/**
 * Memory resource endpoints.
 *
 *   DELETE /api/memory/[id] — Decline a draft memory. Hard-deletes. ON DELETE
 *     CASCADE on memory_dimensions and memory_entities cleans up link rows.
 *     Capture_submissions and entities are preserved (entities may be linked
 *     from other memories; submissions are lineage records).
 *
 *   PATCH /api/memory/[id] — Edit a draft memory's content_raw,
 *     occurred_at_fuzzy, or time_precision. Only allowed when is_draft=true;
 *     final-memory edits go through memory_revisions in 6g+ to preserve the
 *     Raw Vault invariant (content_raw never modified after finalization).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authAndOwn(params.id)
  if (!auth.ok) return auth.response
  if (auth.memory.is_draft === false) {
    return NextResponse.json(
      {
        error: 'Cannot delete a finalised memory via this endpoint',
        detail: 'Final-memory soft-delete via memory_revisions lands in Step 6g+',
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
  content_raw?: string
  occurred_at_fuzzy?: string | null
  time_precision?: 'unknown' | 'decade' | 'year' | 'season' | 'month' | 'day'
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authAndOwn(params.id)
  if (!auth.ok) return auth.response
  if (auth.memory.is_draft === false) {
    return NextResponse.json(
      {
        error: 'Cannot edit content_raw on a finalised memory',
        detail: 'Final-memory edits go through memory_revisions (Step 6g+). The Raw Vault invariant preserves content_raw immutable after finalisation.',
      },
      { status: 400 },
    )
  }

  const body = (await request.json()) as PatchBody
  const updates: Record<string, unknown> = {}
  if (typeof body.content_raw === 'string') {
    const trimmed = body.content_raw.trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'content_raw cannot be empty' }, { status: 400 })
    }
    updates.content_raw = body.content_raw
  }
  if (body.occurred_at_fuzzy !== undefined) updates.occurred_at_fuzzy = body.occurred_at_fuzzy
  if (body.time_precision !== undefined) updates.time_precision = body.time_precision
  updates.updated_at = new Date().toISOString()

  if (Object.keys(updates).length === 1) {
    // Only updated_at — nothing meaningful to change.
    return NextResponse.json({ error: 'No fields supplied' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('memories')
    .update(updates)
    .eq('id', params.id)
    .select('id, content_raw, occurred_at_fuzzy, time_precision, is_draft')
    .single()
  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update', detail: error?.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
