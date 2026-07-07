# QA Walkthrough — Pin adoption + alias editing (2026-07-07)

App: **http://localhost:3001** (sign in first).

> The two queued background tasks, built before session close. Proofs:
> `verify-globe-pin-adopt-entity.mjs` 12/12 (adoption semantics + guards);
> alias PATCH already covered by the entity route.

## 1. Alias editing (Entity View)
- [ ] Open **Leola Lapides** (/entities → Open ↗). The "also:" line is now
      **chips** — each with a small ×, plus a dashed **+ alias** button.
- [ ] **Remove the junk "Leo" alias** (the May substring false-positive that
      motivated this) → the chip disappears; reload → still gone.
- [ ] Add an alias (e.g. a nickname) → Enter → it appears; adding a
      duplicate in different case is silently ignored.
- [ ] "Leola Lapidus" (the typo alias) is YOUR call — it still usefully
      catches the misspelling in future captures; keep or remove.

## 2. Pin adoption (the duplicate-twin fix)
- [ ] On the globe, place a draft pin anywhere and type a name that exactly
      matches an existing **unpinned** entity (e.g. **"Yokota Air Base"**
      from your stub acceptances, or the leftover Phillips Exeter twin if
      you haven't merged it) → an amber strip appears under the name:
      *"This looks like your existing X · N recollections mention it — pin
      it instead of creating a duplicate?"* **[taste]** the strip wording.
- [ ] **Pin the existing** → a green confirmation replaces it (with undo).
      Save → the pin appears; open its card → the entity's already-linked
      recollections are there under the recollections chip; /entities shows
      NO new duplicate row.
- [ ] If you edited the pin name to something different before saving, the
      old name still matches — your typed name is folded in as an **alias**.
- [ ] **Create new** dismisses the offer (it doesn't re-nag for the same
      candidate); saving then mints a fresh entity exactly as before.
- [ ] A name matching an entity that ALREADY has a pin gets **no offer**
      (you can't double-pin).

## Notes
- Matching is exact (canonical name or alias, case-insensitive) — deliberate:
  no fuzzy false alarms at placement time; fuzzy resolution stays in the
  capture/review pipeline.
- Adopting an organization converts it to a place (physical location wins);
  its description, context notes, and memory links all ride along.
