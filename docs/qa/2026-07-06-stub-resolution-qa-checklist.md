# QA Walkthrough — Globe stub resolution (2026-07-06)

App: **http://localhost:3001/review** (sign in first).

> Your QA finding: 19 pin recollections, 0 person links — 30+ names stranded
> in extraction metadata. The sweep has now run: **11 exact-name matches were
> linked directly** (e.g. Dartmouth, RAF Mildenhall, Trans Hotel, Stanton
> School) and **57 proposals** await you on /review as lime **"New mention"**
> cards. Every future pin save resolves automatically. Proof:
> `verify-globe-stub-resolution.mjs` 9/9.

## 1. The proposal card
- [x] /review shows lime **"New mention"** cards: "*Rick Toll* is mentioned in
      your recollection at *Year 2 at Mt. Snow* — add them as a person?" with
      an excerpt of the recollection. **[taste]** the card wording.
- [x] **Add as person** on a clean proper name (e.g. Mike Paplow) → the card
      resolves; the person appears in /entities (People) and as a chip on that
      pin's recollection in /memories.
- [ ] Edit the **name field first** on a relational reference (e.g. "my
      father" → his real name) → Add → the entity is created with your name,
      and the stub phrasing ("my father") is kept as an **alias** so future
      mentions still resolve. *(FAILED in Andy's QA 2026-07-10 via the
      Link-to-existing path — the fold only existed on Add, and Add
      clobbered rather than merged. Both paths now fold via `appendAlias`;
      Andy's manual "my father" alias on Bill Halliday already covers the
      live case. Re-testable when the next relational stub arrives — the
      extractors now emit primary relations ("my father/mother/wife…")
      verbatim, so they will.)*
- [x] The **type selector** next to the name defaults to the nomination but
      is yours to correct: on *Tachikawa Air Base* (proposed organization),
      switch to **place** → "Add as place" → it lands under Places in
      /entities. All seven types are offered.
- [x] **Dismiss** something you don't want in the graph (e.g. "SAC" or
      "Green Hotel") → it leaves the queue and will NOT be re-proposed.

## 2. Suggested matches (fuzzy)
- [ ] The "Mount Snow" proposal carries a blue strip: *Looks like your
      existing Mount Snow, Vermont?* → **Same — link them** links without
      creating anything.
- [ ] A wrong suggestion (e.g. "Air Force" → Lockbourne) can be ignored —
      Dismiss or Add work independently of the suggestion.

## 3. Link to existing…
- [ ] On any proposal, **Link to existing…** opens a typeahead over all your
      entities; picking one links the recollection to it and resolves the card.
      (Useful for "Rick Tole" — the Mount Snow pin's spelling of Rick Toll:
      accept ONE spelling as the entity, then Link the other proposal to it.)

## 4. The pipeline going forward
- [ ] Edit any pin recollection to mention a NEW person → Save → within ~30s
      (Inngest) a fresh "New mention" proposal appears on /review; names
      already settled do NOT reappear.

## Notes / known scope
- Entity creation happens ONLY via your Accept — the sweep never mints
  entities (propose-and-confirm).
- Exact canonical/alias matches link without asking (a confirmed identity);
  everything else proposes.
- Duplicate spellings across pins (Rick Toll / Rick Tole) arrive as separate
  proposals — resolve via §3, and the alias system prevents recurrence.
- Re-running `scripts/sweep-globe-stub-resolution.mjs` is safe/idempotent.
