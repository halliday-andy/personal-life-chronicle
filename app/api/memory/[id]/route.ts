/**
 * Memory resource endpoints.
 *
 *   DELETE /api/memory/[id] — Hard-delete a memory. Drafts delete freely
 *     (the Decline action). Finalised memories additionally require
 *     ?confirm=final — owner curation (duplicates, test entries) decided
 *     with Andy 2026-06-13; the Raw Vault invariant binds agents and
 *     synthesis, not the owner's right to remove their own record.
 *     ON DELETE CASCADE covers memory_dimensions, memory_entities,
 *     memory_media, and memory_revisions; assumption_log refs SET NULL.
 *     Capture_submissions and entities are preserved (entities may be
 *     linked from other memories; submissions are lineage records).
 *
 *   PATCH /api/memory/[id] — Edit memory fields (lib/memory/owner-edit.ts).
 *
 *     Draft text edits apply in place (composition grace period). A
 *     FINALIZED content_raw edit is revision-backed: the prior text is
 *     written to memory_revisions before the overwrite — the same
 *     owner-edit pattern the globe's update_residence_pin has used since
 *     Slice 4a (Raw Vault invariant: immutable to agents/synthesis;
 *     owner corrections are revision-preserved, The Stroll pathway C).
 *     Response carries revision_saved so the UI can say so.
 *
 *     Owner-only metadata (private_notes, Step 6h) and temporal metadata
 *     (occurred_at_fuzzy, time_precision) edit freely at any status —
 *     they are not the verbatim narrative.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ownerEditMemory, OwnerEditError } from '@/lib/memory/owner-edit'

async function authAndOwn(memoryId: string): Promise<
  | { ok: true; userId: string; memory: { id: string; user_id: string; is_draft: boolean } }
  | { ok: false; response: NextResponse }
> {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: mem, error } = await admin
    .from('memories')
    .select('id, user_id, is_draft')
    .eq('id', memoryId)
    .single()
  if (error || !mem) {
    return { ok: false, response: NextResponse.json({ error: 'Memory not found', detail: error?.message }, { status: 404 }) }
  }
  if (mem.user_id !== user.id) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true, userId: user.id, memory: mem }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authAndOwn(params.id)
  if (!auth.ok) return auth.response
  if (auth.memory.is_draft === false && req.nextUrl.searchParams.get('confirm') !== 'final') {
    return NextResponse.json(
      {
        error: 'Deleting a finalised memory requires explicit confirmation',
        detail: 'Pass ?confirm=final. This is permanent: the verbatim text and its revisions are removed.',
      },
      { status: 400 },
    )
  }
  const admin = createAdminClient()
  const { error } = await admin.from('memories').delete().eq('id', params.id)
  if (error) {
    return NextResponse.json({ error: 'Failed to delete', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ status: 'deleted', memory_id: params.id })
}

interface PatchBody {
  // Raw-Vault-bound (drafts only)
  content_raw?: string
  occurred_at_fuzzy?: string | null
  time_precision?: 'unknown' | 'decade' | 'year' | 'season' | 'month' | 'day'
  // Owner-only metadata (any time)
  private_notes?: string | null
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authAndOwn(params.id)
  if (!auth.ok) return auth.response

  const body = (await request.json()) as PatchBody

  try {
    const result = await ownerEditMemory(createAdminClient(), auth.userId, params.id, {
      content_raw: body.content_raw,
      occurred_at_fuzzy: body.occurred_at_fuzzy,
      time_precision: body.time_precision,
      private_notes: body.private_notes,
    })
    return NextResponse.json({ ...result.memory, revision_saved: result.revision_saved })
  } catch (err) {
    if (err instanceof OwnerEditError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json(
      { error: 'Failed to update', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
