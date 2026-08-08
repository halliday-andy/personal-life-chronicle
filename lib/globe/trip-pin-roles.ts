/**
 * What role does each pin play in the user's trips? (Andy, 2026-08-04)
 *
 * A trip's DESTINATION has worn a rose halo since U4. A STOP wore nothing,
 * so a place a journey passed through looked exactly like a pin with no
 * journey near it — which is how Andy came to ask whether "stop on a trip"
 * ought to be a pin TYPE.
 *
 * It ought not, and the reason is worth keeping:
 *
 *  - **A pin can be a stop on one trip and a destination on another.** One
 *    `type_code` field cannot hold that; a role SET can. Wendy's shared
 *    apartment was a destination this morning and is a stop this afternoon,
 *    and could be both tomorrow.
 *  - **`trip_stops` already stores it.** Encoding it in the type vocabulary
 *    duplicates a relation the schema holds one join away — rule 24 — and
 *    the copy would immediately start drifting from the original.
 *  - **Place = entity + dimension + relationship** (the three-layer
 *    location design). Trip membership is the relationship layer. The type
 *    vocabulary is a different shelf, and it has a standing "one definition
 *    per controlled vocabulary" guard on it.
 *
 * So the gap was never taxonomic — nothing DREW the relation. This derives
 * the roles from the trips themselves, which keeps one source of truth and
 * means a retarget re-styles both pins the instant it lands.
 *
 * ORIGINS DELIBERATELY GET NOTHING. They are homes; the glowing spine
 * already speaks for them, and F21 established that a busy home must not
 * shout about its departures.
 */

export interface TripRoleTrip {
  origin_relationship_id: string | null
  destination_relationship_id: string
  stops: { relationship_id: string }[]
  is_draft: boolean
}

export interface TripPinRole {
  isDestination: boolean
  /** A destination whose trip has no origin yet — the "trip to frame" call
   *  to action. Rides with the DESTINATION only: it is about the trip's
   *  missing origin, which a stop says nothing about. */
  isDraftDestination: boolean
  isStop: boolean
}

/**
 * Can this pin be deleted, as far as trips are concerned?
 *
 * `trips.destination_relationship_id` is **ON DELETE RESTRICT**, so the
 * database refuses to delete a pin that any trip ends at. That refusal is
 * translated into a readable sentence when it happens — but only AFTER the
 * user has accepted a confirm that says "can't be undone". Andy declined to
 * click it (2026-08-04), which was the right response to what it told him:
 * he was being asked to accept an irreversible-sounding risk in order to
 * discover a refusal.
 *
 * The card already holds the trips. So the obstacle can be named BEFORE the
 * ceremony instead of after it.
 *
 * Origins are `ON DELETE SET NULL` and stops are `ON DELETE CASCADE` —
 * neither blocks, so neither belongs here. Only the destination.
 */
export function isTripDestination(trips: TripRoleTrip[], relationshipId: string): boolean {
  return trips.some((t) => t.destination_relationship_id === relationshipId)
}

export function tripPinRoles(trips: TripRoleTrip[]): Map<string, TripPinRole> {
  const roles = new Map<string, TripPinRole>()
  const at = (id: string): TripPinRole => {
    let r = roles.get(id)
    if (!r) { r = { isDestination: false, isDraftDestination: false, isStop: false }; roles.set(id, r) }
    return r
  }

  for (const t of trips) {
    const dest = at(t.destination_relationship_id)
    dest.isDestination = true
    // OR, never assignment: a pin that is a framed trip's destination and
    // a draft's destination is still worth flagging as needing framing.
    dest.isDraftDestination = dest.isDraftDestination || t.is_draft
    for (const s of t.stops ?? []) at(s.relationship_id).isStop = true
  }

  return roles
}
