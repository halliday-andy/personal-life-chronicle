/**
 * POST /api/memory/[id]/convert-to-context (2026-07-10)
 *
 * Move a research-y recollection to the context layer: verbatim text
 * becomes an entity_context_notes row on the chosen entity; the memory
 * row is deleted. Body: { entityId: string, visibility?: 'shareable'|'private' }.
 * Guards live in lib/memory/convert-context.ts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { OwnerEditError } from '@/lib/memory/owner-edit'
import { convertMemoryToContext } from '@/lib/memory/convert-context'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { data: { user } } = await createUserClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Bad memory id' }, { status: 400 })

  let p: { entityId?: string; visibility?: string }
  try {
    p = (await request.json()) as { entityId?: string; visibility?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!p.entityId || !UUID_RE.test(p.entityId)) {
    return NextResponse.json({ error: 'entityId is required' }, { status: 400 })
  }
  const visibility = p.visibility === 'private' ? 'private' : 'shareable'

  try {
    const result = await convertMemoryToContext(createAdminClient(), user.id, params.id, p.entityId, visibility)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof OwnerEditError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json(
      { error: 'Conversion failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
