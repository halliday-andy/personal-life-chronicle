/**
 * Which trip routes paint on the globe.
 *
 * The rule has accumulated four reasons over three QA walks, which is
 * exactly why it now lives in one proven place instead of inline:
 *
 *  - **The legend toggle** shows everything, deliberately off by default so
 *    the residential spine stays visually dominant (R10).
 *  - **Selection paints only with the trips CHIP open** (F21/R18). Selection
 *    alone used to paint, had no off-switch, and a home with many departures
 *    buried the map. Opening the chip is the "show me these" gesture.
 *  - **Hover peeks**, independent of the chip, and dismisses itself (F19 —
 *    peeking should reveal everything attached to a pin, not a subset).
 *  - **The trip being route-built always paints**, so the route grows under
 *    the user's clicks.
 *
 * And now a fifth, which is the one that had been missing:
 *
 *  - **A FOCUSED trip paints because it is why we are here.** "Show on
 *    globe →" from a Travel Journal card is a request for one trip, and it
 *    used to arrive showing nothing of it (Andy, 2026-08-04). Nothing was
 *    wrong when written — `?trip=` relied on "selection reveals the trip
 *    strip and its complete route", and that was true. Then F21/R18 put
 *    routes behind the chip, and J4 made deep links arrive on the COMPACT
 *    card, which never mounts the chip row at all. Two correct changes,
 *    each removing one leg of a third feature's premise, with nothing
 *    connecting them but a comment.
 *
 * CLASS OF BUG: a feature whose premise is another feature's behaviour,
 * recorded only in prose. `focusedTripId` states the intent directly rather
 * than hoping a chain of disclosures still ends where it used to.
 */

export interface RouteVisibilityTrip {
  trip_id: string
  origin_relationship_id: string | null
  destination_relationship_id: string
  stops: { relationship_id: string }[]
}

export interface RouteVisibilityState {
  /** Legend: "Trip routes" — show every framed trip. */
  tripsVisible: boolean
  selectedId: string | null
  /** Is the selected pin's trips chip open? Selection alone is not enough. */
  tripsPanelOpen: boolean
  hoverPreview: string | null
  routeEditTripId: string | null
  /** Arrived by `?trip=` — this trip is the reason the globe is open. */
  focusedTripId: string | null
}

export function tripRouteVisible(trip: RouteVisibilityTrip, s: RouteVisibilityState): boolean {
  if (s.tripsVisible) return true
  if (trip.trip_id === s.routeEditTripId) return true
  if (trip.trip_id === s.focusedTripId) return true

  // Selection needs the chip; hover does not.
  const peeked = (id: string | null) =>
    id !== null && ((id === s.selectedId && s.tripsPanelOpen) || id === s.hoverPreview)

  return (
    peeked(trip.destination_relationship_id) ||
    peeked(trip.origin_relationship_id) ||
    (trip.stops ?? []).some((st) => peeked(st.relationship_id))
  )
}
