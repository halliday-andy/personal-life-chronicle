/**
 * Trip itinerary stops (plan U2).
 *
 *   POST  /api/trips/[tripId]/stops — add a stop pin to a leg
 *     ('outbound' | 'return'); position omitted = append in travel
 *     order, given = insert-and-shift within the leg.
 *
 *   PATCH /api/trips/[tripId]/stops — reorder one leg. The id array
 *     must be exactly that leg's stops (cross-leg moves are a
 *     remove + add; the destination divider is fixed).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const LEGS = ['outbound', 'return'] as const

export async function POST(req: NextRequest, { params }: { params: { tripId: string } }) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    relationshipId?: string; leg?: string; position?: number | null
  }
  if (!body.relationshipId) {
    return NextResponse.json({ error: 'relationshipId is required' }, { status: 400 })
  }
  const leg = body.leg ?? 'outbound'
  if (!(LEGS as readonly string[]).includes(leg)) {
    return NextResponse.json({ error: `leg must be one of ${LEGS.join(', ')}` }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('add_trip_stop', {
    p_user_id: user.id,
    p_trip_id: params.tripId,
    p_relationship_id: body.relationshipId,
    p_leg: leg,
    p_position: body.position ?? null,
  })
  if (error) {
    return NextResponse.json({ error: 'Failed to add stop', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ stopId: data }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: { tripId: string } }) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { leg?: string; orderedStopIds?: string[] }
  if (!body.leg || !(LEGS as readonly string[]).includes(body.leg) || !Array.isArray(body.orderedStopIds)) {
    return NextResponse.json({ error: 'leg and orderedStopIds are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.rpc('reorder_trip_stops', {
    p_user_id: user.id,
    p_trip_id: params.tripId,
    p_leg: body.leg,
    p_ordered_stop_ids: body.orderedStopIds,
  })
  if (error) {
    return NextResponse.json({ error: 'Failed to reorder stops', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
