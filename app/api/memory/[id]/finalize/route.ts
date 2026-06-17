/**
 * POST /api/memory/[id]/finalize — Accept a draft memory.
 *
 * Effects:
 *   1. memories.is_draft → false
 *   2. memories.metadata.skip_async_fanout → false
 *   3. Extraction backfill: if the memory has NO memory_entities rows, we
 *      re-emit memory/ingested so the async Entity + Tagger listeners run
 *      with persist=true (the skip flag is cleared above, so they no
 *      longer no-op).
 *
 * Why the backfill (2026-06-17, QA item 6): the orchestrator is *supposed*
 * to call extract_entities with persist=true at draft creation (system.ts
 * §3), but that depends on the model performing a second tool-use turn —
 * and it sometimes doesn't. A real capture ("Sir William Wallace…")
 * finalised with zero entities: no person extracted, no link to its place
 * pin, while the reply claimed it was "associated". Rather than trust the
 * model, we guarantee extraction here by reusing the same async pipeline
 * that already runs for normal memories. Gated on zero memory_entities so
 * the common (model-did-its-job) path skips the extra LLM calls. The
 * Entity/Tagger cores upsert with onConflict, so the backfill is
 * idempotent even in races.
 *
 * Auth: user must own the memory. Admin client used after the ownership
 * check because RLS is still in stub mode (Step 13 will activate it).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'

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

  // Extraction backfill (QA item 6). If no entities were ever linked to this
  // memory, the orchestrator's draft-time extract_entities turn didn't run —
  // re-emit memory/ingested so the Entity + Tagger listeners extract now.
  let extractionBackfilled = false
  const { count: entityCount } = await admin
    .from('memory_entities')
    .select('memory_id', { count: 'exact', head: true })
    .eq('memory_id', memoryId)
  if ((entityCount ?? 0) === 0) {
    try {
      await inngest.send({
        name: 'memory/ingested',
        data: { memory_id: memoryId, user_id: user.id },
      })
      extractionBackfilled = true
    } catch (sendErr) {
      // The memory is finalised regardless; extraction can be retried.
      console.warn('[finalize] extraction backfill send failed', sendErr)
    }
  }

  return NextResponse.json({ status: 'finalised', memory_id: memoryId, extractionBackfilled })
}
