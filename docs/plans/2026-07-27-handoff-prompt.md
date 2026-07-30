# Handoff — Life Chronicle, session of 2026-07-27

*Written 2026-07-26 at the close of a long build+QA session. `origin/main` is at
**`2e69c03`**, working tree clean (the two untracked items — `WHAT-CHANGED.md`
and `YOUR-AI-SETUP-2026-07-16/` — are Andy's; leave them).*

---

## 1. Read in this order

1. `CLAUDE.md` — auto-loaded. Protocols + architectural invariants. Don't relitigate.
2. `memory/MEMORY.md` — the index; "Current state (read first)".
3. `memory/project_lc_build_progress.md` — the **top handoff block (2026-07-26)** is current.
4. `docs/plans/2026-07-17-spine-and-share-roadmap.md` — canonical roadmap. §3 is the next design unit; §5 holds what's parked.
5. `docs/qa/2026-07-17-master-qa-sequence.md` — the single prioritized QA walk.
6. New today, read before touching anything named "chapter" or "stop":
   `memory/project_lc_thematic_chapters.md` and
   `memory/feedback_lc_accessibility_deferral.md`.

## 2. Four decisions from 2026-07-26 — settled, do not reopen

- **"Chapter" is reserved for a future user-defined PUBLICATION object** (a
  relationship arc, a decade-long employer association) that spans many stops
  and overlaps other chapters. The pin-scoped thing — one primary residence
  plus its anchored places — is a **STOP**, in code *and* in user copy. Andy
  judges publication-chapters "nearly the same thing as a shareable
  collection"; roadmap §4 must decide whether they are ONE object before
  building either. `user_periods` stays dormant.
- **Ordering is the owner's assertion, never date-parsed.** `when_text` is free
  prose and invariant #5 keeps it that way. Two features today needed
  chronology and both got it structurally: stop places by drag order,
  cited recollections by spine position. Andy's steer for the eventual
  Temporal Agent conversation (agent-*promoted* time phrasing, never a
  required format) is recorded in `memory/project_lc_temporal_agent.md`.
- **Keyboard accessibility is deferred, not dropped.** Free-with-the-build
  semantics (real buttons, `aria-expanded`, `sr-only` where a visual cue is the
  sole carrier) still ship in every unit; dedicated keyboard surfaces wait.
  Running debt list in roadmap §5.
- **The globe card and Journey share their vocabulary and their components.**
  Two surfaces rendering one thing must use one component — this bit three
  times today.

## 3. State of the build

18 commits today, all pushed. In order:

| Unit | Commits |
|---|---|
| QA checklists caught up to Andy's walk | `81ade7b` |
| Pin-facts editor UI (closes the 07-10 design) | `59a6be2`, `8891dbf` |
| 19× duplicate-render fix + static guard | `ee67828` |
| Journey stop ordinals | `670ab15` |
| Fact placeholders read as real biography | `303784e` |
| "… more" — read a cited recollection in place | `6d6cda5` |
| Spine-derived recollection ordering | `51972bb` |
| Context zero-state (couldn't add the first note) | `bd0e9ce` |
| Stop places: data layer → API → Journey drag → globe card | `70fdb4d`, `adbdfd0`, `4a4d853`, `2e69c03` |
| "chapter" → "stop" rename | `aff4bd7` |
| Memory: temporal steer, a11y policy, thematic chapters | `0cc960c`, `cf9f9e5`, (in `aff4bd7`) |

**Migrations applied today** (both verified): `relationships.anchor_sort_order`
(additive) and `get_residence_pins` returning it (required a gated
`DROP FUNCTION`; Andy approved — verified afterwards: one function, no orphan
overload, 36 pins).

**Proof scripts, all green:** `verify-stop-order` (19), `verify-sticky-facts`
(26), `verify-recollection-order` (14), `verify-jsx-sibling-keys`,
`verify-journey-tree`, `verify-pin-image-order`, `verify-create-pin-payload`.

## 4. Class-of-bug rules added today

Each earned from a real finding. They generalize — apply them, don't rediscover them.

1. **Sibling React elements keyed by the same entity id collide** — React
   duplicates or omits them. Namespace keys by ROLE (`facts-${id}`,
   `connections-${id}`). Guard: `scripts/verify-jsx-sibling-keys.mjs`.
2. **A guard that has never failed on the bug it was written for is unproven.**
   The first version of that very guard PASSED while the bug was live — it only
   inspected direct children, and the colliding elements sat inside
   `{cond && <El/>}` slots. Caught only by reintroducing the bug to test the test.
3. **One writer per persisted shape.** `mergeFactsIntoMetadata` now serves both
   extraction and owner edits; two writers of one shape drift.
4. **Read through the proven reader.** A route re-reading a persisted shape by
   hand drifts from the reader that owns it.
5. **One definition per controlled vocabulary** — the model's tool enum and the
   owner's picker must read the same list.
6. **Check whether the sibling surface already solved it.** Third sighting
   today; I added a redundant `GET /api/memory/[id]` because the stop payload
   had carried the full text since `338d2b3`.
7. **Never hide the control that CREATES the first item behind the existence of
   an item.** The context chip was gated on `context.length > 0`, so ten of
   fourteen homes had no route to adding context at all.
8. **A truncated excerpt whose continuation lives elsewhere needs an explicit
   continuation affordance, not a hover state.** Second sighting.
9. **In an app that stores biography, placeholder text must be unmistakably
   illustrative** — never a well-formed fact.

## 5. What's next

**Immediately:** nothing is half-built. The stop-places unit is complete
through piece 3.

1. **Andy's live QA** is the gate on five checklists (see §6). The globe visual
   for the stop-places block and the pin-card reconciliation are the two
   oldest outstanding eyeballs.
2. **Loose-Ends surface design doc** (roadmap §3) — the next development unit,
   **design-first**, Andy's agreement before any code. Journey-doc pattern
   (`archive/2026-07-05-journey-view-design.md` is the shape). Must cover:
   user-asserted spine gaps (NEVER date-computed), unsequenced residences,
   draft trips, open jots across hosts, review-queue proposals, Future Places;
   tone as acceptance criteria (progressive disclosure, years-long framing,
   celebrate what exists, every item one tap from its capture flow); Step 8's
   orchestrated strand (assistant nudging off `chronicle/threshold.reached`)
   plus the KB lookup tool; and session-end capture triage.
3. Deferred but named: grandchild reorder (endpoint already supports it, UI
   unwired); keyboard reorder; the un-stick control for owner-edited facts;
   unifying fact-chip wording with the editor's curated labels.

## 6. QA state — master sequence Phase 1

Checked off: unsequenced residences, Slice 3 close-out, UI-checklist spine
remnants **and** §5 photos, globe pin search, basemap regime, legend swatch.

Still open in Phase 1 — **all five need Andy, not the agent**:

- `2026-07-19-trip-from-here-` — the walk he started this evening, **his resume point**
- `2026-07-20-context-card-` — now includes a new zero-state section
- `2026-07-20-pin-card-reconciliation-` — oldest pending eyeball
- `2026-07-26-pin-facts-editor-` — §3 proves the sticky invariant live
- `2026-07-26-stop-places-order-` — §3 proves a reorder can't lose a place

Plus the data chores: merge the Phillips Exeter twins, confirm the junk "Leo"
alias is gone from Leola Lapides, resolve ~5 "New mention" stub proposals.

## 7. Operational knowledge that will save you an hour

- **Claude CAN drive the running app now.** The Chrome extension connects only
  while the **Claude side panel is open** in Chrome — installed and
  site-permitted is not enough, and a clean Chrome restart alone did not do it.
  Then `list_connected_browsers` → `select_browser` → `tabs_context_mcp`. The
  panel can live in any tab, any tab group, any window; the MCP works in its
  own tab group and won't disturb Andy's tabs.
- **The globe often fails to finish its Mapbox init in the automated tab** on
  repeated hard navigations (the API is healthy — ~950ms, all pins). `/journey`
  and `/memories` verify cleanly. So **globe visuals remain Andy's** — say so
  explicitly rather than implying a render was confirmed.
- **Trap:** typing into the globe search box APPENDS to any existing query, and
  a stray Places pick drops a draft pin. Clear with the ✕ first; if a draft
  appears, Cancel it.
- Dual-write every memory change to the workspace `memory/` AND auto-memory
  (`.../spaces/21262e82-*/memory`). In sync as of `2e69c03`.
- Auto-push hook covers each commit; check `git status -sb` for `[ahead N]` and
  push manually if it lagged.
- Gates on every commit: `npx tsc --noEmit` + `npx next lint --dir app --dir
  components --dir lib`. Never `npm run build` while dev runs.
- Migrations via `node scripts/db-apply.mjs <file>`; additive is ungated,
  anything dropping or altering existing data needs Andy — and **`DROP
  FUNCTION` counts**, even to add a return column.

## 8. Standing guards (unchanged, do not weaken)

`role='location'` is the pin-overview discriminator (mentions use `'mentioned'`);
words-are-not-actions (tool results required); `merge_entities` preserves
substance both directions; `entities.metadata` is MERGE-only; UI flows needing
visible outcomes get deterministic links at their own gate; never re-enumerate
payload fields inline at a boundary (use one guarded builder); home-ness is the
TYPE, not the spine slot; a modifier-only CSS class applied without its base
collapses to its box-shadow.
