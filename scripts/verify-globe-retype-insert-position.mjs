#!/usr/bin/env node
/**
 * Proof for re-type-to-primary insert position (QA §12 follow-up, 2026-06-24).
 *
 * When a marker (e.g. a vacation anchored to a home) is re-typed to a primary,
 * it should join the spine RIGHT AFTER the home it was anchored to — not append
 * at the end of the sequence.
 *
 * Relative-only against this script's own fixtures; self-cleaning.
 * Run: node scripts/verify-globe-retype-insert-position.mjs
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

console.log('Globe re-type insert position proof\n')

const { data: users } = await admin.auth.admin.listUsers()
const user = users.users.find((u) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
const { data: self } = await admin.from('entities').select('id')
  .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
if (!self) { bad('no self entity'); process.exit(1) }

const mk = (lng, lat, name, type, anchor) => admin.rpc('create_residence_pin', {
  p_user_id: user.id, p_self_entity_id: self.id, p_lng: lng, p_lat: lat,
  p_name: name, p_place_subtype: 'city', p_country_code: 'XX',
  p_when_text: null, p_body_text: null, p_position: null, p_type_code: type, p_anchor_residence_id: anchor ?? null,
})
const rel = (row) => (Array.isArray(row) ? row[0] : row)
const created = []

const spineIds = async () => {
  const { data } = await admin.rpc('get_residence_pins', { p_user_id: user.id })
  return (data ?? []).filter((p) => p.type_code === 'lived_at').map((p) => p.relationship_id)
}

try {
  const P1 = rel((await mk(0, 60, 'TESTPIN insert P1', 'lived_at', null)).data).relationship_id; created.push(P1)
  const P2 = rel((await mk(1, 61, 'TESTPIN insert P2', 'lived_at', null)).data).relationship_id; created.push(P2)
  const P3 = rel((await mk(2, 62, 'TESTPIN insert P3', 'lived_at', null)).data).relationship_id; created.push(P3)
  const V  = rel((await mk(3, 63, 'TESTPIN insert V', 'vacationed_at', P1)).data).relationship_id; created.push(V)

  const { error: e } = await admin.rpc('update_residence_pin', {
    p_relationship_id: V, p_user_id: user.id, p_lng: null, p_lat: null,
    p_name: null, p_place_subtype: null, p_country_code: null, p_when_text: null,
    p_body: null, p_type_code: 'lived_at', p_anchor_residence_id: null,
  })
  if (e) throw new Error('retype V→primary: ' + e.message)

  const spine = await spineIds()
  const iP1 = spine.indexOf(P1), iV = spine.indexOf(V), iP2 = spine.indexOf(P2)
  if (iV === iP1 + 1) ok('re-typed pin lands immediately AFTER its anchor home (P1 → V)')
  else bad(`V is not right after P1: P1@${iP1}, V@${iV}, P2@${iP2}`)
  if (iP2 === iV + 1) ok('the home that was after the anchor (P2) shifted down by one')
  else bad(`P2 not after V: V@${iV}, P2@${iP2}`)
} catch (e) {
  bad(e.message)
} finally {
  for (const id of created.reverse()) {
    try { await admin.rpc('delete_residence_pin', { p_relationship_id: id, p_user_id: user.id }) } catch { /* best effort */ }
  }
  const { data: ents } = await admin.from('entities').select('id').eq('user_id', user.id).like('canonical_name', 'TESTPIN insert %')
  for (const en of ents ?? []) {
    await admin.from('memory_entities').delete().eq('entity_id', en.id)
    await admin.from('relationships').delete().eq('object_id', en.id)
    await admin.from('entities').delete().eq('id', en.id)
  }
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
