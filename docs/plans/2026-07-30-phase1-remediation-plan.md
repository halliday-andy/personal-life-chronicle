# Phase-1 remediation — the finding register and build order

**Date:** 2026-07-30
**Author:** Claude Code (Opus 5), from Andy's live walk of the
[trip-from-here checklist](../qa/2026-07-19-trip-from-here-qa-checklist.md).
**Status:** **R1–R3 BUILT 2026-07-30** (`0be03e7`, `fb8ac78`, `52cf87e`) —
QA checklist [`../qa/2026-07-30-remediation-r1-r3-qa-checklist.md`](../qa/2026-07-30-remediation-r1-r3-qa-checklist.md),
Andy's live pass pending. **R4–R5 UNBLOCKED 2026-08-01** — Andy completed the pin-card reconciliation
walk (its only finding was that the "N related pins" chip item is superseded,
not failing), so the surfaces R4 rewrites have now been proven. R6 carries the gated
migration. **Sequencing agreed with Andy 2026-07-30 — remediation ships as ONE
pass BEFORE Loose-Ends L1.** **All four open design questions resolved
2026-07-30 (§4): R1–R5 are fully specified and unblocked.** R6's migration is
approved as written and applies at R6; R7 needs only Andy's A/B glance.
**No code written yet.**
**Why this document exists:** findings were living only at the bottom of a QA
checklist that is now walked and heading for archive. The evidence belongs in
the checklist; the **decision** belongs here, so implementation needs no
re-derivation.

---

## 1. The register

Nine findings from one checklist. Three (F1, F2, F8) collapse into a single
change — the best ratio in the set.

