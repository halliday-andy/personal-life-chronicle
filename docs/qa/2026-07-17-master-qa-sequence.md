# Master QA sequence — one prioritized walk (2026-07-17)

*Consolidates every open QA item into a single sequence, per Andy's request
2026-07-17. Ordering is NOT build order — it is priority order against the
three strategic objectives agreed the same day (see
`docs/plans/2026-07-17-spine-and-share-roadmap.md`):*

1. *the **loose-ends surface** (guided completion),*
2. *a **correct birth-to-now residential spine** in weeks,*
3. *the **shareable spine + shareable collections**.*

*Each phase is sized to one sitting. Check items off in the ORIGINAL
checklists (linked per phase) so their history stays intact; this file
tracks only phase-level progress. This is a long list because the app is
now large — that is a sign of ground covered, not ground lost. One phase
at a time.*

**Open totals at creation:** 176 unchecked items across 12 checklists.
Fully complete and needing nothing: journey-j1 (34/34), hopper-5a (12/12),
memories-owner-edit (17/17), stub-resolution (9/9), pin-adoption-and-aliases
(9/9).

---

## Phase 1 — Spine correctness *(serves: spine in weeks)*

The spine is the shareable deliverable's backbone; these items prove the
mechanics that placing, sequencing, and correcting it depend on.

- [ ] **Unsequenced residences** — [2026-07-15-unsequenced-residences-qa-checklist.md](2026-07-15-unsequenced-residences-qa-checklist.md) (0/13). The newest spine capability: decide-later creation, demote/re-place, spine integrity, Journey "Not yet placed" group. Do this first — it is the mechanism the loose-ends surface will lean on for "homes you haven't placed yet."
- [ ] **Slice 3 close-out re-tests** — [2026-06-24-globe-slice3-closeout-qa-checklist.md](2026-06-24-globe-slice3-closeout-qa-checklist.md) (37/50; open: §4 chevron-on-line, §5 refine-location fix, §12 re-type round-trip restore, §13 orphan-on-retype, §14 pin naming + recollection markdown). These are the spine-editing correctness fixes that were re-queued after the 06-24 rounds.
- [ ] **UI checklist spine remnants** — [2026-06-15-ui-qa-checklist.md](2026-06-15-ui-qa-checklist.md) §3 standalone-marker, §4 re-type anchor-safety + relocate-save (3 items; leave §5 photos for Phase 5).

- [ ] **Globe pin search** — [2026-07-18-globe-pin-search-qa-checklist.md](2026-07-18-globe-pin-search-qa-checklist.md). Built 2026-07-18 from this phase's first finding (navigating to a prior spine stop required manual globe flying or a detour through Journey): the search box now matches your own pins (all types) above external places.
- [ ] **Basemap regime (nocturne ↔ daylight)** — [2026-07-18-basemap-regime-qa-checklist.md](2026-07-18-basemap-regime-qa-checklist.md). Built 2026-07-18 from the Sunshine Village comparison: past reading zoom the dark basemap crosses to the detailed outdoors style (hysteresis + dissolve), back to nocturne on zoom-out.

**Data chores to fold into this sitting** (5 minutes each, all on /entities
or /review): merge the Phillips Exeter twins (safe in either direction since
`20260706130000`); confirm the junk "Leo" alias is gone from Leola Lapides
(alias-chip ×); resolve the ~5 remaining "New mention" stub proposals.

## Phase 2 — Capture fidelity & the loose-ends machinery *(serves: loose-ends surface)*

The surface will be assembled FROM these parts — jots, seeded write-ups,
person capture, paste fidelity. Proving them now de-risks its build.

- [ ] **Rich paste** — [2026-07-16-rich-paste-qa-checklist.md](2026-07-16-rich-paste-qa-checklist.md) (0/9). Research paste keeping markdown on every input surface; the Biggs repro.
- [ ] **Slice 7 remainder** — [2026-07-07-slice7-person-page-qa-checklist.md](2026-07-07-slice7-person-page-qa-checklist.md) (9/22; open: §3 person-anchored recollections, §4 person hopper, §5 the 5b assistant loop incl. mid-conversation jot offers, §6 regression spot-checks).

## Phase 3 — Context & collection richness *(serves: shareable collections)*

Context notes + Entity View are the substrate a shareable collection will
draw on (background, sources, the entity web around an experience). This is
the largest single walkthrough — it was deliberately deferred until Slice 6
completed; it is now the direct preparation for the share arc.

- [ ] **Slice 6 Entity View + context** — [2026-06-24-slice6-entity-view-context-qa-checklist.md](2026-06-24-slice6-entity-view-context-qa-checklist.md) (4/40; open: §6.2 Entity View page, §6.3 add context, §6.4 entity chips + globe link, §6.5a/b context capture incl. the assistant's context-proposal card, §6.6 markdown/titles/in-place edit + pin count-chips).

## Phase 4 — Trips & travel *(the elaboration tail — important, not urgent)*

Travel is part of the years-long elaboration, not the weeks-scale spine
goal, so it walks after Phases 1–3. Exception already honored in Phase 1:
unsequenced residences (built as trips U9) moved up because it is spine
machinery.

- [ ] **Trips capture** — [2026-07-15-trips-capture-qa-checklist.md](2026-07-15-trips-capture-qa-checklist.md) (0/12) — includes AE5 origin-before-the-spine, which touches Phase-1 machinery.
- [ ] **Trips on the globe** — [2026-07-15-trips-globe-qa-checklist.md](2026-07-15-trips-globe-qa-checklist.md) (0/17).
- [ ] **Travel Journal** — [2026-07-15-travel-journal-qa-checklist.md](2026-07-15-travel-journal-qa-checklist.md) (0/16).
- [ ] **Retro framing** — [2026-07-15-trips-retro-framing-qa-checklist.md](2026-07-15-trips-retro-framing-qa-checklist.md) (0/15) — AE2 on the real Wallace Monument pin.
- [ ] **Frequent traveler** — [2026-07-15-trips-frequent-traveler-qa-checklist.md](2026-07-15-trips-frequent-traveler-qa-checklist.md) (0/14).
- [ ] **Future Places** — [2026-07-15-future-places-qa-checklist.md](2026-07-15-future-places-qa-checklist.md) (0/10).

## Phase 5 — Residual polish

- [ ] **Photos / gallery** — [2026-06-15-ui-qa-checklist.md](2026-06-15-ui-qa-checklist.md) §5 (5 items: HEIC, multi-photo gallery, primary promotion, full-size viewer).

---

## How findings feed back

Per the established pattern, each phase's findings become a same-week
remediation pass before the next phase starts (historically each QA round
has produced about a day of real fixes). The
[pin-facts editor enhancement](../plans/2026-07-10-pin-facts-editor-enhancement.md)
(agreed 2026-07-10) rides whichever remediation pass first touches the
globe/journey code region — likely Phase 1's.
