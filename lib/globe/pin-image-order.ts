/**
 * pin-image-order — the pure ordering rules for a pin's photo gallery/carousel.
 *
 * The gallery is: the PRIMARY photo first (the globe/detail-card cover), then
 * "the carousel" — the non-primary photos in owner-chosen order. Order is
 * stored in entity_media.sort_order (added 2026-07-20); before that the gallery
 * sorted by created_at DESC, which made new photos jump to the front and
 * sequential adds come out reversed (Andy's UI-checklist §5 finding).
 *
 * Model (agreed with Andy): primary is decoupled from the sequence — it's a
 * flag, not position 0. New photos append at the end; promoting a photo makes
 * it the cover and drops the former primary to the end of the carousel.
 *
 * Pure — no I/O, no React. Proof: scripts/verify-pin-image-order.mjs.
 * Design: docs/plans/2026-07-20-pin-photo-ordering-design.md.
 */

export interface OrderableRow {
  media_id: string
  is_primary: boolean
  sort_order: number | null
  created_at: string
}

/**
 * Gallery comparator: primary first; then by sort_order ascending with NULLS
 * LAST (un-positioned legacy photos sort after positioned ones); created_at
 * ascending as the final tiebreak (oldest first).
 */
export function compareGalleryRows(a: OrderableRow, b: OrderableRow): number {
  if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
  if (a.sort_order !== b.sort_order) {
    if (a.sort_order === null) return 1
    if (b.sort_order === null) return -1
    return a.sort_order - b.sort_order
  }
  return a.created_at.localeCompare(b.created_at)
}

/** A stable-sorted copy of the gallery in display order. */
export function sortGallery<T extends OrderableRow>(rows: readonly T[]): T[] {
  return [...rows].sort(compareGalleryRows)
}

/**
 * The sort_order for a photo appended to the end of the carousel: one past the
 * highest existing sort_order, or 0 when there is none (empty or all-null).
 */
export function nextSortOrder(rows: readonly { sort_order: number | null }[]): number {
  let max = -1
  for (const r of rows) {
    if (typeof r.sort_order === 'number' && r.sort_order > max) max = r.sort_order
  }
  return max + 1
}

/**
 * Map an owner-provided ordering of media ids to their new sort_order values
 * (0..N-1, dense). Used by the drag-to-reorder persist path.
 */
export function applyReorder(orderedIds: readonly string[]): { media_id: string; sort_order: number }[] {
  return orderedIds.map((media_id, i) => ({ media_id, sort_order: i }))
}
