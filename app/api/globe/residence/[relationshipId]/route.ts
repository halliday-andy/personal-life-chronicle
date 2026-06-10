/**
 * Single residence pin — edit / relocate / delete (Step 7 Slice 4a).
 *
 *   GET    — the pin's recollection text (for the edit panel; coords/name/
 *            when are already in the GlobeView pins list).
 *   PATCH  — edit name / when / recollection and/or relocate. The client
 *            sends the FULL field set on save (so an unchanged body isn't
 *            mistaken for "cleared"). On a coordinate change the route
 *            reverse-geocodes for place_subtype + country.
 *   DELETE — hard delete the pin (memory + relationship + place), atomic.
 *
 * Ownership is enforced both here and inside the RPCs (user_id guard).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reverseGeocode } from '@/lib/globe/geocoding'
import { proximityHint } from '@/lib/globe/proximity'
import { removePinImage } from '@/lib/globe/pin-image'

async function getUser() {
  const { data: { user } } = await createUserClient().auth.getUser()
  return user
}

export async function GET(_req: NextRequest, { params }: { params: { relationshipId: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: rel } = await admin
    .from('relationships').select('object_id, user_id').eq('id', params.relationshipId).maybeSingle()
  if (!rel || rel.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: link } = await admin
    .from('memory_entities').select('memory_id').eq('entity_id', rel.object_id).eq('role', 'location')
    .limit(1).maybeSingle()

  let body = ''
  let memoryId: string | null = null
  let isDraft: boolean | null = null
  if (link) {
    const { data: mem } = await admin
      .from('memories').select('id, content_raw, is_draft').eq('id', link.memory_id).single()
    if (mem) { body = mem.content_raw ?? ''; memoryId = mem.id; isDraft = mem.is_draft }
  }
  return NextResponse.json({ memoryId, body, isDraft })
}

interface PatchBody {
  name?: string
  whenText?: string
  body?: string
  lng?: number
  lat?: number
}

export async function PATCH(request: NextRequest, { params }: { params: { relationshipId: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let p: PatchBody
  try { p = (await request.json()) as PatchBody } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const lng = typeof p.lng === 'number' ? p.lng : null
  const lat = typeof p.lat === 'number' ? p.lat : null
  let placeSubtype: string | null = null
  let countryCode: string | null = null
  if (lng !== null && lat !== null) {
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
    }
    try {
      const g = await reverseGeocode(lng, lat)
      placeSubtype = g.placeSubtype
      countryCode = g.countryCode
    } catch { /* non-fatal: keep existing subtype/country */ }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('update_residence_pin', {
    p_relationship_id: params.relationshipId,
    p_user_id: user.id,
    p_lng: lng,
    p_lat: lat,
    p_name: p.name?.trim() || null,
    p_place_subtype: placeSubtype,
    p_country_code: countryCode,
    p_when_text: p.whenText?.trim() || null,
    p_body: p.body !== undefined ? p.body.trim() : null,
  })
  if (error) {
    return NextResponse.json({ error: 'Failed to update pin', detail: error.message }, { status: 500 })
  }
  const row = Array.isArray(data) ? data[0] : data

  // On a relocate, flag if the pin landed near another residence.
  const proximity =
    lng !== null && lat !== null
      ? await proximityHint(admin, user.id, lng, lat, params.relationshipId)
      : null

  return NextResponse.json({ ok: true, relocated: row?.relocated ?? false, memoryId: row?.memory_id ?? null, proximity })
}

export async function DELETE(_req: NextRequest, { params }: { params: { relationshipId: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Clear the pin image first: the entity_media CASCADE on pin delete
  // would otherwise orphan the media row and the storage bytes.
  const { data: rel } = await admin
    .from('relationships').select('object_id, user_id').eq('id', params.relationshipId).maybeSingle()
  if (rel && rel.user_id === user.id) {
    await removePinImage(admin, user.id, rel.object_id)
  }

  const { error } = await admin.rpc('delete_residence_pin', {
    p_relationship_id: params.relationshipId,
    p_user_id: user.id,
  })
  if (error) {
    return NextResponse.json({ error: 'Failed to delete pin', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
