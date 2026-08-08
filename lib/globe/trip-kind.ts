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

/**
 * How the relocation reading is worded, in one place so two surfaces cannot
 * word it differently and imply two different facts.
 *
 * Phrased as a READING, not as a label. It is the chronicle's inference
 * from `return_to_origin` and the destination's type — not something the
 * owner asserted — and the app's existing idiom for that distinction is
 * "the chronicle's reading · not yours to edit", against "● yours" for what
 * the owner set.
 */
export const RELOCATION_READING = 'reads as a relocation'

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

export interface TripKind {
  /** The OWNER's choice of what kind of journey this was. Always shown. */
  label: string
  /** The chronicle's reading. Shown ALONGSIDE the label, never instead. */
  relocation: boolean
}

/**
 * The two things a trip's kind consists of — deliberately returned
 * together, because they were briefly collapsed into one and the collapse
 * silently ate the owner's answer.
 *
 * `tripKindLabel` used to return "Relocation" INSTEAD of the subtype. Andy
 * changed the Fiat 128 to Professional travel to test the new kind selector
 * and neither surface would show it: the write had worked, the label had
 * eaten it. His example for why it matters — assembling a chronology of the
 * major road trips of his life, that trip belongs in it, and it had stopped
 * saying so.
 *
 * The two are ORTHOGONAL AXES. "Road trip" describes the character of the
 * journey; "relocation" describes what it accomplished. A relocation can be
 * driven, or flown for a job, or neither, and a road trip stays a road trip
 * whether or not you came home. One label cannot hold both, and whichever
 * one wins, the other is destroyed.
 *
 * Which is also why relocation is NOT a subtype option, though the dropdown
 * would happily hold one: it would force a false choice between two true
 * things, duplicate a fact derivable from `return_to_origin` and the
 * destination's type (rule 24), and freeze a reading that should re-derive
 * the moment either input changes (rule 22).
 */
export function tripKind(trip: TripKindFacts): TripKind {
  return {
    label: TRIP_SUBTYPE_LABELS[trip.subtype],
    relocation: isRelocation(trip),
  }
}
