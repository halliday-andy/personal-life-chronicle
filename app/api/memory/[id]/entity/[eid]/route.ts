/**
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
