# QA — pin photo ordering / carousel foundation (2026-07-20)

*From Andy's finding on the 2026-06-15 UI checklist §5 (Photos gallery): new
photos landed at the front and sequential adds came out reversed, with no way
to reorder. Now the gallery has a stored `sort_order`; the edit-panel gallery
is drag-reorderable. Design:
`docs/plans/2026-07-20-pin-photo-ordering-design.md`.*

**Verified before check-off:** pure ordering proof
`verify-pin-image-order.mjs` 8/8; `tsc` + `next lint` clean. Unlike the recent
auth-blocked UI work, **this one you can exercise live** — this checklist is the
acceptance.

## Add order (the original bug)

- [ ] On a pin, add photos one at a time (say A, then B, then C). They land in
  that order — **A, B, C appended at the END** — not reversed, not jammed in
  after the primary.
- [ ] The **first-ever** photo becomes the primary (cover) automatically.

## Drag to reorder (edit panel)

- [ ] With ≥2 non-primary photos, the header shows **"· drag to reorder"** and
  the carousel photos show a move cursor.
- [ ] Drag a carousel photo onto another slot — the order updates immediately
  and **survives a reload** (persisted).
- [ ] The **primary** (cover, ★ badge) is **not draggable** and stays first;
  you can't drop a photo ahead of it.

## Primary ↔ carousel (the decoupling)

- [ ] Promote a carousel photo (**★ primary** on hover) → it becomes the cover
  (globe/detail photo updates), and the **former primary drops to the END** of
  the carousel, draggable from there.
- [ ] A photo can be promoted from anywhere in the carousel order.
- [ ] Adding a new photo after reordering still **appends at the end**.
- [ ] Remove the primary → the first carousel photo is promoted to cover.

## Notes / known limits

- [ ] Legacy photos added before today have a null `sort_order` and sort
  **after** positioned ones — expected; delete/reinstall the one pin with >2
  old photos to give them an order (Andy's call: no backfill).
- [ ] Reorder is **pointer/mouse drag** only — keyboard-accessible reorder
  (arrow controls) is a deferred a11y follow-up, noted in build-progress.
- [ ] The carousel/slideshow *presentation* itself is deferred (this unit makes
  the sequence real + editable; the carousel is its later consumer).
