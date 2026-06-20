#!/usr/bin/env node
/**
 * Proof for lib/globe/reorder.ts — the pure re-sequencing used by the
 * edit-panel "Where does this fall in your life?" selector (Step 7 Slice 4b
 * follow-up). The selector lets a user jump an existing spine pin to an
 * arbitrary slot in one write; this helper computes the full ordered id
 * list that the reorder_residence_pins RPC expects.
 *
 * Pure logic, no DB. Plain JS so Node runs it directly; the imported .ts
 * helper has its types stripped by Node. Run: node scripts/verify-globe-reorder.mjs
 */

import { moveToIndex, spineSlotOptions } from '../lib/globe/reorder.ts'

let failures = 0
function eq(label, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) {
    console.log(`  ✓ ${label}`)
  } else {
    failures++
    console.error(`  ✗ ${label}\n      got:  ${g}\n      want: ${w}`)
  }
}

console.log('moveToIndex:')

const base = ['A', 'B', 'C', 'D']

// Move later: C (idx 2) → after D (final idx 3)
eq('move middle later', moveToIndex(base, 2, 3), ['A', 'B', 'D', 'C'])
// Move earlier: D (idx 3) → earliest (final idx 0)
eq('move last to first', moveToIndex(base, 3, 0), ['D', 'A', 'B', 'C'])
// Move first later by one: A (idx 0) → final idx 1
eq('move first later one', moveToIndex(base, 0, 1), ['B', 'A', 'C', 'D'])
// No-op: same index returns the same order (a copy)
eq('no-op same index', moveToIndex(base, 2, 2), ['A', 'B', 'C', 'D'])
// To the very end explicitly
eq('move to last index', moveToIndex(base, 0, 3), ['B', 'C', 'D', 'A'])

// Purity: the input array is never mutated
const input = ['A', 'B', 'C', 'D']
moveToIndex(input, 0, 3)
eq('input not mutated', input, ['A', 'B', 'C', 'D'])

// Robustness: to-index clamped into range rather than producing holes
eq('to clamped above range', moveToIndex(base, 0, 99), ['B', 'C', 'D', 'A'])
eq('to clamped below range', moveToIndex(base, 3, -5), ['D', 'A', 'B', 'C'])
// Out-of-range from returns an unchanged copy (defensive)
eq('from out of range is no-op', moveToIndex(base, 9, 0), ['A', 'B', 'C', 'D'])
// Single-element list is always a no-op copy
eq('single element', moveToIndex(['X'], 0, 0), ['X'])

console.log('spineSlotOptions (self excluded from reference labels):')

// Self in the middle: [A, B, C, D], self = C (index 2). Others = A, B, D.
const mid = spineSlotOptions(['A', 'B', 'C', 'D'], 2)
eq('middle: option values', mid.map((o) => o.value), [0, 1, 2, 3])
eq('middle: labels exclude self', mid.map((o) => o.label), [
  'Before A (earliest)',
  'After A',
  'After B',
  'After D (most recent)',
])
// The current slot (value === selfIndex) must be a truthful description: C is
// "After B", and selecting it is a no-op via moveToIndex.
eq('middle: current slot is a no-op', moveToIndex(['A', 'B', 'C', 'D'], 2, 2), ['A', 'B', 'C', 'D'])
// And the "After D" option (value 3) actually lands C after D.
eq('middle: After D lands correctly', moveToIndex(['A', 'B', 'C', 'D'], 2, 3), ['A', 'B', 'D', 'C'])

// Self first: [A, B, C], self = A (index 0). Others = B, C.
const first = spineSlotOptions(['A', 'B', 'C'], 0)
eq('first: labels', first.map((o) => o.label), [
  'Before B (earliest)',
  'After B',
  'After C (most recent)',
])

// Two pins only: [A, B], self = B (index 1). Others = A.
const two = spineSlotOptions(['A', 'B'], 1)
eq('two pins: labels', two.map((o) => o.label), [
  'Before A (earliest)',
  'After A (most recent)',
])

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll reorder assertions passed.')
