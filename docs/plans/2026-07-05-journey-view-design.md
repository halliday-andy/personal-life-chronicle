# Journey — slice design & phased plan

**Date:** 2026-07-05
**Status:** Agreed with Andy 2026-07-05. **BUILT — all phases J1–J5 shipped
2026-07-06/07** (J1 skeleton `1fc4863`…, J2 ember thread + transitions, J3
expand-to-detail, J4 `?pin=` handoff, J5 a11y pass). QA:
`docs/qa/2026-07-06-journey-j1-qa-checklist.md`.
**Supersedes:** item 4 ("Resume View") of the [2026-06-22 brief](2026-06-22-globe-and-entity-ux-enhancements-design.md) and the "Resume View (item 4)" section of the [revised roadmap](2026-06-22-globe-and-entity-ux-revised-roadmap.md). Those remain the product-intent record; this doc is canonical for the build.
**Owner:** Andy Halliday (product); design review by Claude Code (Fable 5).

---

## 1. What it is

**Journey** is a standalone, vertically scrollable, chronological reading surface
for the residential strand: the user's life journey as a column of stop cards,
connected by a vertical ember spine, readable top (origin) to bottom (now).
It is the linear, accessible, mobile-native counterpart to the globe — the same
story, read instead of explored.

**Name.** "Journey" — short form of "life journey," approved as a placeholder.
There is a deliberate interplay between *Journey* and *Journal* that may inform
a later naming pass across surfaces; parked, not forgotten. (The earlier working
name "Resume View" is retired: without the accent it reads as "continue," and
*résumé* evokes a CV — wrong register for a memoir.)

## 2. Decisions (agreed 2026-07-05)

