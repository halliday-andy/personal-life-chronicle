/**
 * Does selecting this pin reveal its trips without a click?
 *
 * The rule carries one deliberate exception, and the exception is the
 * reason this lives in its own file rather than inline:
 *
 *  - **Destination → yes** (R19/F23/F24, 2026-08-01). Landing on the place
 *    a trip went TO, the trip is the point of the pin, and there is usually
 *    exactly one.
 *  - **Stop → yes** (Andy, 2026-08-04). A stop is a place the journey
 *    passed THROUGH; the journey is still the point of the pin. This was
 *    the gap R22 opened: making destinations movable meant a pin could stop
 *    being a destination, and Wendy's shared apartment silently lost its
 *    auto-open — and with it the route painting the trips chip gates
 *    (R18/F21) — the moment the Fiat 128 trip was retargeted past it.
 *  - **Origin → no** (F21, the same 2026-08-01 walk). A home with many
 *    departures opened a stack of trips that buried the map. That is also
 *    why selection alone stopped painting routes: opening the chip is the
 *    "show me these" gesture, and closing it is the way out.
 *
 * Being an origin is not a VETO, only an absence of reason — a pin that is
 * both an origin and a stop still auto-opens.
 *
 * The tidy-looking simplification, "any trip touching this pin", is the F21
 * bug. It has cost a QA walk once already.
 */

export interface AutoOpenTrip {
  origin_relationship_id: string | null
  destination_relationship_id: string
  stops: { relationship_id: string }[]
}

export function tripAutoOpensFor(trips: AutoOpenTrip[], selectedId: string | null): boolean {
  if (!selectedId) return false
  return trips.some(
    (t) =>
      t.destination_relationship_id === selectedId ||
      (t.stops ?? []).some((s) => s.relationship_id === selectedId),
  )
}
