#!/usr/bin/env node
/**
 * Proof for 20260803130000_retarget_trip.sql (R6 part 2 / finding F6).
 *
 * A trip's destination used to be immutable from creation — severe,
 * because capture is destination-FIRST, so the one unchangeable field was
 * the one chosen when the user knew least about the journey.
 *
 * Everything here runs inside a TRANSACTION THAT IS ROLLED BACK, so the
 * chronicle is untouched even if an assertion fails partway. Fixtures are
 * the user's own existing pins — no entities are invented.
 *
 * Asserts:
 *   1. the destination actually moves;
 *   2. the former destination becomes an OUTBOUND stop by default;
 *   3. order is load-bearing — the demoted stop lands, which is only
 *      possible because the repoint happened first (add_trip_stop refuses
 *      the current destination);
 *   4. promoting an existing STOP to destination removes its stop row, so
 *      a pin is never both;
 *   5. an UNTITLED trip's derived entity name follows the new destination;
 *   6. a TITLED trip keeps its title AND its entity name — a retarget must
 *      never overwrite the owner's own sentence;
 *   7. p_demote_old_to_stop = false drops the old destination entirely;
 *   8. retargeting to the current destination is a no-op, and must not
 *      append the destination to its own itinerary;
 *   9. another user's trip is refused.
 *
 * Run: node scripts/verify-retarget-trip.mjs
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
const q = (sql, params) => client.query(sql, params)

try {
  await q('BEGIN')

  const { rows: pins } = await q(`
    SELECT r.id, r.user_id, e.canonical_name AS name
    FROM relationships r JOIN entities e ON e.id = r.object_id
    WHERE r.metadata->>'globe_pin' = 'true'
    ORDER BY e.canonical_name LIMIT 4`)
  if (pins.length < 4) throw new Error('need at least 4 globe pins as fixtures')
  const [origin, oldDest, newDest, extra] = pins
  const user = origin.user_id

  const mkTrip = async (title) => (await q(
    `SELECT * FROM create_trip($1::uuid,$2::uuid,'road_trip',$3::text,NULL,NULL,$4::uuid)`,
    [user, oldDest.id, title, origin.id])).rows[0]

  // ── untitled trip: destination moves, old one demoted, name follows ──
  const t1 = await mkTrip(null)
  await q('SELECT retarget_trip($1::uuid,$2::uuid,$3::uuid)', [user, t1.trip_id, newDest.id])

  const { rows: [after1] } = await q('SELECT destination_relationship_id, title FROM trips WHERE id=$1', [t1.trip_id])
  after1.destination_relationship_id === newDest.id
    ? ok('the destination moves')
    : bad('destination did not move')

  const { rows: stops1 } = await q(
    `SELECT relationship_id, leg FROM trip_stops WHERE trip_id=$1`, [t1.trip_id])
  stops1.some((s) => s.relationship_id === oldDest.id && s.leg === 'outbound')
    ? ok('the former destination becomes an OUTBOUND stop (order is load-bearing)')
    : bad('old destination was not demoted: ' + JSON.stringify(stops1))

  const { rows: [ent1] } = await q('SELECT canonical_name FROM entities WHERE id=$1', [t1.trip_entity_id])
  ent1.canonical_name === `Trip to ${newDest.name}`
    ? ok('an untitled trip’s derived name follows the new destination')
    : bad(`derived name wrong: ${ent1.canonical_name}`)

  // ── promoting an existing STOP: it must stop being a stop ────────────
  const t2 = await mkTrip(null)
  await q(`SELECT add_trip_stop($1::uuid,$2::uuid,$3::uuid,'outbound',NULL)`, [user, t2.trip_id, extra.id])
  await q('SELECT retarget_trip($1::uuid,$2::uuid,$3::uuid)', [user, t2.trip_id, extra.id])
  const { rows: stops2 } = await q('SELECT relationship_id FROM trip_stops WHERE trip_id=$1', [t2.trip_id])
  !stops2.some((s) => s.relationship_id === extra.id)
    ? ok('promoting a stop to destination removes its stop row — never both')
    : bad('the promoted pin is still a stop')

  // ── a TITLED trip keeps the owner's sentence ─────────────────────────
  const titled = 'The epic solo road trip in the overloaded Fiat 128'
  const t3 = await mkTrip(titled)
  await q('SELECT retarget_trip($1::uuid,$2::uuid,$3::uuid)', [user, t3.trip_id, newDest.id])
  const { rows: [after3] } = await q('SELECT title FROM trips WHERE id=$1', [t3.trip_id])
  const { rows: [ent3] } = await q('SELECT canonical_name FROM entities WHERE id=$1', [t3.trip_entity_id])
  after3.title === titled && ent3.canonical_name === titled
    ? ok('a titled trip keeps its title AND its entity name')
    : bad(`title clobbered: trip="${after3.title}" entity="${ent3.canonical_name}"`)

  // ── opting out of the demotion ───────────────────────────────────────
  const t4 = await mkTrip(null)
  await q('SELECT retarget_trip($1::uuid,$2::uuid,$3::uuid,false)', [user, t4.trip_id, newDest.id])
  const { rows: stops4 } = await q('SELECT relationship_id FROM trip_stops WHERE trip_id=$1', [t4.trip_id])
  stops4.length === 0
    ? ok('p_demote_old_to_stop = false drops the old destination entirely')
    : bad('a stop was added despite opting out')

  // ── idempotence: retarget to where it already ends ───────────────────
  const t5 = await mkTrip(null)
  await q('SELECT retarget_trip($1::uuid,$2::uuid,$3::uuid)', [user, t5.trip_id, oldDest.id])
  const { rows: stops5 } = await q('SELECT relationship_id FROM trip_stops WHERE trip_id=$1', [t5.trip_id])
  stops5.length === 0
    ? ok('retargeting to the current destination is a no-op')
    : bad('a no-op retarget appended the destination to its own itinerary')

  // ── ownership ────────────────────────────────────────────────────────
  try {
    await q('SELECT retarget_trip($1::uuid,$2::uuid,$3::uuid)',
      ['00000000-0000-0000-0000-000000000000', t1.trip_id, oldDest.id])
    bad('another user’s trip was retargeted')
  } catch (e) {
    /does not belong to user/.test(e.message)
      ? ok('another user’s trip is refused')
      : bad('unexpected error: ' + e.message)
  }
} catch (e) {
  bad('threw: ' + e.message)
} finally {
  // ALWAYS roll back — the chronicle must be untouched by a proof.
  await client.query('ROLLBACK').catch(() => {})
  await client.end()
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
