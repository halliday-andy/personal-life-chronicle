/**
 * One trip (plan U2).
 *
 *   PATCH  /api/trips/[tripId] — frame or refine: origin (or clear it),
 *     DESTINATION, title, free-text timeframe, year hint, subtype,
 *     return-to-origin. All fields optional; omitted fields are unchanged.
 *
 *   DELETE /api/trips/[tripId] — un-frame (R14): deletes the trip and
 *     its stops; pins are untouched. The backing entity is removed only
 *     when nothing references it — a trip entity carrying recollections
 *     or jots survives as a plain entity.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface PatchBody {
  originRelationshipId?: string | null
  clearOrigin?: boolean
  /** Present ONLY when the destination is changing (R22) — its presence,
   *  not its value, is what triggers the retarget. */
  destinationRelationshipId?: string
  /** Keep the OLD destination as an outbound stop. Defaults TRUE, matching
   *  `retarget_trip` — the old destination is usually the story of the
   *  journey, not something to discard. */
  demoteOldToStop?: boolean
  title?: string
  whenText?: string
  yearHint?: number | null
  subtype?: string
  returnToOrigin?: boolean
}

export async function PATCH(req: NextRequest, { params }: { params: { tripId: string } }) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as PatchBody
  const admin = createAdminClient()

  // ── The destination change (R22), FIRST ──────────────────────────────
  // `retarget_trip` and `frame_trip` touch disjoint columns, so order is
  // not forced by the data. It is chosen: retargeting first means the trip
  // is in its final SHAPE before the descriptive fields land, and a failure
  // leaves the simpler state. Order INSIDE retarget_trip is load-bearing
  // for a different reason (add_trip_stop refuses the current destination,
  // so the repoint must land before the demote) — that lives in the SQL.
  const newDestination = body.destinationRelationshipId?.trim()
  if (newDestination) {
    const { error: retargetError } = await admin.rpc('retarget_trip', {
      p_user_id: user.id,
      p_trip_id: params.tripId,
      p_new_destination_relationship_id: newDestination,
      p_demote_old_to_stop: body.demoteOldToStop ?? true,
    })
    if (retargetError) {
      // retarget_trip's own RAISEs are the readable half of this — the
      // panel renders `detail` in preference to `error`.
      return NextResponse.json(
        { error: 'Could not change where the trip ended', detail: retargetError.message },
        { status: 500 },
      )
    }
  }

  const { error } = await admin.rpc('frame_trip', {
    p_user_id: user.id,
    p_trip_id: params.tripId,
    p_origin_relationship_id: body.originRelationshipId ?? null,
    p_title: body.title ?? null,
    p_when_text: body.whenText ?? null,
    p_year_hint: body.yearHint ?? null,
    p_subtype: body.subtype ?? null,
    p_return_to_origin: body.returnToOrigin ?? null,
    p_clear_origin: body.clearOrigin ?? false,
  })
  if (error) {
    // Two RPCs, no shared transaction. If the retarget landed and framing
    // then failed, "Failed to update trip" would be a lie by omission —
    // the destination HAS moved, and the owner is about to look at a globe
    // that proves it. Name what stuck.
    return NextResponse.json(
      {
        error: newDestination
          ? 'The destination was changed, but the rest of the frame did not save'
          : 'Failed to update trip',
        detail: error.message,
        destinationChanged: !!newDestination,
      },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true, destinationChanged: !!newDestination })
}

export async function DELETE(_req: NextRequest, { params }: { params: { tripId: string } }) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('delete_trip', {
    p_user_id: user.id,
    p_trip_id: params.tripId,
  })
  if (error) {
    return NextResponse.json({ error: 'Failed to delete trip', detail: error.message }, { status: 500 })
  }
  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ ok: true, entityDeleted: row?.entity_deleted ?? false })
}
