---
name: Project: LC build progress — May 2026 implementation phase
description: What's been built so far in the Claude Code implementation of Life Chronicle. Step-by-step state from Step 1 (scaffold) through Step 5 (interview API). Captures decisions made during build that aren't in the PRD.
type: project
---

## Session handoff — 2026-07-30 (design day + live QA findings; NO code shipped)

Andy WALKED the trip-from-here checklist to completion — nine findings
(F1–F9). Design docs written, then **R1–R3 BUILT and pushed** (the first
code of the day; F7 closed as a pass on Andy's eye).

**BUILT 2026-07-30:** `52cf87e` R3 pin search (token-wise matching +
abbreviations + an explicit "none of your pins match"; proof extended 8 → 15
and proven red/green), `0be03e7` R1 modal dismissal (new
`lib/ui/use-escape-key.ts`; both globe modals were keyboard traps; dismissal
now PRESERVES the armed origin, only a real frame consumes it), `fb8ac78` R2
the framing panel's exit set (Discard/Keep/Save for drafts, Cancel/Save when
framed). QA: `docs/qa/2026-07-30-remediation-r1-r3-qa-checklist.md`.
**R4–R5 deliberately wait for the pin-card reconciliation walk** — that
checklist covers the very surfaces R4 modifies.

**Context-card walk added F10–F12.** `4c657d3` **R10 BUILT**: a `##Title` on
line 1 lost to a proper heading inside pasted research, because
`deriveContextTitle` required a space after the hashes and the loose-form
fallback only ran when the note had NO heading anywhere — invisible until
pasted material started bringing its own headings (proof 15 → 17, red/green;
derived at read time so old notes self-correct). **F11 (R9, not built):** rich
paste loses tables AND all bold — turndown has no table rule and no rule for
PRESENTATIONAL emphasis (Gemini uses styled spans, not `<b>`), while
`remark-gfm` is active on render. **F10 (R8):** Andy could not reproduce the
context-chip symptom, but the detail card genuinely has no max-height and no
internal scroll inside an `overflow-hidden` viewport — latent, kept on merit.

**R11 BUILT (F13):** editing a long context note jumped the page — the
textarea was `rows={4}` regardless of content, so opening the editor collapsed
a tall rendered block into a short box and the preserved scroll offset landed
Andy in the recollections list with the editor above the viewport. Fixed with
autoFocus + `scrollIntoView` and content-sized rows (4–24, computed once).

**CLASS-OF-BUG (new, rule 13): a mode switch that changes an element's height
must keep that element in view.** Suspected at F10, confirmed at F13 — two
sightings. Replacing rendered content with an editor collapses the document,
and a preserved scroll offset then points somewhere meaningless.

**CLASS-OF-BUG (new, rule 12): test a converter against captured REAL input,
not idealised markup.** A synthetic `<b>` fixture proved bold survived rich
paste; Andy's actual source marks bold presentationally, and all of it was
lost. *The tell: a fixture nobody copied from a real producer.* Sibling of the
07-26 rule that a guard which has never failed on its own bug is unproven.

- **START HERE next session: `docs/plans/2026-07-30-phase1-remediation-plan.md`**
  — the finding register + build order R1–R7. **Sequencing agreed with Andy:
  remediation ships as ONE pass BEFORE Loose-Ends L1.** Findings from the
  four remaining Phase-1 checklists **append to its §1**, never to a new doc:
  a finding that lives only in a walked checklist dies when that checklist is
  archived. Evidence stays in the checklist; the DECISION lives in the plan.
  **All four open design questions were resolved 2026-07-30 — R1–R5 are fully
  specified and unblocked; R6's migration is approved as written and applies
  at R6; R7 needs only Andy's A/B glance.** Build may start from the plan
  without further design work.

- **Loose-Ends surface designed** — see [[project_lc_loose_ends_design]] and
  `docs/plans/2026-07-30-loose-ends-surface-design.md`. Drafted, awaiting
  Andy's review.
- **Trip strip → pin card designed** —
  `docs/plans/2026-07-30-trip-strip-into-pin-card-design.md`, from Andy's live
  QA. Design only; three §4 questions open for him.
