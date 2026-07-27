#!/usr/bin/env node
/**
 * Proof for owner-ordered places within a chapter — lib/journey/chapter-order.ts.
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
 * Pure — no DB. Run: node scripts/verify-chapter-order.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { orderChapterPlaces, moveChapterPlace, assignChapterPositions } from '${projectRoot}/lib/journey/chapter-order'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }
function expect(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) ok(label + ' \\u2192 ' + g)
  else bad(label + ': got ' + g + ', wanted ' + w)
}

// Andy's Dartmouth chapter, as captured (NOT as lived): the legacy sort is
// type_code alphabetical, then created_at.
const place = (id: string, type_code: string, created_at: string, anchor_sort_order: number | null = null) =>
  ({ relationship_id: id, type_code, created_at, anchor_sort_order })

const chapter = [
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
  ids(orderChapterPlaces(chapter)),
  ['blois', 'yokota', 'masshall', 'nauset'],
)

// ── The owner asserts an order ──
const positioned = [
  place('yokota', 'lived_briefly_at', '2026-01-03', 0),
  place('masshall', 'logged_at', '2026-01-04', 1),
  place('blois', 'lived_briefly_at', '2026-01-01', 2),
  place('nauset', 'vacationed_at', '2026-01-02', 3),
]
expect('explicit positions win over the legacy sort', ids(orderChapterPlaces(positioned)), ['yokota', 'masshall', 'blois', 'nauset'])

// A place added AFTER an ordering exists has no position — it trails, rather
// than silently landing in the middle of a sequence the owner arranged.
const withNewcomer = [...positioned, place('newplace', 'logged_at', '2026-02-01')]
expect('a newly added place trails the ordered ones', ids(orderChapterPlaces(withNewcomer)), ['yokota', 'masshall', 'blois', 'nauset', 'newplace'])

// Two newcomers keep the legacy order among themselves.
const twoNew = [...positioned, place('zeta', 'vacationed_at', '2026-02-02'), place('alpha', 'logged_at', '2026-02-03')]
expect('several newcomers trail in legacy order', ids(orderChapterPlaces(twoNew)).slice(4), ['alpha', 'zeta'])

// ── Dragging ──
expect('move a place later', moveChapterPlace(['a', 'b', 'c', 'd'], 'a', 2), ['b', 'c', 'a', 'd'])
expect('move a place earlier', moveChapterPlace(['a', 'b', 'c', 'd'], 'd', 0), ['d', 'a', 'b', 'c'])
expect('move to its own index is a no-op', moveChapterPlace(['a', 'b', 'c'], 'b', 1), ['a', 'b', 'c'])
expect('index past the end clamps to last', moveChapterPlace(['a', 'b', 'c'], 'a', 99), ['b', 'c', 'a'])
expect('negative index clamps to first', moveChapterPlace(['a', 'b', 'c'], 'c', -5), ['c', 'a', 'b'])
// A drag must never lose a place — the whole point of an owner-asserted order
// is that the chronicle keeps everything the owner put in it.
expect('an unknown id leaves the list untouched', moveChapterPlace(['a', 'b', 'c'], 'ghost', 0), ['a', 'b', 'c'])
expect('every move preserves the full set', moveChapterPlace(['a', 'b', 'c', 'd'], 'c', 0).slice().sort(), ['a', 'b', 'c', 'd'])
expect('empty list survives a move', moveChapterPlace([], 'a', 0), [])

// ── Persisting: the whole sibling list gets explicit positions on first drag,
// so an ordered chapter never carries a positioned/unpositioned mix. ──
expect('positions are assigned 0..n-1 in list order', assignChapterPositions(['x', 'y', 'z']), [
  { relationship_id: 'x', anchor_sort_order: 0 },
  { relationship_id: 'y', anchor_sort_order: 1 },
  { relationship_id: 'z', anchor_sort_order: 2 },
])
expect('assigning over an empty chapter yields nothing', assignChapterPositions([]), [])

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.chapter-order-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
