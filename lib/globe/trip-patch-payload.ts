/**
 * Trip-PATCH payload assembly (R22, 2026-08-03).
 *
 * The framing panel can now change where a trip ENDED, not just where it
 * began. `retarget_trip` has existed and been proven since R6 part 2, but
 * nothing called it — so the capability was reachable only by an agent
 * running SQL, which is the gap R22 closes.
 *
 * Two decisions live here rather than in the panel's `save`, because both
 * are the kind of thing that is wrong silently:
 *
 *  1. **Is this a retarget at all?** Only when the chosen destination
 *     differs from the trip's current one. `retarget_trip` is itself
 *     idempotent (it returns early when the destination is unchanged), but
 *     "the RPC will cope" is not a reason for the client to ask for work it
 *     knows is unnecessary — and it keeps the API's error surface honest,
 *     since a no-op retarget can still fail on validation.
 *
 *  2. **A destination is never blank.** `trips.destination_relationship_id`
 *     is NOT NULL — unlike the origin, which has a real "Decide later".
 *     The two selectors look alike and that asymmetry is exactly what a
 *     copied-markup selector would lose.
 *
 * The `routed` guard is the create-pin-payload lesson (2026-07-18): add a
 * field to `TripFrameEdits` and this file fails to COMPILE until the field
 * is consciously routed — sent, transformed, or documented as client-only.
 */

import type { TripSubtype } from './trip-types'

/** Everything the framing panel can edit, as the panel holds it. */
export interface TripFrameEdits {
  /** '' means "Decide later" — a real state for an origin. */
  originId: string
  /** Never '' on save: the destination selector offers no empty option. */
  destinationId: string
  /** Keep the OLD destination as an outbound stop. Default on: the old
   *  destination is usually the story of the journey, not something to
   *  discard. Only meaningful when the destination actually changes. */
  demoteOldToStop: boolean
  title: string
  whenText: string
  yearHint: number | null
  subtype: TripSubtype
  returnToOrigin: boolean
}

export interface TripPatchPayload {
  originRelationshipId: string | null
  clearOrigin: boolean
  title: string | undefined
  whenText: string | undefined
  yearHint: number | null
  subtype: TripSubtype
  returnToOrigin: boolean
  /** Present ONLY when the destination changed — its presence is what
   *  tells the API to call `retarget_trip`. */
  destinationRelationshipId?: string
  demoteOldToStop?: boolean
}

export function buildTripPatchPayload(
  edits: TripFrameEdits,
  /** The trip's destination as it stands in the database right now. */
  currentDestinationId: string,
): TripPatchPayload {
  const nextDestination = edits.destinationId.trim()
  const retargeting = nextDestination !== '' && nextDestination !== currentDestinationId

  const routed = {
    originId: edits.originId,
    destinationId: edits.destinationId,
    demoteOldToStop: edits.demoteOldToStop,
    title: edits.title,
    whenText: edits.whenText,
    yearHint: edits.yearHint,
    subtype: edits.subtype,
    returnToOrigin: edits.returnToOrigin,
  } satisfies Record<keyof TripFrameEdits, unknown>

  const payload: TripPatchPayload = {
    // `frame_trip` COALESCEs a null origin to the existing one, so null
    // reads as "unchanged" — clearing is a separate, explicit flag.
    originRelationshipId: routed.originId || null,
    clearOrigin: false,
    // Empty strings mean "untouched" to frame_trip's NULLIF/COALESCE pair,
    // so blank fields are omitted rather than sent as ''.
    title: routed.title.trim() || undefined,
    whenText: routed.whenText.trim() || undefined,
    yearHint: routed.yearHint,
    subtype: routed.subtype,
    returnToOrigin: routed.returnToOrigin,
  }

  if (retargeting) {
    payload.destinationRelationshipId = nextDestination
    payload.demoteOldToStop = routed.demoteOldToStop
  }

  return payload
}
