#!/usr/bin/env node
/**
 * Proof for 20260611100000_globe_pin_memory_scoping.sql — pin edit and
 * delete touch ONLY the pin's own globe-authored recollection.
 *
 * Fixture: one temp pin (with a globe memory) + one extra 'freeform'
 * memory linked to the same place entity (simulating a capture-assistant
 * recollection that mentions the place).
 *
 * Asserts:
 *   1. update_residence_pin edits the globe memory, not the freeform one
 *   2. delete_residence_pin removes the globe memory but the freeform
 *      memory survives the pin's deletion
 *
 * Relative-only assertions against this script's own fixtures; cleans up
 * after itself. Run: node scripts/verify-globe-pin-memory-scoping.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(projectRoot, '.env.local'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('='); if (i < 0) continue
  const k = line.slice(0, i).trim(); if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let failures = 0
const ok = (m) => console.log(`  ✓ ${m}`)
const bad = (m) => { console.error(`  ✗ ${m}`); failures++ }

console.log('Pin memory scoping proof\n')

const { data: users } = await admin.auth.admin.listUsers()
const user = users.users.find((u) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
const { data: self } = await admin.from('entities').select('id')
  .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
if (!self) { bad('no self entity'); process.exit(1) }

let relId, placeId, globeMemId, extraMemId
try {
  // ── Fixture ──
  const { data: pin, error: ce } = await admin.rpc('create_residence_pin', {
    p_user_id: user.id, p_self_entity_id: self.id, p_lng: 151.2, p_lat: -33.86,
    p_name: 'TESTPIN scoping', p_place_subtype: 'city', p_country_code: 'XX',
    p_when_text: 'test era', p_body_text: 'GLOBE ORIGINAL recollection.', p_position: null,
  })
  if (ce) throw new Error('create: ' + ce.message)
  const row = Array.isArray(pin) ? pin[0] : pin
  relId = row.relationship_id; placeId = row.place_entity_id; globeMemId = row.memory_id

  const { data: extra, error: me } = await admin.from('memories').insert({
    user_id: user.id, content_raw: 'EXTRA capture-assistant recollection mentioning the place.',
    source: 'text_entry', capture_mode: 'freeform', is_draft: false,
  }).select('id').single()
  if (me) throw new Error('extra memory: ' + me.message)
  extraMemId = extra.id
  // Link it to the same place, role=location — created BEFORE the edit
  // test so the unscoped LIMIT 1 would have had two candidates.
  const { error: le } = await admin.from('memory_entities').insert({
    memory_id: extraMemId, entity_id: placeId, role: 'location', is_primary: false,
  })
  if (le) throw new Error('link: ' + le.message)

  // ── 1. Edit targets only the globe memory ──
  const { error: ue } = await admin.rpc('update_residence_pin', {
    p_relationship_id: relId, p_user_id: user.id, p_lng: null, p_lat: null,
    p_name: null, p_place_subtype: null, p_country_code: null,
    p_when_text: 'test era', p_body: 'GLOBE EDITED recollection.',
  })
  if (ue) throw new Error('update: ' + ue.message)
  const { data: gm } = await admin.from('memories').select('content_raw').eq('id', globeMemId).single()
  const { data: xm } = await admin.from('memories').select('content_raw').eq('id', extraMemId).single()
  if (gm.content_raw === 'GLOBE EDITED recollection.') ok('edit updated the globe memory')
  else bad(`edit missed the globe memory (now: ${JSON.stringify(gm.content_raw)})`)
  if (xm.content_raw.startsWith('EXTRA')) ok('edit left the extra memory untouched')
  else bad(`edit clobbered the extra memory (now: ${JSON.stringify(xm.content_raw)})`)

  // ── 2. Delete removes globe memory, spares the extra one ──
  const { error: de } = await admin.rpc('delete_residence_pin', {
    p_relationship_id: relId, p_user_id: user.id,
  })
  if (de) throw new Error('delete: ' + de.message)
  relId = null // deleted
  const { data: gGone } = await admin.from('memories').select('id').eq('id', globeMemId).maybeSingle()
  const { data: xAlive } = await admin.from('memories').select('id').eq('id', extraMemId).maybeSingle()
  if (!gGone) ok('pin delete removed the globe memory')
  else bad('globe memory survived pin delete')
  if (xAlive) ok('pin delete spared the extra (non-globe) memory')
  else bad('pin delete DESTROYED the extra memory — scoping failed')
  const { data: pGone } = await admin.from('entities').select('id').eq('id', placeId).maybeSingle()
  if (!pGone) { ok('place entity removed (unreferenced)'); placeId = null }
} catch (e) {
  bad(e.message)
} finally {
  // ── Cleanup ──
  if (relId) await admin.rpc('delete_residence_pin', { p_relationship_id: relId, p_user_id: user.id }).catch(() => {})
  if (extraMemId) await admin.from('memories').delete().eq('id', extraMemId)
  if (placeId) {
    await admin.from('memory_entities').delete().eq('entity_id', placeId)
    await admin.from('entities').delete().eq('id', placeId)
  }
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