- **CLASS-OF-BUG (new, rule 10): a control scoped to a selected object
  belongs on that object's surface.** Rendered into global chrome — above all
  next to a global control — proximity assigns it to the neighbour's
  intention, and users hunt for it where the app's conventions say it lives.
  *The tell: an action that reads `selectedId` but renders outside the
  selected thing's card.* Earned from "Start a trip from here" living under
  the search box: Andy searched the detail card and edit panel for it and
  failed, while every other pin-scoped control (`PinFactsEditor`,
  `PinConnections`, `PinHopper`) already sat on the pin's surfaces. **No
  static guard proposed** — the check is "does this render inside the selected
  object's subtree", a judgement about intent, not a shape a linter sees.
- **The same misplacement was also a functional bug.** The strip (`z-30`,
  `top-20`) paints over the search dropdown (`z-20`, `top-6`, expanding down),
  hiding pin-search's "Your pins" group, which renders at the top of the
  merged results. **Corollary worth keeping: a UX misplacement and a stacking
  bug can be one root cause** — the control in the wrong lane was covering
  that lane's output.
- **Third silent-failure path in globe search.** `searchPins` matches the
  WHOLE query as a substring (`name.includes(q)`), so `Mount Snow Chalet`
  misses the pin actually named **"My Mt. Snow Chalet"** (`mount` ≠ `mt.`).
  Indistinguishable from the occlusion above and from the known append trap —
  all three render as nothing. **"No pins matched" must be said out loud.**
- **Live-data finding, matters to Track A:** "Wendy's shared apartment" is
  typed `vacationed_at`, not a residence, so it is **not on the spine** — a
  workaround for the guard forbidding a primary residence as a trip
  destination. The trip-terminus relaxation designed today is what lets it be
  retyped correctly. Also confirmed: 14 sequenced stops, **4 residences with
  `sort_order` NULL** (26th Street Santa Monica, Brookbend Drive Des Peres,
  Peabody Terrace HBS, Canmore House).
- **CLASS-OF-BUG (new, rule 11): a generic surface reused in a specific mode
  must state the mode in its OWN title and primary action.** When the only cue
  lives in chrome outside the surface — worse, chrome *suppressed* while the
  surface is open — the user reverse-engineers intent from secondary fields.
  *The tell: a reused dialog whose CTA is the generic verb while the app sits
  in an armed state.* Earned from "Start a trip from here": the placement
  modal opens preset (Trip type, armed pin as anchor) but says only **"Add
  this place"**, and the armed banner carrying the context renders
  `{tripFromHere && !modalOpen && …}` — **suppressed exactly when needed.**
- **The through-line of all four findings, worth more than the fixes:** *state
  an action depends on must travel with the action's surface, not sit beside
  it in chrome.* Chrome-borne context gets **occluded** (F1), **suppressed**
  (F4), and **hunted for in the wrong place** (F2). One correction applied
  twice: strip → card, mode → modal.
- **F5 (latent, not user-reported):** for trip pin types the anchor prompt is
  "Which home were you living in then?" and is preset to the armed pin, so it
  READS as the trip origin. It isn't — `suggestTripOrigin` prefers
  `armedOriginId` over `anchorId`, so editing it there silently would not
  change the origin. Recommended fix is a clarifying label, not moving
  trip-level state into a pin-level dialog.
- **F6 (Andy; CAPABILITY GAP, blocking real work): a trip's destination is
  IMMUTABLE.** `frame_trip` takes origin/title/when/year/subtype/
  return_to_origin/clear_origin — **no destination** — and no sibling function
  supplies one. Severe because capture is destination-FIRST: the one
  unchangeable field is the one chosen when the user knows least about the
  journey. Andy hit it remodelling his 1978 trip (`594fa9aa`) as chalet →
  *stop* Wendy's apartment (which IS in Calgary — one pin, two names; not a
  separate waypoint) → **SSV Day Lodge Room** (Sunshine Village, Banff) as
  destination; blocked twice (no retarget function, and SSV
  Day Lodge Room is `lived_at` so the still-gated guard refuses it). That trip
  is ALREADY one-way with the right origin and zero stops — the destination is
  its only wrong field and its only unchangeable one. **Andy is in no rush to
  repair the data** — the capability gap stands on its own. Note the chalet is spine `sort_order` 12 and SSV Day Lodge Room is 13
  — CONSECUTIVE, so this relocation lives in the interstice between them: a
  live instance of the Loose-Ends seam design's §3.5. **Do NOT delete-and-recreate** — `delete_trip` loses
  the title, framing and trip-entity jots, and `create_trip` runs the same
  guard so it would fail anyway. Fix sketched as a new additive RPC
  `retarget_trip(..., p_demote_old_to_stop)`; retarget must land BEFORE
  demoting the old destination to a stop (`add_trip_stop` refuses the current
  destination), and it must never rename a user-titled trip.
