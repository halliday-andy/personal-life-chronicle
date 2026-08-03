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
[pin-facts editor](2026-07-10-pin-facts-editor-enhancement.md) rode the
first globe-region remediation as planned (data layer 2026-07-20, UI
2026-07-26 — **BUILT**), as did **globe pin search** (agreed
2026-07-18, the first Phase-1 finding: the Find-Location box gains a
"Your pins" results group — ALL pin types, Andy's call — that flies to
and selects the matched pin; search-as-navigation in one merged dropdown,
with the coordinate-paste and suggest-crash-guard behaviors preserved)
and the **basemap regime** (agreed 2026-07-18 from Andy's Sunshine
Village dark-vs-detail comparison: nocturne stays the identity canvas at
world/regional zoom; past reading zoom the basemap crosses to the
detailed outdoors style with hysteresis and a dissolve — the identity
lives in the chrome and pins, the basemap is content). Both BUILT
2026-07-18; QA checklists in Phase 1. This shrinks the §5 globe
visual-language pass to pin/marker styling proper. QA phases interleave with the units below;
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

- **Capture-assistant support knowledge base — content SEEDED 2026-07-19**
  (`documentation/knowledge-base/`, five articles + authoring rules, from
  the Phase-1 QA sessions; Andy's request). The remaining half is
  **integration**: an orchestrator lookup tool so the assistant answers
  how/why capture questions FROM the articles (never improvised), citing
  the surface to tap. Rides the Unit-1 / Step-8 orchestrated-strand
  design — guidance is the assistant's support face, nudging its
  proactive face. Standing rule: a PR that changes a captured flow
  updates the affected article in the same change.

- **Globe visual-language pass** — promoted from "parked polish": scope has
  grown since parking (trip arcs = 4th line tier, destination/stop markers,
  draft badges, hollow Future Places, unplaced treatment, the icon-hierarchy
  inversion from Phase-5 finding 5). Schedule after the QA walk, which will
  show exactly where legibility breaks.

  **⚑ PIN OCCLUSION — added 2026-08-01 from Andy's Queenstown observation.**
  Two distinct problems, one small and one a design unit.

  **(a) Stacking is accidental.** There is **no `z-index` on pins anywhere** —
  not in `globals.css`, not on the marker elements — and Mapbox's `Marker`
  does not sort. Markers are DOM nodes created in `pins.forEach` order
  (`GlobeView.tsx:786`), so **stacking is insertion order**: whichever pin the
  API returns later wins. A workplace can permanently hide a primary residence
  for no reason a user could infer. Andy had to zoom far in to discover the
  two Queenstown pins were separate.

  *Options:* latitude-based (`viewport-y`, the cartographic convention — the
  southerly pin on top, layering like a landscape) **or** type-priority (homes
  always above markers). **Recommend latitude + selected/hovered always on
  top**: type-priority would draw a workplace that is genuinely in front
  behind a home, which contradicts (b)'s whole objective. **Ordering can only
  make occlusion honest — it cannot remove it.**

  **(b) Separation that preserves relative orientation** — Andy's proposal,
  and the actual remedy. On zoom-out, pins should stay separated **without
  swapping their relative positions**: if one sits above-left of another when
  zoomed in, it must still sit above-left when crowded.

  *This rules out both standard answers.* **Clustering** collapses neighbours
  into a count bubble — cheap, standard, and wrong here: each pin is a place
  in a life, and "3" erases what the globe is for. **Spiderfying** keeps
  identity but arranges legs in a circle *by array index*, destroying
  orientation — exactly the swap Andy objects to.

  *The technique that fits is cartographic **displacement**:* group pins whose
  SCREEN distance falls below the pin size at the current zoom, take the
  group's centroid, and push each outward **along its true bearing** until
  they just separate. Orientation is preserved exactly; displacement decays to
  zero as natural separation grows, so pins settle onto true coordinates as
  you zoom in. Implementable against the existing DOM markers (repositionable
  divs) with a throttled recompute on zoom/move.

  **→ Preliminary design recorded 2026-08-01:**
  [`2026-08-01-pin-separation-preliminary-design.md`](2026-08-01-pin-separation-preliminary-design.md)
  — written after reading the Codex source directly (not inferred from the
  screenshots). Adopts its core, fixes two cheap limitations (offset pop,
  input-order dependence), and defers density to the post-MVP refinement
  phase at Andy's call.

  **⚑ REFERENCE IMPLEMENTATION — the Codex build already does this**
  (Andy, 2026-08-01, three screenshots across zoom levels; the sibling
  implementation from `memory/project_lc_dual_track_final_review.md`). Two
  numbered pins, "12" and "8", ~10km apart near Tokyo:

  | Zoom | Behaviour |
  |---|---|
  | City (Akishima/Tokorozawa) | separated naturally; 12 north-west of 8 |
  | Regional (Kanto) | still separated, **12 still left of 8** |
  | Country (Japan) | **adjacent, not stacked** — true positions are a few px apart, yet both stay legible and 12 is still left of 8 |

  So displacement with preserved bearing is not theoretical — it is running,
  and Andy's verdict is that it "doesn't obscure or dilute the comprehension
  of the important message, which is that there are pins here to be zoomed in
  on and reviewed."

  **That last sentence resolves the truthfulness worry** recorded here
  earlier — *"a displaced pin is briefly lying about where a place is"*.
  **At low zoom the marker is ALREADY a claim about a region, not a point:** a
  ~45px badge covers roughly a hundred kilometres at country zoom, so
  displacement adds no imprecision the marker size has not already added. And
  displacement operates only where markers overlap, which is exactly the zoom
  range where no precision is being claimed — decaying to zero before reaching
  the range where a pin does read as a coordinate.

  **Consequence: the "visibly displaced" treatment (a hairline back to true
  position) is probably unnecessary**, which makes this materially simpler
  than first recorded. Worth confirming during design rather than assuming.

  *Not adopted, just observed:* the Codex pins are numbered badges (stop
  ordinals, plus "F2" for a future place) rather than coloured dots. Different
  visual language; Andy pointed only at the sizing and separation behaviour.

  *Related, not a code issue:* Andy has **three pins named variations of
  "Coronet Peak"** within a few hundred metres (the residence, "Year 2 Coronet
  Peak", and the Ski School), which is what made a trip arc landing on the
  residence read as pointing at the workplace.
- **Dead citation markers in pasted context — post-MVP** (Andy, 2026-08-01,
  after R9 restored tables and bold). Research pasted from Gemini arrives with
  citation markers as plain bracketed numerals — `[5, 13, 17, 18]` — which
  render as unclickable noise inside otherwise clean prose.

  **Constraint, verified against the stored note:** the clipboard HTML carries
  **no URLs** for these (`has_md_links: false`), so "retain the links" is not
  achievable for this source — there is nothing to retain. Turndown already
  preserves real links when a source includes them (proof case 3), so this is
  Gemini-shaped, not general.

  The real choice is therefore **strip the numerals on paste** (clean prose,
  loses the signal that a claim was sourced) or **keep them** (visible
  provenance, visible clutter). Andy's instinct: "either the links are retained
  or they're stripped" — i.e. the current half-way state is the worst option.
  Not scheduled; deliberately deferred past MVP.

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

  **⚑ THE TRIGGER HAS FIRED (2026-08-01).** The temporal-arcs brainstorm
  ([`2026-08-01-temporal-arcs-brainstorm.md`](2026-08-01-temporal-arcs-brainstorm.md))
  wants a time axis that co-scrolls with the spine, and Andy supplied the
  argument against deferring again: **someone who lived in one place their
  whole life has ONE stop**, so the spine's temporal resolution is a function
  of how often they moved — meaning invariant #5's assumption that the
  residential spine IS the temporal scaffold has a class of user it does not
  serve. Verified the same day: `started_at`/`ended_at` are **dead columns
  (zero rows populated)** and the spine holds no year data at all, while trips
  carry `year_hint` on 5 of 6 — the axis exists for trips and not for the
  spine. **The fork — a general axis vs. another feature-local workaround —
  is OPEN and explicitly unsettled.** Recommendation on file: draw both.
- **Keyboard accessibility — deferred, not dropped** (Andy's call 2026-07-26,
  `memory/feedback_lc_accessibility_deferral.md`). The MVP is for testing, so
  dedicated keyboard work waits; free-with-the-build semantics (real buttons,
  `aria-expanded`, `sr-only` where a visual-only cue carries meaning) still ship
  in every unit, and the accessible path gets built inline whenever a feature
  makes it cheap. Running list of what's owed:
  - pin photo carousel reorder — drag is pointer-only (2026-07-20)
  - chapter "places within this chapter" reorder — drag is pointer-only (2026-07-26)

  Natural revisit point: Track B, the first surface other people touch.

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
