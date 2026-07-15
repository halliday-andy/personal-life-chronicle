/**
 * Home Base (Trips & Travel U7, KTD8 / R16).
 *
 *   PUT /api/trips/home-base — designate one primary residence as the
 *     reusable default trip origin ({ relationshipId }), or clear it
 *     ({ relationshipId: null }). One at a time, enforced by the RPC.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PUT(req: NextRequest) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { relationshipId?: string | null }
  const admin = createAdminClient()
  const { error } = await admin.rpc('set_home_base', {
    p_user_id: user.id,
    p_relationship_id: body.relationshipId ?? null,
  })
  if (error) {
    return NextResponse.json({ error: 'Failed to set home base', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
