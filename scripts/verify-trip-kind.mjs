#!/usr/bin/env node
/**
 * Proof for the trip-kind rendering (lib/globe/trip-kind.ts). Pure — no DB.
 *
 * Origin (R22 add-on, Andy 2026-08-03): the guard forbidding a home as a
 * trip destination was removed in R6, because a trip may end where you then
 * lived — that is a RELOCATION, and `return_to_origin` carries the
 * distinction. But nothing ever said the word, so his Mt. Snow → SSV Day
 * Lodge Room drive read "Road trip" and looked like a data error.
 *
 * **Corrected 2026-08-04, and this file exists to keep it corrected.** The
 * first version made "Relocation" REPLACE the subtype. Andy changed the
 * Fiat 128 to Professional travel to test the new kind selector and neither
 * surface would show it — the write had worked, the label had eaten it. His
 * example for why it matters: assembling a chronology of the major road
 * trips of his life, this one is among them, and it had stopped saying so.
 *
 * **Rule 15: owner-asserted and machine-read must never render as peers.**
 * The subtype is Andy's own claim; "relocation" is the chronicle's reading
 * of it. The reading had not merely become a peer — it had EVICTED the
 * claim. They are also orthogonal: a relocation can be driven (a road
 * trip), flown for a job (professional travel), or neither. Collapsing two
 * axes into one label destroys whichever one loses.
 *
 * Asserts:
 *   1. The owner's subtype label ALWAYS survives — the eviction, in every
 *      combination that used to hide it.
 *   2. `relocation` is a separate flag, not a substitute label.
 *   3. One-way + a home = relocation; a round trip to a home is not;
 *      one-way to a non-home is not.
 *   4. Every home TYPE counts, not just the spine slot (2026-07-18).
 *   5. An unknown destination type never invents a relocation.
 *   6. The reading's wording is shared, so surfaces cannot word it
 *      differently and imply two different facts.
 *
 * Run: node scripts/verify-trip-kind.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { tripKind, isRelocation, RELOCATION_READING } from '${projectRoot}/lib/globe/trip-kind'
import { TRIP_SUBTYPES, TRIP_SUBTYPE_LABELS } from '${projectRoot}/lib/globe/trip-types'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

// The Fiat 128 after R22's retarget: one-way, ending at a primary residence.
const fiat = { subtype: 'road_trip' as const, return_to_origin: false, destination_type_code: 'lived_at' }

// 1 + 2 — THE EVICTION. The owner's word survives; the reading rides along.
const k = tripKind(fiat)
if (k.label === 'Road trip') ok('a relocation still says "Road trip" \\u2014 the owner\\u2019s word survives')
else bad('the reading evicted the subtype again: ' + k.label)
if (k.relocation) ok('...and carries relocation as a SEPARATE flag, not as the label')
else bad('relocation flag lost')

// The case that exposed it: Andy set Professional travel and saw neither.
const professional = tripKind({ ...fiat, subtype: 'professional' })
if (professional.label === 'Professional travel' && professional.relocation)
  ok('Professional travel + relocation shows BOTH (Andy\\u2019s \\u00a73 test case)')
else bad('professional relocation still hides one of the two: ' + JSON.stringify(professional))

// EVERY subtype must survive being a relocation — the eviction was total.
for (const s of TRIP_SUBTYPES) {
  const r = tripKind({ ...fiat, subtype: s })
  if (r.label === TRIP_SUBTYPE_LABELS[s] && r.relocation) ok('"' + s + '" survives relocation as "' + r.label + '"')
  else bad('"' + s + '" lost its label to the reading: ' + JSON.stringify(r))
}

// 3 — when the reading is true
if (isRelocation(fiat)) ok('one-way to a home IS a relocation (Mt. Snow \\u2192 SSV Day Lodge Room)')
else bad('the relocation reading failed on the real case')
const roundTrip = tripKind({ ...fiat, return_to_origin: true })
if (!roundTrip.relocation && roundTrip.label === 'Road trip')
  ok('a round trip to a home is NOT a relocation \\u2014 returning is not moving')
else bad('round trip mislabelled: ' + JSON.stringify(roundTrip))
const toHill = tripKind({ ...fiat, destination_type_code: 'vacationed_at' })
if (!toHill.relocation && toHill.label === 'Road trip') ok('one-way to a non-home is not a relocation')
else bad('one-way to a vacation pin mislabelled: ' + JSON.stringify(toHill))

// 4 — home-ness is the TYPE, not the spine slot
for (const code of ['lived_at', 'owned_residence_at', 'lived_briefly_at']) {
  if (tripKind({ ...fiat, destination_type_code: code }).relocation) ok('"' + code + '" counts as a home')
  else bad('"' + code + '" was not treated as a home')
}
for (const code of ['worked_at', 'logged_at', 'wants_to_visit', 'traveled_for_work_to']) {
  if (!tripKind({ ...fiat, destination_type_code: code }).relocation) ok('"' + code + '" is not a home')
  else bad('"' + code + '" wrongly counted as a home')
}

// 5 — unknown type invents nothing, and still shows the owner's word
for (const code of [null, undefined]) {
  const r = tripKind({ ...fiat, destination_type_code: code })
  if (!r.relocation && r.label === 'Road trip') ok('destination type ' + String(code) + ' reads no relocation, keeps the subtype')
  else bad('missing destination type invented a relocation')
}

// 6 — one wording, so two surfaces cannot imply two different facts
if (typeof RELOCATION_READING === 'string' && RELOCATION_READING.length > 0)
  ok('the reading\\u2019s wording is shared: \\u201c' + RELOCATION_READING + '\\u201d')
else bad('no shared wording for the reading')

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.trip-kind-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
