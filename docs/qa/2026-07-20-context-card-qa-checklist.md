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
- [x] **"＋ Add New Context ↗"** is a small, secondary link at the
  **top-right** of the panel (mirrors "View all in Recollections →").
  *(Renamed from "＋ Add on place page ↗" by the pin-card reconciliation
  later the same day — this line was stale until 2026-07-26.)*
- [x] A **private** context note shows the 🔒 and still opens the place page.

### Zero-state — the chip exists before the context does (fixed 2026-07-26)

*Andy's finding: the chip was gated on `context.length > 0`, so the "add"
affordance lived inside a disclosure that only appeared once context already
existed. Ten of his fourteen homes had no route to it.*

- [x] Open a pin with **no context yet** (Dartmouth, Coronet Peak, My Mt.
      Snow Chalet — most of the spine) → a **"＋ context"** chip is present
      on both the detail card and the edit panel.
- [x] Open it → a one-line "no background about this place yet" note and the
      **＋ Add New Context ↗** link; following it opens the place page with
      the composer already open.
- [x] Add a note, return to the pin → the chip now reads **"1 context"** and
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

---

## Findings — Andy's live walk, 2026-07-30

Registered in
[`../plans/2026-07-30-phase1-remediation-plan.md`](../plans/2026-07-30-phase1-remediation-plan.md)
as **F10 (R8)** and **F11 (R9)**. Neither is fixed yet.

### F10 — Opening the context chip looks like nothing happened

Clicking the chip revealed the one-line note and "＋ Add New Context ↗"
**outside the visible area**; it read as a dead control until Andy scrolled.

Confirmed latent defect: the expanded card (`PinDetailCard.tsx:199`) has **no
`max-height` and no `overflow-y-auto`**, inside an `h-screen overflow-hidden`
container — bottom-anchored, growing upward, clipping with no way to scroll.

**Screenshot requested**: that geometry clips at the TOP and the globe page
should not scroll, which does not match "below the container… scroll the
window". Andy may have been on the place page after following the add link.

### F11 — Rich paste loses tables

Pasting Gemini research on Dartmouth co-education kept the prose but destroyed
a table. Reproduced against the real converter: the table collapses to a
vertical run of orphaned cell values.

Root cause: `turndown` has no `<table>` rule and `turndown-plugin-gfm` is not
installed — while `remark-gfm` IS active in `components/Markdown.tsx:32`. **The
app can render a markdown table it cannot produce.** Rich paste is correctly
wired here (`EntityView.tsx:547`); the loss is purely in conversion.

