#!/usr/bin/env node
/**
 * Repair mention-links masquerading as pin-overview links (2026-07-07).
 *
 * Invariant: a globe_onboarding memory holds role='location' ONLY toward
 * its OWN pin's place entity. The stub sweep and the /memories "+ link"
 * feature both created place links with role='location', letting one
 * pin's recollection hijack another pin's overview text (Coronet Peak
 * Ski School showed the 1975 primary's recollection; Trans Hotel showed
 * the Ramada's).
 *
 * Ground truth: create_residence_pin inserts the pin relationship and
 * its memory in one transaction, so the GENUINE pair shares an exact
 * created_at timestamp. Rule applied here:
 *
 *   For every (memory M, entity E, role='location') link where M is a
 *   globe_onboarding memory: if M has an exact-timestamp pin whose
 *   place entity is NOT E → the link is a mention → role becomes
 *   'mentioned'. Memories with no exact-timestamp pin are left alone
 *   (conservative — covers any pin whose body was added after creation).
 *
 * Idempotent and re-runnable; prints every change.
 * Run: node scripts/repair-globe-location-roles.mjs
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

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL })
await client.connect()

try {
  const { rows: fixed } = await client.query(`
    WITH genuine AS (
      -- The pin each globe memory was born with (same-transaction timestamp).
      SELECT m.id AS memory_id, r.object_id AS own_entity_id
      FROM memories m
      JOIN relationships r
        ON r.user_id = m.user_id
       AND r.created_at = m.created_at
       AND r.metadata->>'globe_pin' = 'true'
      WHERE m.capture_mode = 'globe_onboarding'
    )
    UPDATE memory_entities me
    SET role = 'mentioned'
    FROM genuine g
    WHERE me.memory_id = g.memory_id
      AND me.role = 'location'
      AND me.entity_id <> g.own_entity_id
    RETURNING me.memory_id, me.entity_id
  `)

  for (const f of fixed) {
    const { rows: e } = await client.query(`SELECT canonical_name FROM entities WHERE id=$1`, [f.entity_id])
    const { rows: m } = await client.query(`SELECT left(content_raw, 45) AS t FROM memories WHERE id=$1`, [f.memory_id])
    console.log(`FLIPPED to mentioned: "${m[0]?.t}…" → ${e[0]?.canonical_name ?? f.entity_id}`)
  }
  console.log(`\n${fixed.length} link(s) repaired.`)

  // Post-condition: no globe memory claims location on a foreign pin entity.
  const { rows: remaining } = await client.query(`
    WITH genuine AS (
      SELECT m.id AS memory_id, r.object_id AS own_entity_id
      FROM memories m
      JOIN relationships r
        ON r.user_id = m.user_id AND r.created_at = m.created_at
       AND r.metadata->>'globe_pin' = 'true'
      WHERE m.capture_mode = 'globe_onboarding'
    )
    SELECT count(*)::int AS n FROM memory_entities me
    JOIN genuine g ON g.memory_id = me.memory_id
    WHERE me.role = 'location' AND me.entity_id <> g.own_entity_id
  `)
  console.log(remaining[0].n === 0 ? 'POST-CONDITION OK: no foreign location links remain.' : `WARNING: ${remaining[0].n} foreign location link(s) remain`)
} finally {
  await client.end()
}
