#!/usr/bin/env node
/**
 * Proof for the globe pin-search matcher (lib/globe/pin-search.ts).
 * Pure-function test — no DB, fixture pins only.
 *
 * Asserts:
 *   1. Queries under 2 characters return nothing (no one-key noise).
 *   2. Rank tiers: exact > starts-with > word-start > substring.
 *   3. Case-insensitive and diacritic-insensitive both directions.
 *   4. Within a tier: sequenced primaries first, then by sort_order
 *      (unsequenced primaries after sequenced), then markers.
 *   5. Result limit enforced (default 5, explicit override).
 *   6. No match → empty (component renders Places only — never an error).
 *
 * Run: node scripts/verify-pin-search.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { searchPins } from '${projectRoot}/lib/globe/pin-search'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

const pin = (id: string, name: string, type: string | null = 'lived_at', sort: number | null = null) =>
  ({ relationship_id: id, name, type_code: type, sort_order: sort })

const pins = [
  pin('han', 'Hanover', 'lived_at', 2),
  pin('cor', 'Coronet Peak Ski School', 'worked_at'),
  pin('zar', 'Zarag\\u00f3za AB', 'lived_at', 0),
  pin('spk', 'The Speakeasy', 'logged_at'),
  pin('pea', 'Peak', 'vacationed_at'),
  pin('pe2', 'Peak House', 'lived_at', 1),
  pin('pe3', 'Peakston', 'lived_at', null), // unsequenced primary (U9)
  pin('wal', 'Wallace Monument', 'vacationed_at'),
]

const ids = (r: { relationship_id: string }[]) => r.map((p) => p.relationship_id)

// 1. Minimum query length
if (searchPins(pins, '').length === 0 && searchPins(pins, 'p').length === 0)
  ok('queries under 2 chars return nothing')
else bad('short query leaked results')

// 2. Tier order: exact ('Peak') > starts-with ('Peak House', 'Peakston') >
//    word-start ('Coronet Peak ...') > substring ('The Speakeasy')
const peak = ids(searchPins(pins, 'peak', 10))
if (JSON.stringify(peak) === JSON.stringify(['pea', 'pe2', 'pe3', 'cor', 'spk']))
  ok('tiers rank exact > starts-with > word-start > substring')
else bad('tier order wrong: ' + JSON.stringify(peak))

// 3. Case + diacritics, both directions
if (ids(searchPins(pins, 'ZARAGOZA'))[0] === 'zar') ok('case-insensitive, plain query hits accented name')
else bad('ZARAGOZA missed Zarag\\u00f3za AB')
if (ids(searchPins(pins, 'zarag\\u00f3z'))[0] === 'zar') ok('accented query hits too')
else bad('accented query missed')

// 4. Within a tier, sequenced primaries lead (sort asc), unsequenced primary
//    after them, markers last. 'pe2' (sort 1) vs 'pe3' (unsequenced) vs 'pea'
//    (marker): starts-with tier for 'peak h' is only pe2 — use 'peaks' →
//    starts-with: pe3 (Peakston); check the mixed tier via 'pea' query:
//    starts-with tier holds pea(exact? no — starts-with), pe2, pe3.
const pea = ids(searchPins(pins, 'pea', 10))
if (JSON.stringify(pea.slice(0, 3)) === JSON.stringify(['pe2', 'pe3', 'pea']))
  ok('within a tier: sequenced primary, then unsequenced primary, then marker')
else bad('tier tiebreak wrong: ' + JSON.stringify(pea))

// 5. Limit
if (searchPins(pins, 'peak', 10).length === 5 && searchPins(pins, 'peak', 2).length === 2 && searchPins(pins, 'a').length === 0)
  ok('limit respected (explicit and minimum-length gate)')
else bad('limit not respected')
if (searchPins(pins, 'pe').length <= 5) ok('default limit caps at 5')
else bad('default limit exceeded')

// 6. No match
if (searchPins(pins, 'xyzzy').length === 0) ok('no match returns empty, never throws')
else bad('phantom results for xyzzy')

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.pin-search-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
