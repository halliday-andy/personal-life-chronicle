/**
 * POST /api/memory/[id]/finalize — Accept a draft memory.
 *
 * Effects:
 *   1. memories.is_draft → false
 *   2. memories.metadata.skip_async_fanout → false (now informational; the
 *      async Inngest listeners only check this flag when memory/ingested
 *      fires, and we're not re-emitting it)
 *
 * No re-emit of memory/ingested. Per the orchestrator system prompt
 * (lib/agents/orchestrator/system.ts §3), the orchestrator already calls
 * classify_dimensions and extract_entities with persist=true at draft
 * creation. The memory_dimensions and memory_entities rows are real from
 * the start; finalisation just lifts the draft flag.
 *
 * Caveat: if the user edited content_raw via PATCH between create and
 * finalize, the tags/entities may be slightly stale. MVP accepts this —
 * the user can fix via inline chip editing. A future refinement could
 * re-run classification when content_raw was touched.
 *
 * Auth: user must own the memory. Admin client used after the ownership
 * check because RLS is still in stub mode (Step 13 will activate it).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const memoryId = params.id

  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: mem, error: loadErr } = await admin
    .from('memories')
    .select('id, user_id, is_draft, metadata')
    .eq('id', memoryId)
    .single()
  if (loadErr || !mem) {
    return NextResponse.json({ error: 'Memory not found', detail: loadErr?.message }, { status: 404 })
  }
  if (mem.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (mem.is_draft === false) {
    return NextResponse.json({ error: 'Memory already finalised', memory_id: memoryId }, { status: 400 })
  }

  const newMeta = {
    ...(mem.metadata as Record<string, unknown> | null ?? {}),
    skip_async_fanout: false,
    finalised_at: new Date().toISOString(),
  }
  const { error: updateErr } = await admin
    .from('memories')
    .update({ is_draft: false, metadata: newMeta })
    .eq('id', memoryId)
  if (updateErr) {
    return NextResponse.json({ error: 'Failed to finalize', detail: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ status: 'finalised', memory_id: memoryId })
}
