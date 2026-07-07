/**
 * GET /api/globe/entity-match?name=… — does the pin name the user is about
 * to place match an entity already in their chronicle? (2026-07-07)
 *
 * Exact case-insensitive match on canonical_name or alias, place +
 * organization types only (the ones a map pin can embody), excluding
 * entities that already have a globe pin. The PinModal offers "pin your
 * existing X?" — adopting it via create_residence_pin(p_entity_id) keeps
 * every linked recollection/context note instead of minting a twin
 * (the Phillips Exeter / Hanover-Dartmouth duplicate class).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { data: { user } } = await createUserClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const name = request.nextUrl.searchParams.get('name')?.trim() ?? ''
  if (!name) return NextResponse.json({ candidates: [] })
  const lower = name.toLowerCase()

  const admin = createAdminClient()
  const { data: rows, error } = await admin
    .from('entities')
    .select('id, type, canonical_name, aliases')
    .eq('user_id', user.id)
    .in('type', ['place', 'organization'])
  if (error) {
    return NextResponse.json({ error: 'Match lookup failed', detail: error.message }, { status: 500 })
  }

  const exact = (rows ?? []).filter(
    (e) =>
      e.canonical_name.toLowerCase() === lower ||
      ((e.aliases ?? []) as string[]).some((a) => a.toLowerCase() === lower),
  )
  if (exact.length === 0) return NextResponse.json({ candidates: [] })

  // Exclude entities that are already pins (globe_pin flag or legacy lived_at).
  const candidates: { id: string; type: string; canonical_name: string; mention_count: number }[] = []
  for (const e of exact) {
    const { data: pinRel } = await admin
      .from('relationships')
      .select('id, metadata, relationship_types!inner(code)')
      .eq('object_id', e.id)
      .limit(10)
    const isPinned = (pinRel ?? []).some(
      (r) =>
        (r.metadata as Record<string, unknown> | null)?.globe_pin === true ||
        (r.metadata as Record<string, unknown> | null)?.globe_pin === 'true' ||
        (Array.isArray(r.relationship_types) ? r.relationship_types[0] : r.relationship_types)?.code === 'lived_at',
    )
    if (isPinned) continue
    const { count } = await admin
      .from('memory_entities')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', e.id)
    candidates.push({
      id: e.id,
      type: e.type,
      canonical_name: e.canonical_name,
      mention_count: count ?? 0,
    })
  }

  return NextResponse.json({ candidates })
}