| # | Finding | Fix | Unit |
|---|---|---|---|
| **F1** | Trip strip (`z-30`, `top-20`) occludes the search dropdown (`z-20`, `top-6`), hiding pin-search's "Your pins" group | strip → card; the band empties, so no stacking rule to maintain | **R4 — BUILT** |
| **F2** | "Start a trip from here" lives in globe chrome; Andy hunted the card and edit panel for it | strip → card (rule 10) | **R4 — BUILT** |
| **F8** | A trip's jots are invisible from its destination pin — they host on the *trip* entity, the card reads the *place* entity | strip → card; trip jots arrive via the trip disclosure. **Counts stay per-host** | **R4 — BUILT** |
| **F4** | The armed placement modal never says the pin is the trip's destination; CTA reads "Add this place" | mode-aware heading + CTA (rule 11) | **R5** |
| **F5** | Anchor reads as trip origin and is preset to the armed pin, but editing it would not change the origin | clarifying label; ownership stays in the framing panel | **R5** |
| **F3** | `searchPins` matches the whole query as a substring, so `Mount Snow Chalet` misses `My Mt. Snow Chalet`; failure is silent | token-wise matching + an explicit "no pins matched" | **R3** |
| **F9a** | No dismissal on `TripFramePanel` **or** `PinModal` — no Escape, ✕, or backdrop. Both are keyboard traps | Escape + ✕ + backdrop | **R1** |
| **F9b** | The exit exists but is labelled "Keep as a draft", which reads as *demote* when re-framing an already-framed trip | contextual label (rule 11, 3rd sighting) | **R2** |
| **F6** | A trip's destination is immutable at every layer — `frame_trip` has no destination parameter and no sibling supplies one | gated guard relaxation + new `retarget_trip` RPC | **R6** |
| **F12** | A `##Title` typed on line 1 loses its title to a proper heading inside pasted research — `deriveContextTitle` required a space after the hashes, so the loose form fell to a fallback that only runs when the note has NO heading anywhere | accept both spellings in step 1; first heading wins | **R10 — BUILT `4c657d3`** |
| **F13** | Editing a long context note jumps the page to the recollections list, editor above the viewport. The textarea was `rows={4}` regardless of content, so opening it collapsed a tall rendered block into a short box and the preserved scroll offset pointed nowhere useful | autoFocus + `scrollIntoView` on the editor; size rows from the note (4–24, computed once) | **R11 — BUILT** |
| **F10** | Opening a chip activates it and nothing else visibly happens — the panel opens below the fold and the chip reads as a dead control. **REPRODUCED 2026-08-01 on Zaragoza AB**, in `PinEditPanel` (not the detail card, and not a missing scroll container — the panel already scrolls). Disclosures render after the chip row inside that scroll container and nothing brought them into view | `PinConnections` scrolls its disclosure into view on open; `PinDetailCard` also gains a bounded height + internal scroll, without which it has no scrollable ancestor to act on | **R8 — BUILT + VERIFIED** |
| **F11** | Rich paste **loses tables AND all bold**. Verified against the stored note: headings, bullets and links survived, but the table became a vertical run of cells and there is not one `**` in the body. `turndown` has no `<table>` rule (and `turndown-plugin-gfm` is absent) and no rule for **presentational** emphasis — Gemini marks bold with styled spans, not `<b>`. Meanwhile `remark-gfm` IS active on the render side | `turndown-plugin-gfm` for tables + a custom rule mapping `font-weight:600–900` / `font-style:italic` onto strong/em | **R9** |
| **F14** | The "● yours" marker's explanation lives only in a native `title`, whose ~1s delay is browser-controlled and uncontrollable — a brief hover never sees it, touch never does, screen readers are inconsistent | promote the meaning to a visible legend under the Facts heading, shown only while a marker exists; keep the title as a bonus | **R12 — BUILT** |
| **F15** | `residence_detail` ("The place itself") was missing from the fact chips on BOTH reading surfaces AND from the client types — the omission fossilised, though the API returned it all along. An owner could correct it and never see it | add it to the chips and the types | **R13 — BUILT** |
| **F16** | `rough_temporal_range` rendered as a peer of the owner's editable facts but is a read-only extraction artifact, editable nowhere — and on Loring it restated the `when` phrase uncorrectably. Andy hunted for a field that does not exist | **Andy's call: keep it, separate it.** Own row labelled "The chronicle's reading · not yours to edit" | **R13 — BUILT** |
| **F17** | Residence facts render on **non-home pins** — "father and sister" on a castle visit. The facts EDITOR has always gated on `isHomeType` (`PinEditPanel:475`); the two READING surfaces never gated at all | gate both reading surfaces on the same shared predicate; pin `isHomeType`'s membership in the proof, which had no coverage | **R14 — BUILT** |
| **F18** | A place title drags as a LINK. Grandchildren (no reorder machinery) appeared draggable and dropped with no effect; worse, on DIRECT children the anchor's native drag hijacked the row's, so reorder-by-title silently failed | `draggable={false}` on `ChildRow`'s links — grandchildren stop offering a dead gesture, direct children hand it back to the `<li>` | **R15 — BUILT** |
| **F19** | Hovering a pin peeked its tethers but never its **trips** — the tether effect honoured `hoverPreview`, the route effect only honoured `selectedId`. Hovering the trip's far end showed that pin's tether home, so the link looked one-sided | hover counts alongside selection for routes; drafts still draw nothing at rest | **R16 — BUILT** |
| **F7** | A stop-less round trip's dashed return is coincident with the solid outbound — *is it legible?* | **CLOSED — PASS (Andy, 2026-07-30).** The dash reads clearly over the solid outbound; the one-way arc to Wendy's apartment shows none. No work needed; **R7 retired** | — |

## 2. Build order

Cheap and independent first, then the structural move, then the data model.
Each unit is one atomic commit, `tsc` + `next lint` gated, with a QA checklist.

### R1 — Modal dismissal *(F9a)* — **BUILT `0be03e7`**
Escape handler, ✕, and backdrop dismiss on **`TripFramePanel` and `PinModal`**.
Smallest unit in the set and it removes two keyboard traps.

Per `memory/feedback_lc_accessibility_deferral.md` this is **owed, not
deferred** — dedicated keyboard surfaces wait, but Escape-to-close on a modal
is the cheapest accessible path available and the policy says to take it when
a feature makes it cheap.

**RESOLVED (Andy, 2026-07-30): preserve `tripFromHere` on dismissal; clear it
only on a successful frame.** The armed pin is applied at *framing*, not at
trip creation, so dismissing while also clearing it would strand a draft trip
with no origin and no way to recover the intent. Dismissal means "not now",
not "never". This is not hidden state: the banner reappears on `!modalOpen`
and carries its own ✕.

