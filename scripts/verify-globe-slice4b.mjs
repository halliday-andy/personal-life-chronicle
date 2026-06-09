#!/usr/bin/env node
/**
 * Slice 4b proof — explicit residence sequence: positional insert and
 * reorder via create_residence_pin(p_position) and reorder_residence_pins
 * (the DB layer behind POST + the new reorder API).
 *
 * Asserts:
 *   - existing residences carry a backfilled sort_order (get returns it)
 *   - create with no position appends at the end
 *   - create with p_position=0 inserts at the front, shifting others up
 *   - create with p_position=k inserts at index k
 *   - reorder_residence_pins rewrites the whole chain order atomically
 *   - reorder rejects an incomplete id list (ownership/coverage guard)
 *
 * Non-destructive: snapshots the user's existing residence order at the
 * start and restores it at the end, after deleting the test pins.
 *
 * Requires migration 20260609000000_globe_slice4b_sequence.sql.
 * Run: node scripts/verify-globe-slice4b.mjs
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

console.log('Slice 4b proof (sequence: positional insert + reorder)\n')

const { data: users } = await admin.auth.admin.listUsers()
const user = users.users.find((u) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
const { data: self } = await admin.from('entities').select('id')
  .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
if (!self) { bad('no self entity'); process.exit(1) }

const pins = async () => (await admin.rpc('get_residence_pins', { p_user_id: user.id })).data ?? []
const ids = (ps) => ps.map((p) => p.relationship_id)
const create = (lng, lat, name, position) =>
  admin.rpc('create_residence_pin', {
    p_user_id: user.id, p_self_entity_id: self.id, p_lng: lng, p_lat: lat,
    p_name: name, p_place_subtype: 'city', p_country_code: 'XX',
    p_when_text: null, p_body_text: null, p_position: position ?? null,
  })

const original = await pins()
const originalIds = ids(original)
const made = []

try {
  // backfill: every existing residence has a non-null, contiguous sort_order
  if (original.length > 0) {
    const orders = original.map((p) => p.sort_order)
    const contiguous = orders.every((o, idx) => o === idx)
    contiguous && orders.every((o) => o !== null)
      ? ok(`existing ${original.length} residence(s) carry a backfilled 0..n sort_order`)
      : bad(`backfill not contiguous from 0: [${orders.join(', ')}]`)
  } else {
    ok('no existing residences (backfill trivially holds)')
  }

  // append (no position) -> lands last
  const { data: cA, error: eA } = await create(10, 10, 'TESTPIN A append')
  if (eA) throw new Error('create A: ' + eA.message)
  made.push(cA[0].relationship_id)
  let cur = await pins()
  cur[cur.length - 1].relationship_id === cA[0].relationship_id && cA[0].sort_order === original.length
    ? ok(`append placed A last (sort_order=${cA[0].sort_order})`)
    : bad(`append did not place A last (got sort_order=${cA[0].sort_order}, last=${cur[cur.length - 1].relationship_id === cA[0].relationship_id})`)

  // insert at front (position 0) -> A and everything shifts up
  const { data: cB, error: eB } = await create(20, 20, 'TESTPIN B front', 0)
  if (eB) throw new Error('create B: ' + eB.message)
  made.push(cB[0].relationship_id)
  cur = await pins()
  cur[0].relationship_id === cB[0].relationship_id && cB[0].sort_order === 0
    ? ok('position=0 inserted B at the front, shifting the rest up')
    : bad(`front insert failed (first=${cur[0].relationship_id}, B.sort_order=${cB[0].sort_order})`)

  // insert at index 1 -> sits right after B
  const { data: cC, error: eC } = await create(30, 30, 'TESTPIN C idx1', 1)
  if (eC) throw new Error('create C: ' + eC.message)
  made.push(cC[0].relationship_id)
  cur = await pins()
  cur[1].relationship_id === cC[0].relationship_id
    ? ok('position=1 inserted C at index 1 (right after B)')
    : bad(`index-1 insert failed (index1=${cur[1].relationship_id}, C=${cC[0].relationship_id})`)

  // reorder: reverse the full chain, then assert it stuck
  const fullNow = ids(await pins())
  const reversed = [...fullNow].reverse()
  const { error: rErr } = await admin.rpc('reorder_residence_pins', { p_user_id: user.id, p_ordered_ids: reversed })
  if (rErr) throw new Error('reorder: ' + rErr.message)
  JSON.stringify(ids(await pins())) === JSON.stringify(reversed)
    ? ok('reorder_residence_pins rewrote the whole chain order')
    : bad('reorder did not produce the requested order')

  // guard: an incomplete list must be rejected
  const { error: gErr } = await admin.rpc('reorder_residence_pins', { p_user_id: user.id, p_ordered_ids: [made[0]] })
  gErr ? ok('reorder rejects an incomplete id list (coverage guard)') : bad('reorder accepted an incomplete list')
} catch (e) {
  bad('threw: ' + e.message)
} finally {
  for (const rel of made) await admin.rpc('delete_residence_pin', { p_relationship_id: rel, p_user_id: user.id })
  if (originalIds.length > 0) {
    await admin.rpc('reorder_residence_pins', { p_user_id: user.id, p_ordered_ids: originalIds })
  }
  console.log('  · cleaned up test pins and restored original order')
}

console.log(`\n${failures === 0 ? 'PASS — Slice 4b sequence (insert + reorder) works' : `FAIL — ${failures} problem(s)`}`)
process.exit(failures === 0 ? 0 : 1)
