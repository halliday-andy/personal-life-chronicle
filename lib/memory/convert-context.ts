/**
 * Convert a recollection into a context note (2026-07-10, Andy's QA).
 *
 * Research captured BEFORE the context layer existed lives as memories
 * (the Wallace-clan history, hand-linked 2026-06-17) — indistinguishable
 * from first-person recollections because structurally it IS one. This
 * moves such a memory to its proper layer: the verbatim text becomes an
 * entity_context_notes row on the entity it's about, and the memory row
 * is deleted (owner-deliberate, two-click-confirmed in the UI).
 *
 * Guards:
 *  - ownership on both sides;
 *  - NEVER a globe pin's own overview (capture_mode='globe_onboarding' —
 *    deleting one would strip its pin);
 *  - refuses memories carrying private_notes (move those first — silent
 *    destruction of the owner-only layer is worse than an extra step).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { OwnerEditError } from '@/lib/memory/owner-edit'

export interface ConvertResult {
  note: { id: string; entity_id: string; visibility: string }
  deleted_memory_id: string
  entity_name: string
}

export async function convertMemoryToContext(
  admin: SupabaseClient,
  userId: string,
  memoryId: string,
  entityId: string,
  visibility: 'shareable' | 'private',
): Promise<ConvertResult> {
  const { data: mem, error: memErr } = await admin
    .from('memories')
    .select('id, user_id, content_raw, capture_mode, private_notes')
    .eq('id', memoryId)
    .single()
  if (memErr || !mem) throw new OwnerEditError('Memory not found', 404)
  if (mem.user_id !== userId) throw new OwnerEditError('Forbidden', 403)
  if (mem.capture_mode === 'globe_onboarding') {
    throw new OwnerEditError(
      "This is a pin's own recollection — converting it would strip the pin. Edit it on the globe instead.",
      400,
    )
  }
  if (mem.private_notes && String(mem.private_notes).trim()) {
    throw new OwnerEditError(
      'This memory carries private notes — move or clear them first so nothing is silently destroyed.',
      400,
    )
  }
  if (!mem.content_raw?.trim()) throw new OwnerEditError('Nothing to convert — the memory is empty', 400)

  const { data: ent, error: entErr } = await admin
    .from('entities')
    .select('id, user_id, canonical_name')
    .eq('id', entityId)
    .single()
  if (entErr || !ent) throw new OwnerEditError('Entity not found', 404)
  if (ent.user_id !== userId) throw new OwnerEditError('Forbidden', 403)

  const { data: note, error: noteErr } = await admin
    .from('entity_context_notes')
    .insert({
      user_id: userId,
      entity_id: entityId,
      body: mem.content_raw, // verbatim — the text changes layers, not words
      created_by: 'owner',
      visibility,
    })
    .select('id, entity_id, visibility')
    .single()
  if (noteErr || !note) {
    throw new OwnerEditError(`Could not create the context note: ${noteErr?.message}`, 500)
  }

  const { error: delErr } = await admin.from('memories').delete().eq('id', memoryId)
  if (delErr) {
    // Don't leave the text in both layers: roll the note back and report.
    await admin.from('entity_context_notes').delete().eq('id', note.id)
    throw new OwnerEditError(`Could not remove the recollection: ${delErr.message}`, 500)
  }

  return { note, deleted_memory_id: memoryId, entity_name: ent.canonical_name }
}