- **The gated trip-terminus relaxation now has TWO dependents** — the seam's
  one-way trips and `retarget_trip`. Raises its priority.
- Andy's call: **do not patch the occlusion blocker** — he can navigate around
  it, and the redesign matters more than an intermediate fix.

## Session handoff — 2026-07-26 (pin-facts editor UI — the 07-10 design closed)

Andy resumed QA at the 2026-07-19 "start a trip from here" checklist this
evening; the build side finished the pin-facts editor.

- **QA checklists caught up** (`81ade7b`): Andy's live check-offs since
  07-18 recorded against the original checklists — globe pin search
  COMPLETE (all §1–§8), unsequenced residences §5–§6, UI-checklist §4
  spine remnants **and all of §5 photos/gallery** (done ahead of its
  Phase-5 slot). Master Phase 1 now has three checklists left:
  trip-from-here (in progress), context-card, pin-card reconciliation —
  plus the data chores (Phillips Exeter merge, Leola alias, ~5 stubs).
- **Pin-facts editor UI BUILT** (`59a6be2`; closes
  `docs/plans/2026-07-10-pin-facts-editor-enhancement.md`, whose data
  layer shipped 07-20): `components/globe/PinFactsEditor.tsx` on the edit
  panel — two selects + two text fields, **immediate per-field saves**,
  each edited field marked "● yours" and sticky against re-extraction,
  plus **↻ Refresh from recollection** (POSTs, emitting the same
  `globe/pin.saved` a text save emits, so stub resolution rides along).
  Homes only via a newly exported `isHomeType` (anchor-options), so the
  anchor picker and the facts editor share ONE definition of home-ness.
  New route `app/api/globe/residence/[id]/facts` — deliberately NOT
  folded into the pin PATCH, which takes the full field set every save
  (folding in would make an untouched fact indistinguishable from a
  cleared one and mark all four owner-edited on every save, freezing out
  extraction entirely). Proof `verify-sticky-facts.mjs` **26/26** (was
  16/16). **VISUAL PENDING Andy's eyeball** — QA
  `docs/qa/2026-07-26-pin-facts-editor-qa-checklist.md` (§3 is the one
  that matters: the sticky invariant proven live).
- **Two GET defects fixed en route**, both live the moment editing ships:
  `facts` was gated on `globe_extraction` existing (so an owner's edit on
  a never-extracted pin would save and render as nothing), and
  `residence_detail` was never returned at all — the route read facts
  inline and had already drifted from the proven `readCurrentFacts`.
  **Class-of-bug: a route that re-reads a persisted shape by hand drifts
  from the proven reader — read through the reader.**
- **`mergeFactsIntoMetadata` is now the ONE writer** of the persisted
  fact shape (top-level `residence_type`/`move_reason` + the
  `globe_extraction` mirror + `facts_owner_edited`); `runGlobeExtraction`
  calls it too, and it's MERGE-only in both directions so an owner edit
  preserves the extraction audit trail (mentioned_people, confidence,
  extracted_at). **Class-of-bug: two writers of one persisted shape
  drift — extract the writer, don't re-derive the shape** (the storage
  sibling of 07-20's PinConnections rule for two renderers).
- **`lib/globe/fact-vocabulary.ts` is the ONE vocabulary** — the model's
  tool enum and the editor's selects both read it. **Class-of-bug: a
  controlled vocabulary duplicated between the model's schema and the
  owner's picker drifts into values one side can emit and the other
  can't.**
- **KB updated in the same change** (standing rule): "The facts read from
  a home's recollection" section in `kb-recollections-and-jots.md` +
  README index row.
