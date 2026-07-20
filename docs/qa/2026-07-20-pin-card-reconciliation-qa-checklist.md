# QA — pin-card reconciliation (detail ↔ edit) (2026-07-20)

*From the 2026-07-20 brainstorm with Andy (Approach A). The detail card's
connections UI (recollections / context / related pins) was extracted into a
shared `PinConnections` component that BOTH the detail card and the edit panel
mount, so the two surfaces stop drifting. Plus: rename "anchored" → "related
pin(s)", and "＋ Add New Context ↗" deep-linking to the place page with the
composer pre-opened. Design:
`docs/plans/2026-07-20-pin-card-reconciliation-design.md`.*

**Verified before check-off:** `tsc` clean, `next lint` clean. The visual is
this checklist (Claude can't reach the authed app). Nothing pure-logic here —
`PinConnections` is presentational.

## Detail card (read view) — should be UNCHANGED except the rename

- [ ] Open a pin with recollections/context/related pins. The count-chip row
  looks and behaves as before: single-open (tapping one closes another), the
  jot chip always present.
- [ ] The old **"N anchored"** chip now reads **"N related pin"** (one) /
  **"N related pins"** (many).
- [ ] The **context** chip still leads with the notes (2026-07-20 fix intact):
  note title first (no `##`), leading dot/🔒, trailing ↗; the add link is
  top-right and now says **"＋ Add New Context ↗"**.
- [ ] Recollections chip still expands in place (▸/▾, markdown); related-pins
  chip still selects + flies to the pin.
- [ ] Navigate prev/next along the spine — the open chip **resets** (fresh
  card), same as before.

## Add New Context deep-link

- [ ] On a pin card, open the **context** chip → click **"＋ Add New
  Context ↗"**. You land on the place's entity page with the **Add-context
  composer already open** and scrolled into view (no second click needed).
- [ ] Only the **context** composer opens — the person-recollection form (on
  person pages) does not.
- [ ] A normal visit to an entity page (no `?addContext`) opens with the
  composer **closed**, as before.

## Edit panel — now the workbench (the new bit)

- [ ] Open a pin → **Edit**. Below the photos/jots you now see the **same
  connections chips**: recollections, context, related pins (whichever exist).
- [ ] The context chip there shows your notes + **"＋ Add New Context ↗"**;
  the recollections chip lists + expands; **"N related pins"** lists them.
- [ ] Clicking a **related pin** from the edit panel **exits edit mode** and
  opens that pin's detail card, flying to it.
- [ ] The full **jots hopper** (add / check off / delete) is still present and
  working — there is **no second/duplicate hopper**.
- [ ] By the recollection editor, the old "research? → add context ↗" link is
  now a non-clickable hint (**"research goes in Context ↓"**) — no competing
  add-context CTA.
- [ ] An edit panel for a pin with **no** connections yet shows no empty
  connections block (just the hint).

## Drift check (the point of Approach A)

- [ ] The recollections / context / related-pins lists look **identical** on
  the detail card and the edit panel (same component) — confirm one obvious
  case (e.g. the context note title renders the same in both).
