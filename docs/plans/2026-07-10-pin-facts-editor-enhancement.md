# Enhancement — owner-editable pin facts (with sticky owner values)

*Status: AGREED with Andy 2026-07-10, not yet scheduled. Small build (~an
hour with proof) — a natural rider on any future globe/journey session.*

## Problem (two live sightings, 2026-07-09/10)

The extracted pin facts — `residence_type`, `move_reason`,
`household_composition`, `residence_detail`, stored in
`relationships.metadata` / `.globe_extraction` — render as fact chips on
the Journey (J3) and feed the transition phrases, but are **editable
nowhere**. They are a save-time snapshot of the recollection text:

1. Andy corrected "Rick Toll" → "Rick Tole" in the Mt. Snow recollection;
   the chip kept the misspelling until a manual re-extraction (2026-07-10).
2. Alp Hof's `move_reason` sat on `unknown` (rendered as Journey silence)
   until the vocabulary gained `relationship` and the pin was re-extracted.

Repairs currently require Claude re-running `runGlobeExtraction` — an LLM
roll the owner can't steer.

## Agreed shape

**On the globe PinEditPanel** (the pin's editing home):

- `household_composition` — free-text field ("who lived there with you").
- `move_reason` — selector over the extraction vocabulary (incl.
  `relationship`, `seasonal_work` added 2026-07-09) + "unknown".
- `residence_type` / `residence_detail` — same treatment if cheap; chips
  render them, so probably yes.

**Sticky owner values (the important invariant):** owner-edited facts are
marked with per-field provenance (e.g.
`metadata.facts_owner_edited: ['household_composition', …]`) and
**re-extraction never overwrites an owner-edited field**. Extraction stays
the frontline for untouched fields; the owner's word is final where given.

**Re-extract affordance:** a "refresh facts from the recollection" action
on the panel (and/or the already-queued enhancement: *offer re-extraction
after a finalized text edit* — the Leola-session item this problem
re-confirmed). Respects sticky fields.

## Acceptance sketch

- Editing household on a pin updates the Journey chip on next expand; the
  value survives a subsequent re-extraction (sticky).
- move_reason set by owner drives the Journey transition phrase
  immediately; extraction never flips it back.
- Proof: pure sticky-merge helper (owner fields win) + a live
  re-extraction-respects-sticky assertion.

## Related

- `lib/globe/extraction.ts` — asPhrase coercion (array-shaped phrases) +
  vocabulary; `lib/journey/tree.ts` — transitionPhrase map.
- Queued enhancement (build_progress, Leola session 2026-07-06): offer
  re-extraction after finalized owner edits.
- Three stored values healed by re-extraction 2026-07-10 (Lockbourne,
  Coronet Peak Y2, Mt. Snow — Rick Tole spelling included).
