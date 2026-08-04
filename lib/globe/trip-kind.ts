/**
 * What KIND of journey was this? (R22 add-on, 2026-08-03)
 *
 * R6 part 1 removed the guard that refused a home as a trip's destination.
 * The reasoning was that a trip may end where you then lived — one-way
 * makes it a relocation, a round trip makes it a visit to a place that is
 * or became home, and `return_to_origin` carries the distinction, asserted
 * by the owner.
 *
 * Nothing ever said the word. Andy's October 1978 drive from the Mt. Snow
 * chalet to the SSV Day Lodge Room renders "Road trip" — and a one-way
 * road trip terminating at a primary residence reads as a data error
 * rather than as the move it was. The guard's removal is only legible if
 * the surfaces can name what it made possible.
 *
 * **On rule 20.** This READS a mutable classification — the destination
 * pin's type — which the rule warns about. The warning is about
 * CONSTRAINTS: a rule that consults an entity's current type to decide
 * whether a past event was legitimate freezes a judgement that the data
 * can outgrow. A LABEL is the opposite: it re-derives the instant the
 * classification changes, so retyping the pin retitles the trip and
 * nothing is trapped. Reading a mutable type to describe is fine; reading
 * it to forbid is not.
 *
 * Shared by the globe's pin card and the Travel Journal so the two cannot
 * disagree about what a journey was — one definition per vocabulary.
 */

import { isHomeType } from './anchor-options'
import { TRIP_SUBTYPE_LABELS, type TripSubtype } from './trip-types'

/** The minimum a trip must expose to be named. */
export interface TripKindFacts {
  subtype: TripSubtype
  return_to_origin: boolean
  /** The DESTINATION pin's type code. Null when unknown — never assumed. */
  destination_type_code?: string | null
}

export const RELOCATION_LABEL = 'Relocation'

/**
 * One-way, and it ended somewhere you lived. `isHomeType` is the standing
 * single definition of home-ness — primaries, second residences and
 * short-term stays alike, because home-ness is the TYPE, not the spine
 * slot (2026-07-18). Deliberately not re-tested here: a second home test
 * is how two surfaces start disagreeing.
 */
export function isRelocation(trip: TripKindFacts): boolean {
  return !trip.return_to_origin && isHomeType(trip.destination_type_code)
}

export function tripKindLabel(trip: TripKindFacts): string {
  return isRelocation(trip) ? RELOCATION_LABEL : TRIP_SUBTYPE_LABELS[trip.subtype]
}
