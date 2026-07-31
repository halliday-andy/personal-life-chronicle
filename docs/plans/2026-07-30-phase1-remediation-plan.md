# Phase-1 remediation — the finding register and build order

**Date:** 2026-07-30
**Author:** Claude Code (Opus 5), from Andy's live walk of the
[trip-from-here checklist](../qa/2026-07-19-trip-from-here-qa-checklist.md).
**Status:** **Sequencing agreed with Andy 2026-07-30 — remediation ships as ONE
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
| **F1** | Trip strip (`z-30`, `top-20`) occludes the search dropdown (`z-20`, `top-6`), hiding pin-search's "Your pins" group | strip → card; the band empties, so no stacking rule to maintain | **R4** |
| **F2** | "Start a trip from here" lives in globe chrome; Andy hunted the card and edit panel for it | strip → card (rule 10) | **R4** |
| **F8** | A trip's jots are invisible from its destination pin — they host on the *trip* entity, the card reads the *place* entity | strip → card; trip jots arrive via the trip disclosure. **Counts stay per-host** | **R4** |
| **F4** | The armed placement modal never says the pin is the trip's destination; CTA reads "Add this place" | mode-aware heading + CTA (rule 11) | **R5** |
| **F5** | Anchor reads as trip origin and is preset to the armed pin, but editing it would not change the origin | clarifying label; ownership stays in the framing panel | **R5** |
| **F3** | `searchPins` matches the whole query as a substring, so `Mount Snow Chalet` misses `My Mt. Snow Chalet`; failure is silent | token-wise matching + an explicit "no pins matched" | **R3** |
| **F9a** | No dismissal on `TripFramePanel` **or** `PinModal` — no Escape, ✕, or backdrop. Both are keyboard traps | Escape + ✕ + backdrop | **R1** |
| **F9b** | The exit exists but is labelled "Keep as a draft", which reads as *demote* when re-framing an already-framed trip | contextual label (rule 11, 3rd sighting) | **R2** |
| **F6** | A trip's destination is immutable at every layer — `frame_trip` has no destination parameter and no sibling supplies one | gated guard relaxation + new `retarget_trip` RPC | **R6** |
| **F7** | A stop-less round trip's dashed return is coincident with the solid outbound — *is it legible?* | **decided:** never fabricate a bowed path; draw a return only where real return stops exist, express round-trip in text. Andy's A/B glance decides whether the text treatment is needed at all | **R7** |

## 2. Build order

Cheap and independent first, then the structural move, then the data model.
Each unit is one atomic commit, `tsc` + `next lint` gated, with a QA checklist.

### R1 — Modal dismissal *(F9a)*
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

### R2 — The exit set is right, and abandonment is possible *(F9b)*

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

**Accept:** a fresh draft can be discarded from the framing panel in one
click, keeping the pin; re-framing an existing trip never offers language
implying demotion; Escape writes and deletes nothing; attempting to delete a
pin that is still a trip destination produces an explanation rather than a
raw error.

### R3 — Search that fails out loud *(F3)*
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

### R4 — The trip strip moves onto the pin card *(F1, F2, F8)*
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

**Non-negotiable:** namespace the sibling key `trips-${relationshipId}`.
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

### R7 — The dashed return *(F7)* — **BLOCKED on Andy**
Not scheduled. The geometry is intended (`pair()` builds a great circle; the
comment says the return renders dashed over the solid outbound), so this is a
legibility question only Andy's eye settles. The A/B test is on his globe
today: two stop-less trips from **My Mt. Snow Chalet**, one one-way, one round
trip.
**RESOLVED (Andy, 2026-07-30) — if the two are indistinguishable, do NOT fix
the arc.** Bowing the return would draw a path that was never recorded,
implying a different return route; for a stop-less round trip the return is
*status*, not geometry. **Reserve the drawn return for trips that have actual
return stops**, where it carries real information, and express round-trip-ness
in text (the trip row and Travel Journal both have room).

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

**Nothing blocks R1–R5.** R6 applies its migration at its turn; R7 needs only
Andy's A/B glance to confirm whether the text treatment is needed at all.

## 5. Cross-references

- Evidence for every finding: [`../qa/2026-07-19-trip-from-here-qa-checklist.md`](../qa/2026-07-19-trip-from-here-qa-checklist.md) §Findings
- Designs: [`2026-07-30-trip-strip-into-pin-card-design.md`](2026-07-30-trip-strip-into-pin-card-design.md) (R4/R5/R6)
- The unit this precedes: [`2026-07-30-loose-ends-surface-design.md`](2026-07-30-loose-ends-surface-design.md)
- Master walk: [`../qa/2026-07-17-master-qa-sequence.md`](../qa/2026-07-17-master-qa-sequence.md) — Phase 1
- Rules 10 and 11, and the through-line: `memory/project_lc_build_progress.md` (2026-07-30 block)
