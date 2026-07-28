/**
 * stop-order — the owner's ordering of the places at a stop.
 *
 * A primary residence is an era, and the pins anchored to it (short-term
 * stays, second residences, vacations, workplaces, logs) are what happened
 * inside it. Journey sorted them by type code then capture time, which reads
 * as arbitrary next to a life that actually ran in a sequence.
 *
 * We do NOT sort chronologically, and this is deliberate rather than a
 * shortfall: `when_text` is free prose ("Summers 1970 and 1971", "1976-1977
 * Winter Season"), and invariant #5 keeps structured dates out of the capture
 * path so the user is never made to phrase time to suit a parser. So the order
 * is the OWNER'S ASSERTION — dragged once, stored, never computed. Same model
 * as the pin photo carousel (lib/globe/pin-image-order.ts, 2026-07-20).
 *
 * Pure — no I/O, no React. Proof: scripts/verify-stop-order.mjs.
 */

export interface StopPlace {
  relationship_id: string
  type_code: string | null
  created_at: string
  anchor_sort_order: number | null
}

/**
 * The legacy order, kept as the fallback for places the owner has never
 * arranged: type code alphabetically, then capture time. Preserving it matters
 * — it means an existing chronicle looks EXACTLY the same until the first drag.
 */
export function byTypeThenCreated(a: StopPlace, b: StopPlace): number {
  const t = (a.type_code ?? '').localeCompare(b.type_code ?? '')
  if (t !== 0) return t
  return a.created_at < b.created_at ? -1 : 1
}

/**
 * Order a stop's places: those the owner has positioned lead, in their
 * asserted order; everything else trails in the legacy order. A place added
 * after an ordering exists therefore appears at the END rather than silently
 * inserting itself into a sequence the owner arranged.
 */
export function orderStopPlaces<T extends StopPlace>(places: readonly T[]): T[] {
  const positioned = places.filter((p) => p.anchor_sort_order !== null)
  const unpositioned = places.filter((p) => p.anchor_sort_order === null)
  positioned.sort((a, b) => (a.anchor_sort_order as number) - (b.anchor_sort_order as number))
  unpositioned.sort(byTypeThenCreated)
  return [...positioned, ...unpositioned]
}

/**
 * Move one place to `toIndex`, returning the new id sequence. Out-of-range
 * indices clamp; an id that isn't in the list leaves it untouched. The set is
 * always preserved — a drag must never lose something the owner put in their
 * chronicle.
 */
export function moveStopPlace(ids: readonly string[], movedId: string, toIndex: number): string[] {
  const from = ids.indexOf(movedId)
  if (from < 0) return [...ids]
  const next = [...ids]
  next.splice(from, 1)
  const clamped = Math.max(0, Math.min(toIndex, next.length))
  next.splice(clamped, 0, movedId)
  return next
}

export interface AnchoredRow extends StopPlace {
  anchor_residence_id: string | null
}

/**
 * Flatten a pin's anchored SUBTREE into the order it should read in on the
 * globe card — which shows one flat list where Journey shows a nested rail.
 *
 * Nesting still carries meaning even when it isn't drawn: a Log on a workplace
 * belongs beside that workplace, not adrift among the stop's other places. So
 * the direct places lead in the owner's order, and each is immediately
 * followed by its own descendants, depth-first.
 *
 * Nothing is ever dropped: a row whose parent is absent from the payload, or
 * caught in an anchor cycle, still renders (trailing) rather than vanishing.
 */
export function orderAnchoredSubtree<T extends AnchoredRow>(rows: readonly T[], hostId: string): T[] {
  const childrenOf = new Map<string, T[]>()
  for (const r of rows) {
    const key = r.anchor_residence_id ?? ''
    const list = childrenOf.get(key) ?? []
    list.push(r)
    childrenOf.set(key, list)
  }

  const out: T[] = []
  const seen = new Set<string>()
  const walk = (parentId: string) => {
    for (const child of orderStopPlaces(childrenOf.get(parentId) ?? [])) {
      if (seen.has(child.relationship_id)) continue // cycle guard
      seen.add(child.relationship_id)
      out.push(child)
      walk(child.relationship_id)
    }
  }
  walk(hostId)

  // Anything unreachable from the host — an orphan, or a cycle island — still
  // belongs to the owner and must be shown.
  for (const r of rows) if (!seen.has(r.relationship_id)) out.push(r)
  return out
}

/**
 * Explicit positions for a whole sibling list. The entire stop is written
 * on the first drag, so an ordered stop never carries a half-positioned
 * mix — otherwise an untouched place would keep jumping the queue by falling
 * into the unpositioned tail with a different sort.
 */
export function assignStopPositions(
  ids: readonly string[],
): { relationship_id: string; anchor_sort_order: number }[] {
  return ids.map((relationship_id, i) => ({ relationship_id, anchor_sort_order: i }))
}
