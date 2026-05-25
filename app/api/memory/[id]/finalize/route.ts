/**
 * POST /api/memory/[id]/finalize — Accept a draft memory.
 *
 * Effects:
 *   1. memories.is_draft → false
 *   2. memories.metadata.skip_async_fanout → false (so the next memory/ingested
 *      event causes the Tagger and Entity Inngest listeners to actually run)
 *   3. Emit memory/ingested with the user_id so the async fanout processes
 *      the (possibly user-edited) content_raw
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

  // Auth
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify ownership + draft state
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

  // Clear the skip flag and flip is_draft
  const newMeta = { ...(mem.metadata as Record<string, unknown> | null ?? {}), skip_async_fanout: false }
  const { error: updateErr } = await admin
    .from('memories')
    .update({ is_draft: false, metadata: newMeta })
    .eq('id', memoryId)
  if (updateErr) {
    return NextResponse.json({ error: 'Failed to finalize', detail: updateErr.message }, { status: 500 })
  }

  // Re-emit memory/ingested so Tagger + Entity Inngest listeners run for real now.
  try {
    await inngest.send({
      name: 'memory/ingested',
      data: { memory_id: memoryId, user_id: user.id },
    })
  } catch (sendErr) {
    console.warn('[finalize] inngest.send failed (memory still finalised)', sendErr)
  }

  return NextResponse.json({ status: 'finalised', memory_id: memoryId })
}
