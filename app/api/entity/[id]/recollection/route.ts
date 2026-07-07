/**
 * POST /api/entity/[id]/recollection — person-anchored recollection (Slice 7.3).
 *
 * Adds a recollection that belongs to a person, no globe pin required.
 * Body: { body: string, when?: string }. The memory saves FINAL with the
 * when-phrase stored verbatim (never parsed — Temporal Agent invariant);
 * the person link is role='participant' via linkEntityToMemory.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { OwnerEditError } from '@/lib/memory/owner-edit'
import { createPersonAnchoredRecollection } from '@/lib/memory/person-recollection'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { data: { user } } = await createUserClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Bad entity id' }, { status: 400 })

  let p: { body?: string; when?: string }
  try {
    p = (await request.json()) as { body?: string; when?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!p.body?.trim()) {
    return NextResponse.json({ error: 'A recollection needs some text' }, { status: 400 })
  }

  try {
    const result = await createPersonAnchoredRecollection(
      createAdminClient(), user.id, params.id, p.body, p.when ?? null,
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof OwnerEditError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json(
      { error: 'Could not save the recollection', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
