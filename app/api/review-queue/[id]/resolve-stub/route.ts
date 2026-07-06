/**
 * POST /api/review-queue/[id]/resolve-stub — act on an entity_stub_proposal
 * (globe stub resolution, 2026-07-06).
 *
 * Body:
 *   { action: 'create',  name?: string }   → create the entity (editable name,
 *                                            default = the stub) + link it to
 *                                            the memory
 *   { action: 'link',    entityId: string }→ link an existing entity instead
 *   { action: 'dismiss' }                  → drop the proposal
 *
 * Every path resolves the queue row and settles the stub's bookkeeping in
 * relationships.metadata.globe_stub_resolution so re-sweeps never
 * re-propose it. Ownership app-layer as everywhere; RLS at Step 13.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { linkEntityToMemory, OwnerEditError } from '@/lib/memory/owner-edit'
import { settleStubState } from '@/lib/globe/stub-resolution'

interface Body {
  action?: 'create' | 'link' | 'dismiss'
  name?: string
  entityId?: string
  /** Optional override of the proposed entity type — the extractor's
   *  nomination is a default, not a verdict (e.g. "Tachikawa Air Base"
   *  proposed as organization, corrected to place by the user). */
  entityType?: string
}

// Keep in sync with the DB entity_type enum + EntitiesList.tsx.
const ALLOWED_ENTITY_TYPES = [
  'person', 'place', 'organization', 'concept', 'artifact', 'vehicle', 'event_series',
]

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Body
  try { body = (await request.json()) as Body } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.action || !['create', 'link', 'dismiss'].includes(body.action)) {
    return NextResponse.json({ error: "action must be 'create', 'link', or 'dismiss'" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: row, error: rowErr } = await admin
    .from('review_queue')
    .select('id, user_id, item_type, context_json, resolved_at')
    .eq('id', params.id)
    .single()
  if (rowErr || !row) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })
  if (row.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (row.item_type !== 'entity_stub_proposal') {
    return NextResponse.json({ error: 'Not an entity_stub_proposal item' }, { status: 400 })
  }
  if (row.resolved_at) {
    return NextResponse.json({ error: 'Already resolved', resolved_at: row.resolved_at }, { status: 409 })
  }

  const ctx = (row.context_json ?? {}) as {
    name?: string
    entity_type?: string
    relationship_id?: string
    memory_id?: string
  }
  if (!ctx.name || !ctx.entity_type || !ctx.memory_id || !ctx.relationship_id) {
    return NextResponse.json({ error: 'Proposal is missing its context' }, { status: 400 })
  }

  try {
    let entityId: string | null = null
    let canonicalName: string | null = null
    let resolution: 'confirmed' | 'dismissed' = 'confirmed'

    if (body.action === 'create') {
      const name = (body.name ?? ctx.name).trim()
      if (!name) return NextResponse.json({ error: 'A name is required' }, { status: 400 })
      const createType = body.entityType ?? ctx.entity_type
      if (!ALLOWED_ENTITY_TYPES.includes(createType)) {
        return NextResponse.json(
          { error: `entityType must be one of: ${ALLOWED_ENTITY_TYPES.join(', ')}` },
          { status: 400 },
        )
      }
      const { data: ent, error: entErr } = await admin
        .from('entities')
        .insert({ user_id: user.id, type: createType, canonical_name: name })
        .select('id, canonical_name')
        .single()
      if (entErr || !ent) {
        return NextResponse.json({ error: 'Could not create the entity', detail: entErr?.message }, { status: 500 })
      }
      entityId = ent.id
      canonicalName = ent.canonical_name
      // If the user renamed it (e.g. "my father" → "Robert Halliday"), keep
      // the stub phrasing as an alias so future mentions still resolve.
      if (name.toLowerCase() !== ctx.name.trim().toLowerCase()) {
        await admin.from('entities').update({ aliases: [ctx.name.trim()] }).eq('id', ent.id)
      }
      await linkEntityToMemory(admin, user.id, ctx.memory_id, ent.id)
    } else if (body.action === 'link') {
      if (!body.entityId) return NextResponse.json({ error: 'entityId is required for link' }, { status: 400 })
      const result = await linkEntityToMemory(admin, user.id, ctx.memory_id, body.entityId)
      entityId = result.entity.id
      canonicalName = result.entity.canonical_name
    } else {
      resolution = 'dismissed'
    }

    const { error: updErr } = await admin
      .from('review_queue')
      .update({
        resolved_at: new Date().toISOString(),
        resolution,
        resolution_payload: {
          action: body.action,
          ...(entityId ? { entity_id: entityId, canonical_name: canonicalName } : {}),
        },
        resolved_by: 'user',
      })
      .eq('id', row.id)
    if (updErr) {
      return NextResponse.json({ error: 'Could not resolve the item', detail: updErr.message }, { status: 500 })
    }

    await settleStubState(admin, {
      relationshipId: ctx.relationship_id,
      entityType: ctx.entity_type,
      name: ctx.name,
      status: body.action === 'dismiss' ? 'dismissed' : 'linked',
      ...(entityId ? { entityId } : {}),
    })

    return NextResponse.json({
      status: 'resolved',
      action: body.action,
      ...(entityId ? { entity: { id: entityId, canonical_name: canonicalName } } : {}),
    })
  } catch (err) {
    if (err instanceof OwnerEditError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json(
      { error: 'Failed to resolve stub', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
