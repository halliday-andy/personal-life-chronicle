#!/usr/bin/env node
/**
 * Slice 4a proof — edit / relocate / delete via the update_residence_pin
 * and delete_residence_pin RPCs (the DB layer behind PATCH/DELETE
 * /api/globe/residence/[relationshipId]).
 *
 * Asserts:
 *   - create_residence_pin now makes drafts (is_draft=true)
 *   - draft text edit updates content_raw in place, no revision written
 *   - relocate moves the geom (coords change via get_residence_pins)
 *   - finalized text edit writes a memory_revisions row (original
 *     preserved) and updates content_raw
 *   - delete removes pin + memory + place (+ revisions cascade)
 *
 * Requires migration 20260605140000_globe_slice4_edit_delete.sql.
 * Run: node scripts/verify-globe-slice4.mjs
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
const near = (a, b) => Math.abs(a - b) < 0.0001

console.log('Slice 4a proof (edit / relocate / delete)\n')

const { data: users } = await admin.auth.admin.listUsers()
const user = users.users.find((u) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
const { data: self } = await admin.from('entities').select('id')
  .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
if (!self) { bad('no self entity'); process.exit(1) }

let rel, place, mem
async function getPin() {
  const { data } = await admin.rpc('get_residence_pins', { p_user_id: user.id })
  return data.find((p) => p.relationship_id === rel)
}

try {
  // create — expect draft
  const { data: created, error: cErr } = await admin.rpc('create_residence_pin', {
    p_user_id: user.id, p_self_entity_id: self.id, p_lng: -3.7038, p_lat: 40.4168,
    p_name: 'TESTPIN Madrid', p_place_subtype: 'city', p_country_code: 'ES',
    p_when_text: '1985', p_body_text: 'original draft text',
  })
  if (cErr) throw new Error('create: ' + cErr.message)
  ;({ place_entity_id: place, relationship_id: rel, memory_id: mem } = created[0])
  const { data: m1 } = await admin.from('memories').select('is_draft').eq('id', mem).single()
  m1.is_draft === true ? ok('create_residence_pin makes a draft (is_draft=true)') : bad('expected draft on create')

  // draft edit — in place, no revision
  await admin.rpc('update_residence_pin', {
    p_relationship_id: rel, p_user_id: user.id, p_lng: null, p_lat: null,
    p_name: 'TESTPIN Madrid edited', p_place_subtype: null, p_country_code: null,
    p_when_text: '1985 to 1990', p_body: 'edited draft text',
  })
  const { data: m2 } = await admin.from('memories').select('content_raw, is_draft').eq('id', mem).single()
  m2.content_raw === 'edited draft text' ? ok('draft edit updates content_raw in place') : bad('draft edit failed')
  const { count: rev0 } = await admin.from('memory_revisions').select('*', { count: 'exact', head: true }).eq('source_memory_id', mem)
  rev0 === 0 ? ok('draft edit wrote NO revision') : bad(`draft edit wrote ${rev0} revision(s)`)

  // relocate
  await admin.rpc('update_residence_pin', {
    p_relationship_id: rel, p_user_id: user.id, p_lng: -3.6500, p_lat: 40.5000,
    p_name: null, p_place_subtype: null, p_country_code: null, p_when_text: '1985 to 1990', p_body: 'edited draft text',
  })
  const moved = await getPin()
  moved && near(moved.lng, -3.65) && near(moved.lat, 40.5) ? ok('relocate moved the geom') : bad('relocate did not move coords')

  // finalize, then finalized edit -> revision
  await admin.from('memories').update({ is_draft: false }).eq('id', mem)
  await admin.rpc('update_residence_pin', {
    p_relationship_id: rel, p_user_id: user.id, p_lng: null, p_lat: null,
    p_name: null, p_place_subtype: null, p_country_code: null, p_when_text: '1985 to 1990', p_body: 'final corrected text',
  })
  const { data: rev } = await admin.from('memory_revisions').select('original_excerpt, revised_content, revision_type').eq('source_memory_id', mem)
  const r = rev?.[0]
  r && r.original_excerpt === 'edited draft text' && r.revised_content === 'final corrected text'
    ? ok('finalized edit wrote a revision preserving the original') : bad('finalized edit revision wrong/missing')
  const { data: m3 } = await admin.from('memories').select('content_raw').eq('id', mem).single()
  m3.content_raw === 'final corrected text' ? ok('finalized edit updated content_raw') : bad('finalized content_raw not updated')

  // delete
  await admin.rpc('delete_residence_pin', { p_relationship_id: rel, p_user_id: user.id })
  const gone = await getPin()
  !gone ? ok('delete removed the pin') : bad('pin still present after delete')
  const { data: mGone } = await admin.from('memories').select('id').eq('id', mem).maybeSingle()
  !mGone ? ok('delete removed the memory') : bad('memory still present')
  const { data: eGone } = await admin.from('entities').select('id').eq('id', place).maybeSingle()
  !eGone ? ok('delete removed the place entity') : bad('place entity still present')
  const { count: revGone } = await admin.from('memory_revisions').select('*', { count: 'exact', head: true }).eq('source_memory_id', mem)
  revGone === 0 ? ok('revisions cascade-deleted with the memory') : bad('revisions lingered')
  rel = null
} catch (e) {
  bad('threw: ' + e.message)
} finally {
  if (rel) { await admin.rpc('delete_residence_pin', { p_relationship_id: rel, p_user_id: user.id }); console.log('  · cleaned up test pin') }
}

console.log(`\n${failures === 0 ? 'PASS — Slice 4a edit/relocate/delete works' : `FAIL — ${failures} problem(s)`}`)
process.exit(failures === 0 ? 0 : 1)
