/**
 * Mention→pin resolution (Slice 7.1).
 *
 * The Entity View lists recollections that mention an entity as OUT-links.
 * A mention that lives on a globe pin should open on its pin (the Journey
 * `?pin=` handoff, J4); everything else falls back to the /memories row
 * anchor. "Lives on a pin" means: the memory carries a role='location' link
 * to a place entity that IS a globe pin's place. role='location' is the
 * load-bearing discriminator (mention-links never use it — 2026-07-07
 * incident), so a location link is authoritative here.
 *
 * Pure function so the mapping is provable without a page render.
 */

import { PIN_TYPES } from '@/lib/globe/pin-types'

export const PIN_TYPE_CODES: ReadonlySet<string> = new Set(PIN_TYPES.map((t) => t.code))

export interface LocationLinkRow {
  memory_id: string
  entity_id: string
}

export interface PinRelationshipRow {
  /** relationships.id — the ?pin= deep-link key on /journey and /globe. */
  relationship_id: string
  /** relationships.object_id — the pin's place entity. */
  place_entity_id: string
}

/**
 * Maps each memory to the globe pin it lives on, via its role='location'
 * entity link. Memories with no location link, or whose located place has
 * no pin, are absent from the result. First pin wins if a place somehow
 * carries several (pin adoption keeps places single-pinned in practice).
 */
export function mapMentionsToPins(
  locationLinks: LocationLinkRow[],
  pins: PinRelationshipRow[],
): Map<string, string> {
  const pinByPlace = new Map<string, string>()
  for (const p of pins) {
    if (!pinByPlace.has(p.place_entity_id)) pinByPlace.set(p.place_entity_id, p.relationship_id)
  }
  const pinByMemory = new Map<string, string>()
  for (const l of locationLinks) {
    if (pinByMemory.has(l.memory_id)) continue
    const rel = pinByPlace.get(l.entity_id)
    if (rel) pinByMemory.set(l.memory_id, rel)
  }
  return pinByMemory
}
