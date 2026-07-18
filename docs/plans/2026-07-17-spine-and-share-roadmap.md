# Spine & Share — the post-Trips roadmap

**Date:** 2026-07-17
**Author:** Claude Code (Fable 5), from a plans-portfolio review discussed with Andy the same day.
**Status:** Direction agreed with Andy 2026-07-17; unit designs pending (each design-first unit gets its own doc before build, Journey-doc pattern).
**Supersedes:** `archive/2026-06-22-globe-and-entity-ux-revised-roadmap.md` (exhausted 2026-07-07) and `archive/2026-07-07-claude-code-handoff-prompt-post-slice7.md` (pre-dated Trips). Parked items from both are re-homed in §5.

---

## 1. Strategic direction (Andy, 2026-07-17)

The capture-and-organization layer is built and rich (globe, trips, journey,
entities, hopper, context). The product's center of gravity now shifts to
**guided completion and give-back**, on two tracks:

**Track A — a correct skeletal spine, birth to now, in weeks not months.**
The residential spine is the one artifact that can and should be *complete*
soon. The app's job is to actively guide the user there.

**Track B — something shareable and fairly complete.** Two shareable
elements: the **spine itself**, and a new concept — the **shareable
collection**: one or more recollections gathered around a past experience,
shared with people who were part of it or who care about it, who
collaborate through commentary and feedback (the enrichment-invitation
model, `memory/project_lc_single_post_share.md`, widened from single post
to experience collection).

**The framing constraint that shapes everything:** full elaboration of a
life is a *years-long* project — that is the product's nature, not a
failure state. Surfaces that show remaining work must therefore be
extensive yet **undaunting**: encouraging persistent, incremental use,
never presenting the chronicle as an overdue to-do list. Completion
pressure applies to the spine skeleton only; everything else is invitation.

## 2. Unit 0 — the master QA walk + remediation (start immediately)

Canonical sequence: [`docs/qa/2026-07-17-master-qa-sequence.md`](../qa/2026-07-17-master-qa-sequence.md)
— all 176 open items in five phases, prioritized to this roadmap's
objectives (spine correctness → loose-ends machinery → context/collection
substrate → trips → polish), each phase one sitting, findings feeding a
same-week remediation pass. The
[pin-facts editor](2026-07-10-pin-facts-editor-enhancement.md) rides the
first globe-region remediation, as does **globe pin search** (agreed
2026-07-18, the first Phase-1 finding: the Find-Location box gains a
"Your pins" results group — ALL pin types, Andy's call — that flies to
and selects the matched pin; search-as-navigation in one merged dropdown,
with the coordinate-paste and suggest-crash-guard behaviors preserved). QA phases interleave with the units below;
only Phase 1 (spine correctness) hard-gates Unit 1's build.

## 3. Unit 1 — the Loose-Ends surface *(Track A's engine; design doc first)*

A reincarnation of the vestigial Dashboard as the place the app answers
**"where were we?"** — and gently steers toward spine completeness.

**What it gathers (all machinery already exists):**
- spine gaps the *user* asserts (no date parsing — invariant #5; the
  surface prompts "anything between X and Y?" style reflection, it never
  computes gaps from dates),
