# QA Walkthrough — Hopper 5a (the memory-stub notepad)

App: **http://localhost:3001/globe** (sign in first).

> Hopper 5a is the pin-host notepad pulled forward from Slice 7: jot the
> memories a pin brings to mind faster than you can write them up; check them
> off once they've become recollections. Data layer proven by
> `verify-memory-stubs.mjs` (7/7, incl. the merge-repoint invariant); this is
> the human proof. The capture-assistant loop that *consumes* a stub into an
> interview is Hopper 5b (Slice 7) — checking off is manual for now.

> **[taste]** marks subjective calls — say the word and I'll tune.

## 1. Jot from the detail card (the placement-flow case)
- [ ] Click any pin → the count-chip row now always shows a **✎ jot** chip
      (even on a pin with no recollections/context). **[taste]** the chip label
      ("jot" vs alternatives) and its always-present-ness.
- [ ] Tap it → a **"Jot a memory to come back to…"** input appears. Type a
      fragment (e.g. "the ice-cream truck summer") → **Enter** (or Jot) → it
      appears in the list instantly; the chip now reads **✎ 1 to write**.
- [ ] Add two or three more in quick succession — the input stays focused so
      you can jot at thinking speed.
- [ ] Switch to another pin and back → the jots persist; the chip count is
      right on arrival (no flicker to "jot").

## 2. The full hopper on the edit panel
- [ ] Open the same pin → **Edit** → below the photo gallery there's a
      **"Memories to write — jot now, recollect later"** section listing the
      open jots with checkboxes. **[taste]** the section label.
- [ ] **Check one off** → it moves into a collapsed **"N written"** group
      (strikethrough, ✓).
- [ ] Expand "N written" → **↩ reopen** puts it back on the open list;
      **✕** removes it permanently.
- [ ] Hover an open jot → **✕** appears; removing it deletes without ceremony
      (it's a to-do, not an audit trail).

## 3. Cross-surface consistency
- [ ] Check a jot off on the edit panel → close the panel → the detail-card
      chip count dropped to match.
- [ ] A pin with zero open jots shows the invitational empty line ("Nothing
      waiting — jot the memories this place brings to mind…"), not a bare box.

## 4. Not in the way
- [ ] The Journey/globe reading surfaces are unaffected — the hopper appears
      ONLY on the pin detail card (behind its chip) and the edit panel
      (per the brief: compact sequence surfaces stay clean).
- [ ] The chip row doesn't push the card over its own pin awkwardly on a pin
      with all four chips. **[taste]** density.

## Known scope (not bugs)
- Checking off is **manual** — the assistant-driven "expand this stub into an
  interview" loop is Hopper 5b (Slice 7, with the person-entity host).
- Stubs are host-entity-scoped: a jot lives on the *place*, so it also
  surfaces on that place's future person/entity views only via the entity.
- No stub appears in /memories, /review, or the Raw Vault — by design.
