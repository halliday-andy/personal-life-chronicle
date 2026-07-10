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
import { listPinImages, removeAllPinImages } from '@/lib/globe/pin-image'
import { sendEventQuick } from '@/lib/inngest/send-quick'
import { deriveContextTitle } from '@/lib/context/derive-title'

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
    .select('id, content_raw, occurred_at_fuzzy, created_at, capture_mode, memory_entities!inner(entity_id)')
    .eq('memory_entities.entity_id', rel.object_id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  if (memoryId) linkedQuery = linkedQuery.neq('id', memoryId)
  const { data: linkedRows } = await linkedQuery

  // Home pin per linked recollection (Andy's Journey QA, 2026-07-09): a
  // mention list mixes eras — the Mount Snow share-house memory name-drops
  // Dartmouth — so each row carries WHERE the recollection lives (its
  // role='location' pin) and that pin's verbatim when-phrase. That grounds
  // retrospective/pluperfect references without parsing any dates. A
  // recollection whose home IS this stop gets home:null (native, no label).
  const linkedIds = (linkedRows ?? []).map((r) => r.id)
  const homeByMemory = new Map<string, { relationship_id: string; name: string; when_text: string | null }>()
  if (linkedIds.length > 0) {
    const { data: locLinks } = await admin
      .from('memory_entities')
      .select('memory_id, entity_id')
      .in('memory_id', linkedIds)
      .eq('role', 'location')
    const placeIds = Array.from(new Set((locLinks ?? []).map((l) => l.entity_id)))
    if (placeIds.length > 0) {
      const [{ data: relRows }, { data: placeEntotal }] = await Promise.all([
        admin
          .from('relationships')
          .select('id, object_id, metadata, relationship_types!inner(code)')
          .eq('user_id', user.id)
          .in('object_id', placeIds),
        admin.from('entities').select('id, canonical_name').in('id', placeIds),
      ])
      const nameByPlace = new Map((placeEntotal ?? []).map((e) => [e.id, e.canonical_name as string]))
      type HomeRel = {
        id: string; object_id: string; metadata: Record<string, unknown> | null
        relationship_types: { code: string } | { code: string }[] | null
      }
      const pinByPlace = new Map<string, { relationship_id: string; name: string; when_text: string | null }>()
      for (const r of (relRows ?? []) as HomeRel[]) {
        const rt = Array.isArray(r.relationship_types) ? r.relationship_types[0] : r.relationship_types
        if (!rt || !(PIN_TYPE_CODES as readonly string[]).includes(rt.code) || pinByPlace.has(r.object_id)) continue
        pinByPlace.set(r.object_id, {
          relationship_id: r.id,
          name: nameByPlace.get(r.object_id) ?? 'Untitled place',
          when_text: (r.metadata?.when_text as string | undefined) ?? null,
        })
      }
      for (const l of (locLinks ?? []) as { memory_id: string; entity_id: string }[]) {
        if (homeByMemory.has(l.memory_id)) continue
        const pin = pinByPlace.get(l.entity_id)
        // Native to this stop → no label (retrospective mentions stand out).
        if (pin && pin.relationship_id !== params.relationshipId) homeByMemory.set(l.memory_id, pin)
      }
    }
  }

  const linked = (linkedRows ?? []).map((r) => ({
    id: r.id,
    excerpt: (r.content_raw ?? '').slice(0, 240),
    // Full text so the card can expand in place (≤20 rows, cheap).
    text: r.content_raw ?? '',
    created_at: r.created_at,
    occurred_at_fuzzy: r.occurred_at_fuzzy ?? null,
    home: homeByMemory.get(r.id) ?? null,
  }))

  // Recollection roll-up (Slice 3.6): pins anchored to THIS pin (Logs,
  // vacations, work trips…) surface as short descriptors that link to that
  // pin. The recollection still lives on its own pin — this is an index.
  //
  // SUBTREE, not direct children (2026-07-09, Andy's Journey QA): since
  // generalized anchoring, a marker can anchor to another marker — his
  // Queenstown hotels now hang off the ski school, and a direct-children
  // query left the grandchildren without excerpts in the Journey. Walk
  // level by level with a visited guard (cycles are theoretically
  // repairable states — never loop on them).
  const anchoredRels: { id: string; object_id: string; type_id: string }[] = []
  {
    const visited = new Set<string>([params.relationshipId])
    let frontier = [params.relationshipId]
    while (frontier.length > 0) {
      const { data: level } = await admin
        .from('relationships')
        .select('id, object_id, type_id, anchor_residence_id')
        .in('anchor_residence_id', frontier)
        .eq('user_id', user.id)
      const next: string[] = []
      for (const r of level ?? []) {
        if (visited.has(r.id)) continue
        visited.add(r.id)
        anchoredRels.push({ id: r.id, object_id: r.object_id, type_id: r.type_id })
        next.push(r.id)
      }
      frontier = next
    }
  }
  let anchored: {
    relationship_id: string; name: string; type_code: string | null; excerpt: string
    place_entity_id: string; linked_count: number
  }[] = []
  if (anchoredRels && anchoredRels.length > 0) {
    const objIds = anchoredRels.map((r) => r.object_id)
    const typeIds = Array.from(new Set(anchoredRels.map((r) => r.type_id)))
    const [{ data: ents }, { data: tcodes }, { data: rollMems }, { data: childLinks }] = await Promise.all([
      admin.from('entities').select('id, canonical_name').in('id', objIds),
      admin.from('relationship_types').select('id, code').in('id', typeIds),
      admin.from('memories')
        .select('id, content_raw, memory_entities!inner(entity_id, role)')
        .in('memory_entities.entity_id', objIds)
        .eq('memory_entities.role', 'location')
        .eq('capture_mode', 'globe_onboarding')
        .eq('user_id', user.id),
      // Every recollection linked to each child place (any role) — feeds
      // the "+N recollections" count so a place accumulating memories
      // doesn't look inert from the Journey (Andy's QA, 2026-07-09).
      admin.from('memory_entities')
        .select('entity_id, memory_id, memories!inner(user_id)')
        .in('entity_id', objIds)
        .eq('memories.user_id', user.id),
    ])
    const nameById = new Map((ents ?? []).map((e) => [e.id, e.canonical_name as string]))
    const codeById = new Map((tcodes ?? []).map((t) => [t.id, t.code as string]))
    const excerptByEntity = new Map<string, string>()
    const overviewIdByEntity = new Map<string, string>()
    for (const m of rollMems ?? []) {
      const meRows = Array.isArray(m.memory_entities) ? m.memory_entities : [m.memory_entities]
      for (const me of meRows as { entity_id: string; role: string }[]) {
        if (!excerptByEntity.has(me.entity_id)) {
          excerptByEntity.set(me.entity_id, (m.content_raw ?? '').slice(0, 160))
          overviewIdByEntity.set(me.entity_id, m.id as string)
        }
      }
    }
    // Distinct memories per child entity (a memory can link with several
    // roles); the shown overview excerpt doesn't count toward "+N more".
    const memsByEntity = new Map<string, Set<string>>()
    for (const l of (childLinks ?? []) as { entity_id: string; memory_id: string }[]) {
      const set = memsByEntity.get(l.entity_id) ?? new Set<string>()
      set.add(l.memory_id)
      memsByEntity.set(l.entity_id, set)
    }
    anchored = anchoredRels.map((r) => {
      const set = memsByEntity.get(r.object_id) ?? new Set<string>()
      const overviewId = overviewIdByEntity.get(r.object_id)
      const linked_count = set.size - (overviewId && set.has(overviewId) ? 1 : 0)
      return {
        relationship_id: r.id,
        name: nameById.get(r.object_id) ?? 'Untitled place',
        type_code: codeById.get(r.type_id) ?? null,
        excerpt: excerptByEntity.get(r.object_id) ?? '',
        place_entity_id: r.object_id,
        linked_count,
      }
    })
  }

  // Context notes on this place entity (Slice 6.5). Titles are derived
  // server-side so the pin card and the entity page agree. The card links
  // out to the entity page rather than per-note, so body isn't returned.
  const { data: ctxRows } = await admin
    .from('entity_context_notes')
    .select('id, body, visibility, created_at')
    .eq('entity_id', rel.object_id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  const context = (ctxRows ?? []).map((n) => ({
    id: n.id,
    title: deriveContextTitle(n.body ?? ''),
    visibility: n.visibility,
  }))

  // Full gallery, primary first; `image` (the primary) kept for the
  // detail card, `images` powers the edit-panel gallery.
  const images = await listPinImages(admin, user.id, rel.object_id)
  const image = images[0] ?? null

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

  return NextResponse.json({ memoryId, body, isDraft, image, images, facts, linked, anchored, context })
}

const PIN_TYPE_CODES = [
  'lived_at', 'worked_at', 'owned_residence_at',
  'lived_briefly_at', 'vacationed_at', 'traveled_for_work_to', 'logged_at',
] as const

interface PatchBody {
  name?: string
  whenText?: string
  body?: string
  lng?: number
  lat?: number
  typeCode?: string         // re-classify the pin; omit to leave type/anchor untouched
  anchorId?: string | null  // marker → its primary residence (null = standalone)
  description?: string      // placard; omit to leave untouched
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

  // Optional re-type. Omitted typeCode leaves type + anchor untouched (a
  // plain text/relocate edit). When present it must be a valid pin type.
  let typeCode: string | null = null
  if (p.typeCode !== undefined) {
    if (!(PIN_TYPE_CODES as readonly string[]).includes(p.typeCode)) {
      return NextResponse.json({ error: `Unknown pin type: ${p.typeCode}` }, { status: 400 })
    }
    typeCode = p.typeCode
  }
  const anchorId = typeCode && typeCode !== 'lived_at'
    ? (typeof p.anchorId === 'string' ? p.anchorId : null)
    : null

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
    p_type_code: typeCode,
    p_anchor_residence_id: anchorId,
  })
  if (error) {
    return NextResponse.json({ error: 'Failed to update pin', detail: error.message }, { status: 500 })
  }
  const row = Array.isArray(data) ? data[0] : data

  // Placard — write the short description onto the place entity. Omitted =
  // untouched; an empty string clears it.
  if (p.description !== undefined && row?.place_entity_id) {
    await admin.from('entities').update({ description: p.description.trim() || null }).eq('id', row.place_entity_id)
  }

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

  // Clear the pin's images first: the entity_media CASCADE on pin delete
  // would otherwise orphan the media rows and the storage bytes.
  const { data: rel } = await admin
    .from('relationships').select('object_id, user_id').eq('id', params.relationshipId).maybeSingle()
  if (rel && rel.user_id === user.id) {
    await removeAllPinImages(admin, user.id, rel.object_id)
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