**Escape closes; it NEVER deletes.** Destructive actions require a deliberate
click.

**Accept:** Escape closes both modals; no data written on dismiss; after
dismissing, the banner is back and still armed; framing successfully still
consumes the armed origin.

### R2 — The exit set is right, and abandonment is possible *(F9b)* — **BUILT `fb8ac78`**

Relabelling one button is not enough — Andy asked how an incomplete "trip from
here" is abandoned outright, and today that takes three steps across two
surfaces.

**Exits by trip state:**

| Trip state | Exits |
|---|---|
| **Fresh draft** | **Discard this trip** · Keep as a draft · Save the frame |
| **Already framed** | Cancel · Save the frame |

- **Discard reuses the existing `unframeTrip` path** — delete the trip, keep
  the pin — rather than growing a second deletion route (rule 6: check whether
  the sibling surface already solved it). Copy states the outcome: *"The place
  stays on your globe."*
- **Discard is not offered for an already-framed trip.** That is Unframe,
  which lives on the card after R4.
- "Keep as a draft" survives only where it is true — a fresh draft.

**The abandonment trap to fix or explain:**
`trips.destination_relationship_id` is `ON DELETE RESTRICT`, so **the
destination pin cannot be deleted while the trip exists.** A user tidying up
in the intuitive order hits a bare database restriction. Either unframe-first
is guided, or the error is caught and explained.

**Where strays surface meanwhile:** a draft draws nothing on the globe at rest
(R6) but the Travel Journal shows *"N trips still need framing"* plus per-card
badges (`TravelJournal.tsx:168`, `:237`). Draft trips are also one of the six
Loose-Ends inputs, so the unit that follows this pass sweeps them up.

**Accept:** a fresh draft can be discarded from the framing panel, keeping
the pin; re-framing an existing trip never offers language
implying demotion; Escape writes and deletes nothing; attempting to delete a
pin that is still a trip destination produces an explanation rather than a
raw error.

### R3 — Search that fails out loud *(F3)* — **BUILT `52cf87e`**
Token-wise matching in `lib/globe/pin-search.ts`, plus an explicit **"No pins
matched"** row in the merged dropdown.

The message matters as much as the matcher: F3, F1's occlusion, and the known
append trap **all present identically as "nothing happened."** One of them
saying so out loud collapses that ambiguity.

**`scripts/verify-pin-search.mjs` already exists — extend it, and prove it
red/green.** Rule: *a guard that has never failed on the bug it was written
for is unproven* (earned 2026-07-26, when the first sibling-key guard passed
while the bug was live).

**Accept:** `Mount Snow Chalet` finds `My Mt. Snow Chalet`; St./Saint and
Rd./Road behave; the proof fails on the pre-fix matcher and passes after; a
query with genuinely no matches says so.

### R4 — The trip strip moves onto the pin card *(F1, F2, F8)* — **BUILT `2de4ea4`**
The structural unit. `components/globe/PinTrips.tsx` mounted by **both**
`PinDetailCard` and `PinEditPanel`, all three strip variants, as a chip on the
count-chip row with single-open disclosure.

Full design:
[`2026-07-30-trip-strip-into-pin-card-design.md`](2026-07-30-trip-strip-into-pin-card-design.md)
§3.

**RESOLVED (Andy, 2026-07-30):**
- **The WHOLE strip moves**, all three variants — not the trigger alone.
  Trigger-only would fix F2 and leave F1's occlusion and F8's invisibility
  alive; the band must empty for F1 to die by construction.
- **Both card surfaces**, one component, same actions. Mounting `PinTrips` in
  only one place would recreate the exact drift the pin-card reconciliation
  doc was written to fix, in the same files.

**Deviation at build (2026-08-01, better than designed):** `PinTrips` is
mounted BY `PinConnections`, exactly as `PinHopper` is — not as a third
sibling in each card. The design asked for "a Trips chip on the pin's
count-chip row", and that row lives inside `PinConnections`, so this is the
faithful reading. It also makes the sibling-key hazard **moot** rather than
merely handled: `PinTrips` is a child, not a sibling keyed by relationship
id. `PinConnections` stays ignorant of trips — it takes one opaque `tripCtx`
object, sizes the chip from a reported count, and passes it on.

