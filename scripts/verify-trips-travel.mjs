#!/usr/bin/env node
/**
 * Proof for 20260715130000_trips_travel.sql (plan U1).
 *
 * Asserts, against this script's OWN fixtures (relative-only, live-DB-safe:
 * the one lived_at fixture appends at the spine's end so no real row shifts):
 *   1. create_trip with a destination only → draft (origin NULL), backing
 *      entity of type 'trip' named after the destination.        (AE1, R5)
 *   2. Framing an existing vacation pin as a trip leaves the pin's
 *      relationship row byte-identical.                          (AE2, R14)
 *   3. Guards: bad subtype; lived_at as destination; foreign user.
 *   4. frame_trip sets origin/title/when/year → framed; entity renamed.
 *   5. Stops are leg-aware and ordered: append, positional insert-and-shift,
 *      within-leg reorder, cross-leg reorder REJECTED, destination-as-stop
 *      rejected, remove resequences.                             (AE3, R1)
 *   6. Repeat destination → two distinct trips on one pin.       (R2)
 *   7. Deleting a destination pin is blocked while a trip references it;
 *      after delete_trip the pin deletes fine.                   (KTD1)
 *   8. Deleting the origin pin demotes the trip to draft (SET NULL).
 *   9. delete_trip removes an unreferenced backing entity, keeps one that
 *      carries a jot (no Raw Vault link lost, no zero-link orphan).
 *
 * Cleans up in a finally block; final sweep asserts zero TESTTRIP residue.
 * Run: node scripts/verify-trips-travel.mjs
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

console.log('Trips & Travel data-layer proof\n')

const { data: users } = await admin.auth.admin.listUsers()
const user = users.users.find((u) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
const { data: self } = await admin.from('entities').select('id')
  .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
if (!self) { console.error('no self entity'); process.exit(1) }

const mkPin = (lng, lat, name, type) => admin.rpc('create_residence_pin', {
  p_user_id: user.id, p_self_entity_id: self.id, p_lng: lng, p_lat: lat,
  p_name: name, p_place_subtype: 'city', p_country_code: 'XX',
  p_when_text: null, p_body_text: null, p_position: null,
  p_type_code: type, p_anchor_residence_id: null,
})
const rel = (row) => (Array.isArray(row) ? row[0] : row)
const getTrips = async () => (await admin.rpc('get_trips', { p_user_id: user.id })).data ?? []
const tripById = async (id) => (await getTrips()).find((t) => t.trip_id === id)

const pins = []   // relationship ids for best-effort cleanup
let stubId = null

try {
  // ── Fixtures ─────────────────────────────────────────────────────────
  const home = rel((await mkPin(10, 50, 'TESTTRIP Home', 'lived_at')).data)
  const dest = rel((await mkPin(20, 51, 'TESTTRIP Destination', 'vacationed_at')).data)
  const s1 = rel((await mkPin(21, 52, 'TESTTRIP Stop One', 'logged_at')).data)
  const s2 = rel((await mkPin(22, 53, 'TESTTRIP Stop Two', 'logged_at')).data)
  const s3 = rel((await mkPin(23, 54, 'TESTTRIP Stop Three', 'logged_at')).data)
  for (const p of [home, dest, s1, s2, s3]) {
    if (!p?.relationship_id) { console.error('fixture pin failed'); process.exit(1) }
    pins.push(p.relationship_id)
  }

  // Snapshot the destination pin's relationship row (test 2).
  const { data: destBefore } = await admin.from('relationships').select('*').eq('id', dest.relationship_id).single()

  // ── 1. Destination-only draft ────────────────────────────────────────
  const { data: t1row, error: t1err } = await admin.rpc('create_trip', {
    p_user_id: user.id, p_destination_relationship_id: dest.relationship_id, p_subtype: 'professional',
  })
  if (t1err) { bad('create_trip failed: ' + t1err.message); throw new Error('abort') }
  const trip1 = rel(t1row)
  let t1 = await tripById(trip1.trip_id)
  if (t1 && t1.is_draft && t1.origin_relationship_id === null) ok('destination-only trip saves as draft (AE1)')
  else bad('draft state wrong: ' + JSON.stringify(t1))
  const { data: tent } = await admin.from('entities').select('type, canonical_name').eq('id', trip1.trip_entity_id).single()
  if (tent?.type === 'trip' && tent.canonical_name === 'Trip to TESTTRIP Destination') ok(`backing entity is type 'trip', named after destination`)
  else bad('backing entity wrong: ' + JSON.stringify(tent))

  // ── 2. Framing left the pin untouched ────────────────────────────────
  const { data: destAfter } = await admin.from('relationships').select('*').eq('id', dest.relationship_id).single()
  if (JSON.stringify(destBefore) === JSON.stringify(destAfter)) ok('destination pin row byte-identical after framing (AE2/R14)')
  else bad('destination pin row changed')

  // ── 3. Guards ────────────────────────────────────────────────────────
  const { error: subErr } = await admin.rpc('create_trip', { p_user_id: user.id, p_destination_relationship_id: dest.relationship_id, p_subtype: 'pilgrimage' })
  subErr ? ok('unknown subtype rejected') : bad('unknown subtype accepted')
  const { error: spineErr } = await admin.rpc('create_trip', { p_user_id: user.id, p_destination_relationship_id: home.relationship_id, p_subtype: 'vacation' })
  spineErr ? ok('lived_at as destination rejected') : bad('lived_at destination accepted')
  const { error: foreignErr } = await admin.rpc('create_trip', { p_user_id: '00000000-0000-4000-8000-000000000000', p_destination_relationship_id: dest.relationship_id, p_subtype: 'vacation' })
  foreignErr ? ok(`another user's pin rejected`) : bad('foreign-user create accepted')

  // ── 4. frame_trip ────────────────────────────────────────────────────
  const { error: frameErr } = await admin.rpc('frame_trip', {
    p_user_id: user.id, p_trip_id: trip1.trip_id, p_origin_relationship_id: home.relationship_id,
    p_title: 'TESTTRIP Convention Run', p_when_text: '1980s', p_year_hint: 1984,
  })
  if (frameErr) bad('frame_trip failed: ' + frameErr.message)
  t1 = await tripById(trip1.trip_id)
  if (t1 && !t1.is_draft && t1.origin_relationship_id === home.relationship_id && t1.year_hint === 1984 && t1.when_text === '1980s') ok('framing sets origin/title/when/year → framed')
  else bad('framed state wrong: ' + JSON.stringify(t1))
  const { data: tentRenamed } = await admin.from('entities').select('canonical_name').eq('id', trip1.trip_entity_id).single()
  tentRenamed?.canonical_name === 'TESTTRIP Convention Run' ? ok('title renames the backing entity') : bad('entity not renamed: ' + JSON.stringify(tentRenamed))

  // ── 5. Stops ─────────────────────────────────────────────────────────
  const add = (relId, leg, pos = null) => admin.rpc('add_trip_stop', { p_user_id: user.id, p_trip_id: trip1.trip_id, p_relationship_id: relId, p_leg: leg, p_position: pos })
  const { data: st1 } = await add(s1.relationship_id, 'outbound')
  const { data: st2 } = await add(s2.relationship_id, 'outbound')
  const { data: st3 } = await add(s3.relationship_id, 'return')
  t1 = await tripById(trip1.trip_id)
  let order = t1.stops.map((s) => `${s.leg}:${s.name}`)
  if (JSON.stringify(order) === JSON.stringify(['outbound:TESTTRIP Stop One', 'outbound:TESTTRIP Stop Two', 'return:TESTTRIP Stop Three'])) ok('stops append leg-aware in travel order (AE3)')
  else bad('stop order wrong: ' + JSON.stringify(order))

  const { error: dupErr } = await add(dest.relationship_id, 'outbound')
  dupErr ? ok('destination cannot be an itinerary stop') : bad('destination accepted as stop')

  const { error: reErr } = await admin.rpc('reorder_trip_stops', { p_user_id: user.id, p_trip_id: trip1.trip_id, p_leg: 'outbound', p_ordered_stop_ids: [st2, st1] })
  if (reErr) bad('reorder failed: ' + reErr.message)
  t1 = await tripById(trip1.trip_id)
  order = t1.stops.filter((s) => s.leg === 'outbound').map((s) => s.name)
  if (JSON.stringify(order) === JSON.stringify(['TESTTRIP Stop Two', 'TESTTRIP Stop One'])) ok('within-leg reorder works')
  else bad('reorder order wrong: ' + JSON.stringify(order))

  const { error: crossErr } = await admin.rpc('reorder_trip_stops', { p_user_id: user.id, p_trip_id: trip1.trip_id, p_leg: 'outbound', p_ordered_stop_ids: [st2, st3] })
  crossErr ? ok('cross-leg reorder rejected') : bad('cross-leg reorder accepted')

  const { error: rmErr } = await admin.rpc('remove_trip_stop', { p_user_id: user.id, p_stop_id: st2 })
  if (rmErr) bad('remove_trip_stop failed: ' + rmErr.message)
  t1 = await tripById(trip1.trip_id)
  const s1row = t1.stops.find((s) => s.stop_id === st1)
  s1row && s1row.position === 0 ? ok('remove resequences the leg') : bad('resequence wrong: ' + JSON.stringify(t1.stops))

  // ── 6. Repeat destination ────────────────────────────────────────────
  const trip2 = rel((await admin.rpc('create_trip', { p_user_id: user.id, p_destination_relationship_id: dest.relationship_id, p_subtype: 'vacation' })).data)
  const both = (await getTrips()).filter((t) => t.destination_relationship_id === dest.relationship_id)
  both.length === 2 ? ok('repeat destination → two distinct trips (R2)') : bad('expected 2 trips, got ' + both.length)

  // ── 7. Destination delete blocked ────────────────────────────────────
  const { error: delDestErr } = await admin.rpc('delete_residence_pin', { p_relationship_id: dest.relationship_id, p_user_id: user.id })
  delDestErr ? ok('deleting a trip-destination pin is blocked (unframe first)') : bad('destination pin deleted while trips reference it')

  // ── 8. Origin delete demotes to draft ────────────────────────────────
  const { error: delHomeErr } = await admin.rpc('delete_residence_pin', { p_relationship_id: home.relationship_id, p_user_id: user.id })
  if (delHomeErr) bad('origin pin delete failed: ' + delHomeErr.message)
  else {
    pins.splice(pins.indexOf(home.relationship_id), 1)
    t1 = await tripById(trip1.trip_id)
    t1 && t1.is_draft && t1.origin_relationship_id === null ? ok('deleting the origin pin demotes the trip to draft') : bad('trip after origin delete: ' + JSON.stringify(t1))
  }

  // ── 9. delete_trip and the backing entity ────────────────────────────
  const { data: del2 } = await admin.rpc('delete_trip', { p_user_id: user.id, p_trip_id: trip2.trip_id })
  rel(del2)?.entity_deleted === true ? ok('unreferenced backing entity deleted with its trip') : bad('entity_deleted expected true: ' + JSON.stringify(del2))

  const { data: stub } = await admin.from('memory_stubs')
    .insert({ user_id: user.id, host_entity_id: trip1.trip_entity_id, body: 'TESTTRIP the hotel bar story', created_by: 'owner' })
    .select('id').single()
  stubId = stub?.id
  const { data: del1 } = await admin.rpc('delete_trip', { p_user_id: user.id, p_trip_id: trip1.trip_id })
  rel(del1)?.entity_deleted === false ? ok('backing entity with a jot survives un-framing') : bad('entity_deleted expected false: ' + JSON.stringify(del1))
  const { data: keptEnt } = await admin.from('entities').select('id').eq('id', trip1.trip_entity_id).maybeSingle()
  keptEnt ? ok('surviving trip entity still exists (jot preserved)') : bad('trip entity vanished despite jot')

  // Destination now deletable (no trips reference it).
  const { error: delDest2Err } = await admin.rpc('delete_residence_pin', { p_relationship_id: dest.relationship_id, p_user_id: user.id })
  if (!delDest2Err) { pins.splice(pins.indexOf(dest.relationship_id), 1); ok('destination pin deletes once no trip references it') }
  else bad('destination still blocked after trips deleted: ' + delDest2Err.message)

  // Clean the kept entity (stub cascades on entity delete).
  await admin.from('entities').delete().eq('id', trip1.trip_entity_id)
} finally {
  for (const id of pins) {
    try { await admin.rpc('delete_residence_pin', { p_relationship_id: id, p_user_id: user.id }) } catch { /* best effort */ }
  }
  await admin.from('entities').delete().eq('user_id', user.id).ilike('canonical_name', 'TESTTRIP%')
  await admin.from('entities').delete().eq('user_id', user.id).ilike('canonical_name', 'Trip to TESTTRIP%')
  const { data: leftE } = await admin.from('entities').select('id').or('canonical_name.ilike.TESTTRIP%,canonical_name.ilike.Trip to TESTTRIP%')
  const { data: leftT } = await admin.from('trips').select('id').eq('user_id', user.id)
  const residualTrips = (leftT ?? []).length // all fixture trips were deleted above; real trips shouldn't exist yet
  if ((leftE ?? []).length === 0) ok('cleanup complete — no TESTTRIP residue')
  else bad('TESTTRIP residue remains: ' + JSON.stringify(leftE))
  if (residualTrips === 0) ok('no trip rows left behind')
  else console.log(`  · ${residualTrips} trip row(s) present (pre-existing or real data — not fixture residue)`)
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
