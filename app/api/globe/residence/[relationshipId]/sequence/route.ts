/**
 * Spine membership for one primary residence (Trips & Travel U9, KTD10).
 *
 *   PUT /api/globe/residence/[relationshipId]/sequence
 *     { position: number }  — place an unsequenced home into the spine
 *                             at that slot (insert-and-shift);
 *     { position: null }    — demote a sequenced home to "not yet
 *                             placed" (the remainder closes up; the pin
 *                             keeps everything else).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PUT(req: NextRequest, { params }: { params: { relationshipId: string } }) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { position?: number | null }
  const admin = createAdminClient()

  if (body.position === null || body.position === undefined) {
    const { error } = await admin.rpc('unsequence_residence', {
      p_user_id: user.id,
      p_relationship_id: params.relationshipId,
    })
    if (error) {
      return NextResponse.json({ error: 'Failed to unsequence', detail: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, position: null })
  }

  const pos = Math.trunc(body.position)
  if (!Number.isFinite(pos) || pos < 0) {
    return NextResponse.json({ error: 'position must be a non-negative integer or null' }, { status: 400 })
  }
  const { data, error } = await admin.rpc('place_residence_in_spine', {
    p_user_id: user.id,
    p_relationship_id: params.relationshipId,
    p_position: pos,
  })
  if (error) {
    return NextResponse.json({ error: 'Failed to place in sequence', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, position: data })
}
