/**
 * POST /api/review-queue/[id]/resolve — Smart resolution endpoint.
 *
 * One endpoint per resolution action. The handler reads the row's
 * item_type, validates the requested resolution against the allowed
 * matrix for that type, performs the cascading side-effect, then
 * records the resolution. The /review page UI just sends a verb +
 * payload; the dispatch table lives here so each card component
 * doesn't have to know which sub-endpoint to call.
 *
 * Body
 *   {
 *     resolution: 'confirmed' | 'renamed' | 'rejected' | 'merged'
 *                 | 'deferred' | 'dismissed',
 *     payload?: {
 *       canonical_name?: string,      // renamed (entity)
 *       aliases?: string[],            // renamed (entity)
 *       merged_into_id?: string,       // merged (entity)
 *       resurface_at?: string,         // deferred (ISO timestamp)
 *     },
 *     note?: string                    // → resolution_note
 *   }
 *
 * Response
 *   200 { status: 'resolved', resolution, payload, effects }
 *   400 invalid body / invalid resolution for type
 *   401 unauthorized
 *   403 not owner
 *   404 row not found
 *   409 already resolved
 *
 * Cascading effects per (item_type, resolution):
 *   entity_confirmation_needed × confirmed  → none
 *   entity_confirmation_needed × renamed    → rename entity (PATCH-like)
 *   entity_confirmation_needed × rejected   → delete entity (cascades memory_entities)
 *   entity_confirmation_needed × merged     → RPC merge_entities(item_id → payload.merged_into_id)
 *   entity_confirmation_needed × deferred   → none
 *   entity_confirmation_needed × dismissed  → none
 *   entity_merge_proposal      × merged     → RPC merge_entities(item_id → context.proposed_primary)
 *   entity_merge_proposal      × rejected   → none (keep both entities)
 *   entity_merge_proposal      × dismissed  → none
 *   all other types            × *          → record-only (Phase 2 side-effects)
 *
 * For `merged`, the RPC itself closes the triggering queue row (it
 * closes ALL open rows where item_id = source). We detect that and
 * skip the duplicate UPDATE; the response still reports the
 * resolution + payload so the caller doesn't refetch.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Resolution =
  | 'confirmed'
  | 'renamed'
  | 'rejected'
  | 'merged'
  | 'deferred'
  | 'dismissed'

const ALL_RESOLUTIONS: Resolution[] = [
  'confirmed', 'renamed', 'rejected', 'merged', 'deferred', 'dismissed',
]

const ALLOWED_BY_TYPE: Record<string, Resolution[]> = {
  entity_confirmation_needed: ['confirmed', 'renamed', 'rejected', 'merged', 'deferred', 'dismissed'],
  entity_merge_proposal:      ['merged', 'rejected', 'deferred', 'dismissed'],
  temporal_constraint:        ['confirmed', 'rejected', 'deferred', 'dismissed'],
  synthesis_stale:            ['confirmed', 'dismissed', 'deferred'],
  memory_elaboration_needed:  ['confirmed', 'dismissed', 'deferred'],
  sensitive_promotion:        ['confirmed', 'rejected', 'dismissed'],
  contribution_review:        ['confirmed', 'rejected', 'dismissed'],
  assumption_review:          ['confirmed', 'rejected', 'dismissed'],
}

type ReviewQueueRow = {
  id: string
  user_id: string
  item_type: string
  item_id: string
  context_json: Record<string, unknown> | null
  resolved_at: string | null
}

type EntityRow = {
  id: string
  user_id: string
  type: string
  canonical_name: string
  aliases: string[] | null
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { resolution?: unknown; payload?: unknown; note?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 })
  }

  const resolution = body.resolution as Resolution | undefined
  if (!resolution || !ALL_RESOLUTIONS.includes(resolution)) {
    return NextResponse.json(
      { error: `resolution must be one of: ${ALL_RESOLUTIONS.join(', ')}` },
      { status: 400 },
    )
  }
  const payload = (body.payload && typeof body.payload === 'object')
    ? (body.payload as Record<string, unknown>)
    : {}
  const note = typeof body.note === 'string' ? body.note : null

  const admin = createAdminClient()

  // --- 1. Load + ownership check ------------------------------------
  const { data: rowRaw, error: loadErr } = await admin
    .from('review_queue')
    .select('id, user_id, item_type, item_id, context_json, resolved_at')
    .eq('id', params.id)
    .single()
  if (loadErr || !rowRaw) {
    return NextResponse.json({ error: 'Review item not found' }, { status: 404 })
  }
  const row = rowRaw as unknown as ReviewQueueRow
  if (row.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (row.resolved_at !== null) {
    return NextResponse.json(
      { error: 'Already resolved', resolved_at: row.resolved_at },
      { status: 409 },
    )
  }

  // --- 2. Resolution-type compatibility ----------------------------
  const allowed = ALLOWED_BY_TYPE[row.item_type] ?? ['dismissed']
  if (!allowed.includes(resolution)) {
    return NextResponse.json(
      {
        error: `resolution '${resolution}' is not valid for item_type '${row.item_type}'`,
        allowed,
      },
      { status: 400 },
    )
  }

  // --- 3. Cascading side-effects -----------------------------------
  const effects: Record<string, unknown> = {}
  // Track whether the side-effect already closed the queue row so we
  // don't double-write.
  let queueRowAlreadyClosed = false

  try {
    if (row.item_type === 'entity_confirmation_needed') {
      if (resolution === 'renamed') {
        const newName = typeof payload.canonical_name === 'string'
          ? payload.canonical_name.trim() : ''
        if (!newName) {
          return NextResponse.json(
            { error: 'payload.canonical_name is required for renamed' },
            { status: 400 },
          )
        }
        const effect = await renameEntity(admin, row.item_id, user.id, newName,
          Array.isArray(payload.aliases) ? payload.aliases as string[] : undefined)
        if ('error' in effect) return effect.error
        effects.entity = effect.entity

      } else if (resolution === 'rejected') {
        const effect = await deleteEntity(admin, row.item_id, user.id)
        if ('error' in effect) return effect.error
        effects.entity_deleted = effect.deleted_id

      } else if (resolution === 'merged') {
        const targetId = typeof payload.merged_into_id === 'string'
          ? payload.merged_into_id : ''
        if (!targetId) {
          return NextResponse.json(
            { error: 'payload.merged_into_id is required for merged' },
            { status: 400 },
          )
        }
        const rpc = await admin.rpc('merge_entities', {
          p_source_id: row.item_id,
          p_target_id: targetId,
          p_user_id: user.id,
          p_resolved_by: 'user',
        })
        if (rpc.error) {
          return mapRpcError(rpc.error.message)
        }
        effects.merge = rpc.data
        queueRowAlreadyClosed = true
      }
      // confirmed | deferred | dismissed → no cascading effect.

    } else if (row.item_type === 'entity_merge_proposal') {
      if (resolution === 'merged') {
        // The proposal row's item_id is the DUPLICATE (source); the
        // context_json carries the proposed_primary (target). Caller
        // may override the target via payload.merged_into_id (e.g. if
        // they're picking a different existing entity from a list),
        // but the proposed_primary is the default.
        const proposedPrimary =
          (row.context_json as Record<string, unknown> | null)?.proposed_primary
        const targetId =
          typeof payload.merged_into_id === 'string'
            ? payload.merged_into_id
            : typeof proposedPrimary === 'string'
              ? proposedPrimary
              : ''
        if (!targetId) {
          return NextResponse.json(
            { error: 'no merge target — payload.merged_into_id required' },
            { status: 400 },
          )
        }
        const rpc = await admin.rpc('merge_entities', {
          p_source_id: row.item_id,
          p_target_id: targetId,
          p_user_id: user.id,
          p_resolved_by: 'user',
        })
        if (rpc.error) {
          return mapRpcError(rpc.error.message)
        }
        effects.merge = rpc.data
        queueRowAlreadyClosed = true
      }
      // rejected | deferred | dismissed → no cascading effect.
    }
    // All other item_types: record-only at MVP.

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: 'Side-effect failed', detail: msg },
      { status: 500 },
    )
  }

  // --- 4. Record the resolution (if not already closed by an RPC) ---
  const resolutionPayload: Record<string, unknown> = { ...payload }
  if (!queueRowAlreadyClosed) {
    const { error: updErr } = await admin
      .from('review_queue')
      .update({
        resolved_at: new Date().toISOString(),
        resolution,
        resolution_payload: resolutionPayload,
        resolution_note: note,
        resolved_by: 'user',
      })
      .eq('id', row.id)
    if (updErr) {
      return NextResponse.json(
        { error: 'Failed to record resolution', detail: updErr.message },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({
    status: 'resolved',
    item_id: row.item_id,
    item_type: row.item_type,
    resolution,
    payload: resolutionPayload,
    note,
    effects,
  })
}

// ------------------------------------------------------------------
// Per-effect helpers
// ------------------------------------------------------------------

async function renameEntity(
  admin: ReturnType<typeof createAdminClient>,
  entityId: string,
  userId: string,
  newName: string,
  newAliases?: string[],
): Promise<{ entity: unknown } | { error: NextResponse }> {
  const { data: entRaw, error: loadErr } = await admin
    .from('entities')
    .select('id, user_id, type, canonical_name, aliases')
    .eq('id', entityId)
    .single()
  if (loadErr || !entRaw) {
    return { error: NextResponse.json({ error: 'Entity not found' }, { status: 404 }) }
  }
  const ent = entRaw as unknown as EntityRow
  if (ent.user_id !== userId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const existingAliases: string[] = Array.isArray(ent.aliases) ? ent.aliases : []
  let nextAliases = existingAliases.slice()

  if (newName !== ent.canonical_name) {
    updates.canonical_name = newName
    const lower = ent.canonical_name.toLowerCase()
    if (!nextAliases.some((a) => a.toLowerCase() === lower)) {
      nextAliases = [...nextAliases, ent.canonical_name]
    }
  }
  if (Array.isArray(newAliases)) {
    // Wholesale replace (matches PATCH /api/entity/[id] semantics).
    const seen = new Set<string>()
    nextAliases = []
    for (const a of newAliases) {
      const trimmed = a.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      nextAliases.push(trimmed)
    }
  }
  if (
    nextAliases.length !== existingAliases.length ||
    nextAliases.some((a, i) => a !== existingAliases[i])
  ) {
    updates.aliases = nextAliases.length > 0 ? nextAliases : null
  }

  const { data, error } = await admin
    .from('entities')
    .update(updates)
    .eq('id', entityId)
    .select('id, type, canonical_name, aliases')
    .single()
  if (error || !data) {
    return {
      error: NextResponse.json(
        { error: 'Failed to rename entity', detail: error?.message },
        { status: 500 },
      ),
    }
  }
  return { entity: data }
}

async function deleteEntity(
  admin: ReturnType<typeof createAdminClient>,
  entityId: string,
  userId: string,
): Promise<{ deleted_id: string; dependent_queue_rows_closed: number } | { error: NextResponse }> {
  const { data: entRaw, error: loadErr } = await admin
    .from('entities')
    .select('id, user_id')
    .eq('id', entityId)
    .single()
  if (loadErr || !entRaw) {
    return { error: NextResponse.json({ error: 'Entity not found' }, { status: 404 }) }
  }
  const ent = entRaw as unknown as { id: string; user_id: string }
  if (ent.user_id !== userId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  // Hard delete. Post-migration 20260530144509 the FK rules handle the
  // ripple effects:
  //   memory_entities.entity_id      ON DELETE CASCADE  → links auto-cleared
  //   assumption_log.entity_id       ON DELETE SET NULL → audit preserved
  //   relationships.subject/object   ON DELETE CASCADE  → edges removed
  //   coverage.entity_id             ON DELETE CASCADE  → rows removed
  //   syntheses/contacts/etc.        ON DELETE SET NULL → links nulled
  // No manual cleanup needed here — Postgres does the right thing.
  const { error: delErr } = await admin
    .from('entities')
    .delete()
    .eq('id', entityId)
  if (delErr) {
    return {
      error: NextResponse.json(
        { error: 'Failed to delete entity', detail: delErr.message },
        { status: 500 },
      ),
    }
  }

  // Cascade-close any other open review_queue rows that reference
  // this now-deleted entity by item_id. The most common case: an
  // entity_merge_proposal that listed this entity as the duplicate.
  // Once the entity is gone, the proposal has nothing to act on, so
  // we dismiss it with a reason field so the audit history makes
  // sense ("this didn't need user action — the underlying entity was
  // deleted").
  const { count: depCount, error: depErr } = await admin
    .from('review_queue')
    .update({
      resolved_at: new Date().toISOString(),
      resolution: 'dismissed',
      resolution_payload: { reason: 'source_entity_deleted' },
      resolved_by: 'system:entity_deleted',
    }, { count: 'exact' })
    .eq('user_id', userId)
    .eq('item_id', entityId)
    .is('resolved_at', null)
  if (depErr) {
    // Don't bubble — the primary action (entity delete) already
    // succeeded. Log and continue. The orphan row(s) can be cleaned
    // up by the user via Dismiss on the /review page.
    console.warn('[resolve] dependent queue cleanup failed:', depErr.message)
  }

  return { deleted_id: entityId, dependent_queue_rows_closed: depCount ?? 0 }
}

function mapRpcError(message: string): NextResponse {
  if (message.includes('not found')) {
    return NextResponse.json({ error: message }, { status: 404 })
  }
  if (message.includes('does not belong to user')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (
    message.includes('cannot merge entity into itself') ||
    message.includes('cannot merge entities of different types')
  ) {
    return NextResponse.json({ error: message }, { status: 400 })
  }
  return NextResponse.json(
    { error: 'Merge failed', detail: message },
    { status: 500 },
  )
}