| # | Decision | Detail |
|---|---|---|
| 1 | **Standalone route** `/journey` | A sibling surface under AppNav (which it inherits automatically), NOT a panel docked to the globe. The globe keeps its full-screen nocturne opt-out. Rationale: the brief itself concedes globe+list are hard to view simultaneously; a reading surface wants reading chrome. |
| 2 | **Sync = handoff via URL param**, not live wiring | Both surfaces read/write `?pin=<relationshipId>`. Switching surfaces lands the user centered/expanded on the last-attended stop; stops become deep-linkable for free. Live bidirectional sync is NOT built (was already low-criticality). |
| 3 | **Rows from the list payload; detail is lazy** | One `GET /api/globe/residence` call paints the whole journey (name, type, `when` phrase, placard `description`, anchor, sort_order all already returned). Rows are compact summary cards sharing the globe's visual vocabulary (type chip, when chip, placard). `PinDetailCard` is NOT mounted per row — it self-fetches (N+1) and is shaped for globe overlay, not reading. "No forked rendering" is honored at the subcomponent level. |
| 4 | **Nesting rule (one level of meaning, two of indent)** | Children of a primary stop = (a) marker pins anchored to it (workplace, vacation, Log …), each with its own excerpt when expanded; (b) the primary's own linked recollections. NO roll-up duplication at the parent level in this surface (the globe card's "Anchored here" chip serves that need there). A marker anchored to a marker (Log→vacation) nests under its actual anchor; visual indent caps at two levels. |
| 5 | **Ordering is spine `sort_order`, full stop** | "Chronological" means spine order. `when_text` renders verbatim as the chip; it is NEVER parsed into dates (invariant #5 — Temporal Agent territory). Children order: grouped by type, then `created_at`. |
| 6 | **Editing deep-links to the globe** | A stop's Edit action navigates to `/globe?pin=<id>&edit=1` rather than re-hosting `PinEditPanel`. One editor per thing (the line already drawn for recollections); drag-relocate is globe-only anyway. |
| 7 | **Emotional layer is IN the MVP** | Vertical ember spine + origin star + present-tense "now" + transition narration (§4). Approved as reinforcing comprehension of progression through time and places. |
| 8 | **Mobile-first** | The card column is designed at 375px first and relaxes upward. Journey is expected to become the primary mobile reading surface (the globe on a phone is inherently a compromise). |
| 9 | **The Hopper is not rendered in Journey** | Unchanged from the brief — the journey stays a compact readable sequence. (The Hopper itself is being re-sequenced separately; see §7.) |

## 3. Data & schema

**One additive migration** (no safety-gate stop): widen `get_residence_pins`
with a `move_reason TEXT` column reading `r.metadata->>'move_reason'` (written
by the Slice 2c extraction agent since 2026-06-10; today visible only as a
fact chip on the detail card). DROP + recreate per the established pattern
(return-shape change), shown before apply, with a relative-only self-cleaning
verify script.

Everything else reads existing endpoints:
- List: `GET /api/globe/residence` (`get_residence_pins`) — one call.
- Expand: `GET /api/globe/residence/[relationshipId]` — recollection, facts,
  photo signed URL, linked recollections, context-note titles, anchored pins.
  Fetched lazily on first expansion only.

No new tables, no new columns on base tables.

## 4. The emotional layer (spec)

The person scrolling this surface is re-reading their own life. Three elements,
all from existing data:

- **Vertical ember spine.** A continuous warm thread down the left margin
  connecting primary stop cards — the globe's glowing spine rotated 90°.
  The origin stop renders a **star** at the top of the thread (mirroring the
  globe's origin-pin treatment); the current residence anchors the bottom with
  its "…–now" phrase in present tense. Markers hang off the thread with short
  dashed stubs (echoing tether language), indented.
- **Transition narration.** Between consecutive primary stops, when the arriving
  stop's `move_reason` exists and isn't `unknown`, render a quiet phrase on the
  thread (e.g. "left for work →", reusing the detail card's `label()`
  vocabulary). When absent, render nothing — never fabricate connective tissue.
- **Copy voice.** Empty state is invitational ("Your journey starts with a
  first home — place it on the globe", linking there), not "No pins found."
  Loading is calm ("Laying out your journey…"). Section labels use product
  language ("Anchored here", "Recollections from this time").

**Motion:** row expansion eases out at 200–300ms; `prefers-reduced-motion`
disables the ease and any scroll animation; no scroll-jacking, ever.

**Accessibility:** Journey is the screen-reader-accessible representation of
the globe — claim it deliberately: `<ol>` of stops, proper heading levels
(place name as heading), landmarks, focus-visible on rows, keyboard
expand/collapse. This is an explicit acceptance criterion, not polish.

## 5. Phased plan

Build directly on `main` (project convention); `tsc + eslint` gate every
commit; verify script for the RPC change; Andy proofs live per phase.

### J1 — route + spine-ordered summary cards (walking skeleton)
`/journey` page under `(protected)`; one list fetch; primary stops in
`sort_order` as compact cards (name heading, type chip, `when` chip, placard);
markers indented under their anchor (two-level cap); origin and "now" stops
identifiable; single readable column, mobile-first (375px up).
**Accept:** whole spine renders in order from one request; children nest under
the right parents; a Log under a vacation nests under the vacation; no date
parsing anywhere; renders correctly at 375px and desktop widths.

### J2 — ember spine + transitions (the emotional layer)
Vertical thread + origin star + present-tense bottom; `move_reason` transition
phrases between primaries (needs the additive RPC widening + verify);
reduced-motion respected.
**Accept:** thread visually continuous across scroll; star tops it; transitions
render only where extraction data exists; RPC proof passes; `[taste]` items
flagged for Andy (thread weight, star size, phrase tone).

### J3 — expand-to-detail (lazy)
Tapping a stop expands it in place: recollection (markdown), primary photo
(lazy-loaded), fact chips, linked recollections, context-note titles linking to
the Entity View, per-child excerpts. Single-open accordion (matches the pin
card's single-open chip discipline); detail fetched on first expand only.
**Accept:** zero detail requests on initial render; expanding is <300ms
perceived (skeleton while fetching); photos lazy; links out to Entity View and
`/memories?entity=` work.

### J4 — cross-surface handoff
`?pin=<relationshipId>` read/written by both surfaces. Journey scrolls to +
expands that stop on load; the globe centers/selects it on load. Each journey
card gets "Show on globe →"; the globe detail card gets "Read in journey →";
AppNav gains **Journey**.
**Accept:** globe→journey and journey→globe land oriented on the same stop;
a cold deep link works; the globe still opts out of AppNav.

### J5 — a11y + polish proof
Semantics/keyboard pass per §4; empty/loading copy; QA walkthrough doc
(`docs/qa/2026-07-XX-journey-qa-checklist.md`) for Andy's proof.
**Accept:** keyboard-only traversal works; VoiceOver reads stops as a list of
named headings; QA doc published.

## 6. Scope guards (explicitly out)

- Era grouping, year normalization, proportional time — Temporal Agent
  (invariant #5). `when_text` verbatim only.
- PDF export; print styling.
- Live two-way selection sync (the URL handoff is the whole mechanism).
- Re-hosted edit panel (deep link instead; revisit only if the deep link
  proves clumsy in use).
- Inline photo galleries (primary photo only; gallery lives on the pin).
- The Hopper inside Journey (§7 — it lives on pin/person surfaces).
- Batch thumbnail endpoint (only if J3's per-expand loading feels slow).

## 7. Relationship to the Hopper (re-sequenced 2026-07-05)

The roadmap had bundled the Hopper into Slice 7 (Person page) because the two
share the `memory_stubs` substrate and a host-agnostic component. Andy's lived
experience laying the residential spine says the **pin-host notepad is needed
much earlier**: placing a pin surfaces top-of-mind memories faster than they
can be developed, and today they're simply lost. The bundling was packaging,
not dependency — the notepad needs only the additive `memory_stubs` migration
(roadmap M2) and a small component on the pin detail card / edit panel.

**Split:**
- **Hopper 5a (pin host, notepad MVP)** — `memory_stubs` migration + add/list/
  check-off on the pin surfaces. Pulled forward; small. Sequencing vs. Journey
  is Andy's call (see the 2026-07-05 session discussion).
- **Hopper 5b (interview loop + person host)** — capture-assistant consumes a
  stub into an interview → real recollection → stub consumed; offers newly
  triggered memories back into the hopper; person-entity host. Stays with
  Slice 7, riding on the Person page and the assistant work.

Journey continues to exclude the Hopper from its own rendering either way.

## 8. Cross-references

- Product intent: [2026-06-22 brief §4](2026-06-22-globe-and-entity-ux-enhancements-design.md) (superseded by this doc)
- Roadmap position: [revised roadmap](2026-06-22-globe-and-entity-ux-revised-roadmap.md) — Journey replaces "Resume View" in the execution order
- Slice state: `memory/project_lc_build_progress.md` (2026-07-05 handoff block)
- Invariants: project `CLAUDE.md` (#1 Raw Vault, #5 temporal scaffold)
- Design-review rationale: 2026-07-05 session (name, host, row anatomy, nesting, emotional layer)
