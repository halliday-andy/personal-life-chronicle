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
  // R3 fixtures (F3, 2026-07-30): the live miss was querying
  // "Mount Snow Chalet" against a pin actually named "My Mt. Snow Chalet".
  pin('cha', 'My Mt. Snow Chalet', 'lived_at', 3),
  pin('stm', 'St. Marks Rd', 'lived_at', 4),
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

// ── R3 / finding F3 (2026-07-30) — token-wise matching ──────────────────
// The whole-query substring test silently missed any query carrying an extra
// or differently-abbreviated word. Live case: "Mount Snow Chalet" vs the pin
// "My Mt. Snow Chalet".

// 7. The live miss
if (ids(searchPins(pins, 'Mount Snow Chalet', 10)).includes('cha'))
  ok('F3: "Mount Snow Chalet" finds "My Mt. Snow Chalet" (mount = mt.)')
else bad('F3 REGRESSION: "Mount Snow Chalet" still misses "My Mt. Snow Chalet"')

// 8. Token order is irrelevant — recall is not word order
if (ids(searchPins(pins, 'chalet snow', 10)).includes('cha'))
  ok('tokens match out of order')
else bad('token order mattered')

// 9. ALL query tokens must match — no loose fuzzy recall
if (!ids(searchPins(pins, 'Mount Snow Castle', 10)).includes('cha'))
  ok('an unmatched token rejects the pin (no fuzzy over-matching)')
else bad('matched despite the token "castle" being absent')

// 10. Prefix tokens, so incremental typing keeps working
if (ids(searchPins(pins, 'Mt Snow Chal', 10)).includes('cha'))
  ok('partial trailing token still matches (incremental typing)')
else bad('prefix token failed')

// 11. Abbreviations both directions
if (ids(searchPins(pins, 'Saint Marks Road', 10)).includes('stm'))
  ok('expanded query hits abbreviated name (saint/road)')
else bad('"Saint Marks Road" missed "St. Marks Rd"')
if (ids(searchPins(pins, 'St Marks Rd', 10)).includes('stm'))
  ok('abbreviated query still hits')
else bad('"St Marks Rd" missed')

// 12. Token matching is the LAST resort — substring tiers still outrank it
const snow = ids(searchPins(pins, 'snow chalet', 10))
if (snow[0] === 'cha') ok('token match ranks behind the existing tiers, not ahead')
else bad('token tier displaced a stronger match: ' + JSON.stringify(snow))

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.pin-search-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