**Superseded by the above, kept for the reasoning:** namespace the sibling key `trips-${relationshipId}`.
`PinTrips` lands beside `PinFactsEditor` (`facts-…`) and `PinConnections`
(`connections-…`); the bare-id collision is what rendered the Facts block
nineteen times. `scripts/verify-jsx-sibling-keys.mjs` covers the file set.

**Accept:** F1 gone with **no z-index change** (nothing renders in that band);
"Start a trip from here" reachable from the card; a trip's jots reachable from
its destination pin **without merging the counts**; both card surfaces render
identically from the one component.

### R5 — The armed modal states its mode *(F4, F5)*
Heading *"Where did the trip from **X** go?"*, sub-line reusing the banner's
wording, CTA **"Set the destination"**. Reverts to generic if the type changes
away from a trip. Plus F5's clarifying label on the anchor.
Design: same doc §4.
**Accept:** the mode is stated only while true; the type stays changeable
(§1's guarantee); no trip-level state moves into the pin-level dialog.

### R6 — A trip's destination becomes changeable *(F6)* — **GATED**
Two parts:

1. **Guard relaxation (GATED, approved in principle 2026-07-30, unapplied).** A
   primary residence may be a trip destination when `return_to_origin = false`
   — terminus, not turnaround. Alters `validate_trip_pin` and `create_trip`;
   the signature change means `DROP FUNCTION` and a post-apply proof of
   **exactly one function, no orphan overload** (the 2026-07-26 trap).
   **APPROVED as written (Andy, 2026-07-30) — to be applied AT R6, not before**,
   so the schema and the code do not disagree while five findings are still
   unbuilt. Two call-site changes, `validate_trip_pin` itself unchanged:
   `create_trip` gains `p_return_to_origin` and validates with
   `allow_spine := NOT p_return_to_origin`; **`frame_trip` re-validates**, so a
   one-way trip terminating at a home cannot later be flipped back to a round
   trip and become invalid.
2. **`retarget_trip(...)` — new RPC, additive, ungated.** Repoint the
   destination, optionally demoting the old one to a stop. **Repoint before
   demoting** (`add_trip_stop` refuses the current destination); leg
   `outbound` for one-way; **never rename a user-titled trip.**

Design: same doc §5. **This gated migration has three dependents** — R6 itself,
the Loose-Ends seam's one-way trips, and retyping Wendy's shared apartment back
onto the spine.

**Live-data repairs ride here, each asked separately, and none is urgent
(Andy, 2026-07-30):** the Fiat 128 trip → terminus SSV Day Lodge Room with
Wendy's apartment demoted to a stop; Wendy's apartment retyped from
`vacationed_at` to a residence.

### R7 — The dashed return *(F7)* — **RETIRED, no work**
Not scheduled. The geometry is intended (`pair()` builds a great circle; the
comment says the return renders dashed over the solid outbound), so this is a
legibility question only Andy's eye settles. The A/B test is on his globe
today: two stop-less trips from **My Mt. Snow Chalet**, one one-way, one round
trip.
**CLOSED AS A PASS (Andy, 2026-07-30).** He ran the A/B on his globe: round
trips show a dashed line superimposed on the solid outbound; the one-way arc
to Wendy's apartment shows no dash at all. The overlay is legible and the
feature works as designed — **this unit is retired.**

The reasoning below is kept because it governs any *future* change to trip
route rendering:

**If the two had been indistinguishable, the fix would NOT have been the
arc.** Bowing the return would draw a path that was never recorded,
implying a different return route; for a stop-less round trip the return is
*status*, not geometry. **Reserve the drawn return for trips that have actual
return stops**, where it carries real information, and express round-trip-ness
in text (the trip row and Travel Journal both have room).

### R10 — The title you type wins *(F12)* — **BUILT `4c657d3`**

Andy opened his Dartmouth note with `##Matriculating into an all-male college
environment` and the card titled it *"The 'Strategic Self-Interest'
Argument"* — a heading from the middle of the pasted Gemini article.

`deriveContextTitle` step 1 scanned every line but **required a space after
the hashes**. The loose form fell through to step 2, which only runs when the
note contains no proper heading *anywhere*. Hand-typed notes have none — which
is why the 2026-07-20 fix looked complete — but pasted research is full of
them, so the author's own title lost to someone else's subheading.

Both spellings are the same authorial act: step 1 now accepts either and the
**first** heading wins. `(?!#)` keeps a hashes-only line from splitting into
`##` plus a title of `#`.

**No data migration:** the title is derived at read time, so existing notes
correct themselves on next render.

**Proof:** `verify-derive-context-title.mjs` 15 → 17, red/green. A guard case
(a proper heading still wins when line 1 is prose) passed before and after, so
the change is bounded to the reported defect.

### R8 — An opened chip scrolls itself into view *(F10)* — **BUILT + VERIFIED LIVE (Andy, Zaragoza AB, 2026-08-01)**

Andy, 2026-07-30 (context-card walk): clicking the context chip appeared to do
nothing; the revealed one-line note and "＋ Add New Context ↗" had opened
outside the visible area and needed scrolling to reach.

**Confirmed latent defect:** the expanded card is
`glass absolute bottom-6 … p-5` (`PinDetailCard.tsx:199`) — **no
`max-height`, no `overflow-y-auto`** — inside
`nocturne relative h-screen w-screen overflow-hidden` (`GlobeView.tsx:1396`).
Bottom-anchored, it grows upward until its top is clipped with no way to
scroll to it. Any pin with recollection + facts + context + related pins can
exceed the viewport.

**REPRODUCED 2026-08-01** on Zaragoza AB, with before/after screenshots.
**The original diagnosis named the wrong component.** This is `PinEditPanel`,
which already has a scroll container (`overflow-y-auto`, `:283`) — the defect
is that the disclosures render after the chip row *inside* it, so opening one
appends content below the current scroll position and nothing scrolls.

Fixed in the shared `PinConnections` (ref + `scrollIntoView({ block:
'nearest' })` on open), so both card surfaces benefit. `PinDetailCard` also
gained `max-h-[calc(100vh-8rem)] overflow-y-auto` — the latent defect the
original write-up correctly identified, and a precondition for
`scrollIntoView` to have anything to act on there.

**Lesson worth keeping: "cannot reproduce" is not "not a bug."** The first
pass closed this as unconfirmed because the geometry did not match Andy's
description — and the geometry genuinely did not, because it was a different
component.

**Fix regardless of which end:** bound the card to the viewport
(`max-h-[calc(100vh-…)]` + `overflow-y-auto`) so it is always readable to the
end, and scroll a newly opened disclosure into view so opening a chip always
produces visible feedback.

**Class of bug — CONFIRMED at F13, two sightings:** *a mode switch that
changes an element's height must keep that element in view.* Replacing
rendered content with an editor collapses the document; a preserved scroll
offset then points somewhere meaningless. The F10 form of it — *a disclosure
whose revealed content lands outside the viewport reads as a dead control* — The user
does not conclude "it opened somewhere I can't see"; they conclude "nothing
happened" — the same silent-failure family as F3's empty search.

### R9 — Pasted tables and bold survive *(F11)* — **BUILT**

Andy pasted Gemini research on Dartmouth co-education into the context
composer and lost the formatting, including a table.

**Verified against the STORED note, not a guess.** Querying
`entity_context_notes` for the saved body shows turndown definitely ran —
`## The "Dartmouth Plan" Solution`, `- Zero-Sum Fear: …` bullets, and
turndown's own bracket escaping (`\[5, 13, 17, 18\]`). Headings, bullets,
links and paragraph structure all survived.

**Two losses:**

1. **Tables** — `Institution\n\nTransition to Coeducation\n\nNote\n\nColumbia\n\n1983…`,
   a vertical run of orphaned cells.
2. **Bold — completely.** Not one `**` in the whole body, though the source is
   full of it.

**Correction to an earlier claim in this document's history:** a first pass
concluded "bold and links survive; tables don't", from a synthetic fixture
written with `<b>`. Semantic `<b>` does survive. Andy's real source marks
emphasis **presentationally** (styled spans), which turndown has no rule for —
so the fixture proved the wrong thing.

**Class of bug (new): test a converter against captured REAL input, not
idealised markup.** A hand-written fixture encodes the author's assumption
about the source; the source is free to disagree. *The tell: a fixture nobody
copied from a real producer.* Sibling of the 2026-07-26 rule that a guard
which has never failed on its own bug is unproven.

**Root cause is an asymmetry between the two ends of one pipeline:**
`turndown` ships **no `<table>` rule**, and `turndown-plugin-gfm` is not a
dependency — but `remark-gfm` **is** installed and active in
`components/Markdown.tsx:32`. **The app can render a markdown table it is
incapable of producing.** Rich paste IS correctly wired to this composer
(`EntityView.tsx:547`); the loss is entirely in conversion.

**Fix — two rules, not one:**

1. `turndown-plugin-gfm` for tables (plus strikethrough and task lists, so the
   converter's capability set matches `remark-gfm`'s).
2. A custom rule mapping **presentational** emphasis — inline
   `font-weight: bold|600|700|800|900` and `font-style: italic` — onto
   `strong`/`em`, so bold survives sources that never emit `<b>`.

**Proof:** extend `scripts/verify-rich-paste.mjs` with BOTH a table fixture
and a styled-span-bold fixture, proven red/green.

**Open:** the styled-span rule is written against the most common
presentational form (inline `style`). If Gemini uses a CSS *class* instead,
the class name is unknowable from here and the raw clipboard HTML would need
capturing. Re-test with the same source after the fix; if bold still flattens,
that is the next step rather than more guessing.

**Class of bug (new): a lossy converter paired with a capable renderer.** When
one end of a pipeline is upgraded (remark-gfm on render) the other end must be
audited for the same capability set, or the product silently supports a format
it cannot accept. *The tell: an input path and an output path that disagree
about what the format includes.*

## 3. What this pass does not include

- Anything from the four unwalked Phase-1 checklists — **they will add
  findings, and those append to §1 rather than starting a new document.**
- The Loose-Ends unit (L1–L7). This pass precedes L1 by Andy's call.
- The `/memories` full-text search of the Loose-Ends design §6.1 — R3 is the
  *pin* matcher only, and is **not** the Step-14 semantic search agent.

## 4. Open before build — ALL RESOLVED 2026-07-30

1. ~~Whole strip or trigger only; one card surface or both~~ → **whole strip,
   both surfaces, one component** (R4).
2. ~~Does dismissing consume the armed origin?~~ → **no; preserved on
   dismissal, cleared only on a successful frame**, and Escape never deletes
   (R1). Abandonment gets a first-class **Discard** exit (R2).
3. ~~The coincident dashed return~~ → **reserve the drawn return for trips
   with real return stops**; never fabricate a bowed path (R7).
4. ~~The gated migration~~ → **approved as written, applied at R6**, not
   before.

**One deviation to review:** R2's discard is **two-step**, not one-click —
the panel is reachable for an existing draft carrying a title and jots, and
Unframe already uses a two-step confirm for the same deletion. Andy's call.

**Nothing blocks R1–R5.** R6 applies its migration at its turn. **R7 is
closed as a pass and retired** — eight live findings across six units.

## 5. Cross-references

- Evidence for every finding: [`../qa/2026-07-19-trip-from-here-qa-checklist.md`](../qa/2026-07-19-trip-from-here-qa-checklist.md) §Findings
- Designs: [`2026-07-30-trip-strip-into-pin-card-design.md`](2026-07-30-trip-strip-into-pin-card-design.md) (R4/R5/R6)
- The unit this precedes: [`2026-07-30-loose-ends-surface-design.md`](2026-07-30-loose-ends-surface-design.md)
- Master walk: [`../qa/2026-07-17-master-qa-sequence.md`](../qa/2026-07-17-master-qa-sequence.md) — Phase 1
- Rules 10 and 11, and the through-line: `memory/project_lc_build_progress.md` (2026-07-30 block)
