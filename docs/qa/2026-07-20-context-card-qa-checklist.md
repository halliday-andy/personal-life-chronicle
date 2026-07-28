# QA — pin detail-card context panel (2026-07-20)

*Remediation of Andy's Phase-1 finding (Lockbourne AFB card): clicking the
"N context" chip led with "＋ add context on the place page" while the actual
context note rendered below as dim, dead-looking text — an inverted hierarchy
— and the note's title showed raw markdown (`##The preamble to my journey.`).
Andy chose **navigate-with-strong-affordance**. Fix in `PinDetailCard.tsx`
(context block) + `lib/context/derive-title.ts` (title leak).*

## The title leak (proven)

- [x] `node scripts/verify-derive-context-title.mjs` → PASS (15/15, incl. the
  three new no-space-heading cases). Root cause: `deriveContextTitle` only
  treated `# …` (space after the hashes) as a heading; `##The …` fell through
  to the raw first line and never stripped the `#`s.

## Verify on the globe (Lockbourne AFB, or any pin with context)

- [x] Open the pin's detail card and tap the **"N context"** chip.
- [x] The context **note(s) are the primary content** — a list of rows, not
  buried under the add link.
- [x] The Lockbourne note title now reads **"The preamble to my journey."**
  (no leading `##`).
- [x] Each row **reads as clickable**: leading ember dot (or 🔒 if private),
  prominent title, trailing **↗**. Clicking a row **opens the place page**
  (`/entities/…`) — same destination as before, now obviously so.
- [ ] **"＋ Add New Context ↗"** is a small, secondary link at the
  **top-right** of the panel (mirrors "View all in Recollections →").
  *(Renamed from "＋ Add on place page ↗" by the pin-card reconciliation
  later the same day — this line was stale until 2026-07-26.)*
- [ ] A **private** context note shows the 🔒 and still opens the place page.

### Zero-state — the chip exists before the context does (fixed 2026-07-26)

*Andy's finding: the chip was gated on `context.length > 0`, so the "add"
affordance lived inside a disclosure that only appeared once context already
existed. Ten of his fourteen homes had no route to it.*

- [ ] Open a pin with **no context yet** (Dartmouth, Coronet Peak, My Mt.
      Snow Chalet — most of the spine) → a **"＋ context"** chip is present
      on both the detail card and the edit panel.
- [ ] Open it → a one-line "no background about this place yet" note and the
      **＋ Add New Context ↗** link; following it opens the place page with
      the composer already open.
- [ ] Add a note, return to the pin → the chip now reads **"1 context"** and
      lists the note, add demoted to the top-right corner as before.

## Regression spot-checks (same card)

- [ ] The **"N recollections"** chip still expands recollections in place
  (▸/▾, markdown) — unchanged.
- [ ] The **"N anchored"** chip still lists anchored pins and selects them on
  click — unchanged.
- [ ] The **✎ jot** hopper chip still opens — unchanged.
- [ ] Other context titles across the app (Journey context list, Entity View)
  are unaffected — the title change only strips a *leading* hash run; spaced
  headings and inline-markdown reduction are covered by the proof.
