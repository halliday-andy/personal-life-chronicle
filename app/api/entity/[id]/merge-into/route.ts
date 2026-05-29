/**
 * POST /api/entity/[id]/merge-into — Merge this entity (source) into target.
 *
 * Path param  id          UUID of the SOURCE entity — will be deleted.
 * Body        { target_id: UUID }   The TARGET entity — kept and enriched.
 *
 * The actual work happens in the merge_entities() PL/pgSQL function
 * (supabase/migrations/20260528222311_merge_entities_function.sql) so
 * the multi-table re-point is atomic. This route is a thin wrapper
 * that does auth, validates the body, and translates the function's
 * domain errors into HTTP status codes.
 *
 * On success returns the function's JSONB summary:
 *   { merged_into, source, memory_entities_moved, entity_media_moved,
 *     review_queue_closed, target_aliases }
 *
 * Also called internally from the resolve endpoint's 'merged'
 * dispatch (Step 6g-3) via supabase.rpc — not via fetch.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sourceId = params.id

  let body: { target_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 })
  }
  if (typeof body.target_id !== 'string' || body.target_id.length === 0) {
    return NextResponse.json({ error: 'target_id is required' }, { status: 400 })
  }
  const targetId = body.target_id

  if (sourceId === targetId) {
    return NextResponse.json(
      { error: 'cannot merge entity into itself' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('merge_entities', {
    p_source_id: sourceId,
    p_target_id: targetId,
    p_user_id: user.id,
    p_resolved_by: 'user',
  })

  if (error) {
    const msg = error.message || ''
    if (msg.includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    if (msg.includes('does not belong to user')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (
      msg.includes('cannot merge entity into itself') ||
      msg.includes('cannot merge entities of different types')
    ) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json(
      { error: 'Merge failed', detail: msg },
      { status: 500 },
    )
  }

  return NextResponse.json({ status: 'merged', ...(data as Record<string, unknown>) })
}
