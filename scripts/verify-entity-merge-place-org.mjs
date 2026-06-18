#!/usr/bin/env node
/**
 * Proof: merge_entities() can merge a place and an organization that are
 * the same real-world institution (e.g. a military base), and the PLACE
 * always survives so its globe identity (geom, place_subtype,
 * country_code, residence relationship) is preserved.
 *
 * Why this exists (2026-06-17): entity resolution deliberately blurs
 * place/organization for institutions (lib/agents/entity/core.ts
 * candidateTypes — bases extract as either type run to run) and queues a
 * merge proposal across the type line. But merge_entities() used to hard-
 * reject every cross-type merge, so the proposal it raised could never be
 * executed ("cannot merge entities of different types: organization vs
 * place"). Andy hit this merging an extracted "Loring Air Force Base"
 * (organization) into his "Loring AFB, Limestone Maine" pin (place).
 *
 * Acceptance:
 *   A. org -> place merge succeeds; survivor is the place (type=place,
 *      geom intact); org's name lands in survivor aliases; the org's
 *      memory_entities link repoints to the place; org row deleted.
 *   B. place -> org merge (wrong direction) ALSO keeps the place as the
 *      survivor — the function swaps so the globe pin is never destroyed.
 *   C. a genuinely incompatible cross-type pair (person vs vehicle) still
 *      raises 'cannot merge entities of different types'.
 *
 * Run: node scripts/verify-entity-merge-place-org.mjs
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(projectRoot, '.env.local'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('='); if (i < 0) continue
  const k = line.slice(0, i).trim(); if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}

const DB_URL = process.env.SUPABASE_DB_URL
if (!DB_URL) { console.error('✗ SUPABASE_DB_URL not set'); process.exit(1) }

const { Client } = await import('pg')
const ssl = /supabase\.(co|com)/.test(DB_URL) ? { rejectUnauthorized: false } : undefined
const u = new URL(DB_URL)
const client = new Client({
  host: u.hostname,
  port: u.port ? Number(u.port) : 5432,
  user: decodeURIComponent(u.username),
  database: u.pathname.replace(/^\//, '') || 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD ?? decodeURIComponent(u.password),
  ssl,
})

let failures = 0
const ok = (m) => console.log('  ✓ ' + m)
const bad = (m) => { console.error('  ✗ ' + m); failures++ }
const TAG = 'ZZ Merge Test '

await client.connect()

async function newPlace(userId, name) {
  const { rows } = await client.query(
    `INSERT INTO entities (user_id, type, canonical_name, country_code, geom)
     VALUES ($1, 'place', $2, 'US', ST_SetSRID(ST_MakePoint(-68.0, 46.95), 4326)::geography)
     RETURNING id`, [userId, TAG + name])
  return rows[0].id
}
async function newEntity(userId, type, name) {
  const { rows } = await client.query(
    `INSERT INTO entities (user_id, type, canonical_name) VALUES ($1, $2, $3) RETURNING id`,
    [userId, type, TAG + name])
  return rows[0].id
}
async function newMemoryLinkedTo(userId, entityId) {
  const { rows } = await client.query(
    `INSERT INTO memories (user_id, content_raw, source, capture_mode, authored_by_actor, is_draft)
     VALUES ($1, $2, 'text_entry', 'globe_onboarding', 'owner', false) RETURNING id`,
    [userId, TAG + 'recollection'])
  const memId = rows[0].id
  await client.query(
    `INSERT INTO memory_entities (memory_id, entity_id, role, is_primary)
     VALUES ($1, $2, 'participant', false)`, [memId, entityId])
  return memId
}
async function getEntity(id) {
  const { rows } = await client.query(
    `SELECT id, type, canonical_name, aliases, geom IS NOT NULL AS has_geom FROM entities WHERE id = $1`, [id])
  return rows[0] ?? null
}

try {
  await client.query(`DELETE FROM entities WHERE canonical_name LIKE $1`, [TAG + '%'])

  const { rows: urows } = await client.query(
    `SELECT id FROM auth.users WHERE email = 'andrewsbox@gmail.com' LIMIT 1`)
  const userId = urows[0]?.id
  if (!userId) { bad('test user not found'); throw new Error('no user') }

  // --- A. org -> place: place survives with globe identity, org name aliased ---
  {
    const place = await newPlace(userId, 'Loring Place AFB')
    const org = await newEntity(userId, 'organization', 'Loring Air Force Base')
    const mem = await newMemoryLinkedTo(userId, org)
    await client.query(`SELECT merge_entities($1, $2, $3)`, [org, place, userId])

    const survivor = await getEntity(place)
    const gone = await getEntity(org)
    if (survivor && survivor.type === 'place' && survivor.has_geom) ok('A: place survives with geom intact')
    else bad('A: place survivor wrong: ' + JSON.stringify(survivor))
    if (!gone) ok('A: organization row deleted')
    else bad('A: organization row still present')
    if ((survivor?.aliases ?? []).some((a) => a === TAG + 'Loring Air Force Base'))
      ok('A: organization name folded into place aliases')
    else bad('A: org name not in aliases: ' + JSON.stringify(survivor?.aliases))
    const { rows: link } = await client.query(
      `SELECT entity_id FROM memory_entities WHERE memory_id = $1`, [mem])
    if (link.length === 1 && link[0].entity_id === place) ok('A: memory_entities repointed org -> place')
    else bad('A: memory_entities not repointed: ' + JSON.stringify(link))
  }

  // --- B. place -> org (wrong direction): place must STILL survive ---
  {
    const place = await newPlace(userId, 'Mather Place AFB')
    const org = await newEntity(userId, 'organization', 'Mather AFB Org')
    // Caller passes place as source, org as target — naive merge would
    // destroy the globe pin. Function must swap and keep the place.
    await client.query(`SELECT merge_entities($1, $2, $3)`, [place, org, userId])
    const survivingPlace = await getEntity(place)
    const survivingOrg = await getEntity(org)
    if (survivingPlace && survivingPlace.type === 'place' && survivingPlace.has_geom && !survivingOrg)
      ok('B: place survives even when passed as source (swap protects the pin)')
    else bad('B: pin not protected — place=' + JSON.stringify(survivingPlace) + ' org=' + JSON.stringify(survivingOrg))
  }

  // --- C. genuinely incompatible types still rejected ---
  {
    const person = await newEntity(userId, 'person', 'Some Person')
    const vehicle = await newEntity(userId, 'vehicle', 'Some Car')
    let raised = false
    try {
      await client.query(`SELECT merge_entities($1, $2, $3)`, [person, vehicle, userId])
    } catch (e) {
      raised = /different types/.test(e.message)
    }
    if (raised) ok('C: person vs vehicle still rejected')
    else bad('C: incompatible cross-type merge was NOT rejected')
  }
} finally {
  await client.query(`DELETE FROM entities WHERE canonical_name LIKE $1`, [TAG + '%'])
  await client.query(`DELETE FROM memories WHERE content_raw LIKE $1`, [TAG + '%'])
  await client.end()
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
