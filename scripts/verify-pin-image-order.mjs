#!/usr/bin/env node
/**
 * Proof for the pin-photo ordering logic (2026-07-20) — lib/globe/pin-image-order.ts.
 *
 * Andy's finding (UI checklist §5): new photos jumped to the front and
 * sequential adds came out reversed, because the gallery sorted by created_at
 * DESC with no stored order. The fix stores an explicit sort_order; this proves
 * the pure ordering rules: primary first, then the carousel by sort_order asc
 * (nulls last, created_at tiebreak); new photos append at the end; reorder
 * assigns 0..N-1; and promoting a photo drops the former primary to the end.
 *
 * Pure — no DB. Run: node scripts/verify-pin-image-order.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { sortGallery, nextSortOrder, applyReorder } from '${projectRoot}/lib/globe/pin-image-order'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }
function expect(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) ok(label + ' \\u2192 ' + g)
  else bad(label + ': got ' + g + ', wanted ' + w)
}
const P = (media_id: string, is_primary: boolean, sort_order: number | null, created_at: string) => ({ media_id, is_primary, sort_order, created_at })
const ids = (rows: { media_id: string }[]) => rows.map((r) => r.media_id).join(',')

// ── sortGallery: primary first, then sort_order asc, nulls last, created_at tiebreak ──
expect(
  'sort: primary first, carousel by sort_order, nulls last (created_at tiebreak)',
  ids(sortGallery([
    P('b', false, 1, '2020-01-02'),
    P('cover', true, 5, '2020-01-01'),   // primary wins regardless of its sort_order
    P('a', false, 0, '2020-01-03'),
    P('old2', false, null, '2019-06-01'),
    P('old1', false, null, '2019-01-01'),
  ])),
  'cover,a,b,old1,old2',
)

// ── nextSortOrder: max(non-null) + 1, else 0 ──
expect('next: empty → 0', nextSortOrder([]), 0)
expect('next: all null → 0', nextSortOrder([{ sort_order: null }, { sort_order: null }]), 0)
expect('next: [0,1,2] → 3', nextSortOrder([{ sort_order: 0 }, { sort_order: 1 }, { sort_order: 2 }]), 3)
expect('next: [null,0,5] → 6', nextSortOrder([{ sort_order: null }, { sort_order: 0 }, { sort_order: 5 }]), 6)

// ── applyReorder: assign 0..N-1 in the given order ──
expect('reorder assigns 0..N-1', applyReorder(['a', 'b', 'c']), [
  { media_id: 'a', sort_order: 0 },
  { media_id: 'b', sort_order: 1 },
  { media_id: 'c', sort_order: 2 },
])

// ── new photo appends at the end of the carousel ──
{
  const rows = [P('a', true, 0, 't1'), P('b', false, 1, 't2'), P('c', false, 2, 't3')]
  const withNew = [...rows, P('d', false, nextSortOrder(rows), 't4')]
  expect('new photo lands last (a is the cover)', ids(sortGallery(withNew)), 'a,b,c,d')
}

// ── promote drops the former primary to the end of the carousel ──
{
  const rows = [P('Y', true, 0, 't1'), P('A', false, 1, 't2'), P('B', false, 2, 't3'), P('X', false, 3, 't4')]
  const bumped = nextSortOrder(rows) // 4
  const after = rows.map((r) =>
    r.media_id === 'X' ? { ...r, is_primary: true }
    : r.media_id === 'Y' ? { ...r, is_primary: false, sort_order: bumped }
    : r,
  )
  expect('promote X → X is cover, former primary Y goes to the end', ids(sortGallery(after)), 'X,A,B,Y')
}

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.pin-image-order-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
