#!/usr/bin/env node
/**
 * Proof for 20260803120000_trip_destination_guard_removed.sql (R6 / F6).
 *
 * The "a primary residence cannot be a trip destination" rule was removed.
 * Its premise was unsound: pin types describe the PRESENT, trips describe
 * the PAST, so any rule keyed on a destination's current type misjudges a
 * life in which places change role. Andy's case: a round trip to view a
 * house under construction, which becomes home six months later — the
 * journey never changed, the world did, and the trip became unsaveable.
 *
 * Asserts, read-only — nothing is created, so this can run any time:
 *   1. exactly ONE validate_trip_pin, taking TWO arguments (the dropped
 *      p_allow_spine must leave no orphan overload — the 2026-07-26 trap);
 *   2. its three callers survive with their signatures unchanged;
 *   3. a SPINE pin passes validation (the case that used to raise);
 *   4. ownership is still enforced — a stranger's id still raises;
 *   5. the old exception text is gone from the function source;
 *   6. add_trip_stop STILL refuses the destination as an itinerary stop —
 *      that rule is about a trip's own shape, not a pin's type, and was
 *      deliberately kept.
 *
 * Run: node scripts/verify-trip-destination-guard.mjs
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(projectRoot, '.env.local'), 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

let failures = 0
const ok = (m) => console.log('  ✓ ' + m)
const bad = (m) => { console.error('  ✗ ' + m); failures++ }

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

try {
  // 1 + 2. Signatures — no orphan overloads anywhere in the family.
  const { rows: fns } = await client.query(`
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('validate_trip_pin','create_trip','frame_trip','add_trip_stop')`)

  const byName = (n) => fns.filter((f) => f.proname === n)
  const v = byName('validate_trip_pin')
  v.length === 1
    ? ok('exactly one validate_trip_pin — no orphan overload')
    : bad(`validate_trip_pin has ${v.length} definitions: ${JSON.stringify(v)}`)
  v[0] && !/p_allow_spine/.test(v[0].args)
    ? ok('validate_trip_pin no longer takes p_allow_spine')
    : bad(`p_allow_spine still present: ${v[0]?.args}`)

  for (const n of ['create_trip', 'frame_trip', 'add_trip_stop']) {
    byName(n).length === 1
      ? ok(`exactly one ${n}`)
      : bad(`${n} has ${byName(n).length} definitions`)
  }

  // A spine pin belonging to the owner — the case that used to raise.
  const { rows: spine } = await client.query(`
    SELECT r.id, r.user_id FROM relationships r
    JOIN relationship_types rt ON rt.id = r.type_id
    WHERE rt.code = 'lived_at' LIMIT 1`)

  if (!spine.length) {
    bad('no lived_at relationship to test against')
  } else {
    // 3. Accepted.
    try {
      await client.query('SELECT validate_trip_pin($1::uuid, $2::uuid)', [spine[0].id, spine[0].user_id])
      ok('a SPINE pin passes validation (the removed guard)')
    } catch (e) {
      bad('spine pin still refused: ' + e.message)
    }
    // 4. Ownership still enforced — the function must not be toothless.
    try {
      await client.query('SELECT validate_trip_pin($1::uuid, $2::uuid)',
        [spine[0].id, '00000000-0000-0000-0000-000000000000'])
      bad('a stranger’s id was accepted — ownership is no longer enforced')
    } catch (e) {
      /does not belong to user/.test(e.message)
        ? ok('ownership is still enforced')
        : bad('unexpected error: ' + e.message)
    }
  }

  // 5 + 6. Source-level: the removed rule is gone, the retained one stays.
  const src = async (name) => (await client.query(
    `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname=$1`, [name])).rows[0]?.def ?? ''

  const guardGone = !/primary residence cannot be a trip destination/.test(
    await src('validate_trip_pin'))
  if (guardGone) ok('the old exception text is gone from validate_trip_pin')
  else bad('the removed guard is still in the source')

  const turnaroundKept = /turnaround, not an itinerary stop/.test(
    await src('add_trip_stop'))
  if (turnaroundKept) ok('add_trip_stop still refuses the destination as a stop')
  else bad('the turnaround rule was lost — it should have been kept')
} finally {
  await client.end()
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
