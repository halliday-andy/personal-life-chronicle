#!/usr/bin/env node
/**
 * Slice 1 persistence proof — exercises the create_residence_pin /
 * get_residence_pins RPCs (the DB layer behind /api/globe/residence)
 * end to end, then cleans up.
 *
 * Asserts:
 *   - a pin WITH a narrative creates entity + relationship + memory +
 *     memory_entities link, all correctly shaped
 *   - a pin WITHOUT a narrative creates entity + relationship only
 *     (memory_id null, has_memory false)
 *   - get_residence_pins returns both with correct coordinates, in
 *     placement order
 *
 * Requires migration 20260605120000_globe_residence_functions.sql to be
 * applied. Run: node scripts/verify-globe-residence.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(projectRoot, '.env.local'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i).trim()
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

let failures = 0
const ok = (m) => console.log(`  ✓ ${m}`)
const bad = (m) => { console.error(`  ✗ ${m}`); failures++ }
const near = (a, b) => Math.abs(a - b) < 0.0001

console.log('Slice 1 persistence proof\n')

// Resolve the dev user + self entity.
const { data: users } = await admin.auth.admin.listUsers()
const user = users.users.find((u) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
const { data: self } = await admin
  .from('entities').select('id')
  .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true')
  .limit(1).maybeSingle()
if (!self) { bad('no self entity for dev user — run backfill-self-entity.mjs'); process.exit(1) }
ok(`resolved user ${user.email} + self entity ${self.id.slice(0, 8)}`)

const created = []  // {place, rel, mem}

async function place(args) {
  const { data, error } = await admin.rpc('create_residence_pin', {
    p_user_id: user.id, p_self_entity_id: self.id, ...args,
  })
  if (error) throw new Error(error.message)
  const row = data[0]
  created.push({ place: row.place_entity_id, rel: row.relationship_id, mem: row.memory_id })
  return row
}

try {
  // 1. Pin WITH narrative — Madrid.
  const madrid = await place({
    p_lng: -3.7038, p_lat: 40.4168, p_name: 'Madrid (TEST — delete me)',
    p_place_subtype: 'city', p_country_code: 'ES',
    p_when_text: '1985–1990', p_body_text: 'A test residence. Safe to delete.',
  })
  madrid.memory_id ? ok('pin with narrative created a memory') : bad('expected a memory_id')

  // 2. Pin WITHOUT narrative — London.
  const london = await place({
    p_lng: -0.1276, p_lat: 51.5074, p_name: 'London (TEST — delete me)',
    p_place_subtype: 'city', p_country_code: 'GB',
    p_when_text: null, p_body_text: null,
  })
  london.memory_id === null ? ok('pin without narrative created NO memory') : bad('expected null memory_id')

  // 3. Verify the underlying rows for the Madrid pin.
  const { data: rel } = await admin.from('relationships')
    .select('subject_id, object_id, type_id, metadata').eq('id', madrid.relationship_id).single()
  rel.subject_id === self.id ? ok('relationship subject = self entity') : bad('relationship subject mismatch')
  rel.metadata?.is_primary === true ? ok("relationship metadata.is_primary = true") : bad('is_primary not set')
  rel.metadata?.when_text === '1985–1990' ? ok('when_text stored on relationship') : bad('when_text missing')

  const { data: mem } = await admin.from('memories')
    .select('capture_mode, authored_by_actor, occurred_at_fuzzy').eq('id', madrid.memory_id).single()
  mem.capture_mode === 'globe_onboarding' ? ok("memory capture_mode = globe_onboarding") : bad('capture_mode wrong')
  mem.authored_by_actor === 'owner' ? ok("memory authored_by_actor = owner") : bad('authored_by_actor wrong')

  const { data: link } = await admin.from('memory_entities')
    .select('role, is_primary').eq('memory_id', madrid.memory_id).eq('entity_id', madrid.place_entity_id).maybeSingle()
  link?.role === 'location' && link?.is_primary ? ok("memory_entities link role=location is_primary") : bad('link missing/wrong')

  // 4. get_residence_pins returns both, with correct coords, in order.
  const { data: pins, error: getErr } = await admin.rpc('get_residence_pins', { p_user_id: user.id })
  if (getErr) throw new Error(getErr.message)
  const m = pins.find((p) => p.place_entity_id === madrid.place_entity_id)
  const l = pins.find((p) => p.place_entity_id === london.place_entity_id)
  m && near(m.lng, -3.7038) && near(m.lat, 40.4168) ? ok('Madrid coords round-trip correctly') : bad('Madrid coords wrong')
  l && near(l.lng, -0.1276) && near(l.lat, 51.5074) ? ok('London coords round-trip correctly') : bad('London coords wrong')
  m?.has_memory === true && l?.has_memory === false ? ok('has_memory flags correct') : bad('has_memory flags wrong')
  // Placement order: Madrid placed before London.
  const mi = pins.findIndex((p) => p.place_entity_id === madrid.place_entity_id)
  const li = pins.findIndex((p) => p.place_entity_id === london.place_entity_id)
  mi < li ? ok('pins returned in placement order') : bad('placement order wrong')
} catch (e) {
  bad(`threw: ${e.message}`)
} finally {
  // Cleanup — memories first (cascades the link), then relationships, then entities.
  for (const c of created) {
    if (c.mem) await admin.from('memories').delete().eq('id', c.mem)
    await admin.from('relationships').delete().eq('id', c.rel)
    await admin.from('entities').delete().eq('id', c.place)
  }
  console.log(`  ✓ cleaned up ${created.length} test pin(s)`)
}

console.log(`\n${failures === 0 ? 'PASS — Slice 1 persistence works' : `FAIL — ${failures} problem(s)`}`)
process.exit(failures === 0 ? 0 : 1)
