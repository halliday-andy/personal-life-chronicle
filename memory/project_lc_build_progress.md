---
name: Project: LC build progress — May 2026 implementation phase
description: What's been built so far in the Claude Code implementation of Life Chronicle. Step-by-step state from Step 1 (scaffold) through Step 5 (interview API). Captures decisions made during build that aren't in the PRD.
type: project
---

## Session handoff — 2026-07-15 (Trips & Travel Journal T1–T9 BUILT)

The full Trips & Travel track (plan
`docs/plans/2026-07-15-001-feat-trips-travel-journal-plan.md`, run as a
/goal) shipped in one autonomous pass, U1–U9, commits `3fbdf08`…`cf19287`:

- **U1 data layer** — `trips` + `trip_stops` over existing pins; backing
  `trip` entity (new enum value) carries recollections/jots/context via
  existing machinery; origin nullable (NULL = draft), destination
  RESTRICT (unframe before pin delete — Andy's call); leg-aware stops.
  Proof `verify-trips-travel.mjs` **33/33**, self-cleaning.
- **U2 API** — `/api/trips` (+`[tripId]`, `/stops`, `/home-base`);
  subtype constants in `lib/globe/trip-types.ts`.
- **U3 capture** — PinModal "Trip" path (subtype → pin per KTD4) +
  `TripFramePanel` (origin suggestion: anchor ?? Home Base; year_hint
  typed only, never parsed).
- **U4 globe** — `trip-routes` tier (rose; dashed return), hidden behind
  legend toggle; selection shows full route; destination halo + draft
  dashed ring; route-builder banner (click pins = stops).
- **U5 Travel Journal** — `/journey` mode toggle (JourneySurface), trip
  cards by year_hint ("Sometime" last), `?trip=` handoff both ways.
- **U6 retro framing** — "frame it as a trip" on markers (AE2 = Wallace
  Monument walkthrough), Unframe (pin untouched), PinHopper on trip
  entities, friendly destination-delete error.
- **U7 frequent traveler** — Home Base (`set_home_base`), "Another trip
  here", subtype/decade filters, residence "N trips originated here".
- **U8 Future Places** — `wants_to_visit` pin (hollow mint), whitelists
  amended from live RPC defs; promotion re-types then frames.
- **U9 unsequenced residences** — "Decide later" in the sequence picker
  (create + edit/demote), `place_residence_in_spine`/`unsequence_residence`,
  spine = sequenced primaries everywhere (arcs, origin star, reorder,
  nearest_residence), Journey "Not yet placed" group, trip-origin
  capture for homes that predate the spine (AE5).

**Andy's live QA outstanding** (checklists in `docs/qa/2026-07-15-*`):
trips-capture, trips-globe, travel-journal, trips-retro-framing (AE2 on
the real Wallace pin), trips-frequent-traveler, future-places,
unsequenced-residences. Person-page QA from Slice 7 also still queued.

## Session handoff — 2026-07-05 (reconciliation; Slice 6.5b in progress)

Supersedes the 2026-06-17 block below, which had gone nine days stale. The
06-22→06-26 interval is fully recorded in
`docs/plans/2026-06-22-globe-and-entity-ux-revised-roadmap.md`,
`docs/qa/2026-06-24-globe-slice3-closeout-qa-checklist.md`,
`docs/qa/2026-06-24-slice6-entity-view-context-qa-checklist.md`, and
[[project_lc_globe_entity_ux_brief]]; this block makes this file current again.

- **Slice 3 close-out BUILT 2026-06-23** (`12a3392`…`a9183ce`, 7 atomic commits):
  placard (reuses `entities.description`), at-rest when-chips + hover card,
  origin-pin treatment, "Refine location" detail-card action, re-type
  anchor stash/restore (`metadata.prior_anchor_residence_id`), chevron/tether
  contrast. Migrations `20260623120000` + `20260623130000` (additive).
- **Slice 3.5 BUILT 06-23 (`87ffe44`), REWORKED 06-24 (`cfa7202`)** after Andy's
  QA: the active-lines tray + per-pin toggle were REMOVED (OR-logic conflict);
  line visibility is now global-only — class filters + a zoom-gated
  "Side lines in view" toggle + transient hover preview.
- **Slice 3.6 "Log" pin BUILT 06-23** (`3219462`/`3650151`/`f19b39d`):
  `logged_at` type, `validate_pin_anchor` generalizes anchoring to any own
  globe pin, recollection roll-up ("Anchored here"). Andy proofed it live
  (globe QA §§9–11 ✓).
- **QA rounds 1–3 (06-24)** drove fixes: origin star rework (`f91f9b4`),
  one-chevron-per-leg (`1f4c8e9`), refine-drag guard (`c15b118`), editable
  pin name (`ac7c72a`), re-type inserts after the anchor home (`89c7266`),
  edit-panel markdown (`44fa2a9`).
- **Slice 6 (Entity View + context substrate) BUILT through Phase 6.6**
  (06-24→06-26): 6.1 `entity_context_notes` + merge repoint (`8dbbcd0`);
  6.2/6.3 Entity View `/entities/[id]` + add/remove context (`6ab7481`);
  6.4 entity chips + globe→Entity-View link (`474915e`, `04d8acd`;
  /memories full-text search deferred); 6.5a attach-research-as-context
  from /review (`9e56a58`); 6.6 note markdown, derived titles, in-place
  edit, pin-card count-chips (`90aed81`, `e356815`, `6f27c90`, `b452302`).
- **2026-07-04 session:** `verify-globe-slice4b.mjs` made live-DB-safe
  (`9ce8116`) after it had shifted the real spine; origin-backup hook made
  observable (`ab30e12`). See [[feedback_lc_silent_backup_and_sandbox]].
- **Andy's QA state:** globe checklist mostly ✓; re-tests outstanding
  (§4 chevron-on-line, §5 refine, §12 retype round-trip, §13 orphan,
  §14 naming/markdown). **Slice 6 walkthrough deliberately deferred by Andy
  until Slice 6 completes.** The 06-15 UI checklist pass is committed
  (`b2cd6fb`).
- **Slice 6.5b BUILT 2026-07-05** (`09cf680` backend, `8f8d8c6` card UI,
  `4ffbf86` behavioral proof): proposal-only `propose_context_note` tool
  (entity resolution by name, source-URL auto-detect,
  `use_full_submission` reads the verbatim paste from
  capture_submissions), "Context vs recollection" prompt section
  (SYSTEM_PROMPT_VERSION 2026-07-05.0), `ContextProposalCard`
  (Accept→6.5a context POST / Adjust→typeahead+visibility / Decline).
  Proofs: `verify-context-proposal-tool.mjs` 9/9 +
  `verify-orchestrator-context-proposal.mjs` (real run — research paste
  routed to the tool ONLY; Raw Vault + backlog untouched; nothing
  persisted pre-Accept). **Slice 6 build COMPLETE** (only /memories
  full-text search deferred). Detail: [[project_lc_globe_entity_ux_brief]].
- **Journey view designed 2026-07-05** — "Resume View" renamed + redesigned
  after Claude Code's review; canonical spec
  `docs/plans/2026-07-05-journey-view-design.md` (standalone `/journey`,
  `?pin=` handoff, summary rows + lazy detail, ember-spine emotional layer
  in MVP, mobile-first; phases J1–J5). Same session the **Hopper split**:
  5a (pin notepad) pulled forward, 5b (assistant consume loop + person
  host) stays with Slice 7.
- **Hopper 5a BUILT 2026-07-05** (`ac11a61` data layer, `95e7627` UI):
  `memory_stubs` table (roadmap M2, applied) + merge_entities repoint
  (proof `verify-memory-stubs.mjs` 7/7); `/api/entity/[id]/stubs`;
  `PinHopper` — always-present "✎ jot" chip on the detail card (live
  count) + full "Memories to write" section on the edit panel (check off,
  reopen, delete). QA: `docs/qa/2026-07-05-hopper-5a-qa-checklist.md`.
- **Known gap (2026-07-06, two live occurrences): pin creation does NO
  entity resolution.** `create_residence_pin` mints a fresh place entity
  unconditionally — even an exact-name match against an existing entity
  isn't checked (the #38 matcher + #39 vigilance live only on the
  capture/extraction path). Live duplicates: "Phillips Exeter Academy"
  (extraction-born 05-20 as organization, later re-typed place, no geom
  vs pin-born 06-19 "Summer 1970") and the cross-name Hanover/Dartmouth
  pair (3 recollections invisible from the pin). Data heal = /entities
  merge INTO the pin entity (pin survives, owns globe identity; aliases
  fold so future mentions resolve). Fix spawned as background task:
  PinModal "this looks like your existing X — pin it?" + optional
  `p_entity_id` on create_residence_pin. General answers given to Andy:
  linking is by name/alias identity, never by date-range overlap
  (invariant #5; temporal overlap ≠ identity — at most a future
  Temporal-Agent *suggestion*).