- **Deferred, flagged to Andy:** no "un-stick" control (a fact, once
  owner-edited, can't be handed back to extraction); the detail-card and
  Journey chips still de-underscore raw codes ("family care") while the
  editor shows curated labels ("Caring for family") — one line to unify,
  Andy's call which wording wins; refresh waits a fixed ~3.5s for the
  async re-read rather than tracking progress.
- **BUG from Andy's live QA, fixed same session (`ee67828`): the Facts
  block rendered NINETEEN times.** `PinFactsEditor` and `PinConnections`
  are siblings in the same children list and BOTH used
  `key={pin.relationship_id}` — React reconciles siblings by key, so the
  collision made it duplicate them. React warns, but only at runtime in
  dev. Fixed by namespacing both keys by role (`facts-${id}` /
  `connections-${id}`). **Class-of-bug: when several sibling components
  each reset on the same entity, keying them all off that entity's bare
  id collides — namespace sibling keys by ROLE.** Guard:
  `scripts/verify-jsx-sibling-keys.mjs` (TypeScript AST, 41 files),
  proven red/green. **Second lesson worth keeping: the FIRST version of
  that guard passed while the bug was present** — it only inspected
  direct element children, and these two sit inside `{cond && <El/>}`
  slots. Caught only by reintroducing the bug to test the test. *A guard
  that has never failed on the bug it was written for is unproven.*
- **Journey stop ordinals (`670ab15`)**, from Andy's question about
  cross-surface navigation: the globe card reads "STOP 8 OF 14" but
  Journey showed nothing — except it DID compute the same ordinal and
  hid it in a hover `title` (invisible to touch, screen readers, and
  scanning). Promoted to visible text in its own gutter left of the rail
  (Andy's placement call), plus an `sr-only` "Stop N." in the heading
  since the rail is aria-hidden. **Design calls: the ordinal is
  ORIENTATION, not identity** — it renumbers on any earlier insertion,
  so name + when-phrase stays the durable handle and the deterministic
  links keep navigating by pin identity; **no denominator in Journey**
  (whole arc visible) but **kept on the globe** (can't see the whole
  spine; a rising total reads as accumulation, serving the undaunting
  brief); unplaced/unanchored stay unnumbered. KB `kb-navigating.md`
  updated same commit.
- **Claude can now drive the running app** — the Chrome extension
  connects once the **Claude side panel is open** in Chrome (installed +
  site-permitted is NOT enough; a clean Chrome restart alone did not do
  it). `list_connected_browsers` → `select_browser` → `tabs_context_mcp`.
  The Journey page verifies cleanly; the **globe often fails to finish
  its Mapbox init on repeated hard navigations** in the automated tab
  (the API is healthy — ~950ms, all 37 pins), so globe visuals may still
  need Andy's eye. Beware: typing into the search box APPENDS to any
  existing query and a stray Places pick drops a draft pin (cancel it).
- **Journey reading fixes, from Andy's QA of his own Dartmouth stop:**
  cited recollections were cut off at 240 chars and read as unnavigable
  — they WERE links, but with only a hover colour as affordance. Now
  **"… more" expands the full text INLINE** (`6d6cda5`), because Journey
  is the reading surface and sending the reader to /memories costs them
  their place. **Class-of-bug (2nd sighting): a truncated excerpt whose
  continuation lives elsewhere needs an explicit continuation affordance,
  never a hover state.** Also **spine-derived ordering** (`51972bb`): the
  list was `created_at DESC` (capture order), now sorts by stop, then
  position within the stop, then oldest-first — chronological in effect,
  nothing parsed (`lib/journey/recollection-order.ts`, proof 14/14).
  Known limit, pinned in the proof: a recollection filed on one pin but
  ABOUT an earlier time sorts at its host pin.
- **Context zero-state fix** (`bd0e9ce`): the context chip was gated on
  `context.length > 0` and the add link lives inside it, so **ten of
  fourteen homes had no route to adding context at all**. **Class-of-bug:
  never hide the control that CREATES the first item behind the existence
  of an item.** (Sibling of the 07-20 finding that "add" was too
  prominent — demoting it into a disclosure that could be absent went one
  step too far.) The checklist itself was also stale, still naming a
  label the pin-card reconciliation had renamed hours later.
- **STOP PLACES: elevated + owner-ordered, three pieces** (`70fdb4d` data
  layer + 19-case proof, `adbdfd0` API + tree ordering, `4a4d853` Journey
  drag, `2e69c03` globe card). From Andy's Mt. Snow Chalet finding: a
  four-month short-term stay inside a twelve-month home was invisible
  behind a faint "2 related pins" chip at the bottom of a long card. Now
  its own block ABOVE the chips on both globe surfaces, each row with its
  kind label and era phrase, in the owner's **drag order** — Andy's call:
  "instead of forcing the user to follow a convention in the assertion of
  time ranges, I'd prefer this be drag-and-drop orderable." Nesting kept;
  grandchildren follow their parent and don't drag (his call). Two
  migrations applied and verified, incl. a **gated `DROP FUNCTION`** on
  `get_residence_pins` to add a return column (Andy approved).
- **"chapter" → "stop" rename** (`aff4bd7`) + new memory
  [[project_lc_thematic_chapters]]. "Chapter" is reserved for a future
  user-defined PUBLICATION object spanning many stops and overlapping
  others — Andy: "nearly the same thing as a shareable collection", so
  roadmap §4 must decide if they are ONE object. The rename was bigger
  than a refactor: **"chapter" was already user-facing in four KB
  articles, three seeded 07-19**, teaching users the wrong word. All four
  revised. `user_periods` stays dormant; the 2026-04-30 decision stands.
- **Accessibility policy** ([[feedback_lc_accessibility_deferral]],
  `cf9f9e5`): dedicated keyboard work defers toward MVP; free-with-the-
  build semantics always ship; take the accessible path when a feature
  makes it cheap; never skip silently. Debt list in roadmap §5.
- **Claude can now drive the running app** — the Chrome extension
  connects only while the **Claude side panel is OPEN** (any tab, any
  window; the MCP uses its own tab group). `/journey` and `/memories`
  verify cleanly; **the globe often fails its Mapbox init in the
  automated tab**, so globe visuals stay Andy's. Trap: the globe search
  box APPENDS to an existing query and a stray Places pick drops a draft
  pin.
- **NEXT:** the **Loose-Ends surface design doc** (roadmap §3) —
  design-first, Journey-doc pattern, Andy's agreement before any code.
  Full handoff at `docs/plans/2026-07-27-handoff-prompt.md`.
  **Five checklists await Andy's live pass** (trip-from-here = his resume
  point, context-card, pin-card reconciliation, pin-facts, stop-places);
  pin-facts §2/§3 write to his real chronicle so they need his go-ahead.
  Deferred + named: grandchild reorder (endpoint ready, UI unwired),
  keyboard reorder, the fact un-stick control, unifying fact-chip wording.

## Session handoff — 2026-07-20 (context-card fix + pin-card reconciliation + sticky facts data layer)

Andy QA'd live while this session built; he checked off **unsequenced
residences** and **Slice 3 close-out** in the master sequence (Phase 1).
Three units shipped, all pushed, proofs where there's pure logic:

- **Context-card finding fixed** (Lockbourne card, `74ea542`+`6bca349`):
  the "N context" chip led with "＋ add context" over the actual note
  rendered as dim, dead-looking text (inverted hierarchy), and derived
  titles leaked raw `##`. Root causes: the context block was written
  add-first with weak-affordance rows; `deriveContextTitle` only accepted a
  heading WITH a space after the hashes (`## Foo`), so `##Foo` fell through
  to the raw first line. Fixes: notes-first + strong affordance (Andy's
  call: navigate-with-strong-affordance), and strip a leading ATX-hash run
  in the title fallback (`verify-derive-context-title.mjs` 15/15).
  **Class-of-bug: a derived plain-text label must never carry through block
  markdown (leading hashes), spacing regardless.**
- **Pin-card reconciliation** (design `docs/plans/2026-07-20-pin-card-reconciliation-design.md`;
  `af19c86`/`77fc099`/`324fb20`, Approach A): the detail card and edit panel
  each rendered the pin's connected collections independently and had
  DRIFTED — the bigger edit panel showed LESS (no context, no related pins).
  Extracted `components/globe/PinConnections.tsx`, mounted by BOTH cards; the
  edit panel is now the pin's workbench. Folded in Andy's two directives:
  "N anchored" chip → **"N related pin(s)"**; **"＋ Add New Context ↗"**
  deep-links to `/entities/[id]?addContext=1`, which auto-opens the composer
  (EntityView reads the param client-side). Hopper is per-variant (card = 4th
  single-open chip; panel keeps its own full always-open hopper). **Class-of-
  bug: two surfaces rendering the same data drift — extract a shared
  component, don't copy the markup.** tsc+lint green; **VISUAL PENDING Andy's
  eyeball** (Claude is auth-blocked from the running app) — QA
  `docs/qa/2026-07-20-pin-card-reconciliation-qa-checklist.md`.
- **Sticky pin-facts DATA LAYER** (`3679df6`; the pin-facts editor's
  foundation, plan `docs/plans/2026-07-10-pin-facts-editor-enhancement.md`):
  `runGlobeExtraction` overwrote every fact on each re-run, clobbering owner
  corrections. New pure `lib/globe/sticky-facts.ts` (`verify-sticky-facts.mjs`
  16/16): owner-edited fields (provenance in
  `relationships.metadata.facts_owner_edited`) survive re-extraction;
  extraction stays frontline for untouched fields. Integrated into
  runGlobeExtraction (raw model output still logged for audit; metadata stays
  MERGE-only). **Class-of-bug: an owner-editable field an agent also writes
  needs per-field provenance so the agent can't clobber the owner** (kin to
  merge-substance-preservation). `applyOwnerFactEdit` write helper is built +
  proven for the UI step.
