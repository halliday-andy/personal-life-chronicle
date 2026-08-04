#!/usr/bin/env node
/**
 * Proof for the trip-kind label (lib/globe/trip-kind.ts). Pure — no DB.
 *
 * Origin (R22 add-on, Andy 2026-08-03): the guard forbidding a home as a
 * trip destination was removed in R6 part 1, because a trip may end where
 * you then lived — that is a RELOCATION, and `return_to_origin` carries
 * the distinction. But nothing ever said the word. Andy's Fiat 128 drive
 * from Mt. Snow to the SSV Day Lodge Room would render "Road trip", and a
 * one-way road trip terminating at a primary residence looks like a data
 * error rather than the move it was.
 *
 * The label READS a mutable classification (the destination pin's type)
 * and that is fine — rule 20 forbids a CONSTRAINT keyed on one, because a
 * constraint freezes a past judgement, while a label re-derives the moment
 * the classification changes. Retyping the pin retitles the trip; nothing
 * is trapped.
 *
 * Asserts:
 *   1. One-way + destination is a home → "Relocation".
 *   2. Round trip to a home → the subtype label. Returning home from a
 *      visit is not moving house; return_to_origin is the whole difference.
 *   3. One-way to a non-home → the subtype label. A one-way road trip to a
 *      ski hill is still a road trip.
 *   4. Every home TYPE counts, not just the spine — the standing guard is
 *      "home-ness is the TYPE, not the spine slot" (2026-07-18), so this
 *      defers to isHomeType rather than testing 'lived_at'.
 *   5. An unknown/absent destination type never invents a relocation.
 *   6. Every subtype still round-trips to its own label.
 *
 * Run: node scripts/verify-trip-kind.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { tripKindLabel, isRelocation } from '${projectRoot}/lib/globe/trip-kind'
import { TRIP_SUBTYPES, TRIP_SUBTYPE_LABELS } from '${projectRoot}/lib/globe/trip-types'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

// The Fiat 128 as it should read after R22's retarget.
const fiat = { subtype: 'road_trip' as const, return_to_origin: false, destination_type_code: 'lived_at' }

// 1
if (tripKindLabel(fiat) === 'Relocation') ok('one-way to a home reads "Relocation" (Mt. Snow \\u2192 SSV Day Lodge Room)')
else bad('expected Relocation, got ' + tripKindLabel(fiat))
if (isRelocation(fiat)) ok('isRelocation agrees')
else bad('isRelocation disagrees with the label')

// 2
const roundTrip = { ...fiat, return_to_origin: true }
if (tripKindLabel(roundTrip) === 'Road trip') ok('round trip to a home stays "Road trip" \\u2014 returning is not moving')
else bad('round trip mislabelled: ' + tripKindLabel(roundTrip))

// 3
const oneWayToHill = { ...fiat, destination_type_code: 'vacationed_at' }
if (tripKindLabel(oneWayToHill) === 'Road trip') ok('one-way to a non-home stays "Road trip"')
else bad('one-way to a vacation pin mislabelled: ' + tripKindLabel(oneWayToHill))

// 4 — home-ness is the TYPE, not the spine slot
for (const code of ['lived_at', 'owned_residence_at', 'lived_briefly_at']) {
  if (tripKindLabel({ ...fiat, destination_type_code: code }) === 'Relocation') ok('"' + code + '" counts as a home')
  else bad('"' + code + '" was not treated as a home')
}
for (const code of ['worked_at', 'logged_at', 'wants_to_visit', 'traveled_for_work_to']) {
  if (tripKindLabel({ ...fiat, destination_type_code: code }) !== 'Relocation') ok('"' + code + '" is not a home')
  else bad('"' + code + '" wrongly counted as a home')
}

// 5 — unknown type invents nothing
for (const code of [null, undefined]) {
  if (tripKindLabel({ ...fiat, destination_type_code: code }) === 'Road trip') ok('destination type ' + String(code) + ' falls back to the subtype')
  else bad('missing destination type invented a relocation')
}

// 6 — no subtype loses its label
for (const s of TRIP_SUBTYPES) {
  const label = tripKindLabel({ subtype: s, return_to_origin: true, destination_type_code: 'vacationed_at' })
  if (label === TRIP_SUBTYPE_LABELS[s]) ok('subtype "' + s + '" still renders "' + label + '"')
  else bad('subtype "' + s + '" rendered "' + label + '"')
}

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.trip-kind-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
