/**
 * recollection-order — ordering cited recollections by the residential spine.
 *
 * "Recollections that mention this place" was sorted by capture time, newest
 * first, which read as a jumble on a surface meant for reading (Andy's QA,
 * 2026-07-26: Summer 1972 → 1976-77 → Summers 1970/71).
 *
 * We do NOT sort by date. `occurred_at_fuzzy` and `when_text` are free prose
 * ("sophomore year at Dartmouth", "Summers 1970 and 1971"), and invariant #5
 * exists to keep the user from having to phrase time for a parser's benefit.
 * Best-effort parsing would be worse than the jumble — it would misplace the
 * fuzzy ones while looking authoritative.
 *
 * Instead we use the scaffold invariant #5 already provides: the residential
 * spine IS the primary temporal structure. Every recollection has a home pin;
 * every home pin resolves to a spine stop, and a marker also carries a
 * position inside that stop (anchor_sort_order — the owner's drag
 * order, lib/journey/stop-order.ts). So the ordering is entirely derived
 * from sequence the OWNER asserted, with nothing inferred.
 *
 * KNOWN LIMIT (a decision, not a defect — see the proof): a recollection filed
 * on one pin but about an earlier time sorts at its host pin's position. No
 * structural signal knows its content predates where it lives. That residual
 * is the concrete case for the Temporal Agent conversation.
 *
 * Pure — no I/O, no React. Proof: scripts/verify-recollection-order.mjs.
 */

export interface SpinePin {
  relationship_id: string
  /** Spine slot. Non-null only for sequenced primary residences. */
  sort_order: number | null
  anchor_residence_id: string | null
  /** The owner's position for this pin among its anchor siblings. */
  anchor_sort_order: number | null
}

/** Where a pin sits in the scaffold: which stop, and where among that stop's places. */
export interface SpineCoordinate {
  stop: number
  /** null for the stop itself; the position among that stop's places, for a marker beneath it. */
  within: number | null
}

/**
 * Resolve a pin to its spine coordinate by walking up its anchor chain to a
 * sequenced primary. A marker several levels deep (a Log on a workplace)
 * inherits the position of the TOPMOST marker in its chain, so
 * grandchildren stay grouped with the parent they hang from.
 *
 * Returns null when the chain reaches an unanchored pin, an unplaced home, or
 * a cycle. Anchor cycles are a theoretically repairable state, never a reason
 * to hang (same guard as buildJourneyTree).
 */
export function spineCoordinate(
  pins: ReadonlyMap<string, SpinePin>,
  pinId: string,
): SpineCoordinate | null {
  let current = pins.get(pinId)
  if (!current) return null
  if (current.sort_order !== null) return { stop: current.sort_order, within: null }

  const seen = new Set<string>([pinId])
  // The position belongs to the highest marker in the chain — the one
  // anchored directly to the stop — so a Log follows its workplace.
  let topMarker = current
  while (current.anchor_residence_id) {
    if (seen.has(current.anchor_residence_id)) return null
    seen.add(current.anchor_residence_id)
    const parent = pins.get(current.anchor_residence_id)
    if (!parent) return null
    if (parent.sort_order !== null) {
      return { stop: parent.sort_order, within: topMarker.anchor_sort_order }
    }
    topMarker = parent
    current = parent
  }
  return null
}

export interface OrderableRecollection {
  id: string
  /** The pin this recollection lives on; null when native to the host stop. */
  home_pin_id: string | null
  created_at: string
}

/**
 * Order cited recollections along the spine. Resolvable ones lead — by stop,
 * then by position among that stop's places (the stop's own recollections
 * leading), then oldest-first so a stop reads in the order it was told. Anything
 * unresolvable trails rather than vanishing or jumping the queue.
 */
export function orderRecollectionsBySpine<T extends OrderableRecollection>(
  recollections: readonly T[],
  pins: ReadonlyMap<string, SpinePin>,
  hostCoordinate: SpineCoordinate,
): T[] {
  // `within: null` sorts ahead of any numbered position, so a stop's own
  // recollections lead, before the markers anchored to it.
  const WITHIN_FIRST = -1
  const key = (r: T): SpineCoordinate | null =>
    r.home_pin_id === null ? hostCoordinate : spineCoordinate(pins, r.home_pin_id)

  const resolved: { r: T; k: SpineCoordinate }[] = []
  const unresolved: T[] = []
  for (const r of recollections) {
    const k = key(r)
    if (k) resolved.push({ r, k })
    else unresolved.push(r)
  }

  resolved.sort((a, b) => {
    if (a.k.stop !== b.k.stop) return a.k.stop - b.k.stop
    const aw = a.k.within ?? WITHIN_FIRST
    const bw = b.k.within ?? WITHIN_FIRST
    if (aw !== bw) return aw - bw
    return a.r.created_at < b.r.created_at ? -1 : a.r.created_at > b.r.created_at ? 1 : 0
  })
  unresolved.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))

  return [...resolved.map((x) => x.r), ...unresolved]
}
