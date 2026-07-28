#!/usr/bin/env node
/**
 * Proof for spine-derived recollection ordering — lib/journey/recollection-order.ts.
 *
 * "Recollections that mention this place" was sorted by capture time, newest
 * first, so Andy's Dartmouth chapter read Summer 1972 → 1976-77 → Summers
 * 1970/71 (2026-07-26 QA). He asked for chronological order.
 *
 * We cannot sort by date and never will: when_text / occurred_at_fuzzy are
 * free prose ("sophomore year at Dartmouth"), and invariant #5 keeps parsing
 * out of it. Instead we sort by the RESIDENTIAL SPINE — which invariant #5
 * itself calls the primary temporal scaffold. Every recollection has a home
 * pin; every home pin resolves to a stop (and, for a marker, a position inside
 * that stop's chapter). Nothing is parsed; the order is one the owner asserted.
 *
 * Known and accepted limit, proven here so it is never mistaken for a bug: a
 * recollection filed on a pin but ABOUT an earlier time sorts at its host
 * pin's position. No structural signal knows its content predates its home.
 *
 * Pure — no DB. Run: node scripts/verify-recollection-order.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { spineCoordinate, orderRecollectionsBySpine } from '${projectRoot}/lib/journey/recollection-order'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }
function expect(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) ok(label + ' \\u2192 ' + g)
  else bad(label + ': got ' + g + ', wanted ' + w)
}

// Andy's spine, abbreviated: Tokyo(5) → Dartmouth(6) → Coronet(7) … with
// markers hanging off them, and one marker hanging off another marker.
const pin = (id: string, sort_order: number | null, anchor_residence_id: string | null = null, anchor_sort_order: number | null = null) =>
  ({ relationship_id: id, sort_order, anchor_residence_id, anchor_sort_order })

const pins = new Map(Object.entries({
  tokyo:      pin('tokyo', 5),
  dartmouth:  pin('dartmouth', 6),
  coronet:    pin('coronet', 7),
  exeter:     pin('exeter', null, 'tokyo', 0),        // stay under Tokyo
  yokota:     pin('yokota', null, 'dartmouth', 1),    // stay under Dartmouth
  skischool:  pin('skischool', null, 'coronet', 0),   // workplace under Coronet
  ramada:     pin('ramada', null, 'skischool', 3),    // log under the workplace
  floating:   pin('floating', null, null),            // unanchored marker
  cyclic_a:   pin('cyclic_a', null, 'cyclic_b'),      // pathological pair
  cyclic_b:   pin('cyclic_b', null, 'cyclic_a'),
}))

// ── spineCoordinate: where does a pin sit in the scaffold? ──
expect('a spine stop is its own coordinate', spineCoordinate(pins, 'dartmouth'), { stop: 6, within: null })
expect('a marker takes its anchor stop + its chapter position', spineCoordinate(pins, 'yokota'), { stop: 6, within: 1 })
expect('a grandchild follows its PARENT marker into the chapter', spineCoordinate(pins, 'ramada'), { stop: 7, within: 0 })
expect('an unanchored marker has no coordinate', spineCoordinate(pins, 'floating'), null)
expect('an anchor cycle terminates rather than hanging', spineCoordinate(pins, 'cyclic_a'), null)
expect('an unknown pin has no coordinate', spineCoordinate(pins, 'ghost'), null)

// ── orderRecollectionsBySpine ──
const rec = (id: string, home: string | null, created_at: string) => ({ id, home_pin_id: home, created_at })
const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

// Andy's actual Dartmouth list, in the capture order that produced the jumble.
const dartmouthList = [
  rec('yokota-mem', 'yokota', '2026-07-12'),      // Summer 1972 — in chapter 6
  rec('mtsnow-mem', 'coronet', '2026-06-24'),     // 1976-77 — a later stop
  rec('exeter-mem', 'exeter', '2026-06-20'),      // Summers 1970/71 — chapter 5
  rec('native-mem', null, '2026-06-18'),          // native to Dartmouth itself
]
expect(
  'orders by the spine, not by capture time',
  ids(orderRecollectionsBySpine(dartmouthList, pins, { stop: 6, within: null })),
  ['exeter-mem', 'native-mem', 'yokota-mem', 'mtsnow-mem'],
)

// A recollection native to the stop sorts at the stop, AHEAD of the markers
// inside that same chapter — the stop is the chapter's opening.
expect(
  'the stop\\'s own recollections lead its chapter',
  ids(orderRecollectionsBySpine([rec('a', 'yokota', '2026-01-01'), rec('b', null, '2026-01-02')], pins, { stop: 6, within: null })),
  ['b', 'a'],
)

// Two markers in one chapter follow the owner's drag order (anchor_sort_order).
const chapterPins = new Map(Object.entries({
  home: pin('home', 3),
  second: pin('second', null, 'home', 1),
  first: pin('first', null, 'home', 0),
}))
expect(
  'within a chapter, the owner\\'s drag order decides',
  ids(orderRecollectionsBySpine([rec('x', 'second', '2026-01-01'), rec('y', 'first', '2026-01-02')], chapterPins, { stop: 3, within: null })),
  ['y', 'x'],
)

// Unplaceable recollections trail rather than vanishing or jumping the queue.
expect(
  'unresolvable homes trail, oldest first',
  ids(orderRecollectionsBySpine(
    [rec('lost', 'floating', '2026-02-02'), rec('older-lost', 'floating', '2026-01-01'), rec('placed', 'yokota', '2026-03-03')],
    pins, { stop: 6, within: null },
  )),
  ['placed', 'older-lost', 'lost'],
)

// Same coordinate → oldest first, so a chapter reads in the order it was told.
expect(
  'ties break to capture order, oldest first',
  ids(orderRecollectionsBySpine([rec('newer', 'yokota', '2026-05-05'), rec('older', 'yokota', '2026-01-01')], pins, { stop: 6, within: null })),
  ['older', 'newer'],
)

// Nothing may ever be dropped — this list is the chapter's evidence.
const big = [rec('a', 'yokota', '1'), rec('b', null, '2'), rec('c', 'floating', '3'), rec('d', 'exeter', '4')]
expect('every recollection survives the sort', orderRecollectionsBySpine(big, pins, { stop: 6, within: null }).length, 4)
expect('an empty list is fine', orderRecollectionsBySpine([], pins, { stop: 6, within: null }), [])

// ── The accepted limit, pinned so it reads as a decision, not a defect ──
// exeter-mem is about Summers 1970/71 but is filed on the Exeter pin, which
// sits in chapter 5 — correct. Were the SAME memory filed on Dartmouth
// (chapter 6) it would sort there, after chapter 5, despite being earlier.
expect(
  'a memory filed on a later pin sorts at that pin (known limit)',
  ids(orderRecollectionsBySpine([rec('highschool-on-dartmouth', null, '2026-01-01'), rec('exeter-mem', 'exeter', '2026-01-02')], pins, { stop: 6, within: null })),
  ['exeter-mem', 'highschool-on-dartmouth'],
)

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.recollection-order-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
