/**
 * GET /api/review-queue — List the user's review queue items.
 *
 * Powers the /review page (Step 6g-5) and the dashboard's open-count
 * chip (Step 6g-6).
 *
 * Query parameters
 *   status     'open' (default) | 'resolved' | 'all'
 *   item_type  optional — filter to a single item_type value
 *   limit      default 100, max 500
 *
 * Response
 *   {
 *     items: ReviewQueueItem[],   // ordered by surfaced_at DESC
 *     counts: {
 *       by_type: Record<item_type, number>,   // open-only, all types
 *       total_open: number,
 *       total_returned: number
 *     }
 *   }
 *
 * Each item is hydrated with the referenced entity (for entity_*
 * types) and/or referenced memory (for memory_elaboration_needed,
 * synthesis_stale, sensitive_promotion). Hydration uses the live row,
 * so a renamed entity's current canonical_name reflects in the queue
 * even if context_json captured the old name.
 *
 * Counts.by_type is always over OPEN items regardless of the status
 * filter, so the UI can show "All / Open / Resolved" tabs with
 * accurate per-type counts on the Open tab.
 *
 * Auth: user from session; admin client for queries because RLS is
 * still in stub mode (Step 13 will activate it).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_LIMIT = 500
const DEFAULT_LIMIT = 100

type ItemType =
  | 'entity_merge_proposal'
  | 'entity_confirmation_needed'
  | 'temporal_constraint'
  | 'sensitive_promotion'
  | 'synthesis_stale'
  | 'contribution_review'
  | 'assumption_review'
  | 'memory_elaboration_needed'

const ENTITY_LINKED_TYPES: ItemType[] = [
  'entity_merge_proposal',
  'entity_confirmation_needed',
]

const MEMORY_LINKED_TYPES: ItemType[] = [
  'memory_elaboration_needed',
  'synthesis_stale',
  'sensitive_promotion',
]

type ReviewQueueRow = {
  id: string
  item_type: string
  item_id: string
  context_json: Record<string, unknown> | null
  priority: number
  surfaced_at: string
  resolved_at: string | null
  resolution: string | null
  resolution_payload: Record<string, unknown> | null
  resolution_note: string | null
  resolved_by: string | null
  created_at: string
}

type EntityRow = {
  id: string
  type: string
  canonical_name: string
  aliases: string[] | null
}

type MemoryRow = {
  id: string
  content_raw: string
  occurred_at_fuzzy: string | null
  time_precision: string | null
  is_draft: boolean
}

export async function GET(request: NextRequest) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const status = (url.searchParams.get('status') ?? 'open').toLowerCase()
  const itemTypeFilter = url.searchParams.get('item_type')
  const limitRaw = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT)
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), MAX_LIMIT)
    : DEFAULT_LIMIT

  if (!['open', 'resolved', 'all'].includes(status)) {
    return NextResponse.json(
      { error: "status must be one of: open, resolved, all" },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  // --- 1. List query --------------------------------------------------
  let query = admin
    .from('review_queue')
    .select(
      'id, item_type, item_id, context_json, priority, surfaced_at, ' +
      'resolved_at, resolution, resolution_payload, resolution_note, resolved_by, ' +
      'created_at',
    )
    .eq('user_id', user.id)
    .order('surfaced_at', { ascending: false })
    .limit(limit)

  if (status === 'open') query = query.is('resolved_at', null)
  else if (status === 'resolved') query = query.not('resolved_at', 'is', null)

  if (itemTypeFilter) query = query.eq('item_type', itemTypeFilter)

  const { data: items, error: listErr } = await query
  if (listErr) {
    return NextResponse.json(
      { error: 'Failed to list review queue', detail: listErr.message },
      { status: 500 },
    )
  }
  const rows = (items ?? []) as unknown as ReviewQueueRow[]

  // --- 2. Hydration ---------------------------------------------------
  const entityIds = new Set<string>()
  const memoryIds = new Set<string>()
  for (const row of rows) {
    if (ENTITY_LINKED_TYPES.includes(row.item_type as ItemType)) {
      entityIds.add(row.item_id)
      // entity_merge_proposal also references proposed_primary in context.
      const primary = (row.context_json as Record<string, unknown> | null)
        ?.proposed_primary
      if (typeof primary === 'string') entityIds.add(primary)
    }
    if (MEMORY_LINKED_TYPES.includes(row.item_type as ItemType)) {
      memoryIds.add(row.item_id)
    }
  }

  const [entitiesRes, memoriesRes] = await Promise.all([
    entityIds.size > 0
      ? admin
          .from('entities')
          .select('id, type, canonical_name, aliases')
          .in('id', Array.from(entityIds))
      : Promise.resolve({ data: [], error: null }),
    memoryIds.size > 0
      ? admin
          .from('memories')
          .select('id, content_raw, occurred_at_fuzzy, time_precision, is_draft')
          .in('id', Array.from(memoryIds))
      : Promise.resolve({ data: [], error: null }),
  ])

  if (entitiesRes.error) {
    return NextResponse.json(
      { error: 'Failed to hydrate entities', detail: entitiesRes.error.message },
      { status: 500 },
    )
  }
  if (memoriesRes.error) {
    return NextResponse.json(
      { error: 'Failed to hydrate memories', detail: memoriesRes.error.message },
      { status: 500 },
    )
  }

  const entityRows = (entitiesRes.data ?? []) as unknown as EntityRow[]
  const memoryRows = (memoriesRes.data ?? []) as unknown as MemoryRow[]
  const entityById = new Map<string, EntityRow>()
  for (const e of entityRows) entityById.set(e.id, e)
  const memoryById = new Map<string, MemoryRow>()
  for (const m of memoryRows) memoryById.set(m.id, m)

  const hydrated = rows.map((row) => {
    const enriched: Record<string, unknown> = { ...row }
    if (ENTITY_LINKED_TYPES.includes(row.item_type as ItemType)) {
      enriched.entity = entityById.get(row.item_id) ?? null
      const primary = (row.context_json as Record<string, unknown> | null)
        ?.proposed_primary
      if (typeof primary === 'string') {
        enriched.proposed_primary_entity = entityById.get(primary) ?? null
      }
    }
    if (MEMORY_LINKED_TYPES.includes(row.item_type as ItemType)) {
      enriched.memory = memoryById.get(row.item_id) ?? null
    }
    return enriched
  })

  // --- 3. Counts (always open-only, all types) ------------------------
  const { data: openRows, error: countErr } = await admin
    .from('review_queue')
    .select('item_type')
    .eq('user_id', user.id)
    .is('resolved_at', null)

  if (countErr) {
    return NextResponse.json(
      { error: 'Failed to count review queue', detail: countErr.message },
      { status: 500 },
    )
  }

  const openTypes = (openRows ?? []) as unknown as { item_type: string }[]
  const byType: Record<string, number> = {}
  for (const r of openTypes) {
    byType[r.item_type] = (byType[r.item_type] ?? 0) + 1
  }
  const totalOpen = openTypes.length

  return NextResponse.json({
    items: hydrated,
    counts: {
      by_type: byType,
      total_open: totalOpen,
      total_returned: hydrated.length,
    },
  })
}