- unsequenced residences awaiting placement,
- draft trips needing framing,
- open jots across all hosts (the Hopper's cross-host rollup),
- pending review-queue proposals,
- Future Places (aspirational, lightest touch).

**Tone requirements (acceptance criteria, not decoration):** progressive
disclosure — a handful of invitations, never the full ledger; explicit
years-long framing ("your chronicle grows for as long as you tend it");
celebrate what exists (coverage so far, recollections written) at least as
prominently as what's missing; every item is an *invitation into a capture
flow*, one tap from acting on it.

**Prevention beats display:** the surface shows pending review proposals,
so anything that reduces their inflow serves it. The June Gemini commentary
(§2C) suggests a session-end cleanup moment — "here are the N recollections
I captured from our talk; save/adjust/discard?" — bulk triage while the
conversation is fresh, instead of quiet drafts accreting into backlog.
Consider it in this design.

**Absorbs Step 8's unspecced half:** the orchestrated strand — the capture
assistant proactively prompting off chronicle state
(`chronicle/threshold.reached`). The surface is the passive face; the
assistant's nudging is the active face. Design them together, in one doc.

## 4. Unit 2 — Shareable Collections *(Track B; design doc first)*

The give-back arc, sequenced inside one design:

1. **The collection object** — a curated set of recollections (plus
   context, photos, trip routes where relevant) around an experience.
   Likely a synthesis-layer artifact (derived, never merged back —
   invariant #1). The
   [journalist model](2026-06-14-interview-dialogue-to-recollections-design.md)
   (deferred 2026-06-14, now relevant) is the raw material for how a
   collection *reads*: woven narrative preserving verbatim quotes.
2. **The share** — token-in-URL per the Step 12 spec, widened from single
   post to collection; the shared view is an enrichment invitation;
   collaborator commentary routes to review_queue. Collaborators are
   exactly the people already in the chronicle (Life's Cast connects here).
3. **The privacy gate** — sharing anything requires the minimum viable
   slice of Access Cards (Step 13). The design must decide how minimal:
   full cards UI vs. a scoped share-token grant first. Hard invariants:
   `viewer_can_access()` stays FALSE / RLS stays off until the full body
   lands; `private_notes` and private context never cross a share
   boundary.
4. **External links & media** — the open
   [2026-07-09 design question](2026-07-09-external-links-and-media-design-question.md)
   folds INTO this design: its hardest questions (YouTube embeds phoning
   home from a *viewer's* browser, link rot in a chronicle meant to outlive
   links, sources-strip vs inline) only become concrete once a shared
   surface exists.

**Spine share:** the design should also cover the simpler sibling — a
shareable read-only spine/Journey view — since Track A's payoff is showing
it to someone.

**Design inputs on file** (from the June 2026 Gemini commentary,
`documentation/research/2026-06-gemini-design-commentary.md` §§1B, 2A, 2B,
2D — reviewed 2026-07-18; everything else in it was independently built):

- **DB-level privacy enforcement for shared context** — an Access-Card
  grant on an entity must never leak its private notes; Gemini sketches
  the RLS policy pair. Fold into the Step-13 slice of this design (the
  existing app-layer-now/RLS-at-13 decision stands; this is the §13 shape).
- **Synthesis staleness + diff-review regeneration** — a collection is a
  synthesis over memories; when an underlying memory is revised (Stroll
  pathway C, owner-edit), the collection goes stale. Regeneration should
  be propose-and-confirm with a side-by-side diff, never silent. The
  roadmap's collections design must own this lifecycle.
- **Quote provenance** — transcript-turn → memory linking
  (`extracted_memory_id` on transcript turns; not built) would let a
  journalist-model collection cite its verbatim quotes back to source.
  Optional machinery; decide in design whether MVP needs it.
- **Temporal ordering of multi-memory narratives** — a collection needs an
  order (curated? capture? temporal?); weaving memories with revised or
  conflicting time estimates can produce chronological contradictions.
  This may be the concrete trigger for the §5 Temporal Agent conversation.

## 5. Later, named so nothing is lost

- **Globe visual-language pass** — promoted from "parked polish": scope has
  grown since parking (trip arcs = 4th line tier, destination/stop markers,
  draft badges, hollow Future Places, unplaced treatment, the icon-hierarchy
  inversion from Phase-5 finding 5). Schedule after the QA walk, which will
  show exactly where legibility breaks.
- **/memories full-text search** — the deferred Slice-6 half; small and
  self-contained; a natural rider on any nearby session.
- **Life's Players synthesis + rendering** (Step 11 remainder) — deferred
  behind Shareable Collections; a collection is the sharper first synthesis
  artifact, and the Cast surface can build on its machinery.
- **Trips follow-ups** (from the trips plan's deferred list): destination
  clustering at wide zoom, transport mode, trip-aware synthesis, the
  Journey/Journal naming pass.
- **Temporal Agent** — the pressure valve. `year_hint` was the first
  structured-time workaround; when_chips, "Sometime" groups, and
  capture-order listings all accumulate pressure. Not scheduled — but any
  new feature adding another per-feature time workaround should trigger the
  "is it time?" conversation.
- **Vertical Moments** — parked until Andy supplies examples (unchanged).
- **Steps 9, 14, 15** — topic strand spec, search agent (privacy filter
  BEFORE pgvector similarity), review-inbox generalization: sequenced after
  the two tracks above deliver.

## 6. Suggested execution order

1. **QA Phase 1** (spine correctness) + remediation + pin-facts rider.
2. **Loose-Ends surface design doc** → Andy's review → build. QA Phases
   2–3 interleave (their findings feed the same surfaces).
3. **Spine completion push** — Andy drives his own spine to birth-to-now
   complete using the new surface; friction found = the highest-value bug
   reports the project can get. Acceptance for Track A: Andy's spine is
   complete and he'd show it to someone.
4. **Shareable Collections design doc** (collection + share + minimal
   privacy gate + external media) → review → build in slices.
5. QA Phases 4–5 and §5 items slot into gaps as sessions allow.

## 7. Cross-references

- Master QA sequence: `docs/qa/2026-07-17-master-qa-sequence.md`
- Single Post Share spec: `memory/project_lc_single_post_share.md`
- Access Cards spec: `documentation/access_cards_requirements.md`
- Journalist model: `2026-06-14-interview-dialogue-to-recollections-design.md`
- External media question: `2026-07-09-external-links-and-media-design-question.md`
- Direction memory: `memory/project_lc_direction_2026-07-17.md`
- Exhausted predecessor roadmap: `archive/2026-06-22-globe-and-entity-ux-revised-roadmap.md`
