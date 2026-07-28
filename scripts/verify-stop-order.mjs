#!/usr/bin/env node
/**
 * Proof for owner-ordered places at a stop — lib/journey/stop-order.ts.
 *
 * A primary residence is an era; the places anchored to it are what happened
 * inside it. Journey sorted them alphabetically by type code then by capture
 * time, which reads as arbitrary (Andy's QA, 2026-07-26).
 *
 * We cannot sort chronologically and never will: when_text is free prose
 * ("Summers 1970 and 1971"), and invariant #5 keeps structured dates out of
 * capture. So the order is the OWNER'S assertion — drag-and-drop, set once.
 *
 * The invariants proven here:
 *  - nothing reshuffles until the owner drags (all-unpositioned keeps the old
 *    type-then-created order),
 *  - a reorder NEVER loses or duplicates a place,
 *  - positioned places lead, unpositioned trail in the legacy order.
 *
 * Pure — no DB. Run: node scripts/verify-stop-order.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { orderStopPlaces, moveStopPlace, assignStopPositions, orderAnchoredSubtree } from '${projectRoot}/lib/journey/stop-order'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }
function expect(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) ok(label + ' \\u2192 ' + g)
  else bad(label + ': got ' + g + ', wanted ' + w)
}

// Andy's Dartmouth stop, as captured (NOT as lived): the legacy sort is
// type_code alphabetical, then created_at.
const place = (id: string, type_code: string, created_at: string, anchor_sort_order: number | null = null) =>
  ({ relationship_id: id, type_code, created_at, anchor_sort_order })

const stop = [
  place('yokota', 'lived_briefly_at', '2026-01-03'),
  place('blois', 'lived_briefly_at', '2026-01-01'),
  place('nauset', 'vacationed_at', '2026-01-02'),
  place('masshall', 'logged_at', '2026-01-04'),
]
const ids = (xs: { relationship_id: string }[]) => xs.map((x) => x.relationship_id)

// ── Day one: nobody has dragged anything, so nothing may move ──
// Legacy order = type_code alphabetical, then created_at. Note
// 'lived_briefly_at' < 'logged_at' ("i" before "o"), so the two stays lead,
// oldest first, then the log, then the vacation. Arbitrary against a life —
// which is the whole reason the owner gets to assert an order.
expect(
  'all unpositioned keeps the legacy type-then-created order',
  ids(orderStopPlaces(stop)),
  ['blois', 'yokota', 'masshall', 'nauset'],
)

// ── The owner asserts an order ──
const positioned = [
  place('yokota', 'lived_briefly_at', '2026-01-03', 0),
  place('masshall', 'logged_at', '2026-01-04', 1),
  place('blois', 'lived_briefly_at', '2026-01-01', 2),
  place('nauset', 'vacationed_at', '2026-01-02', 3),
]
expect('explicit positions win over the legacy sort', ids(orderStopPlaces(positioned)), ['yokota', 'masshall', 'blois', 'nauset'])

// A place added AFTER an ordering exists has no position — it trails, rather
// than silently landing in the middle of a sequence the owner arranged.
const withNewcomer = [...positioned, place('newplace', 'logged_at', '2026-02-01')]
expect('a newly added place trails the ordered ones', ids(orderStopPlaces(withNewcomer)), ['yokota', 'masshall', 'blois', 'nauset', 'newplace'])

// Two newcomers keep the legacy order among themselves.
const twoNew = [...positioned, place('zeta', 'vacationed_at', '2026-02-02'), place('alpha', 'logged_at', '2026-02-03')]
expect('several newcomers trail in legacy order', ids(orderStopPlaces(twoNew)).slice(4), ['alpha', 'zeta'])

// ── Dragging ──
expect('move a place later', moveStopPlace(['a', 'b', 'c', 'd'], 'a', 2), ['b', 'c', 'a', 'd'])
expect('move a place earlier', moveStopPlace(['a', 'b', 'c', 'd'], 'd', 0), ['d', 'a', 'b', 'c'])
expect('move to its own index is a no-op', moveStopPlace(['a', 'b', 'c'], 'b', 1), ['a', 'b', 'c'])
expect('index past the end clamps to last', moveStopPlace(['a', 'b', 'c'], 'a', 99), ['b', 'c', 'a'])
expect('negative index clamps to first', moveStopPlace(['a', 'b', 'c'], 'c', -5), ['c', 'a', 'b'])
// A drag must never lose a place — the whole point of an owner-asserted order
// is that the chronicle keeps everything the owner put in it.
expect('an unknown id leaves the list untouched', moveStopPlace(['a', 'b', 'c'], 'ghost', 0), ['a', 'b', 'c'])
expect('every move preserves the full set', moveStopPlace(['a', 'b', 'c', 'd'], 'c', 0).slice().sort(), ['a', 'b', 'c', 'd'])
expect('empty list survives a move', moveStopPlace([], 'a', 0), [])

// ── Persisting: the whole sibling list gets explicit positions on first drag,
// so an ordered stop never carries a positioned/unpositioned mix. ──
expect('positions are assigned 0..n-1 in list order', assignStopPositions(['x', 'y', 'z']), [
  { relationship_id: 'x', anchor_sort_order: 0 },
  { relationship_id: 'y', anchor_sort_order: 1 },
  { relationship_id: 'z', anchor_sort_order: 2 },
])
expect('assigning over an empty stop yields nothing', assignStopPositions([]), [])

// ── orderAnchoredSubtree: the globe card's flat subtree, in owner order ──
// The card shows a stop's places as one flat list (unlike Journey's nested
// rail), but nesting still MEANS something: a Log on a workplace belongs with
// that workplace. So direct places lead in the owner's order, and each is
// immediately followed by its own descendants.
const row = (id: string, anchor: string | null, pos: number | null, type = 'logged_at', created = '2026-01-01') =>
  ({ relationship_id: id, anchor_residence_id: anchor, anchor_sort_order: pos, type_code: type, created_at: created })
const flat = (xs: { relationship_id: string }[]) => xs.map((x) => x.relationship_id)

const subtree = [
  row('hotel', 'skischool', 0),          // grandchild, under the workplace
  row('skischool', 'HOST', 1, 'worked_at'),
  row('stay', 'HOST', 0, 'lived_briefly_at'),
  row('ramada', 'skischool', 1),         // second grandchild
]
expect(
  'direct places in owner order, each trailed by its descendants',
  flat(orderAnchoredSubtree(subtree, 'HOST')),
  ['stay', 'skischool', 'hotel', 'ramada'],
)
expect('an empty subtree is fine', orderAnchoredSubtree([], 'HOST'), [])
// Never lose a row: an orphan whose parent isn't in the payload still renders.
expect(
  'a row whose parent is missing still appears (trailing)',
  flat(orderAnchoredSubtree([row('orphan', 'gone', 0), row('direct', 'HOST', 0)], 'HOST')),
  ['direct', 'orphan'],
)
expect(
  'every row survives, cycles included',
  orderAnchoredSubtree([row('a', 'b', 0), row('b', 'a', 0), row('c', 'HOST', 0)], 'HOST').length,
  3,
)
// Unpositioned direct places fall back to the legacy order, as everywhere else.
expect(
  'unpositioned direct places keep the legacy order',
  flat(orderAnchoredSubtree(
    [row('vac', 'HOST', null, 'vacationed_at', '2026-01-01'), row('log', 'HOST', null, 'logged_at', '2026-01-02')],
    'HOST',
  )),
  ['log', 'vac'],
)

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.stop-order-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
