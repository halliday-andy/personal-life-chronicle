#!/usr/bin/env node
/**
 * Proof for the anchor-picker candidate list (lib/globe/anchor-options.ts).
 * Pure-function test — no DB.
 *
 * Origin (2026-07-18, Andy's live find): the picker listed SEQUENCED
 * primaries only, so a workplace could not anchor to a just-created
 * "decide later" home. Home-ness is the TYPE, not the spine slot — U9
 * excludes unsequenced homes from ORDER logic, never from being homes.
 *
 * Asserts:
 *   1. A Log offers every pin, input order preserved (unchanged behavior).
 *   2. Any other marker offers HOMES only: primary (sequenced AND
 *      unsequenced), second residence, short-term stay — never
 *      vacations/travel/workplaces/future places.
 *   3. Ordering: sequenced primaries in spine order, then unsequenced
 *      primaries, then second residences, then short stays.
 *   4. isUnplacedHome flags exactly the unsequenced primaries (drives the
 *      "· not yet placed" option suffix).
 *
 * Run: node scripts/verify-anchor-options.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { anchorCandidates, isUnplacedHome } from '${projectRoot}/lib/globe/anchor-options'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

const pin = (id: string, name: string, type: string | null, sort: number | null = null) =>
  ({ relationship_id: id, name, type_code: type, sort_order: sort })

// Deliberately shuffled input order.
const pins = [
  pin('vac', 'Beach Week', 'vacationed_at'),
  pin('short', 'Summer Sublet', 'lived_briefly_at'),
  pin('la', 'LA Home', 'lived_at', null), // the unsequenced home from the repro
  pin('home2', 'Second Stop', 'lived_at', 1),
  pin('log', 'Lighthouse', 'logged_at'),
  pin('second', 'Lake House', 'owned_residence_at'),
  pin('work', 'Old Office', 'worked_at'),
  pin('home1', 'First Stop', 'lived_at', 0),
  pin('fut', 'Someday Kyoto', 'wants_to_visit'),
  pin('trav', 'Convention Trip', 'traveled_for_work_to'),
]

const ids = (r: { relationship_id: string }[]) => r.map((p) => p.relationship_id)

// 1. Log: everything, untouched order
if (JSON.stringify(ids(anchorCandidates(pins, 'logged_at'))) === JSON.stringify(ids(pins)))
  ok('Log offers every pin in input order')
else bad('Log list changed: ' + JSON.stringify(ids(anchorCandidates(pins, 'logged_at'))))

// 2 + 3. Workplace: homes only, grouped and ordered
const work = ids(anchorCandidates(pins, 'worked_at'))
if (JSON.stringify(work) === JSON.stringify(['home1', 'home2', 'la', 'second', 'short']))
  ok('workplace offers homes only: spine order, then unplaced, then second, then short stay')
else bad('workplace list wrong: ' + JSON.stringify(work))
if (!work.includes('vac') && !work.includes('log') && !work.includes('work') && !work.includes('fut') && !work.includes('trav'))
  ok('vacations / logs / workplaces / future / travel never offered as homes')
else bad('non-home leaked into the home list')

// The repro itself
if (work.includes('la')) ok('an unsequenced primary IS offered (the 2026-07-18 find)')
else bad('unsequenced primary still missing')

// Same list for the other marker types
for (const t of ['vacationed_at', 'traveled_for_work_to', 'owned_residence_at', 'lived_briefly_at', 'wants_to_visit']) {
  if (JSON.stringify(ids(anchorCandidates(pins, t))) !== JSON.stringify(work)) {
    bad('type ' + t + ' got a different home list')
  }
}
ok('all non-Log marker types share the same home list')

// 4. isUnplacedHome
const flags = pins.filter(isUnplacedHome).map((p) => p.relationship_id)
if (JSON.stringify(flags) === JSON.stringify(['la'])) ok('isUnplacedHome flags exactly the unsequenced primary')
else bad('isUnplacedHome wrong: ' + JSON.stringify(flags))

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.anchor-options-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
