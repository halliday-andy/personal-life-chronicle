/**
 * Entity resource endpoints.
 *
 *   PATCH /api/entity/[id]
 *     Rename an entity, manage aliases, change its type, and/or set its
 *     Life's Cast membership.
 *     Body: { canonical_name?: string, aliases?: string[], type?: string,
 *             in_lifes_cast?: boolean }
 *
 *     in_lifes_cast (Slice 7.2, roadmap M3) is a metadata flag, not a
 *     column. It MERGES into entities.metadata — other keys there are
 *     load-bearing (is_self, prior_anchor_residence_id, globe_extraction
 *     bookkeeping) and must survive. Promotion is a deliberate owner act;
 *     nothing auto-populates the Cast. Person entities only.
 *
 *     When canonical_name changes, the previous canonical_name is appended
 *     to aliases (deduplicated, case-insensitive). This preserves backward
 *     resolvability — past memory_entities references and Layer B context
 *     snippets that used the old name continue to match against the entity.
 *
 *     Type changes (added 6h/68-1) handle the case where the orchestrator's
 *     initial type guess was wrong (e.g. "Berkeley" extracted as a person
 *     when it's an organization). No ripple effects on FKs since they
 *     reference by id, not by type. The new type is validated against the
 *     schema's CHECK constraint on entities.type.
 *
 *   DELETE /api/entity/[id]
 *     Hard-delete the entity. CASCADE rules from migration 20260530144509
 *     handle the ripple: memory_entities + entity_media rows go,
 *     relationships involving this entity drop, syntheses/contacts/etc.
 *     get their entity_id nulled.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyLifesCast, isInLifesCast } from '@/lib/entity/lifes-cast'

// All seven entity_type enum values (schema_v1). concept + vehicle were
// missing here too when the /entities UI gained them (2026-07-06) — keep
// this list in sync with the DB enum AND components/EntitiesList.tsx.
const ALLOWED_TYPES = [
  'person',
  'place',
  'organization',
  'concept',
  'artifact',
  'vehicle',
  'event_series',
] as const

type EntityType = (typeof ALLOWED_TYPES)[number]

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: entity, error: loadErr } = await admin
    .from('entities')
    .select('id, user_id, type, canonical_name, aliases, metadata')
    .eq('id', params.id)
    .single()
  if (loadErr || !entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
  }
  if (entity.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as {
    canonical_name?: string
    aliases?: string[]
    type?: string
    in_lifes_cast?: boolean
  }
  const updates: Record<string, unknown> = {}

  if (typeof body.in_lifes_cast === 'boolean') {
    if (entity.type !== 'person') {
      return NextResponse.json(
        { error: "Life's Cast is for people — this entity is not a person" },
        { status: 400 },
      )
    }
    // MERGE into metadata: other keys (is_self, globe bookkeeping) are
    // load-bearing and must survive. Demotion removes the key entirely.
    updates.metadata = applyLifesCast(entity.metadata as Record<string, unknown> | null, body.in_lifes_cast)
  }

  if (typeof body.type === 'string') {
    if (!ALLOWED_TYPES.includes(body.type as EntityType)) {
      return NextResponse.json(
        { error: `type must be one of: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 },
      )
    }
    if (body.type !== entity.type) {
      updates.type = body.type
    }
  }

  const existingAliases: string[] = Array.isArray(entity.aliases) ? entity.aliases : []
  let nextAliases = existingAliases.slice()

  if (typeof body.canonical_name === 'string') {
    const newName = body.canonical_name.trim()
    if (!newName) {
      return NextResponse.json({ error: 'canonical_name cannot be empty' }, { status: 400 })
    }
    if (newName !== entity.canonical_name) {
      updates.canonical_name = newName
      // Stash the old name as an alias (case-insensitive de-dupe).
      const lower = entity.canonical_name.toLowerCase()
      if (!nextAliases.some((a) => a.toLowerCase() === lower)) {
        nextAliases = [...nextAliases, entity.canonical_name]
      }
    }
  }

  if (Array.isArray(body.aliases)) {
    // Replace aliases wholesale, dedupe case-insensitively.
    const seen = new Set<string>()
    nextAliases = []
    for (const a of body.aliases) {
      const trimmed = a.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      nextAliases.push(trimmed)
    }
  }

  if (nextAliases.length !== existingAliases.length ||
      nextAliases.some((a, i) => a !== existingAliases[i])) {
    updates.aliases = nextAliases.length > 0 ? nextAliases : null
  }

  updates.updated_at = new Date().toISOString()

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'No fields supplied or no changes' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('entities')
    .update(updates)
    .eq('id', params.id)
    .select('id, type, canonical_name, aliases, metadata')
    .single()
  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update', detail: error?.message }, { status: 500 })
  }
  return NextResponse.json({
    id: data.id,
    type: data.type,
    canonical_name: data.canonical_name,
    aliases: data.aliases,
    in_lifes_cast: isInLifesCast(data.metadata as Record<string, unknown> | null),
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: entity, error: loadErr } = await admin
    .from('entities')
    .select('id, user_id, canonical_name, type')
    .eq('id', params.id)
    .single()
  if (loadErr || !entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
  }
  if (entity.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // FK CASCADE rules from migration 20260530144509 handle ripple:
  //   memory_entities + entity_media  → CASCADE (rows dropped)
  //   relationships subject/object    → CASCADE (edges dropped)
  //   coverage                        → CASCADE (rows dropped)
  //   entities.location_entity_id     → SET NULL (children survive)
  //   interview_sessions, syntheses,
  //     contacts, assumption_log      → SET NULL (link nulled,
  //                                                 record survives)
  const { error: delErr } = await admin
    .from('entities')
    .delete()
    .eq('id', params.id)
  if (delErr) {
    return NextResponse.json(
      { error: 'Failed to delete entity', detail: delErr.message },
      { status: 500 },
    )
  }

  // Cascade-close any open review_queue rows still pointing at this
  // entity, matching the deleteEntity() pattern in
  // app/api/review-queue/[id]/resolve/route.ts.
  await admin
    .from('review_queue')
    .update({
      resolved_at: new Date().toISOString(),
      resolution: 'dismissed',
      resolution_payload: { reason: 'source_entity_deleted' },
      resolved_by: 'system:entity_deleted_via_entities_route',
    })
    .eq('user_id', user.id)
    .eq('item_id', params.id)
    .is('resolved_at', null)

  return NextResponse.json({
    status: 'deleted',
    entity_id: params.id,
    canonical_name: entity.canonical_name,
    type: entity.type,
  })
}
