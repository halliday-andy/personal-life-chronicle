/**
 * Owner edits on memories — the Recollections-surface editing core
 * (micro-slice 2026-07-06).
 *
 * Two capabilities, both owner-only, both preserving the Raw Vault
 * invariant (#1):
 *
 *   ownerEditMemory   — edit content_raw / occurred_at_fuzzy /
 *     time_precision / private_notes. Draft text edits in place; a
 *     FINALIZED content edit first writes the prior content_raw into
 *     memory_revisions (revision_type 'factual_correction'), then
 *     overwrites — the same owner-edit pattern update_residence_pin has
 *     used on the globe since Slice 4a. Temporal metadata and
 *     private_notes edit freely at any status (they are not the verbatim
 *     narrative).
 *
 *   linkEntityToMemory — add a memory_entities row by owner choice. This
 *     is the graph-repair path for references extraction can't see
 *     (pronouns: "she" = Leola Lapides), letting the user complete the
 *     relationship graph WITHOUT rewriting their own prose. Default role
 *     follows the extraction convention: place → 'location', everything
 *     else → 'participant'. Idempotent (the PK is memory+entity+role).
 *
 * Kept out of the route handlers so verify scripts can exercise the
 * logic directly (npx tsx pattern).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export class OwnerEditError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export interface OwnerEditFields {
  content_raw?: string
  occurred_at_fuzzy?: string | null
  time_precision?: string
  private_notes?: string | null
}

export interface OwnerEditResult {
  memory: {
    id: string
    content_raw: string
    occurred_at_fuzzy: string | null
    time_precision: string | null
    is_draft: boolean
    private_notes: string | null
  }
  revision_saved: boolean
}

export async function ownerEditMemory(
  admin: SupabaseClient,
  userId: string,
  memoryId: string,
  fields: OwnerEditFields,
): Promise<OwnerEditResult> {
  const { data: mem, error: memErr } = await admin
    .from('memories')
    .select('id, user_id, is_draft, content_raw')
    .eq('id', memoryId)
    .single()
  if (memErr || !mem) throw new OwnerEditError('Memory not found', 404)
  if (mem.user_id !== userId) throw new OwnerEditError('Forbidden', 403)

  const updates: Record<string, unknown> = {}
  if (typeof fields.content_raw === 'string') {
    if (!fields.content_raw.trim()) throw new OwnerEditError('content_raw cannot be empty', 400)
    updates.content_raw = fields.content_raw
  }
  if (fields.occurred_at_fuzzy !== undefined) updates.occurred_at_fuzzy = fields.occurred_at_fuzzy
  if (fields.time_precision !== undefined) updates.time_precision = fields.time_precision
  if (fields.private_notes !== undefined) {
    // Replace mode: empty/null clears (owner-initiated direct edit; the
    // orchestrator's append semantics live in flag_for_private_notes).
    updates.private_notes =
      fields.private_notes === null || fields.private_notes === '' ? null : fields.private_notes
  }
  if (Object.keys(updates).length === 0) throw new OwnerEditError('No fields supplied', 400)
  updates.updated_at = new Date().toISOString()

  // Finalized content edit → preserve the original as a revision FIRST.
  let revision_saved = false
  const newRaw = updates.content_raw as string | undefined
  if (mem.is_draft === false && newRaw !== undefined && newRaw !== mem.content_raw) {
    const { error: revErr } = await admin.from('memory_revisions').insert({
      user_id: userId,
      source_memory_id: memoryId,
      revision_type: 'factual_correction',
      original_excerpt: mem.content_raw,
      revised_content: newRaw,
      user_note: 'Owner edit via Recollections',
    })
    if (revErr) throw new OwnerEditError(`Could not preserve the original as a revision: ${revErr.message}`, 500)
    revision_saved = true
  }

  const { data, error } = await admin
    .from('memories')
    .update(updates)
    .eq('id', memoryId)
    .select('id, content_raw, occurred_at_fuzzy, time_precision, is_draft, private_notes')
    .single()
  if (error || !data) throw new OwnerEditError(`Failed to update: ${error?.message ?? 'no row'}`, 500)

  return { memory: data as OwnerEditResult['memory'], revision_saved }
}

export interface LinkEntityResult {
  entity: { id: string; canonical_name: string; type: string }
  role: string
  already_linked: boolean
}

export function defaultRoleForType(entityType: string): string {
  return entityType === 'place' ? 'location' : 'participant'
}

export async function linkEntityToMemory(
  admin: SupabaseClient,
  userId: string,
  memoryId: string,
  entityId: string,
  role?: string,
): Promise<LinkEntityResult> {
  const { data: mem, error: memErr } = await admin
    .from('memories')
    .select('id, user_id')
    .eq('id', memoryId)
    .single()
  if (memErr || !mem) throw new OwnerEditError('Memory not found', 404)
  if (mem.user_id !== userId) throw new OwnerEditError('Forbidden', 403)

  const { data: ent, error: entErr } = await admin
    .from('entities')
    .select('id, user_id, canonical_name, type')
    .eq('id', entityId)
    .single()
  if (entErr || !ent) throw new OwnerEditError('Entity not found', 404)
  if (ent.user_id !== userId) throw new OwnerEditError('Forbidden', 403)

  const linkRole = role?.trim() || defaultRoleForType(ent.type)

  const { error: insErr } = await admin.from('memory_entities').insert({
    memory_id: memoryId,
    entity_id: entityId,
    role: linkRole,
    is_primary: false,
    confidence: 1.0, // owner-stated, not inferred
  })

  // 23505 = unique_violation on the (memory, entity, role) PK — the link
  // already exists; treat as success (idempotent).
  let already_linked = false
  if (insErr) {
    if (insErr.code === '23505') already_linked = true
    else throw new OwnerEditError(`Could not link: ${insErr.message}`, 500)
  }

  return {
    entity: { id: ent.id, canonical_name: ent.canonical_name, type: ent.type },
    role: linkRole,
    already_linked,
  }
}
