# Design — pin photo ordering (carousel foundation)

**Date:** 2026-07-20
**Author:** Claude Code (Opus 4.8), from a brainstorm with Andy the same day.
**Status:** Agreed with Andy 2026-07-20 — all decisions locked. Building.

---

## Problem

The pin photo gallery has **no stored order**. `findPinImageRows`
([lib/globe/pin-image.ts:70](../../lib/globe/pin-image.ts)) sorts *primary
first, then `created_at` descending* (newest first). So a newly added photo
sorts to the front (right after the primary), sequential one-at-a-time adds
come out reversed, and nothing is reorderable because order is derived from
upload time, not stored (Andy's QA finding on the 2026-06-15 UI checklist §5).

## Model (agreed with Andy)

- **`entity_media.sort_order`** (new, nullable integer) = the carousel
  sequence.
- **Gallery order:** primary first (the **cover**, badged), then the non-primary
  photos — **the carousel** — by `sort_order` ascending (NULLS LAST, with
  `created_at` as the final tiebreak).
- **New photos append to the end** of the carousel (next `sort_order`).
- **Drag** reorders the carousel.
- **Promote any photo → primary** (the globe/detail cover). The **former
  primary drops to the END** of the carousel (next `sort_order`), draggable
  from there. The primary is **decoupled** from the sequence — it's a flag, not
  position 0.
- **No backfill.** Existing photos keep NULL `sort_order` (they sort after
  positioned ones); Andy will delete/reinstall the few pins that already have
  more than two photos.
- **Carousel/slideshow playback = deferred.** This unit makes the sequence real
  and editable; the carousel is a later consumer of `sort_order`.

## Slices

1. **Migration** — `entity_media.sort_order` (additive/nullable → no
   migration-safety gate; shown + verified regardless).
2. **Pure ordering** — `lib/globe/pin-image-order.ts`: the gallery comparator
   (`is_primary` desc, `sort_order` asc nulls-last, `created_at` asc),
   `nextSortOrder(rows)`, `applyReorder(orderedIds)` → `sort_order` 0..N-1.
   Proof `scripts/verify-pin-image-order.mjs`, incl. a
   promote-sends-former-primary-to-end scenario.
3. **Backend** — `pin-image.ts`: `findPinImageRows` sorts via the pure
   comparator; `addPinImage` assigns `nextSortOrder`; `setPrimaryPinImage`
   bumps the former primary to the end; new `reorderPinImages(orderedIds)`.
   New `PATCH` verb on the image route persists a reorder. One-primary
   invariant + storage rollback preserved.
4. **Frontend** — drag-to-reorder the carousel in the edit-panel gallery
   (primary stays the badged cover, first); new photos land visibly at the end.
   Reduced-motion safe; pointer + touch.
5. **QA** — `docs/qa/2026-07-20-photo-ordering-qa-checklist.md`.

## Verification

- Pure-ordering proof (the sort, append, reorder, and promote-to-end logic).
- `tsc` + `next lint` green. Unlike the earlier auth-blocked UI work, **Andy
  can exercise this one live** (add photos, drag, promote) — the QA checklist
  is the acceptance.

## Out of scope (named)

- The carousel/slideshow presentation itself (the "eventually").
- Multi-file selection/upload in one pick (the uploader stays one-at-a-time;
  append-in-order already gives the intended progression).
- Backfilling existing photos' `sort_order`.
