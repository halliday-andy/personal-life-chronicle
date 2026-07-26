/**
 * Owner-editable pin facts (design: docs/plans/2026-07-10-pin-facts-editor-enhancement.md).
 *
 *   PATCH — the owner sets one or more of the four facts. Every field sent
 *           becomes STICKY: re-extraction will never overwrite it again
 *           (per-field provenance in metadata.facts_owner_edited). Sending
 *           null is a real edit — the owner clearing a field — and sticks
 *           just the same, so Claude can't "helpfully" refill it.
 *   POST   — refresh the facts from the recollection: re-runs extraction via
 *           the same globe/pin.saved event a text save emits, so it also
 *           re-resolves people/organisation stubs. Sticky fields survive.
 *
 * A separate route from the pin PATCH on purpose: that endpoint takes the
 * FULL field set on every save, so folding facts into it would make an
 * untouched fact indistinguishable from a cleared one — and every save would
 * mark all four owner-edited, freezing out extraction entirely.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEventQuick } from '@/lib/inngest/send-quick'
import {
  STICKY_FACT_FIELDS,
  applyOwnerFactEdit,
  mergeFactsIntoMetadata,
  readCurrentFacts,
  readOwnerEditedFields,
  type StickyFacts,
} from '@/lib/globe/sticky-facts'
import { MOVE_REASONS, RESIDENCE_TYPES } from '@/lib/globe/fact-vocabulary'

async function getUser() {
  const { data: { user } } = await createUserClient().auth.getUser()
  return user
}

/** Load the pin's relationship, enforcing ownership. */
async function loadOwnedRelationship(relationshipId: string, userId: string) {
  const admin = createAdminClient()
  const { data: rel } = await admin
    .from('relationships').select('id, user_id, object_id, metadata').eq('id', relationshipId).maybeSingle()
  if (!rel || rel.user_id !== userId) return null
  return { admin, rel }
}

/** Trim to a string, or null for empty/absent — an empty box means "cleared". */
function asText(v: unknown): string | null {
  if (v === null) return null
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s.length > 0 ? s : null
}

export async function PATCH(request: NextRequest, { params }: { params: { relationshipId: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only fields actually PRESENT in the payload are edits. An absent field is
  // untouched (and stays extraction's to fill); a present null is a clear.
  const edits: Partial<StickyFacts> = {}
  for (const field of STICKY_FACT_FIELDS) {
    if (!(field in body)) continue
    const value = asText(body[field])
    if (field === 'residence_type' && value !== null && !(RESIDENCE_TYPES as readonly string[]).includes(value)) {
      return NextResponse.json({ error: `Unknown residence type: ${value}` }, { status: 400 })
    }
    if (field === 'move_reason' && value !== null && !(MOVE_REASONS as readonly string[]).includes(value)) {
      return NextResponse.json({ error: `Unknown move reason: ${value}` }, { status: 400 })
    }
    edits[field] = value
  }
  if (Object.keys(edits).length === 0) {
    return NextResponse.json({ error: 'No fact fields in payload' }, { status: 400 })
  }

  const owned = await loadOwnedRelationship(params.relationshipId, user.id)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { admin, rel } = owned

  const metadata = (rel.metadata ?? {}) as Record<string, unknown>
  const { facts, ownerEdited } = applyOwnerFactEdit({
    current: readCurrentFacts(metadata),
    edits,
    ownerEdited: readOwnerEditedFields(metadata),
  })

  const { error } = await admin
    .from('relationships')
    .update({ metadata: mergeFactsIntoMetadata({ metadata, facts, ownerEdited }) })
    .eq('id', params.relationshipId)
  if (error) return NextResponse.json({ error: 'Could not save facts' }, { status: 500 })

  return NextResponse.json({ ok: true, facts, factsOwnerEdited: ownerEdited })
}

export async function POST(_request: NextRequest, { params }: { params: { relationshipId: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const owned = await loadOwnedRelationship(params.relationshipId, user.id)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { admin, rel } = owned

  // Extraction reads the pin's OWN recollection, so there must be one. Same
  // scoping as the GET: role='location' is the pin-overview discriminator
  // (mention-links carry role='mentioned' and must never be re-extracted as
  // if they were this pin's text), globe_onboarding capture mode, oldest first.
  const { data: mem } = await admin
    .from('memories')
    .select('id, memory_entities!inner(entity_id, role)')
    .eq('memory_entities.entity_id', rel.object_id)
    .eq('memory_entities.role', 'location')
    .eq('capture_mode', 'globe_onboarding')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const memoryId = mem?.id ?? null
  if (!memoryId) {
    return NextResponse.json({ error: 'This pin has no recollection to read yet' }, { status: 409 })
  }

  await sendEventQuick({
    name: 'globe/pin.saved',
    data: { user_id: user.id, relationship_id: params.relationshipId, memory_id: memoryId },
  })
  return NextResponse.json({ ok: true, queued: true })
}
