/**
 * Owner-asserted order of the places within a chapter.
 *
 *   PATCH — persist the order of the pins anchored to this one. Body:
 *           `{ order: string[] }`, the anchor-sibling relationship ids in the
 *           sequence the owner dragged them into.
 *
 * Why an owner assertion rather than a computed sort: `when_text` is free
 * prose ("Summers 1970 and 1971"), and invariant #5 keeps structured dates out
 * of capture, so chronological ordering is not available to us and shouldn't
 * be faked. Andy's call (2026-07-26): "instead of forcing the user to follow a
 * convention in the assertion of time ranges, I'd prefer this be
 * drag-and-drop orderable." Same model as the photo carousel.
 *
 * The WHOLE sibling list is written on every reorder, so a chapter never
 * carries a half-positioned mix (see assignChapterPositions).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assignChapterPositions } from '@/lib/journey/chapter-order'

export async function PATCH(request: NextRequest, { params }: { params: { relationshipId: string } }) {
  const { data: { user } } = await createUserClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { order?: unknown }
  try { body = (await request.json()) as { order?: unknown } } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const order = Array.isArray(body.order) ? body.order.filter((x): x is string => typeof x === 'string') : null
  if (!order || order.length === 0) {
    return NextResponse.json({ error: 'Expected { order: string[] }' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Ownership of the chapter itself.
  const { data: host } = await admin
    .from('relationships').select('id, user_id').eq('id', params.relationshipId).maybeSingle()
  if (!host || host.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Only pins actually anchored to THIS chapter may be positioned by it — a
  // reorder must never be able to reach into another chapter, and an id the
  // client no longer has (a pin deleted or re-anchored in another tab) is
  // dropped rather than written blindly.
  const { data: siblings } = await admin
    .from('relationships')
    .select('id')
    .eq('user_id', user.id)
    .eq('anchor_residence_id', params.relationshipId)
  const owned = new Set((siblings ?? []).map((s) => s.id))
  const filtered = order.filter((id) => owned.has(id))
  // Any sibling the client didn't mention (added elsewhere since the page
  // loaded) keeps its place by trailing, rather than being silently unpositioned.
  for (const id of Array.from(owned)) if (!filtered.includes(id)) filtered.push(id)
  if (filtered.length === 0) {
    return NextResponse.json({ error: 'No anchored pins to order' }, { status: 400 })
  }

  const positions = assignChapterPositions(filtered)
  const results = await Promise.all(
    positions.map((p) =>
      admin
        .from('relationships')
        .update({ anchor_sort_order: p.anchor_sort_order })
        .eq('id', p.relationship_id)
        .eq('user_id', user.id),
    ),
  )
  if (results.some((r) => r.error)) {
    return NextResponse.json({ error: 'Could not save the order' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, order: positions.map((p) => p.relationship_id) })
}
