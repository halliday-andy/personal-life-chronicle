#!/usr/bin/env node
/**
 * Slice 4b proof — nearest_residence proximity probe (the DB layer behind
 * the returning / intra-metro hints in POST + PATCH /api/globe/residence).
 *
 * Asserts (with two pins a known distance apart):
 *   - nearest_residence finds the other pin and reports a sane distance
 *     (Madrid ↔ a point ~3 km away → between 2 and 4 km)
 *   - probing AT a pin's exact location returns ~0 km (metric sanity)
 *   - p_exclude_rel excludes a pin from its own probe
 *
 * Distances are asserted only between this script's own pins (the user
 * may have real residences that are nearer to an arbitrary probe point),
 * so no absolute-distance assumption about the wider data set is made.
 *
 * Non-destructive: creates two temp pins and deletes them.
 * Requires migration 20260609010000_globe_slice4b_proximity.sql.
 * Run: node scripts/verify-globe-proximity.mjs
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

console.log('Slice 4b proof (nearest_residence proximity probe)\n')

const { data: users } = await admin.auth.admin.listUsers()
const user = users.users.find((u) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
const { data: self } = await admin.from('entities').select('id')
  .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
if (!self) { bad('no self entity'); process.exit(1) }

const create = (lng, lat, name) =>
  admin.rpc('create_residence_pin', {
    p_user_id: user.id, p_self_entity_id: self.id, p_lng: lng, p_lat: lat,
    p_name: name, p_place_subtype: 'city', p_country_code: 'XX',
    p_when_text: null, p_body_text: null, p_position: null,
  })

// Madrid, and a point ~3 km north-east of it.
const MAD = { lng: -3.7038, lat: 40.4168 }
const NEAR = { lng: -3.6738, lat: 40.4318 }
const made = []

try {
  const { data: a, error: ea } = await create(MAD.lng, MAD.lat, 'TESTPIN prox base')
  if (ea) throw new Error('create base: ' + ea.message)
  made.push(a[0].relationship_id)
  const { data: b, error: eb } = await create(NEAR.lng, NEAR.lat, 'TESTPIN prox near')
  if (eb) throw new Error('create near: ' + eb.message)
  made.push(b[0].relationship_id)

  // Probe the NEAR location, excluding itself -> should find the base pin.
  const { data: n1, error: e1 } = await admin.rpc('nearest_residence', {
    p_user_id: user.id, p_lng: NEAR.lng, p_lat: NEAR.lat, p_exclude_rel: b[0].relationship_id,
  })
  if (e1) throw new Error('nearest near: ' + e1.message)
  const hit = Array.isArray(n1) ? n1[0] : n1
  const km = hit ? hit.distance_m / 1000 : NaN
  hit?.relationship_id === a[0].relationship_id
    ? ok('nearest_residence found the other pin')
    : bad('nearest_residence did not find the base pin')
  km > 2 && km < 4
    ? ok(`distance is sane (~${km.toFixed(2)} km, expected 2–4)`)
    : bad(`distance off: ${km} km (expected 2–4)`)

  // Probe AT the base pin, excluding the near pin -> returns base at ~0 km.
  const { data: n2 } = await admin.rpc('nearest_residence', {
    p_user_id: user.id, p_lng: MAD.lng, p_lat: MAD.lat, p_exclude_rel: b[0].relationship_id,
  })
  const atBase = Array.isArray(n2) ? n2[0] : n2
  atBase?.relationship_id === a[0].relationship_id && atBase.distance_m < 100
    ? ok(`probing at a pin returns ~0 km (${atBase.distance_m.toFixed(1)} m)`)
    : bad(`zero-distance probe unexpected: ${atBase ? atBase.distance_m + ' m' : 'none'}`)

  // Exclude guard — excluding the base, probing AT the base, with only the
  // near pin remaining -> returns the near pin (not the excluded base).
  const { data: n3 } = await admin.rpc('nearest_residence', {
    p_user_id: user.id, p_lng: MAD.lng, p_lat: MAD.lat, p_exclude_rel: a[0].relationship_id,
  })
  const ex = Array.isArray(n3) ? n3[0] : n3
  ex?.relationship_id === b[0].relationship_id
    ? ok('p_exclude_rel excludes the named pin from its own probe')
    : bad('p_exclude_rel did not exclude correctly')
} catch (e) {
  bad('threw: ' + e.message)
} finally {
  for (const rel of made) await admin.rpc('delete_residence_pin', { p_relationship_id: rel, p_user_id: user.id })
  console.log('  · cleaned up test pins')
}

console.log(`\n${failures === 0 ? 'PASS — nearest_residence probe works' : `FAIL — ${failures} problem(s)`}`)
process.exit(failures === 0 ? 0 : 1)
