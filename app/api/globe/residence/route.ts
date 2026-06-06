/**
 * Residential globe persistence (Step 7 Slice 1).
 *
 *   GET  /api/globe/residence — all of the signed-in user's residence
 *     pins, in placement order, with coordinates for the globe.
 *
 *   POST /api/globe/residence — place one residence pin. Resolves the
 *     user's self entity (the relationship subject), reverse-geocodes the
 *     dropped point for place_subtype + country, and runs the atomic
 *     create_residence_pin write chain (entity → relationship → optional
 *     memory + link).
 *
 * Slice 1 scope: Main Residence only (relationship_types.code 'lived_at').
 * The free-text "when" is stored verbatim; structured date parsing is
 * Slice 2.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureSelfEntity } from '@/lib/globe/self-entity'
import { reverseGeocode } from '@/lib/globe/geocoding'

function displayNameFor(user: { user_metadata?: Record<string, unknown>; email?: string }): string {
  const meta = user.user_metadata ?? {}
  const fromMeta = (meta.full_name ?? meta.name) as string | undefined
  return (fromMeta?.trim()) || user.email?.split('@')[0] || 'You'
}

export async function GET() {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('get_residence_pins', { p_user_id: user.id })
  if (error) {
    return NextResponse.json({ error: 'Failed to load pins', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ pins: data ?? [] })
}

interface PostBody {
  lng?: number
  lat?: number
  label?: string      // the place name the user confirmed in the UI
  whenText?: string   // optional free-text date ("early 70s")
  body?: string       // optional verbatim narrative
}

export async function POST(request: NextRequest) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let payload: PostBody
  try {
    payload = (await request.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { lng, lat, label, whenText, body } = payload
  if (
    typeof lng !== 'number' || typeof lat !== 'number' ||
    Number.isNaN(lng) || Number.isNaN(lat) ||
    lng < -180 || lng > 180 || lat < -90 || lat > 90
  ) {
    return NextResponse.json({ error: 'lng/lat must be valid coordinates' }, { status: 400 })
  }

  const admin = createAdminClient()

  // The relationship subject. Created at registration; resolved here
  // (with the helper as an idempotent safety net — never the inception).
  const self = await ensureSelfEntity(admin, user.id, displayNameFor(user))

  // Reverse-geocode for subtype + country. Non-fatal — fall back to a
  // city-level pin with the user's label if Mapbox is unavailable.
  let placeSubtype = 'city'
  let countryCode: string | null = null
  let name = label?.trim() || ''
  try {
    const geo = await reverseGeocode(lng, lat)
    placeSubtype = geo.placeSubtype
    countryCode = geo.countryCode
    if (!name) name = geo.name ?? ''
  } catch {
    // swallow — fall through to the coordinate fallback below
  }
  if (!name) name = `${lat.toFixed(3)}, ${lng.toFixed(3)}`

  const { data, error } = await admin.rpc('create_residence_pin', {
    p_user_id: user.id,
    p_self_entity_id: self.id,
    p_lng: lng,
    p_lat: lat,
    p_name: name,
    p_place_subtype: placeSubtype,
    p_country_code: countryCode,
    p_when_text: whenText?.trim() || null,
    p_body_text: body?.trim() || null,
  })
  if (error) {
    return NextResponse.json({ error: 'Failed to place pin', detail: error.message }, { status: 500 })
  }

  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    pin: {
      relationship_id: row?.relationship_id,
      place_entity_id: row?.place_entity_id,
      memory_id: row?.memory_id ?? null,
      name,
      place_subtype: placeSubtype,
      lng,
      lat,
      when_text: whenText?.trim() || null,
      has_memory: Boolean(row?.memory_id),
    },
  })
}
