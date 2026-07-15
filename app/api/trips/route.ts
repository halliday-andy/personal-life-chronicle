/**
 * Trips & Travel Journal (plan U2).
 *
 *   GET  /api/trips — all of the signed-in user's trips with origin/
 *     destination names + coordinates and ordered leg-aware stops, in
 *     Travel Journal order (year_hint, unhinted last, then created_at).
 *
 *   POST /api/trips — create a trip. Destination-first: a destination
 *     pin id + subtype is enough to save a draft (origin optional).
 *     Also the "frame this pin as a trip" path — the pin is untouched.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TRIP_SUBTYPES } from '@/lib/globe/trip-types'

export async function GET() {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data, error }, { data: hb }] = await Promise.all([
    admin.rpc('get_trips', { p_user_id: user.id }),
    // Home Base (U7/KTD8): the one lived_at carrying the flag, if any.
    admin.from('relationships').select('id').eq('user_id', user.id)
      .filter('metadata->>home_base', 'eq', 'true').limit(1).maybeSingle(),
  ])
  if (error) {
    return NextResponse.json({ error: 'Failed to load trips', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ trips: data ?? [], homeBaseRelationshipId: hb?.id ?? null })
}

interface PostBody {
  destinationRelationshipId?: string
  subtype?: string
  title?: string
  whenText?: string
  yearHint?: number | null
  originRelationshipId?: string | null
}

export async function POST(req: NextRequest) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as PostBody
  if (!body.destinationRelationshipId) {
    return NextResponse.json({ error: 'destinationRelationshipId is required' }, { status: 400 })
  }
  if (!body.subtype || !(TRIP_SUBTYPES as readonly string[]).includes(body.subtype)) {
    return NextResponse.json({ error: `subtype must be one of ${TRIP_SUBTYPES.join(', ')}` }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('create_trip', {
    p_user_id: user.id,
    p_destination_relationship_id: body.destinationRelationshipId,
    p_subtype: body.subtype,
    p_title: body.title ?? null,
    p_when_text: body.whenText ?? null,
    p_year_hint: body.yearHint ?? null,
    p_origin_relationship_id: body.originRelationshipId ?? null,
  })
  if (error) {
    return NextResponse.json({ error: 'Failed to create trip', detail: error.message }, { status: 500 })
  }
  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ tripId: row?.trip_id, tripEntityId: row?.trip_entity_id }, { status: 201 })
}
