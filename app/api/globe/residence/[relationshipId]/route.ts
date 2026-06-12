/**
 * Single residence pin — edit / relocate / delete (Step 7 Slice 4a).
 *
 *   GET    — the pin's recollection text, image (signed URL), and any
 *            AI-extracted facts (for the detail card and edit panel;
 *            coords/name/when are already in the GlobeView pins list).
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
import { getPinImage, removePinImage } from '@/lib/globe/pin-image'
import { sendEventQuick } from '@/lib/inngest/send-quick'

async function getUser() {
  const { data: { user } } = await createUserClient().auth.getUser()
  return user
}

export async function GET(_req: NextRequest, { params }: { params: { relationshipId: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: rel } = await admin
    .from('relationships').select('object_id, user_id, metadata').eq('id', params.relationshipId).maybeSingle()
  if (!rel || rel.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // The pin's OWN recollection: the globe-authored memory only, oldest
  // first — same scoping as update/delete_residence_pin. Other memories
  // that mention this place (capture assistant, interview) are not the
  // pin's overview text and must never be shown or edited here.
  const { data: mem } = await admin
    .from('memories')
    .select('id, content_raw, is_draft, created_at, memory_entities!inner(entity_id, role)')
    .eq('memory_entities.entity_id', rel.object_id)
    .eq('memory_entities.role', 'location')
    .eq('capture_mode', 'globe_onboarding')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const body = mem?.content_raw ?? ''
  const memoryId = mem?.id ?? null
  const isDraft = mem?.is_draft ?? null

  // Other recollections that reference this place (capture assistant,
  // interviews, strolls) — read-only context on the detail card. The
  // pin's own overview memory is excluded.
  let linkedQuery = admin
    .from('memories')
    .select('id, content_raw, created_at, capture_mode, memory_entities!inner(entity_id)')
    .eq('memory_entities.entity_id', rel.object_id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  if (memoryId) linkedQuery = linkedQuery.neq('id', memoryId)
  const { data: linkedRows } = await linkedQuery
  const linked = (linkedRows ?? []).map((r) => ({
    id: r.id,
    excerpt: (r.content_raw ?? '').slice(0, 240),
    created_at: r.created_at,
  }))

  const image = await getPinImage(admin, user.id, rel.object_id)

  // AI-extracted facts (Slice 2 extraction job writes these; null until then).
  const meta = (rel.metadata ?? {}) as Record<string, unknown>
  const extraction = (meta.globe_extraction ?? null) as Record<string, unknown> | null
  const facts = extraction
    ? {
        residence_type: (meta.residence_type as string | null) ?? null,
        move_reason: (meta.move_reason as string | null) ?? null,
        household_composition: (extraction.household_composition as string | null) ?? null,
        rough_temporal_range: (extraction.rough_temporal_range as string | null) ?? null,
      }
    : null

  return NextResponse.json({ memoryId, body, isDraft, image, facts, linked })
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

  // Re-extract when the recollection text was part of this save (the
  // panel sends the full field set, so this re-runs on every save with a
  // non-empty body — latest text wins, acceptable for MVP).
  if (p.body?.trim() && row?.memory_id) {
    await sendEventQuick({
      name: 'globe/pin.saved',
      data: { user_id: user.id, relationship_id: params.relationshipId, memory_id: row.memory_id },
    })
  }

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
