#!/usr/bin/env node
/**
 * Proof for 20260706130000_merge_preserves_substance.sql — merging in
 * EITHER direction keeps the union of entity-level substance.
 *
 * Reproduces the 2026-07-06 incident shape deliberately: source has
 * geom + place_subtype + description (a pin entity), target has none
 * (an extraction twin). After merge_entities(source→target):
 *   1. The target survives AND carries the source's geom.
 *   2. place_subtype + description carried over too.
 *   3. Target values are never overwritten when present (target keeps
 *      its own description if it has one).
 *
 * TESTMERGEGEO fixtures; deletes everything in a finally block.
 * Run: node scripts/verify-merge-preserves-substance.mjs
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

const ids = []
try {
  const { rows: userRow } = await client.query(`SELECT id FROM auth.users WHERE email='andrewsbox@gmail.com'`)
  const userId = userRow[0].id

  const mk = async (name, cols = '', vals = '') => {
    const { rows } = await client.query(
      `INSERT INTO entities (user_id, type, canonical_name${cols}) VALUES ($1, 'place', $2${vals}) RETURNING id`,
      [userId, name],
    )
    ids.push(rows[0].id)
    return rows[0].id
  }

  // Source = the "pin": geom + subtype + description.
  const source = await mk(
    'TESTMERGEGEO Pin',
    ', geom, place_subtype, description',
    `, ST_SetSRID(ST_MakePoint(11.1, 47.2), 4326)::geography, 'city', 'the pin placard'`,
  )
  // Target = the bare extraction twin, but WITH its own description
  // (to prove target values are never clobbered).
  const target = await mk('TESTMERGEGEO Twin', ', description', `, 'twin has its own placard'`)

  // The incident direction: pin INTO twin.
  await client.query(`SELECT merge_entities($1, $2, $3)`, [source, target, userId])

  const { rows: after } = await client.query(
    `SELECT canonical_name, ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat,
            place_subtype, description, aliases
     FROM entities WHERE id = $1`,
    [target],
  )
  const t = after[0]
  if (!t) { bad('target vanished'); throw new Error('abort') }

  if (t.lng === 11.1 && t.lat === 47.2) ok('survivor carries the pin geometry (wrong-direction merge is now safe)')
  else bad('geom not preserved: ' + JSON.stringify({ lng: t.lng, lat: t.lat }))

  if (t.place_subtype === 'city') ok('place_subtype carried over')
  else bad('place_subtype lost: ' + t.place_subtype)

  if (t.description === 'twin has its own placard') ok('target values are never overwritten (kept its own description)')
  else bad('target description clobbered: ' + t.description)

  if ((t.aliases ?? []).includes('TESTMERGEGEO Pin')) ok('source name folded as alias (unchanged behavior)')
  else bad('alias folding regressed: ' + JSON.stringify(t.aliases))

  const { rows: gone } = await client.query(`SELECT id FROM entities WHERE id = $1`, [source])
  if (gone.length === 0) ok('source row deleted (unchanged behavior)')
  else bad('source survived the merge')
} finally {
  await client.query(`DELETE FROM entities WHERE canonical_name LIKE 'TESTMERGEGEO%'`)
  const { rows: left } = await client.query(`SELECT id FROM entities WHERE canonical_name LIKE 'TESTMERGEGEO%'`)
  if (left.length === 0) ok('cleanup complete — no TESTMERGEGEO residue')
  else bad('residue remains')
  await client.end()
}

console.log(failures === 0 ? '\nPASS' : '\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
