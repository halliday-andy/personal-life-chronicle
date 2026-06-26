#!/usr/bin/env node
/**
 * Slice 4b proof — explicit residence sequence: positional insert and
 * reorder via create_residence_pin(p_position) and reorder_residence_pins
 * (the DB layer behind POST + the reorder API).
 *
 * Proves (relative-only, against THIS script's own TESTPIN fixtures):
 *   - existing residences carry a backfilled, non-null, monotonic sort_order
 *   - create with no position appends after everything else
 *   - create with p_position=k opens a gap at index k, shifting later pins up
 *   - reorder_residence_pins rewrites the whole chain order atomically
 *   - reorder rejects an incomplete id list (ownership/coverage guard)
 *
 * SAFETY (this script runs against the LIVE shared DB with real data):
 *   - It never asserts contiguous-from-0 or any absolute sort_order/count;
 *     it only asserts relative ordering between its own fixtures and that the
 *     real spine is untouched.
 *   - Its fixtures are always APPENDED first (so they sort above every real
 *     pin); the positional-insert test then inserts at a fixture's index, so
 *     the insert-and-shift only ever moves fixtures, never the real spine.
 *   - The reorder test supplies the FULL ordered id list (real pins in their
 *     original order, then the fixtures) so the coverage guard is satisfied
 *     and the real pins keep their positions; the guard test deliberately
 *     supplies a partial list and expects rejection (no mutation).
 *   - A finally block deletes the fixtures and restores every real pin's
 *     sort_order to its exact pre-run value, regardless of where we threw.
 *   - Finally, it re-snapshots the spine and asserts ids + sort_orders are
 *     byte-for-byte identical to the pre-run snapshot — proving no mutation
 *     leaked onto real user data.
 *
 * This is the verify-globe-proximity lesson (see
 * memory/project_lc_build_progress.md): verify scripts run against the live
 * shared DB; assert only relative properties between the script's own
 * fixtures, never absolute distances/counts that assume an empty DB.
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
const rel = (row) => (Array.isArray(row) ? row[0] : row)
const create = (lng, lat, name, position) =>
  admin.rpc('create_residence_pin', {
    p_user_id: user.id, p_self_entity_id: self.id, p_lng: lng, p_lat: lat,
    p_name: name, p_place_subtype: 'city', p_country_code: 'XX',
    p_when_text: null, p_body_text: null, p_position: position ?? null,
  })

// Pre-run snapshot of the REAL spine — the invariant we must not disturb.
const original = await pins()
const originalIds = ids(original)
const originalOrders = original.map((p) => p.sort_order)
const created = []

try {
  // ── backfill: existing residences carry a non-null, strictly-increasing
  //    sort_order. Relative-only: NOT "contiguous from 0" (a populated DB's
  //    base need not be 0), just monotonic and present.
  if (original.length > 0) {
    const allNonNull = originalOrders.every((o) => o !== null)
    const monotonic = originalOrders.every((o, idx) => idx === 0 || o > originalOrders[idx - 1])
    allNonNull && monotonic
      ? ok(`existing ${original.length} residence(s) carry a non-null, strictly-increasing sort_order`)
      : bad(`backfill not non-null/monotonic: [${originalOrders.join(', ')}]`)
  } else {
    ok('no existing residences (backfill trivially holds)')
  }

  // ── append (no position): three fixtures land at the tail, in creation
  //    order, each with a strictly greater sort_order than the previous.
  const a1 = rel((await create(10, 10, 'TESTPIN seq A1')).data)
  if (!a1) throw new Error('create A1 returned no row')
  created.push(a1.relationship_id)
  const a2 = rel((await create(11, 11, 'TESTPIN seq A2')).data)
  if (!a2) throw new Error('create A2 returned no row')
  created.push(a2.relationship_id)
  const a3 = rel((await create(12, 12, 'TESTPIN seq A3')).data)
  if (!a3) throw new Error('create A3 returned no row')
  created.push(a3.relationship_id)

  a1.sort_order < a2.sort_order && a2.sort_order < a3.sort_order
    ? ok('append assigns each new pin a strictly greater sort_order than the last')
    : bad(`append not monotonic: A1=${a1.sort_order}, A2=${a2.sort_order}, A3=${a3.sort_order}`)

  let cur = ids(await pins())
  const lastRealIdx = originalIds.length ? Math.max(...originalIds.map((id) => cur.indexOf(id))) : -1
  cur.indexOf(a1.relationship_id) > lastRealIdx &&
  cur.indexOf(a1.relationship_id) < cur.indexOf(a2.relationship_id) &&
  cur.indexOf(a2.relationship_id) < cur.indexOf(a3.relationship_id) &&
  cur[cur.length - 1] === a3.relationship_id
    ? ok('appended fixtures sit, in creation order, after every real pin (A3 last)')
    : bad('appended fixtures not in creation order at the tail')

  // ── positional insert AMONG THE FIXTURES: insert X at A2's index. Because
  //    the fixtures sort above every real pin, the insert-and-shift moves
  //    only A2/A3 — the real spine (all below this index) is never touched.
  const a2Index = a2.sort_order
  const x = rel((await create(13, 13, 'TESTPIN seq X', a2Index)).data)
  if (!x) throw new Error('create X returned no row')
  created.push(x.relationship_id)
  x.sort_order === a2Index
    ? ok(`positional insert opened a gap at A2's index (X.sort_order=${x.sort_order})`)
    : bad(`positional insert wrong sort_order: X=${x.sort_order}, expected ${a2Index}`)

  cur = ids(await pins())
  const iA1 = cur.indexOf(a1.relationship_id)
  const iX = cur.indexOf(x.relationship_id)
  const iA2 = cur.indexOf(a2.relationship_id)
  iA1 < iX && iX < iA2
    ? ok('inserted X lands between A1 and the shifted-up A2 (insert-and-shift)')
    : bad(`insert position wrong: A1@${iA1}, X@${iX}, A2@${iA2}`)

  // ── reorder: the RPC requires the FULL ordered id list of the user's
  //    residences. Build it as [real pins in their original order, then the
  //    fixtures] so the real pins keep their positions, and flip just the
  //    fixtures to prove the rewrite took effect atomically.
  const fixOrderA = [a1.relationship_id, x.relationship_id, a2.relationship_id, a3.relationship_id]
  const fixOrderB = [...fixOrderA].reverse()

  const { error: rA } = await admin.rpc('reorder_residence_pins', { p_user_id: user.id, p_ordered_ids: [...originalIds, ...fixOrderA] })
  if (rA) throw new Error('reorder A: ' + rA.message)
  let now = ids(await pins())
  const posA = fixOrderA.map((id) => now.indexOf(id))
  posA.every((v, i) => i === 0 || v > posA[i - 1])
    ? ok('reorder placed the fixtures in the requested order')
    : bad('reorder did not yield the requested fixture order')

  const { error: rB } = await admin.rpc('reorder_residence_pins', { p_user_id: user.id, p_ordered_ids: [...originalIds, ...fixOrderB] })
  if (rB) throw new Error('reorder B: ' + rB.message)
  now = ids(await pins())
  const posB = fixOrderB.map((id) => now.indexOf(id))
  posB.every((v, i) => i === 0 || v > posB[i - 1])
    ? ok('reorder flipped the fixtures to the reversed order (atomic rewrite)')
    : bad('reorder did not yield the reversed fixture order')

  // real spine kept its relative order through both reorders
  const posReal = originalIds.map((id) => now.indexOf(id))
  posReal.every((v, i) => (i === 0 || v > posReal[i - 1]) && v !== -1)
    ? ok('real spine kept its relative order through the reorder')
    : bad('real spine relative order changed during reorder')

  // ── guard: an incomplete list (fixtures only, missing the real pins) is
  //    rejected by the coverage guard. This errors WITHOUT mutating.
  const { error: gErr } = await admin.rpc('reorder_residence_pins', { p_user_id: user.id, p_ordered_ids: fixOrderA })
  gErr ? ok('reorder rejects an incomplete id list (coverage guard)') : bad('reorder accepted an incomplete list')
} catch (e) {
  bad('threw: ' + e.message)
} finally {
  // Delete the fixtures, then restore every real pin to its exact pre-run
  // sort_order — regardless of where we threw above.
  for (const id of created.reverse()) {
    try { await admin.rpc('delete_residence_pin', { p_relationship_id: id, p_user_id: user.id }) } catch { /* best effort */ }
  }
  for (let i = 0; i < originalIds.length; i++) {
    try {
      await admin.from('relationships').update({ sort_order: originalOrders[i] }).eq('id', originalIds[i]).eq('user_id', user.id)
    } catch (e) { bad('restore failed for ' + originalIds[i] + ': ' + e.message) }
  }
  // sweep any leftover test entities
  const { data: ents } = await admin.from('entities').select('id').eq('user_id', user.id).like('canonical_name', 'TESTPIN seq %')
  for (const en of ents ?? []) {
    await admin.from('memory_entities').delete().eq('entity_id', en.id)
    await admin.from('relationships').delete().eq('object_id', en.id)
    await admin.from('entities').delete().eq('id', en.id)
  }
  console.log('  · cleaned up test pins and restored original spine order')
}

// ── PROOF: the real spine is byte-for-byte what it was before the run.
const after = await pins()
const sameIds = JSON.stringify(ids(after)) === JSON.stringify(originalIds)
const sameOrders = JSON.stringify(after.map((p) => p.sort_order)) === JSON.stringify(originalOrders)
sameIds && sameOrders
  ? ok('real spine unchanged after run (ids + sort_orders identical to pre-run snapshot)')
  : bad(`spine MUTATED — ids ${sameIds ? 'ok' : 'CHANGED'}, sort_orders ${sameOrders ? 'ok' : 'CHANGED'}`)

console.log(`\n${failures === 0 ? 'PASS — Slice 4b sequence (insert + reorder) works, real spine intact' : `FAIL — ${failures} problem(s)`}`)
process.exit(failures === 0 ? 0 : 1)
