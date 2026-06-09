/**
 * Re-sequence a user's residence chain (Step 7 Slice 4b).
 *
 *   POST /api/globe/residence/reorder { orderedIds: string[] }
 *
 * orderedIds is the FULL set of the user's residence relationship ids in
 * the desired order. The reorder_residence_pins RPC is ownership- and
 * coverage-guarded (it rejects a list that doesn't cover exactly the
 * user's residences), so a stale or partial list fails loudly rather
 * than silently corrupting the sequence.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Body {
  orderedIds?: unknown
}

export async function POST(request: NextRequest) {
  const { data: { user } } = await createUserClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let payload: Body
  try { payload = (await request.json()) as Body } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const ids = payload.orderedIds
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === 'string')) {
    return NextResponse.json({ error: 'orderedIds must be a non-empty array of ids' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.rpc('reorder_residence_pins', {
    p_user_id: user.id,
    p_ordered_ids: ids,
  })
  if (error) {
    return NextResponse.json({ error: 'Failed to reorder', detail: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
