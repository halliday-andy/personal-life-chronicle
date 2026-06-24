---
name: project_lc_globe_entity_ux_brief
description: 2026-06-22 globe & entity UX enhancement brief (7 items) — agreed Opus 4.8 + Andy; AWAITS Claude Code review, esp. UI-element finalization + transactional design
metadata:
  type: project
---

A UX design brief was written 2026-06-22 capturing seven globe/entity enhancements, agreed in dialogue between Opus 4.8 and Andy. Canonical doc: `docs/plans/2026-06-22-globe-and-entity-ux-enhancements-design.md`.

**Status: REVIEWED BY CLAUDE CODE 2026-06-22.** Resequenced into the Step-7 slice plan — canonical revised roadmap: `docs/plans/2026-06-22-globe-and-entity-ux-revised-roadmap.md`. The original brief (`docs/plans/2026-06-22-globe-and-entity-ux-enhancements-design.md`) remains the product-intent record.

**Review outcome (key resolutions):**
- **Item 1 placard** — the field already exists (`entities.description`); no migration. The "1971–75" year chip presupposes structured dates we don't capture — MVP renders the free-text `when` phrase; clean year ranges wait for the Temporal Agent (invariant #5).
- **Item 6 (Person page) is the person-specialization of the already-designed-but-unbuilt [[context layer]] (`docs/plans/2026-06-14-context-layer-and-recollection-surfaces-design.md`)** — Entity View + `entity_context_notes` (open/private = `visibility`) + editable `/memories`. Verified none of it is built. Building the general Entity-View substrate first gives item 6 cheaply and clears the recurring context dead-end (Zaragoza, RAF Mildenhall).
- **Item 5 Hopper** → a dedicated **`memory_stubs`** table (host-agnostic, `status open|consumed`), NOT draft `memories` — keeps the Raw Vault append-only (invariant #1).
- **Items 1–3 fold into the Slice-3 region**; the item-3 active-lines tray is its own micro-slice (3.5).

**Andy's sequencing calls (2026-06-22):** (1) pull the Entity-View/context substrate forward; (2) Resume View near-term after globe legibility; (3) defer the TypeUI brand preset — keep nocturne styling.

**Revised slice order:** Slice 3 close-out (items 1,2,3-static + live proof) → Slice 3.5 (active-lines tray) → **Slice 3.6 (the "Log" pin)** → Resume View (item 4) → Slice 6 (Entity View + context substrate) → Slice 7 (Person page + Life's Cast + Hopper) → Vertical Moments parked.

**Phase-5 proof findings (Andy, 2026-06-22) — reshaped the globe track:**
1. Drag-refine is gated to edit mode (`GlobeView.tsx:423`) → add a **"Refine location"** detail-card action; auto-declutter deferred to Slice 5. (→ Slice 3 close-out)
2. **Bug:** marker→primary→marker re-type loses the anchor/tether (`validate_residence_anchor` clears it, nothing remembers it). Fix: stash `metadata.prior_anchor_residence_id`, restore on revert, default picker to nearest primary. (→ Slice 3 close-out)
3. **New "Log" pin type** (MVP trial label; candidates parked: Waypoint / Relic / Capture / Log = "a log entry in the journal of life") — a category-neutral place. Needs **generalized anchoring** (`validate_pin_anchor`: anchor to ANY own globe pin, primary or marker incl. vacation) + **recollection roll-up** (anchor's card includes recollections of pins anchored to it; transitive deferred). (→ Slice 3.6)
4. Orphan-on-retype test deferred until Log exists (Andy). (blocked on 3.6)
5. Workplace icon overwhelms primary residence at zoom-out (Queenstown/Coronet Peak) — primary should dominate. **Deferred to the pin-visual redesign** (Andy). Captured.

**Slice 3 close-out BUILT 2026-06-23** (`12a3392`…`a9183ce`, 7 atomic commits, all tsc+eslint clean, awaits Andy's live batch-proof): finding 2 (re-type anchor stash `metadata.prior_anchor_residence_id` + picker default), finding 1 (Refine-location detail-card action), item 1 placard (reuses `entities.description`; at-rest when-chip + hover card), item 2 origin pin, item 3 default-bare-spine + hover-preview of side lines, chevron enlarge + cool trip-tether color. Migrations `20260623120000` (retype restore) + `20260623130000` (get_residence_pins surfaces description) — both additive. **Type filters moved to Slice 3.5** (share the bottom-left selector + line-visibility state). **Log of a live-data hazard:** `verify-globe-slice4b.mjs` asserts empty-DB invariants and insert-shifts real pins; it shifted Andy's spine sort_order base 0→4 across two runs (restored to 0-based via `reorder_residence_pins`, order preserved). Fix spawned as a background task. Lesson reaffirms the existing relative-only verify-script rule.

The seven items:
1. **Pin legibility** — at-rest compact year-range chip per pin (e.g. `1971–75`, current = `2019–now`), plain text, NO visual proportionality (proportional timeline stays deferred to Temporal Agent, invariant #5); hover reveals name + a short user-written **placard** (likely a new short field); enlarge/sharpen spine chevrons.
2. **Origin pin** — keys off **sequence position #1** (not a semantic "birth" field); larger/graphically distinct "infancy" treatment, calm not attention-grabbing; shows its start year.
3. **Line decluttering** — default = primary spine only; hover = transient side-line preview; click = persist into an **active-lines tray** (dismissible chips + Clear all) docked with the bottom-left pin-type selector; detail-card toggle is a shortcut into that tray state; supports multi-pin line sets; add **type-level filters** in the same selector. Supersedes the earlier "toggle off then navigate away" idea.
4. **Resume View** — NEW surface: scrollable, chronological, card-oriented list of pin detail cards; recollections + photo collections + side pins nested as children; bidirectional globe sync (low-criticality); Hopper NOT shown here.
5. **The Hopper** — host-agnostic memory-stub notepad / consumable recollection checklist; lives on the full edit panel of a **pin** AND a **person** entity; primary input to the capture assistant's interviewer loop (expand a stub; offer newly-triggered memories back into the hopper). Architecture call pending: stub storage vs Raw Vault immutability (invariant #1) — draft-status memory vs separate `memory_stubs` table.
6. **Person Entity page** — detail page **behind** the planned Life's Cast timeline; aggregator/index of mentions linking OUT to recollections that still live on pins (never hosts them); also allows person-anchored recollections with no pin + open/private commentary (privacy via Access Cards, invariant #3); chronological ordering; **no auto-promotion** — user promotes a fleshed-out page into Life's Cast; toggle to show only pages with content.
7. **Vertical Moments** — PARKED future taxonomy axis (an 11th dimension): "70,000-foot view" moments of appreciation/gratitude/continuity. Capture only; awaits Andy's examples. Taxonomy treated as extensible.

Recommended sequencing (proposal for Claude Code): items 1–3 first, ideally folded into Slice 3's line/pin work; then 4 + 5; then 6 (own slice); 7 parked. See also [[reference_lc_designer_skills]] (designer skills added to give Claude Code UX/UI context for this work).
