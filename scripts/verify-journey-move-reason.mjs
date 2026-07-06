#!/usr/bin/env node
/**
 * Proof for 20260706140000_journey_move_reason.sql — get_residence_pins
 * surfaces metadata->>'move_reason'.
 *
 * Asserts (relative-only, this script's OWN fixtures):
 *   1. A pin whose relationship metadata carries move_reason returns it.
 *   2. A pin without one returns NULL (the Journey renders nothing —
 *      never fabricated connective tissue).
 *
 * TESTMOVER fixtures; deletes everything in a finally block.
 * Run: node scripts/verify-journey-move-reason.mjs
 */

import { readFileSync } from 'node:fs'
import pg from 'pg'

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i).trim()
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}

let failures = 0
const ok = (m) => console.log('  ✓ ' + m)
const bad = (m) => { console.error('  ✗ ' + m); failures++ }

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL })
await client.connect()

try {
  const { rows: userRow } = await client.query(`SELECT id FROM auth.users WHERE email='andrewsbox@gmail.com'`)
  const userId = userRow[0].id
  const { rows: rt } = await client.query(`SELECT id FROM relationship_types WHERE code='lived_at'`)

  const mkEnt = async (name) => {
    const { rows } = await client.query(
      `INSERT INTO entities (user_id, type, canonical_name, geom)
       VALUES ($1, 'place', $2, ST_SetSRID(ST_MakePoint(1.1, 2.2), 4326)::geography) RETURNING id`,
      [userId, name],
    )
    return rows[0].id
  }
  const subj = await mkEnt('TESTMOVER Subject')
  const withReason = await mkEnt('TESTMOVER With Reason')
  const without = await mkEnt('TESTMOVER Without')

  await client.query(
    `INSERT INTO relationships (user_id, subject_id, object_id, type_id, metadata)
     VALUES ($1, $2, $3, $4, '{"globe_pin": true, "move_reason": "military_posting"}'::jsonb),
            ($1, $2, $5, $4, '{"globe_pin": true}'::jsonb)`,
    [userId, subj, withReason, rt[0].id, without],
  )

  const { rows: pins } = await client.query(
    `SELECT name, move_reason FROM get_residence_pins($1) WHERE name LIKE 'TESTMOVER%'`,
    [userId],
  )
  const a = pins.find((p) => p.name === 'TESTMOVER With Reason')
  const b = pins.find((p) => p.name === 'TESTMOVER Without')

  if (a?.move_reason === 'military_posting') ok('move_reason surfaced from relationship metadata')
  else bad('move_reason missing/wrong: ' + JSON.stringify(a))
  if (b && b.move_reason === null) ok('pins without a reason return NULL (nothing fabricated)')
  else bad('null case wrong: ' + JSON.stringify(b))
} finally {
  await client.query(`DELETE FROM relationships WHERE object_id IN (SELECT id FROM entities WHERE canonical_name LIKE 'TESTMOVER%')`)
  await client.query(`DELETE FROM entities WHERE canonical_name LIKE 'TESTMOVER%'`)
  const { rows: left } = await client.query(`SELECT id FROM entities WHERE canonical_name LIKE 'TESTMOVER%'`)
  if (left.length === 0) ok('cleanup complete — no TESTMOVER residue')
  else bad('residue remains')
  await client.end()
}

console.log(failures === 0 ? '\nPASS' : '\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
