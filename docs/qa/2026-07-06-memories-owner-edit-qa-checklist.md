# QA Walkthrough — /memories owner editing + entity-link repair (2026-07-06)

App: **http://localhost:3001/memories** (sign in first).

> The micro-slice from the Leola discussion: (1) finalized recollections are
> now editable on /memories with the original preserved as a revision
> (Raw Vault pathway C — same pattern as the globe edit panel); (2) entity
> chips are owner-editable — × unlinks, "+ link" adds an entity extraction
> couldn't see. Logic proven by `verify-memory-owner-edit.mjs` (9/9); this
> is the human proof.

## 1. The Leola repair (the case that motivated this)
- [ ] Open /memories and find the senior-year recollection ("We had known
      each other superficially through high school…", `5cc85be3`).
- [ ] Its chip row now ends with a dashed **+ link** chip. Click it → type
      "Leola" → pick **Leola Lapides** → the chip appears immediately.
- [ ] Click the **Leola Lapides** chip → her Entity View opens and this
      recollection now appears under "recollections that mention" her.
- [ ] (The person↔place↔memory graph is now complete for this memory —
      exactly the repair discussed; no prose was rewritten.)

## 2. Entity-link editing generally
- [ ] Hover any chip → an **×** shows; clicking it unlinks (chip disappears);
      the entity itself still exists in /entities. **[taste]** × subtlety.
- [ ] Re-link the same entity via **+ link** → idempotent, no duplicate chip.
- [ ] The typeahead excludes entities already linked to the card.
- [ ] **Escape** or **cancel** closes the typeahead without changes.

## 3. Editing a FINAL recollection
- [ ] A **Final** memory's header now shows **Edit** (next to Delete).
- [ ] Open Edit → the editor notes *"Saving preserves your original text as
      a revision."* Make a small text change → **Save**.
- [ ] A green notice confirms *"your previous text is preserved as a
      revision."* The card shows the new text.
- [ ] Edit again and change ONLY the "When"/precision fields → Save → no
      revision notice (temporal metadata isn't the verbatim narrative).
- [ ] Draft memories behave as before (Accept / Decline / Edit row).

## 4. Not broken elsewhere
- [ ] The globe pin edit panel still edits its own recollection as before
      (its separate revision path is untouched).
- [ ] ProposalCard draft editing in the capture panel is unaffected.

## Known scope (not bugs)
- **Elaborations via edit do not auto-re-extract** — after adding new names
  to a text, re-extraction is manual for now (the "offer re-extraction after
  save" enhancement is noted; the backfill machinery exists).
- Roles are defaulted (person→participant, place→location), not user-chosen;
  a role picker is deferred until a real need appears.
- The capture-time root cause (orchestrator passing pronoun referents to
  extraction) is a separate queued enhancement — this slice is the repair
  path, that one is prevention.
