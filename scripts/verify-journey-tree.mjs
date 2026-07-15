#!/usr/bin/env node
/**
 * Proof for the Journey tree builder (lib/journey/tree.ts, J1).
 * Pure-function test — no DB, fixture pins only.
 *
 * Asserts:
 *   1. Primary stops come out in spine sort_order (nulls last).
 *   2. A marker nests under its anchor primary.
 *   3. A Log anchored to a vacation nests under the VACATION (J1
 *      acceptance line), not the vacation's home.
 *   4. A standalone marker (no anchor) lands in `unanchored`.
 *   5. A marker whose anchor id doesn't resolve (deleted pin) lands in
 *      `unanchored` — nothing disappears.
 *   6. An anchor CYCLE between two markers still renders (island guard).
 *
 * Run: node scripts/verify-journey-tree.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { buildJourneyTree } from '${projectRoot}/lib/journey/tree'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

const pin = (over: any) => ({
  relationship_id: over.id,
  place_entity_id: 'e-' + over.id,
  name: over.name ?? over.id,
  when_text: over.when ?? null,
  sort_order: over.sort ?? null,
  type_code: over.type ?? 'lived_at',
  anchor_residence_id: over.anchor ?? null,
  description: over.placard ?? null,
  created_at: over.created ?? '2026-01-01T00:00:00Z',
})

// Fixture journey: two homes (out of order in the input), a workplace on
// home1, a vacation on home2, a Log on the VACATION, a standalone stay,
// an orphan whose anchor is gone, and a 2-cycle of Logs.
const pins = [
  pin({ id: 'home2', name: 'Second Home', sort: 1 }),
  pin({ id: 'home1', name: 'First Home', sort: 0, when: '1960 to 1965' }),
  pin({ id: 'work1', name: 'Office', type: 'worked_at', anchor: 'home1' }),
  pin({ id: 'vac1', name: 'Beach House', type: 'vacationed_at', anchor: 'home2' }),
  pin({ id: 'log1', name: 'Lighthouse', type: 'logged_at', anchor: 'vac1' }),
  pin({ id: 'solo', name: 'Standalone Stay', type: 'lived_briefly_at' }),
  pin({ id: 'orphan', name: 'Orphaned Trip', type: 'traveled_for_work_to', anchor: 'deleted-pin' }),
  pin({ id: 'cyc-a', name: 'Cycle A', type: 'logged_at', anchor: 'cyc-b' }),
  pin({ id: 'cyc-b', name: 'Cycle B', type: 'logged_at', anchor: 'cyc-a' }),
  // U9: an unsequenced home (lived_at, sort_order NULL) + a marker on it.
  pin({ id: 'tbd1', name: 'Unplaced Home', sort: null }),
  pin({ id: 'tbd1-log', name: 'Corner Bar', type: 'logged_at', anchor: 'tbd1' }),
]

const tree = buildJourneyTree(pins as any)

// 0. Unsequenced homes (U9): off the thread, in their own group, with
// their anchored markers still nested beneath them.
const unplacedIds = tree.unplaced.map((n) => n.relationship_id)
if (JSON.stringify(unplacedIds) === JSON.stringify(['tbd1'])) ok('unsequenced home lands in unplaced, not stops')
else bad('unplaced wrong: ' + JSON.stringify(unplacedIds))
if (!tree.stops.some((s) => s.relationship_id === 'tbd1')) ok('unsequenced home never renders as a spine stop')
else bad('unsequenced home leaked into stops')
const tbd = tree.unplaced[0]
if (tbd && tbd.children.some((c) => c.relationship_id === 'tbd1-log')) ok('markers still nest under an unplaced home')
else bad('unplaced home lost its children')

// 1. Spine order
const stopIds = tree.stops.map((s) => s.relationship_id)
if (JSON.stringify(stopIds) === JSON.stringify(['home1', 'home2'])) ok('stops in spine sort_order despite input order')
else bad('stop order wrong: ' + JSON.stringify(stopIds))

// 2. Marker under its primary
const home1 = tree.stops[0]
if (home1.children.some((c) => c.relationship_id === 'work1')) ok('workplace nests under its home')
else bad('workplace missing from home1: ' + JSON.stringify(home1.children.map((c) => c.relationship_id)))

// 3. Log under the vacation (marker→marker)
const home2 = tree.stops[1]
const vac = home2.children.find((c) => c.relationship_id === 'vac1')
if (vac && vac.children.some((c) => c.relationship_id === 'log1')) ok('Log anchored to a vacation nests under the vacation')
else bad('log1 not under vac1: ' + JSON.stringify(home2.children))

// 4 + 5. Standalone + orphan → unanchored
const un = tree.unanchored.map((n) => n.relationship_id)
if (un.includes('solo')) ok('standalone marker lands in unanchored')
else bad('solo missing from unanchored: ' + JSON.stringify(un))
if (un.includes('orphan')) ok('marker with a dead anchor lands in unanchored (nothing disappears)')
else bad('orphan missing from unanchored: ' + JSON.stringify(un))

// 6. Cycle island still reachable
const flat: string[] = []
const walk = (n: any) => { flat.push(n.relationship_id); n.children.forEach((c: any) => { if (!flat.includes(c.relationship_id)) walk(c) }) }
tree.stops.forEach(walk)
tree.unanchored.forEach(walk)
if (flat.includes('cyc-a') && flat.includes('cyc-b')) ok('anchor cycle is still rendered (island guard)')
else bad('cycle island lost: ' + JSON.stringify(flat))

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.journey-tree-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
