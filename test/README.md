# Component tests — what belongs here, and what does not

Two suites, two jobs. Neither replaces the other.

| | `scripts/verify-*.mjs` | `test/*.test.tsx` |
|---|---|---|
| run with | `npm run verify` | `npm test` |
| answers | *is this VALUE right?* | *does this happen at the right TIME?* |
| covers | pure functions, DB behaviour in a rolled-back transaction | mount order, late-arriving props, conditional rendering, what the user can read and click |
| **cannot** see | anything involving React | **geometry — layout, z-order, occlusion, scroll position** |

## Why this suite exists

Three bugs shipped on 2026-08-04 that the `verify-*` convention cannot
express, because none of them was a wrong value:

- **`d9171d7`** — `openChip` seeded by a `useState` initialiser from data
  that had not arrived. The broken code computed the right answer, one
  render too early. A pure test of the predicate passes against both
  versions; only mount order shows it. *This is the test that motivated the
  harness, and `test/pin-connections-auto-open.test.tsx` is it.*
- **`4bd75d2`** — a pending draft's trip read back from state since cleared.
- **`dff4fa8`** — a banner that never took the `!modalOpen` guard the
  dialog's mode statement depended on.

## The boundary, stated plainly

**This suite does not see layout.** jsdom computes no geometry. Half of
`4bd75d2` and half of `dff4fa8` were z-order — a confirm bar behind a card,
a banner over a dialog header — and **no test here would have caught
either**. The very first thing this harness hit on setup was
`scrollIntoView` not existing.

So: layout regressions stay with the QA checklists and Andy's eye. A
harness believed to cover more than it does is worse than no harness,
because it converts "we should look at this" into "the tests pass".

## Writing one

- Assert what the user can **read and click**, not implementation details.
  `getByRole`/`getByLabelText` over class names.
- If a control has no accessible name, that is usually a finding, not an
  obstacle to route around — the first run of these tests surfaced eight
  unlabelled inputs in `PinModal` and they were fixed rather than queried
  another way.
- `render` twice mounts two trees. Use `rerender` for "the props changed",
  which is what most timing tests actually mean.
- Prove the test fails against the bug before trusting it. A guard that has
  never failed on its own bug is unproven — for `d9171d7` that was done by
  removing the fix and watching exactly one test go red.
- `fetch` is stubbed globally to resolve `{}`; override locally when a test
  genuinely cares about a response.
