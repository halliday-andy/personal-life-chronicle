#!/usr/bin/env node
/**
 * Proof for the recollection roll-up data path (Slice 3.6c).
 *
 * The pin detail route lists pins anchored to a given pin, with their globe
 * recollection excerpt, so a Log's memory surfaces under its anchor. This
 * replicates the route's queries: anchor lookup → entity name → type code →
 * globe memory excerpt.
 *
 * Relative-only against this script's own fixtures; self-cleaning.
 * Run: node scripts/verify-globe-recollection-rollup.mjs
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

console.log('Globe recollection roll-up proof\n')

const { data: users } = await admin.auth.admin.listUsers()
const user = users.users.find((u) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
const { data: self } = await admin.from('entities').select('id')
  .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
if (!self) { bad('no self entity'); process.exit(1) }

const rel = (row) => (Array.isArray(row) ? row[0] : row)
const created = []
const BODY = 'ROLLUP a memorable afternoon at the lookout'

try {
  const { data: pd } = await admin.rpc('create_residence_pin', {
    p_user_id: user.id, p_self_entity_id: self.id, p_lng: 1, p_lat: 40,
    p_name: 'TESTPIN roll P', p_place_subtype: 'city', p_country_code: 'XX',
    p_when_text: null, p_body_text: null, p_position: null, p_type_code: 'lived_at', p_anchor_residence_id: null,
  })
  const P = rel(pd).relationship_id; created.push(P)

  const { data: ld, error: el } = await admin.rpc('create_residence_pin', {
    p_user_id: user.id, p_self_entity_id: self.id, p_lng: 2, p_lat: 41,
    p_name: 'TESTPIN roll L', p_place_subtype: 'city', p_country_code: 'XX',
    p_when_text: null, p_body_text: BODY, p_position: null, p_type_code: 'logged_at', p_anchor_residence_id: P,
  })
  if (el) throw new Error('Log create: ' + el.message)
  const L = rel(ld).relationship_id; created.push(L)
  const Lplace = rel(ld).place_entity_id

  // Route step 1: pins anchored to P.
  const { data: anchoredRels } = await admin
    .from('relationships').select('id, object_id, type_id').eq('anchor_residence_id', P).eq('user_id', user.id)
  const hit = (anchoredRels ?? []).find((r) => r.id === L)
  if (hit) ok('Log L is discoverable via anchor_residence_id = P')
  else bad('Log L not found among pins anchored to P')

  // Route step 2: its globe recollection excerpt.
  const { data: mems } = await admin
    .from('memories').select('content_raw, memory_entities!inner(entity_id, role)')
    .eq('memory_entities.entity_id', Lplace).eq('memory_entities.role', 'location')
    .eq('capture_mode', 'globe_onboarding').eq('user_id', user.id)
  const excerpt = (mems ?? [])[0]?.content_raw ?? ''
  if (excerpt.startsWith('ROLLUP')) ok('Log L’s globe recollection excerpt is fetchable for the roll-up')
  else bad('roll-up excerpt missing/wrong: ' + JSON.stringify(excerpt.slice(0, 40)))
} catch (e) {
  bad(e.message)
} finally {
  for (const id of created.reverse()) {
    try { await admin.rpc('delete_residence_pin', { p_relationship_id: id, p_user_id: user.id }) } catch { /* best effort */ }
  }
  const { data: ents } = await admin.from('entities').select('id').eq('user_id', user.id).like('canonical_name', 'TESTPIN roll %')
  for (const e of ents ?? []) {
    await admin.from('memory_entities').delete().eq('entity_id', e.id)
    await admin.from('relationships').delete().eq('object_id', e.id)
    await admin.from('entities').delete().eq('id', e.id)
  }
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
