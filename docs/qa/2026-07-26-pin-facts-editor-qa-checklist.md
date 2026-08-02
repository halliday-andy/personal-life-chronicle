# QA — owner-editable pin facts (2026-07-26)

*Built 2026-07-26, completing the 2026-07-10 design
(`docs/plans/2026-07-10-pin-facts-editor-enhancement.md`). The data layer
shipped 2026-07-20; this is its UI. Part of master-sequence Phase 1
remediation.*

**What changed:** the four facts read from a home's recollection —
kind of place, why you moved, who lived there with you, the place itself
— are now editable on the pin's **Edit panel**, under **Facts**. A fact
you set is **sticky**: re-reading the recollection never overwrites it.
A **↻ Refresh from recollection** button re-runs the reading for the
facts you haven't touched.

**Not visually verified by Claude** — auth-blocked from the running app.
Everything below needs your eye.

## 1. It's there, and it reads right

- [x] Open a **primary residence** pin → **Edit** → below the
      recollection (above the photos) there's a **Facts** section headed
      "read from your recollection, yours to correct".
- [x] Two dropdowns — **Kind of place**, **Why you moved** — and two text
      fields — **The place itself**, **Who lived there with you**.
      `[taste]` the density against the rest of the panel.
- [x] Existing extracted values are **pre-filled** (try Lockbourne or
      Mt. Snow, which have real extracted facts).
- [x] The dropdown labels read as English ("Caring for family",
      "Military posting"), not as codes.
- [x] A pin whose facts were never extracted shows the section with
      everything on "— not set —" (it should NOT be missing).

## 2. Editing sticks

- [x] Change **Why you moved** → it saves immediately (no Save press) and
      a "● yours" mark appears next to that field's label.
- [x] Type in **Who lived there with you** → it saves when you click away
      (blur), and gets its own "● yours".
- [x] Hover "● yours" → the tooltip explains re-reading won't overwrite it.
- [x] Close the panel and reopen it → your values are still there.
- [ ] Check the **detail card** and the **Journey** chips → they show the
      value you set, not the old extracted one.
- [ ] **Clearing counts as setting:** empty a text field → the chip
      disappears, and the field stays marked yours.
- [ ] Click into a field and click away **without changing anything** →
      no "● yours" appears. (Looking at a fact must not claim it.)

## 3. The refresh button — the sticky invariant, live

*This is the heart of it: prove the chronicle can re-read your text
without stealing back a fact you corrected.*

- [ ] Edit **one** fact (say household) so it's marked yours; leave the
      others alone.
- [ ] Press **↻ Refresh from recollection** → "Re-reading your
      recollection…", then after a few seconds the facts reload with a
      note that anything you edited was left alone.
- [ ] **Your edited fact is unchanged.** The others may have been refilled
      from the text.
- [ ] Now edit the **recollection text** (e.g. fix a name), save, then
      refresh the facts → the untouched facts reflect the new wording.
- [ ] On a pin with **no recollection yet**, the refresh button is
      disabled and its tooltip says to add a recollection first.
- [ ] Press refresh twice in quick succession → no crash, no duplicate
      state; the button is disabled while it works.

## 4. Scoping

- [ ] A **workplace**, **vacation**, or **Log** pin shows **no** Facts
      section (residence facts read as nonsense there).
- [ ] A **Second residence** and a **Short-term stay** DO show it (they
      are places you lived).
- [ ] Re-type a primary → vacation → the section disappears; re-type back
      → it returns with the values intact.
- [ ] An **unplaced** ("Decide later") home shows the section normally —
      home-ness is the type, not the spine slot.

## 5. Regression spot-checks

- [ ] The panel's **Save** button still saves name/when/type/recollection
      as before, and doesn't disturb the facts you set.
- [ ] Photos, the hopper, and the related-pins/context chips below are
      unaffected.
- [ ] Saving a recollection still triggers the normal re-extraction, and
      still leaves your sticky facts alone.
- [ ] `node scripts/verify-sticky-facts.mjs` passes (26/26).

## Known gaps (deliberate, flag if they bite)

- **No un-stick.** Once a fact is yours there is no "let the chronicle
  manage this again" control. Say if you want one.
- **Chip wording differs from the editor.** The detail-card and Journey
  chips de-underscore the raw code ("family care") while the editor shows
  a curated label ("Caring for family"). One line to unify — Andy's call
  on which wording wins.
- **Refresh waits a fixed \~3.5s** for the async re-reading before
  re-checking. If extraction is slow you'll see "still working"; reopen
  the pin to see the result. No live progress.
