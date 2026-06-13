#!/usr/bin/env node
/**
 * Proof for 20260613130000_globe_place_types.sql — Slice 3 place types.
 * Design: docs/plans/2026-06-12-globe-place-types-design.md
 *
 * Asserts on the user's own throwaway fixtures (relative-only, self-cleaning):
 *   1. typed create — a primary + a vacation anchored to it: types stored,
 *      anchor stored, vacation carries globe_pin so get() returns it.
 *   2. spine vs marker — get_residence_pins returns both; only the primary
 *      has a sort_order; the vacation carries type_code + anchor.
 *   3. re-type vacation -> lived_at: it joins the spine (gets a sort_order,
 *      anchor cleared); re-type back -> sort_order NULL, anchor restorable.
 *   4. delete the anchor primary -> the marker's anchor_residence_id goes
 *      NULL (ON DELETE SET NULL); the marker survives.
 *   5. reorder_residence_pins rejects a non-spine id.
 *
 * Run: node scripts/verify-globe-place-types.mjs
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

console.log('Slice 3 place-types proof\n')

const { data: users } = await admin.auth.admin.listUsers()
const user = users.users.find((u) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
const { data: self } = await admin.from('entities').select('id')
  .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
if (!self) { bad('no self entity'); process.exit(1) }

const create = (lng, lat, name, type, anchor) => admin.rpc('create_residence_pin', {
  p_user_id: user.id, p_self_entity_id: self.id, p_lng: lng, p_lat: lat,
  p_name: name, p_place_subtype: 'city', p_country_code: 'XX',
  p_when_text: 'test era', p_body_text: null, p_position: null,
  p_type_code: type, p_anchor_residence_id: anchor ?? null,
})
const getPins = async () => (await admin.rpc('get_residence_pins', { p_user_id: user.id })).data ?? []

let primRel = null, vacRel = null, primPlace = null, vacPlace = null
try {
  // 1. typed create
  const { data: p, error: pe } = await create(10.0, 50.0, 'TESTPIN slice3 primary', 'lived_at', null)
  if (pe) throw new Error('create primary: ' + pe.message)
  const prow = Array.isArray(p) ? p[0] : p
  primRel = prow.relationship_id; primPlace = prow.place_entity_id

  const { data: v, error: ve } = await create(10.5, 50.5, 'TESTPIN slice3 vacation', 'vacationed_at', primRel)
  if (ve) throw new Error('create vacation: ' + ve.message)
  const vrow = Array.isArray(v) ? v[0] : v
  vacRel = vrow.relationship_id; vacPlace = vrow.place_entity_id

  if (prow.sort_order !== null && prow.sort_order >= 0) ok('primary got a sort_order (' + prow.sort_order + ')')
  else bad('primary missing sort_order')
  if (vrow.sort_order === null) ok('vacation has NULL sort_order (off-spine)')
  else bad('vacation wrongly got a sort_order')

  // 2. get returns both, typed + anchored
  let pins = await getPins()
  const gp = pins.find((x) => x.relationship_id === primRel)
  const gv = pins.find((x) => x.relationship_id === vacRel)
  if (gp?.type_code === 'lived_at') ok('get: primary type_code=lived_at'); else bad('primary type_code wrong: ' + gp?.type_code)
  if (gv?.type_code === 'vacationed_at') ok('get: vacation type_code=vacationed_at'); else bad('vacation type_code wrong: ' + gv?.type_code)
  if (gv?.anchor_residence_id === primRel) ok('get: vacation anchored to the primary'); else bad('vacation anchor wrong: ' + gv?.anchor_residence_id)

  // 3. re-type vacation -> lived_at (enters spine), then back
  const { error: re1 } = await admin.rpc('update_residence_pin', {
    p_relationship_id: vacRel, p_user_id: user.id, p_lng: null, p_lat: null,
    p_name: null, p_place_subtype: null, p_country_code: null, p_when_text: 'test era',
    p_body: null, p_type_code: 'lived_at', p_anchor_residence_id: null,
  })
  if (re1) throw new Error('retype to lived_at: ' + re1.message)
  pins = await getPins()
  const asSpine = pins.find((x) => x.relationship_id === vacRel)
  if (asSpine?.type_code === 'lived_at' && asSpine.sort_order !== null && asSpine.anchor_residence_id === null)
    ok('re-type -> lived_at: joined spine (sort_order set, anchor cleared)')
  else bad('re-type to spine wrong: ' + JSON.stringify(asSpine))

  const { error: re2 } = await admin.rpc('update_residence_pin', {
    p_relationship_id: vacRel, p_user_id: user.id, p_lng: null, p_lat: null,
    p_name: null, p_place_subtype: null, p_country_code: null, p_when_text: 'test era',
    p_body: null, p_type_code: 'vacationed_at', p_anchor_residence_id: primRel,
  })
  if (re2) throw new Error('retype back: ' + re2.message)
  pins = await getPins()
  const backMarker = pins.find((x) => x.relationship_id === vacRel)
  if (backMarker?.type_code === 'vacationed_at' && backMarker.sort_order === null && backMarker.anchor_residence_id === primRel)
    ok('re-type back -> marker (sort_order NULL, anchor restored)')
  else bad('re-type back wrong: ' + JSON.stringify(backMarker))

  // 4. delete anchor primary -> marker anchor goes NULL, marker survives
  const { error: de } = await admin.rpc('delete_residence_pin', { p_relationship_id: primRel, p_user_id: user.id })
  if (de) throw new Error('delete primary: ' + de.message)
  primRel = null; primPlace = null
  const { data: vstill } = await admin.from('relationships').select('id, anchor_residence_id').eq('id', vacRel).maybeSingle()
  if (vstill && vstill.anchor_residence_id === null) ok('anchor primary deleted -> marker survives with anchor NULL')
  else bad('SET NULL did not fire as expected: ' + JSON.stringify(vstill))

  // 5. reorder rejects a non-spine id (the vacation marker)
  const { error: rerr } = await admin.rpc('reorder_residence_pins', { p_user_id: user.id, p_ordered_ids: [vacRel] })
  if (rerr) ok('reorder rejected a non-spine id')
  else bad('reorder wrongly accepted a marker id')
} catch (e) {
  bad(e.message)
} finally {
  try { if (vacRel) await admin.rpc('delete_residence_pin', { p_relationship_id: vacRel, p_user_id: user.id }) } catch { /* best effort */ }
  try { if (primRel) await admin.rpc('delete_residence_pin', { p_relationship_id: primRel, p_user_id: user.id }) } catch { /* best effort */ }
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