- **Pin photo ordering / carousel foundation** (`b325ec7`/`6a4c2ad`/`7609ecb`;
  design `docs/plans/2026-07-20-pin-photo-ordering-design.md`): from Andy's
  UI-checklist §5 finding — photos landed at the front and sequential adds came
  out reversed because the gallery sorted by `created_at` DESC with no stored
  order. Added `entity_media.sort_order` (additive migration, no gate, applied
  + column-verified); pure `lib/globe/pin-image-order.ts`
  (`verify-pin-image-order.mjs` 8/8); backend appends at end + `reorderPinImages`
  (PATCH `{order}`) + promote drops the former primary to the carousel END
  (primary = cover, **decoupled** from sequence — Andy's model); drag-to-reorder
  UI in the edit-panel gallery (native HTML5 DnD, primary not draggable). **No
  backfill** (Andy reinstalls the few old multi-photo pins). **Deferred:
  keyboard-accessible reorder** (drag is pointer-only) + the carousel/slideshow
  presentation itself. Andy can QA this one **live** (not auth-blocked). QA
  `docs/qa/2026-07-20-photo-ordering-qa-checklist.md`.
- **Legend swatch fix** (`93be8de`): the Legend's Second residence & Vacation
  icons rendered as tiny black rectangles — the swatch applied the per-type
  MODIFIER class without the base `globe-pin` (unlike the on-globe markers), and
  those two modifiers inherit size + background from the base. Now
  `globe-pin ${modifier}`; a doc comment on `pinTypeClass` tells consumers to
  always prepend the base. **Class-of-bug: a modifier-only CSS class applied
  without its base collapses to its box-shadow.** From Andy finalizing the
  2026-07-18 pin-search QA.
- **Andy confirmed pin-facts defaults:** all four facts editable
  (residence_type / residence_detail / household_composition / move_reason);
  a user-triggered "refresh facts from the recollection" button + the queued
  offer-after-text-edit.
- **NEXT (2026-07-20 session closed here):** Andy resumes QA **tomorrow at the
  2026-07-19 "start a trip from here" checklist**
  (`docs/qa/2026-07-19-trip-from-here-qa-checklist.md`, Phase 1). Pending his
  live eyeball (Claude is auth-blocked from the running app): the pin-card
  reconciliation + the photo reorder. Build units still queued: the pin-facts
  editor **UI** (four fields + refresh button on the workbench, using
  `applyOwnerFactEdit`), then the **Loose-Ends surface design doc** (roadmap §3).

## Session handoff — 2026-07-18 (Spine & Share direction set; two Phase-1 riders BUILT)

- **2026-07-17: the Spine & Share roadmap is the active forward plan**
  (`docs/plans/2026-07-17-spine-and-share-roadmap.md`; direction memory
  [[project_lc_direction_2026-07-17]]): Track A = complete birth-to-now
  spine in weeks via a Loose-Ends surface (design doc next); Track B =
  shareable spine + Shareable Collections. All open QA consolidated into
  `docs/qa/2026-07-17-master-qa-sequence.md` (five phases, objective
  order, not build order). Plans folder archived/re-homed the same day;
  June Gemini commentary folded in 2026-07-18 (four inputs to the
  Collections design, one to Loose-Ends).
- **Globe pin search BUILT 2026-07-18** (`01cd5ee`/`aa04524`/`2e8d957`),
  from Andy's first Phase-1 QA finding: FindLocationBox rebuilt headless
  on SearchBoxCore — merged dropdown, "Your pins" (ALL types; matcher
  `lib/globe/pin-search.ts`, proof 8/8, tiered + diacritic-tolerant +
  spine-first) above Mapbox places; pin pick = `framePinOnMap` (extracted
  from the ?pin= deep-link effect — cluster-aware, compact-card arrival);
  route-building treats a search pick as "add this stop". Preserved:
  lat,lng paste (reverse-geocoded) + suggest-failure swallowing.
- **Basemap regime BUILT 2026-07-18** (Andy's Sunshine Village
  comparison; his call: outdoors style, build now): nocturne = canvas at
  world/regional zoom; ≥13.2 crosses to `outdoors-v12` detail, ≤12.6
  back (hysteresis `lib/globe/style-regime.ts`, proof 8/8; dissolve via
  `.globe-basemap-fading`, reduced-motion safe). **Class-of-change note:
  `setStyle` wipes all sources/layers/images** — chronicle layers now
  install idempotently on EVERY `style.load`, seeded from `lineDataRef`
  (latest arcs/tethers/commutes/routes FCs) + `activeArcRef` (selected
  leg emphasis), so swaps come back fully drawn with no effect re-runs.
  Fog is nocturne-only. `.globe-daylight` lands on the container as a
  daylight CSS tuning hook (pills carry their own dark backgrounds — no
  flip needed up front).
- **BUG + fix (2026-07-18, Andy's Phase-1 repro): decide-later primaries
  landed SEQUENCED at the spine's end.** PinModal produced
  `unsequenced: true` and the API/RPC honored it — but GlobeView's
  handleSave re-typed the PinDraftData field list into the POST body and
  never added U9's `unsequenced`; position:null then meant "append".
  (Edit path uses the sequence endpoint — that's why correcting worked.)
  Fix: payload assembly extracted to
  `lib/globe/create-pin-payload.ts` with a `satisfies
  Record<keyof PinDraftData, unknown>` exhaustiveness guard — adding a
  PinDraftData field now fails COMPILE until it is consciously routed
  (sent, transformed, or documented client-only like `trip`). Proof
  `verify-create-pin-payload.mjs` 6/6. **Class-of-bug: manual
  re-enumeration of payload fields at a boundary silently drops newly
  added fields — assemble boundary payloads in one guarded builder.**
  The RPC proof passed throughout; the bug lived in the one unproven
  hop (client assembly). Andy's repro pins already healed via edit.
- **Find + fix #2 (2026-07-18, same Phase-1 sitting): the anchor picker
  ("which home did you commute from?") offered SEQUENCED primaries only** —
  a workplace couldn't anchor to a just-created decide-later home. Fix:
  `lib/globe/anchor-options.ts` (proof `verify-anchor-options.mjs` 6/6),
  used by BOTH PinModal and PinEditPanel: Log keeps anchoring to any pin;
  every other marker anchors to a HOME = primaries (sequenced first in
  spine order, then unsequenced "· not yet placed") + second residences +
  short-term stays (Andy delegated the scoping call; vacations/travel/
  workplaces stay out — that's what Log is for; DB stays permissive per
  validate_pin_anchor). **Principle: home-ness is the TYPE, not the spine
  slot — U9's NULL-sort_order exclusion applies to ORDER-derived logic
  only.** `primaries` prop still feeds the sequence-position picker
  (sequenced-only, correct). TripFramePanel already passed all pins — no
  gap there.
- **"Start a trip from here" BUILT 2026-07-19** (Andy's ask, from the
  Mt.-Snow-Chalet "how do I trip from an existing pin?" question): the
  home-pin trip strip (now ALWAYS shown for primaries, not only when
  departures exist) arms `tripFromHere`; a banner mirrors origin-capture;
  the next PinModal opens pre-set to Trip; framing suggestion runs
  through `suggestTripOrigin` (`lib/globe/trip-origin.ts`, proof 5/5:
  existing origin > armed > anchor > Home Base > null) at all three
  setFraming sites; armed state consumed when a framing closes,
  cancellable from the banner. Trips stay destination-first — this is an
  origin-first ENTRY, not a new flow. Daylight ring contrast fix same
  day (`.globe-daylight` hook's first use — burnt amber/deep rose
  unfinished rings). QA: `2026-07-19-trip-from-here-qa-checklist.md`.
- **Andy's QA state:** working the master sequence, Phase 1 (unsequenced
  residences in progress). New checklists queued into Phase 1:
  `2026-07-18-globe-pin-search-`, `2026-07-18-basemap-regime-`, and
  `2026-07-19-trip-from-here-`.
- **NEXT:** Phase-1 QA continues → remediation (+ pin-facts rider);
  then the Loose-Ends surface design doc (roadmap §3).

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