- **Owner-edit micro-slice BUILT 2026-07-06** (`e4c9cb5`), from Andy's
  Leola finding (a recollection ABOUT Leola Lapides carried no link to
  her — pronoun-only references are invisible to per-memory extraction;
  the conversational context that resolved "she" was discarded).
  /memories cards now have: (1) **Edit on FINAL memories** —
  revision-preserving (prior content_raw → memory_revisions, then
  overwrite; the globe's Slice-4a owner-edit pattern; temporal metadata
  edits freely); (2) **entity-link editing** — × unlink + "+ link"
  typeahead (person→participant, place→location, idempotent): graph
  repair without prose rewrite. Logic in `lib/memory/owner-edit.ts`,
  proof `verify-memory-owner-edit.mjs` 9/9. QA:
  `docs/qa/2026-07-06-memories-owner-edit-qa-checklist.md` (§1 = the
  Leola repair walkthrough). **Queued enhancements from the same
  discussion:** offer re-extraction after a finalized text edit;
  capture-time prevention = orchestrator passes pronoun referents
  ("she" = Leola) to extract_entities (bundle with the orchestrator/5b
  work).
- **Both queued background tasks BUILT 2026-07-07** (before session
  close, Andy's request): (1) **Alias editing** — the Entity View
  "also:" line is chips with × + a "+ alias" input (PATCH already
  supported wholesale alias replace; this was the missing UI). Removing
  the junk "Leo" on Leola Lapides is left to Andy's QA. (2) **Pin
  adoption** (the duplicate-twin fix, migration `20260707120000`):
  `create_residence_pin` gains optional `p_entity_id` — the pin ADOPTS
  the user's existing unpinned place/organization entity (gains geom,
  org→place per physical-location-wins, keeps description/links, folds
  a differing modal name as alias; guards: ownership / already-pinned /
  non-place-org). `GET /api/globe/entity-match?name=` (exact ci match,
  unpinned only) feeds a PinModal offer strip ("pin it instead of
  creating a duplicate?" / Create new, per-candidate dismissal). Proof
  `verify-globe-pin-adopt-entity.mjs` 12/12. QA:
  `docs/qa/2026-07-07-pin-adoption-and-aliases-qa-checklist.md`.
- **Globe stub resolution BUILT + SWEPT 2026-07-06** (`102f825` + sweep),
  from Andy's QA finding: 19 pin recollections had ZERO person links —
  30+ names stranded in `metadata.globe_extraction` (the Slice-2
  deferral come due). `lib/globe/stub-resolution.ts`: exact
  canonical/alias match → direct memory_entities link; else a
  review_queue `entity_stub_proposal` (new item_type, additive CHECK
  migration `20260706120000`) with fuzzy suggestion ≥0.8 — never silent
  entity creation (propose-and-confirm). /review "New mention" card:
  editable name ("my father" → real name, stub kept as alias) +
  Add / Link-to-existing / Same-link-them / Dismiss
  (`resolve-stub` route reuses linkEntityToMemory). Extraction agent
  chains resolution after every pin save; bookkeeping in
  `metadata.globe_stub_resolution` keeps re-runs idempotent. **Live
  sweep result: 17 pins → 11 linked directly, 57 proposals queued.**
  Proofs: `verify-globe-stub-resolution.mjs` 9/9;
  `scripts/sweep-globe-stub-resolution.mjs` re-runnable. QA:
  `docs/qa/2026-07-06-stub-resolution-qa-checklist.md`.
- **Incident + hardening (2026-07-06 late): reverse-direction merge
  stripped the Dartmouth pin.** Andy merged the Hanover PIN entity INTO
  the Dartmouth extraction entity; merge_entities repointed links +
  folded the alias but entity-level columns died with the source row —
  geom gone, pin vanished from the globe (relationship survived, sort 6,
  all 5 memory links intact). **Repaired:** geom restored at the
  Dartmouth green (43.7044, −72.2887, subtype city; Andy refines).
  **Hardened:** migration `20260706130000` — merge_entities now COALESCEs
  geom / place_subtype / description / location_entity_id / born/died/
  founded from source onto a NULL target before delete, so merge
  DIRECTION can no longer destroy substance. Proof
  `verify-merge-preserves-substance.mjs` 6/6 (reproduces the incident
  shape). **Class-of-bug: any owner-facing merge of twins where one side
  carries unique columns — the function must union substance, not just
  links.** Exeter twins still unmerged (safe in either direction now).
- **Journey J1 BUILT 2026-07-06** (owner-edit QA ✓ complete, Andy's go):
  `/journey` server-rendered from ONE `get_residence_pins` call —
  spine-ordered stop cards (name + verbatim when-chip + placard), origin
  ★/"The beginning" + "now" badge, anchored markers nested under their
  actual anchor (Log-on-vacation under the vacation; visual indent caps
  at 2), "Elsewhere · not yet anchored" section (nothing ever
  disappears — dead-anchor + cycle guards), mobile-first max-w-2xl.
  AppNav gains Journey. Tree core `lib/journey/tree.ts`, pure-function
  proof `verify-journey-tree.mjs` 6/6. QA:
  `docs/qa/2026-07-06-journey-j1-qa-checklist.md`. **J2 BUILT same
  session:** per-stop rail segments = continuous ember thread (clean at
  any card height, ends at "now"), glowing origin ★, ringed "now"
  marker, `transitionPhrase()` vocabulary over the extraction's
  move_reason (9/11 live stops carry one; absent → nothing rendered);
  migration `20260706140000` widens get_residence_pins with move_reason
  (proof `verify-journey-move-reason.mjs` 3/3). Static by design —
  reduced-motion safe. **J3 BUILT same night** (Andy's QA: "flat and
  non-interactive"): stop headers expand in place — lazy single-open
  detail (recollection markdown, photo, fact chips, linked-recollection
  excerpts → /memories, context titles → Entity View, per-child
  excerpts from the roll-up), cached per stop, zero detail requests
  until tap; rendering moved to `components/journey/JourneyList.tsx`
  (client), page stays a one-RPC server shell. **J4 BUILT same night:**
  `?pin=<relationshipId>` read/written by BOTH surfaces — Journey opens
  the owning stop + scrolls the linked row into view (markers resolve
  to their ancestor stop; reduced-motion → instant jump) and mirrors
  expand/collapse into the URL via router.replace; the globe consumes
  the param post-pins-load (selectPin + flyTo with map-ready retry) and
  mirrors selection via history.replaceState. Links: journey stop
  footer "Show on globe →", child NAMES link to their marker's pin,
  globe detail card "Read in journey →". Cold deep links work; globe
  stays out of AppNav. **J5 BUILT 2026-07-07 — the Journey arc (J1–J5)
  is COMPLETE.** A11y pass: place names are real h2s wrapping the
  disclosure buttons (rotor-walkable spine; detail sections h3),
  aria-controls + role=region panels, visible amber focus-visible
  rings, loading skeleton is a role=status region with sr-only text
  (shimmer bars aria-hidden), decorative rail/chevrons/arrows
  aria-hidden while transition PHRASES stay readable, page metadata
  title. Design doc marked BUILT. Journey is now the claimed
  screen-reader-accessible representation of the globe (design §4).
  **Next per roadmap: Slice 7** (Person page + Life's Cast + Hopper
  5b), riding on Slice 6 — plus Andy's accumulated QA queue.
- **Incident + repair (2026-07-07, Andy's QA): mention-links hijacked
  pin overview text.** The stub sweep AND the /memories "+ link" both
  defaulted place links to role='location' — but role='location' +
  capture_mode='globe_onboarding' (oldest-first) IS the discriminator
  for "the pin's own memory" (the 2026-06-11 scoping rule). One pin's
  globe recollection linked to another pin's entity therefore
  masqueraded as its overview: Coronet Peak Ski School showed the 1975
  primary's text (Andy's sighting); Trans Hotel showed the Ramada's;
  five more pins carried latent wrong-role links. **Class-of-bug:
  role='location' is load-bearing — mention-links must NEVER use it.**
  Fixes: `defaultRoleForType` place→'mentioned' (owner links, stub
  sweep, resolve-stub all inherit); data repaired by
  `scripts/repair-globe-location-roles.mjs` (26 links flipped; genuine
  pairs identified by the create-transaction exact-timestamp match;
  post-condition proven clean; re-runnable). Consumers unaffected:
  linked-recollections, Entity View, /memories queries don't filter by
  role; get_residence_pins has_memory stays location-only by design.
  Proofs updated (owner-edit + stub-resolution assert 'mentioned').
- **Incident + guards (2026-07-06 late): orchestrator narrated a save
  with ZERO tool calls.** Andy pasted Harry Leonard ski-show research
  mid-conversation; the reply claimed it was "added as context to
  McCormick Place" — audit log shows `tools: []`; nothing persisted
  anywhere. **Class-of-bug: words-are-not-actions hallucination — the
  reply-accuracy rule assumed there was a tool result to misreport.**
  Fixes: (1) "Words are not actions" prompt directive
  (SYSTEM_PROMPT_VERSION 2026-07-06.0); (2) deterministic UI backstop —
  substantial submission + zero tool calls ⇒ "no action was taken this
  turn" notice under the reply; (3) behavioral proof now runs the paste
  mid-conversation (the incident shape) — PASS. The lost material was
  recovered from capture_submissions into a review_queue
  attach-as-context card.
- **SLICE 7 BUILT 2026-07-07 (all four phases, Andy's go on the proposal):**
  7.1 (`77ada81`, `1da0374`) — /memories row-anchor deep link
  (`#<memory_id>` scroll+highlight, the Slice-6 deferral pulled forward
  with Andy's OK); Entity-View mention rows link OUT (pin-anchored →
  `/journey?pin=` via `lib/entity/mention-pins.ts`, resolution rides
  role='location' as designed; else the /memories anchor); PinHopper
  gains a `light` theme + `showTitle` and the person page hosts it.
  7.2 (`49f5d68`) — Life's Cast: `metadata.in_lifes_cast` (M3, no DDL)
  via pure `applyLifesCast` MERGE (is_self etc. provably survive);
  deliberate ☆/★ toggle on person pages (persons only, API-enforced);
  /entities ★ badge + Cast-first person tab + "with content only"
  filter (`entityHasContent`; default OFF — the list doubles as the
  orphan-cleanup surface). 7.3 (`dbc5701`) — person-anchored
  recollections: "Add recollection" on person pages →
  `createPersonAnchoredRecollection` (verbatim body + when-phrase,
  saves FINAL, role='participant' link, failed link deletes the orphan).
  Listed in CAPTURE order — event chronology stays the Temporal Agent's.
  7.4 (`6f8cd4d`) — Hopper 5b: orchestrator tools list_memory_stubs /
  add_memory_stub (only on explicit user yes; never mints entities) /
  consume_memory_stub (requires a REAL memory_id — words-are-not-actions
  backing); prompt section "The Hopper" (SYSTEM_PROMPT_VERSION
  2026-07-07.0); migration `20260707130000` adds
  `memory_stubs.consumed_by_memory_id` lineage (additive, applied).
  Proofs: mention-links 4/4, lifes-cast 9/9, person-recollection 9/9,
  hopper-tools 8/8, and a REAL orchestrator run 6/6 (list → create →
  classify/extract → consume in one run, reply matched tools). QA:
  `docs/qa/2026-07-07-slice7-person-page-qa-checklist.md`.
- **Andy's QA delta (checked live 2026-07-07):** stub proposals 52/57
  confirmed (5 pending); owner-edit checklist COMPLETE (17/17, in
  `783ca91`); Exeter twins still unmerged; Leola still carries the junk
  "Leo" alias (alias QA pending); Journey J1 / Slice 6 / Hopper 5a /
  stub-resolution walkthroughs still open.
- **Hopper QA session 2026-07-09 (Andy live-QA'd 5a; four builds came
  out of it, all pushed):**
  (1) **One jot per memory** (`53eb13a`) — tip text under the jot input,
  multi-line paste splits into N jots, prompt granularity rule ("split
  semantically, not on punctuation" — proof: a run-on with an internal
  comma produced exactly 3 atomic stubs, `verify-orchestrator-jot-split`
  6/6).
  (2) **The write-up bridge R1** (`06973e3`) — ✍ write on every open jot
  opens the CaptureAssistant seeded with a structured consume_stub
  intent (exact stub_id; amber chip; rides every turn); core backstop
  consumes mechanically if the model forgets (`findBackstopConsume`,
  pure + proven); viewingEntity ambient context (selected pin / open
  entity page → "this place" needs no name); a seed exits globe edit
  mode so the suppressed assistant can surface. `verify-capture-intent`
  9/9 + real seeded run 6/6 (model consumed the exact stub itself, no
  list call needed).
  (3) **R2 hopper nomination** (`8a4e875`) — Layer B digest gains "Open
  jots" per host (cache-stable ordering); prompt may nominate ONE jot at
  openings/lulls, never nagging. `verify-digest-hopper` 8/8.
  (4) **INCIDENT + fixes (`a6cfbb4`): the invisible write-up.** Andy's
  seeded write-up (Playa Coma Ruga, the surf-launch memory) consumed
  correctly but VANISHED from the pin: extraction minted near-duplicate
  place "Commaruga" (the user's own spelling) and linked the memory
  there. **Space-collapse disguise** — "Commaruga" vs "Playa Coma Ruga"
  slips ALL matcher rules (space defeats boundary-containment; one token
  defeats token-subset; "Playa" prefix defeats whole-string JW). Nothing
  was lost (Raw Vault + consume lineage intact — lineage made the trace
  trivial). Fixes: (a) **consume_memory_stub now GUARANTEES the host
  link** (idempotent linkEntityToMemory at the one gate all consume
  paths share; mentioned/participant, never 'location'; failure reported,
  never unwinds the consume) — extraction is now additive, not
  load-bearing, for write-up visibility; (b) **scoreNameMatch
  space-collapse rule** — single-token name windowed (JW) against the
  space-stripped long name, merge-proposal band capped 0.9; guards:
  single-token short side ONLY (a two-token "Air Force" fragment
  window-matched a base at 0.9 during the rule's own verification —
  caught pre-commit), ≥6 chars, multi-token long side.
  `verify-entity-matching` 17/17; `verify-hopper-consume-tools` 10/10.
  Data healed by Andy: /entities merge Commaruga INTO the pin entity
  (alias folded; both recollections verified on the pin; overview
  discriminator verified untouched). **Class-of-bug: any UI flow whose
  outcome must be visible on a host surface needs a deterministic link
  at the flow's own gate — never rely on extraction resolution alone.**
- **NEXT:** Andy's QA (Journey J1 walkthrough in progress 2026-07-09;
  then Slice 7 checklist + Slice 6 + stub-resolution + pin-adoption
  walkthroughs + Exeter merge + 5 remaining stub proposals); then per
  roadmap §5 the slice list is exhausted — remaining parked items:
  Vertical Moments, pin-visual redesign, /memories full-text search
  (deferred from Slice 6).


> **Earlier build history (Step 5 through Slice 2, May–mid-June 2026) has been
> archived to keep this file's "read first" section fast to scan.** It covers:
> the original Step 6a–6h build (orchestrator, capture assistant, tagger/entity
> agents), Step 7 Slices 1–4b (globe walking skeleton through edit/relocate/
> delete/sequencing), Slice 2 (photos + extraction) and Slice 3 (place types),
> the context-layer and interview-dialogue design sessions, durable tooling/
> schema lessons (Inngest v4 breaking changes, HEIC handling, dev-server
> operations rules, RLS activation gate), and the 2026-06-17 QA remediation
> pass (already self-marked superseded at the time it was written). See
> `memory/project_lc_build_progress_archive_2026H1.md` for the full text —
> nothing was deleted, only moved out of this file's fast-scan zone.

## How to apply

When starting work on Step 6 or Step 7, this is the file to read first. It captures the actual state of the codebase and the decisions that aren't documented elsewhere. Cross-reference `LC_Development_Sequence.md` for the canonical step definitions.

