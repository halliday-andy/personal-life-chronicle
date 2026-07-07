/**
 * Person-anchored recollection capture (Slice 7.3).
 *
 * A recollection that belongs to a PERSON, not a place — "about Leola",
 * with no globe pin anywhere in sight. The memory is owner-authored and
 * saves FINAL (fixes go through the /memories owner-edit revision path);
 * content_raw and the when-phrase are stored verbatim — when_text is never
 * parsed (invariant #5, the Temporal Agent owns chronology later).
 *
 * The person link rides linkEntityToMemory, whose defaultRoleForType gives
 * persons role='participant' — never 'location', which is the load-bearing
 * pin discriminator (2026-07-07 incident rule).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { linkEntityToMemory, OwnerEditError } from '@/lib/memory/owner-edit'

export interface PersonRecollectionResult {
  memory: {
    id: string
    content_raw: string
    occurred_at_fuzzy: string | null
    time_precision: string | null
    is_draft: boolean
    created_at: string
  }
  link: { entity_id: string; role: string }
}

export async function createPersonAnchoredRecollection(
  admin: SupabaseClient,
  userId: string,
  personEntityId: string,
  body: string,
  when?: string | null,
): Promise<PersonRecollectionResult> {
  const content = body.trim()
  if (!content) throw new OwnerEditError('A recollection needs some text', 400)

  const { data: person, error: pErr } = await admin
    .from('entities')
    .select('id, user_id, type')
    .eq('id', personEntityId)
    .single()
  if (pErr || !person) throw new OwnerEditError('Person not found', 404)
  if (person.user_id !== userId) throw new OwnerEditError('Forbidden', 403)
  if (person.type !== 'person') {
    throw new OwnerEditError('Person-anchored recollections attach to people', 400)
  }

  const { data: memory, error: mErr } = await admin
    .from('memories')
    .insert({
      user_id: userId,
      content_raw: content,
      occurred_at_fuzzy: when?.trim() || null, // verbatim; never parsed
      time_precision: 'unknown',
      source: 'text_entry',
      confidence: 'certain',
      is_draft: false,
      capture_mode: 'freeform',
    })
    .select('id, content_raw, occurred_at_fuzzy, time_precision, is_draft, created_at')
    .single()
  if (mErr || !memory) {
    throw new OwnerEditError(`Could not save the recollection: ${mErr?.message}`, 500)
  }

  try {
    const link = await linkEntityToMemory(admin, userId, memory.id, personEntityId)
    return { memory, link: { entity_id: link.entity.id, role: link.role } }
  } catch (e) {
    // Don't leave an unlinked orphan in the vault if the link fails.
    await admin.from('memories').delete().eq('id', memory.id)
    throw e
  }
}
