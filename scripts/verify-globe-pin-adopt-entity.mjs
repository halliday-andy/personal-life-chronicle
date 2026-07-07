#!/usr/bin/env node
/**
 * Proof for 20260707120000_pin_reuse_entity.sql — create_residence_pin
 * can ADOPT an existing entity instead of minting a duplicate twin.
 *
 * Asserts (relative-only, this script's OWN fixtures):
 *   1. Adopting: no new entity row; the pin's place IS the fixture entity.
 *   2. The adopted entity gains the placed geom; existing description is
 *      kept; the differing modal name folds in as an alias.
 *   3. An organization entity is adopted and becomes a place (physical
 *      location wins).
 *   4. Existing memory links survive adoption (the point of the feature).
 *   5. Guards: another user's entity rejected; an already-pinned entity
 *      rejected; a person entity rejected.
 *   6. Omitting p_entity_id still creates a fresh entity (old behavior).
 *
 * TESTADOPT fixtures; deletes everything in a finally block.
 * Run: node scripts/verify-globe-pin-adopt-entity.mjs
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
  const { rows: selfRow } = await client.query(
    `SELECT id FROM entities WHERE user_id=$1 AND type='person' AND metadata->>'is_self'='true' LIMIT 1`, [userId])
  const selfId = selfRow[0].id

  const mkEnt = async (name, type, extra = '', vals = '') => {
    const { rows } = await client.query(
      `INSERT INTO entities (user_id, type, canonical_name${extra}) VALUES ($1, $2, $3${vals}) RETURNING id`,
      [userId, type, name])
    return rows[0].id
  }

  // Fixture: an unpinned organization entity with a description + a linked memory.
  const org = await mkEnt('TESTADOPT Ski Academy', 'organization', ', description', `, 'kept placard'`)
  const { rows: memRow } = await client.query(
    `INSERT INTO memories (user_id, content_raw, source, confidence, is_draft, metadata)
     VALUES ($1, 'TESTADOPT memory mentioning the academy', 'text_entry', 'certain', false, '{"skip_async_fanout":true}'::jsonb)
     RETURNING id`, [userId])
  const memId = memRow[0].id
  await client.query(
    `INSERT INTO memory_entities (memory_id, entity_id, role) VALUES ($1, $2, 'mentioned')`, [memId, org])

  const { rows: entCountBefore } = await client.query(
    `SELECT count(*)::int AS n FROM entities WHERE user_id=$1`, [userId])

  // ── 1–4. Adopt the org as a workplace pin, with a differing modal name ──
  const { rows: created } = await client.query(
    `SELECT * FROM create_residence_pin($1,$2, 11.5, 47.5, 'TESTADOPT Academy Kitzbühel', 'city', 'AT',
       'winter 1968', 'TESTADOPT recollection at the academy', NULL, 'worked_at', NULL, $3)`,
    [userId, selfId, org])
  const pin = created[0]

  if (pin.place_entity_id === org) ok('the pin adopted the fixture entity (no twin)')
  else bad('pin created a different entity: ' + JSON.stringify(pin))

  const { rows: entCountAfter } = await client.query(
    `SELECT count(*)::int AS n FROM entities WHERE user_id=$1`, [userId])
  if (entCountAfter[0].n === entCountBefore[0].n) ok('entity count unchanged — nothing minted')
  else bad(`entity count changed ${entCountBefore[0].n} → ${entCountAfter[0].n}`)

  const { rows: adopted } = await client.query(
    `SELECT type, description, aliases, ST_X(geom::geometry) AS lng, place_subtype::text AS st FROM entities WHERE id=$1`, [org])
  const a = adopted[0]
  if (a.type === 'place') ok('organization became a place (physical location wins)')
  else bad('type not converted: ' + a.type)
  if (a.lng === 11.5) ok('adopted entity gained the placed coordinates')
  else bad('geom wrong: ' + a.lng)
  if (a.description === 'kept placard') ok('existing description preserved')
  else bad('description clobbered: ' + a.description)
  if ((a.aliases ?? []).includes('TESTADOPT Academy Kitzbühel')) ok('differing modal name folded in as alias')
  else bad('alias fold missing: ' + JSON.stringify(a.aliases))

  const { rows: link } = await client.query(
    `SELECT 1 FROM memory_entities WHERE memory_id=$1 AND entity_id=$2`, [memId, org])
  if (link.length === 1) ok('pre-existing memory link survived adoption')
  else bad('memory link lost')

  // ── 5. Guards ──
  const expectFail = async (label, sql, params) => {
    try { await client.query(sql, params); bad(label + ' was accepted') }
    catch { ok(label + ' rejected') }
  }
  await expectFail('already-pinned entity',
    `SELECT * FROM create_residence_pin($1,$2, 1,1, 'x', 'city', NULL, NULL, NULL, NULL, 'worked_at', NULL, $3)`,
    [userId, selfId, org])
  const person = await mkEnt('TESTADOPT Person', 'person')
  await expectFail('person entity',
    `SELECT * FROM create_residence_pin($1,$2, 1,1, 'x', 'city', NULL, NULL, NULL, NULL, 'worked_at', NULL, $3)`,
    [userId, selfId, person])
  await expectFail("another user's entity",
    `SELECT * FROM create_residence_pin($1,$2, 1,1, 'x', 'city', NULL, NULL, NULL, NULL, 'worked_at', NULL, $3)`,
    ['00000000-0000-0000-0000-000000000000', selfId, org])

  // ── 6. Fresh creation still works ──
  const { rows: fresh } = await client.query(
    `SELECT * FROM create_residence_pin($1,$2, 2.2, 41.4, 'TESTADOPT Fresh Place', 'city', 'ES',
       NULL, NULL, NULL, 'vacationed_at', NULL, NULL)`,
    [userId, selfId])
  if (fresh[0].place_entity_id && fresh[0].place_entity_id !== org) ok('omitting p_entity_id still mints a fresh entity')
  else bad('fresh path broken: ' + JSON.stringify(fresh))
} finally {
  await client.query(`DELETE FROM memory_entities WHERE memory_id IN (SELECT id FROM memories WHERE content_raw LIKE 'TESTADOPT%')`)
  await client.query(`DELETE FROM memories WHERE content_raw LIKE 'TESTADOPT%'`)
  await client.query(`DELETE FROM relationships WHERE object_id IN (SELECT id FROM entities WHERE canonical_name LIKE 'TESTADOPT%')`)
  await client.query(`DELETE FROM entities WHERE canonical_name LIKE 'TESTADOPT%'`)
  const { rows: left } = await client.query(`SELECT id FROM entities WHERE canonical_name LIKE 'TESTADOPT%'`)
  if (left.length === 0) ok('cleanup complete — no TESTADOPT residue')
  else bad('residue remains')
  await client.end()
}

console.log(failures === 0 ? '\nPASS' : '\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
