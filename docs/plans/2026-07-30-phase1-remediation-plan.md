# Phase-1 remediation — the finding register and build order

**Date:** 2026-07-30
**Author:** Claude Code (Opus 5), from Andy's live walk of the
[trip-from-here checklist](../qa/2026-07-19-trip-from-here-qa-checklist.md).
**Status:** **Sequencing agreed with Andy 2026-07-30 — remediation ships as ONE
pass BEFORE Loose-Ends L1.** Design agreed for R1–R5; R6 carries a gated
migration; R7 awaits Andy's eye. **No code written yet.**
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
| **F7** | A stop-less round trip's dashed return is coincident with the solid outbound — *is it legible?* | **open — needs Andy's eye** before any work | **R7** |

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

**Caveat:** `onDone` also clears `tripFromHere` (`GlobeView.tsx:1608`), so
dismissing consumes the armed origin. Decide this deliberately — don't let it
be discovered later.

**Accept:** Escape closes both; no data written on dismiss; armed-origin
behaviour is whatever was decided, and stated in the checklist.

### R2 — The exit says what it does *(F9b)*
Fresh draft → "Keep as a draft" (unchanged). Already-framed trip → "Cancel" /
"Close without saving".
**Accept:** re-framing an existing trip never offers language implying
demotion; neither path writes on exit.

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
§3. **Andy's three open questions in §6 must be answered before build.**

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
   **Show it to Andy and get approval before applying.**
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
*If it needs work:* bow the return opposite the outbound so the pair reads as
a lens, rather than relying on a dash overlay.

## 3. What this pass does not include

- Anything from the four unwalked Phase-1 checklists — **they will add
  findings, and those append to §1 rather than starting a new document.**
- The Loose-Ends unit (L1–L7). This pass precedes L1 by Andy's call.
- The `/memories` full-text search of the Loose-Ends design §6.1 — R3 is the
  *pin* matcher only, and is **not** the Step-14 semantic search agent.

## 4. Open before build

1. **§6 of the strip design** — whole strip or trigger only; detail card or
   both surfaces; where R4 sequences.
2. **R1's armed-origin question** — does dismissing consume `tripFromHere`?
3. **R7** — Andy's verdict on the coincident return.
4. **R6's gated migration** — shown for approval when R6 starts.

## 5. Cross-references

- Evidence for every finding: [`../qa/2026-07-19-trip-from-here-qa-checklist.md`](../qa/2026-07-19-trip-from-here-qa-checklist.md) §Findings
- Designs: [`2026-07-30-trip-strip-into-pin-card-design.md`](2026-07-30-trip-strip-into-pin-card-design.md) (R4/R5/R6)
- The unit this precedes: [`2026-07-30-loose-ends-surface-design.md`](2026-07-30-loose-ends-surface-design.md)
- Master walk: [`../qa/2026-07-17-master-qa-sequence.md`](../qa/2026-07-17-master-qa-sequence.md) — Phase 1
- Rules 10 and 11, and the through-line: `memory/project_lc_build_progress.md` (2026-07-30 block)
