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

- [ ] Open the pin's detail card and tap the **"N context"** chip.
- [ ] The context **note(s) are the primary content** — a list of rows, not
  buried under the add link.
- [ ] The Lockbourne note title now reads **"The preamble to my journey."**
  (no leading `##`).
- [ ] Each row **reads as clickable**: leading ember dot (or 🔒 if private),
  prominent title, trailing **↗**. Clicking a row **opens the place page**
  (`/entities/…`) — same destination as before, now obviously so.
- [ ] **"＋ Add on place page ↗"** is now a small, secondary link at the
  **top-right** of the panel (mirrors "View all in Recollections →").
- [ ] A **private** context note shows the 🔒 and still opens the place page.

## Regression spot-checks (same card)

- [ ] The **"N recollections"** chip still expands recollections in place
  (▸/▾, markdown) — unchanged.
- [ ] The **"N anchored"** chip still lists anchored pins and selects them on
  click — unchanged.
- [ ] The **✎ jot** hopper chip still opens — unchanged.
- [ ] Other context titles across the app (Journey context list, Entity View)
  are unaffected — the title change only strips a *leading* hash run; spaced
  headings and inline-markdown reduction are covered by the proof.
