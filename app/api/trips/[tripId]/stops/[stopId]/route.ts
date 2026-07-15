/**
 * One itinerary stop (plan U2).
 *
 *   DELETE /api/trips/[tripId]/stops/[stopId] — remove the stop; the
 *     rest of its leg resequences. The stop's pin is untouched.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(_req: NextRequest, { params }: { params: { tripId: string; stopId: string } }) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin.rpc('remove_trip_stop', {
    p_user_id: user.id,
    p_stop_id: params.stopId,
  })
  if (error) {
    return NextResponse.json({ error: 'Failed to remove stop', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
