/**
 * Entity links on a memory.
 *
 * POST /api/memory/[id]/entity/[eid] — Link an entity by owner choice
 *   (micro-slice 2026-07-06). The graph-repair path for references
 *   extraction can't see (pronouns, unnamed roles): completes the
 *   relationship graph without rewriting the user's prose. Optional
 *   body { role }; defaults place → 'location', else 'participant'.
 *   Idempotent — relinking an existing (memory, entity, role) succeeds.
 *
 * DELETE /api/memory/[id]/entity/[eid] — Remove an entity link from a memory.
 *
 * Removes the (memory_id, entity_id) row(s) from memory_entities. The entity
 * itself stays (it may be linked from other memories). Optional `?role=...`
 * query param targets a specific role; without it, all roles for this
 * entity on this memory are removed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { linkEntityToMemory, OwnerEditError } from '@/lib/memory/owner-edit'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; eid: string } },
) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { role?: string }
  const role = typeof body.role === 'string' ? body.role : undefined

  try {
    const result = await linkEntityToMemory(createAdminClient(), user.id, params.id, params.eid, role)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof OwnerEditError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json(
      { error: 'Failed to link entity', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; eid: string } },
) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: mem, error: memErr } = await admin
    .from('memories')
    .select('user_id')
    .eq('id', params.id)
    .single()
  if (memErr || !mem) return NextResponse.json({ error: 'Memory not found' }, { status: 404 })
  if (mem.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const role = request.nextUrl.searchParams.get('role')
  let q = admin
    .from('memory_entities')
    .delete()
    .eq('memory_id', params.id)
    .eq('entity_id', params.eid)
  if (role) q = q.eq('role', role)

  const { error } = await q
  if (error) {
    return NextResponse.json({ error: 'Failed to remove entity link', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({
    status: 'removed',
    memory_id: params.id,
    entity_id: params.eid,
    role: role ?? 'all',
  })
}
