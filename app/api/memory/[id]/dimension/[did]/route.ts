/**
 * DELETE /api/memory/[id]/dimension/[did] — Remove a tag link from a memory.
 *
 * Removes the (memory_id, dimension_id) row from memory_dimensions. The
 * dimension itself stays (it's a taxonomy node, shared across all users).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; did: string } },
) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  // Verify ownership of the memory
  const { data: mem, error: memErr } = await admin
    .from('memories')
    .select('user_id')
    .eq('id', params.id)
    .single()
  if (memErr || !mem) return NextResponse.json({ error: 'Memory not found' }, { status: 404 })
  if (mem.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await admin
    .from('memory_dimensions')
    .delete()
    .eq('memory_id', params.id)
    .eq('dimension_id', params.did)
  if (error) {
    return NextResponse.json({ error: 'Failed to remove tag', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ status: 'removed', memory_id: params.id, dimension_id: params.did })
}
