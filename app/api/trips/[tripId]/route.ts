/**
 * One trip (plan U2).
 *
 *   PATCH  /api/trips/[tripId] — frame or refine: origin (or clear it),
 *     title, free-text timeframe, year hint, subtype, return-to-origin.
 *     All fields optional; omitted fields are unchanged.
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
    return NextResponse.json({ error: 'Failed to update trip', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
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
