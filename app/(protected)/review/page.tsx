/**
 * /review — Unified Review Queue (Step 6g-5).
 *
 * Single chronological feed of open review_queue items: entity
 * confirmations the orchestrator needs the user to approve, entity
 * merge proposals, memory-elaboration prompts (Phase 2), and so on.
 *
 * Server component fetches the initial open list via the admin client.
 * The interactive list (resolve actions, optimistic removal, kebab
 * menus, merge target picker) lives in components/ReviewQueue.tsx
 * which is a client component.
 *
 * Anchors to PRD §5 Journey 7. RLS stub mode for now; flip to user
 * client at Step 13.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ReviewQueue, { ReviewItem } from '@/components/ReviewQueue'

export const dynamic = 'force-dynamic'

type RawRow = {
  id: string
  item_type: string
  item_id: string
  context_json: Record<string, unknown> | null
  priority: number
  surfaced_at: string
  resolved_at: string | null
}

export default async function ReviewPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const admin = createAdminClient()

  // --- Fetch open queue rows ----------------------------------------
  const { data: rqRaw, error: rqErr } = await admin
    .from('review_queue')
    .select('id, item_type, item_id, context_json, priority, surfaced_at, resolved_at')
    .eq('user_id', user.id)
    .is('resolved_at', null)
    .order('surfaced_at', { ascending: false })
    .limit(500)

  const rows = (rqRaw ?? []) as unknown as RawRow[]

  // --- Hydrate referenced entities + memories -----------------------
  const entityIds = new Set<string>()
  const memoryIds = new Set<string>()
  for (const r of rows) {
    if (['entity_confirmation_needed', 'entity_merge_proposal'].includes(r.item_type)) {
      entityIds.add(r.item_id)
      const primary = (r.context_json ?? {})['proposed_primary']
      if (typeof primary === 'string') entityIds.add(primary)
    }
    if (['memory_elaboration_needed', 'synthesis_stale', 'sensitive_promotion'].includes(r.item_type)) {
      memoryIds.add(r.item_id)
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

  const entityById = new Map<string, { id: string; type: string; canonical_name: string; aliases: string[] | null }>()
  for (const e of (entitiesRes.data ?? []) as unknown as { id: string; type: string; canonical_name: string; aliases: string[] | null }[]) {
    entityById.set(e.id, e)
  }
  const memoryById = new Map<string, { id: string; content_raw: string; occurred_at_fuzzy: string | null; time_precision: string | null; is_draft: boolean }>()
  for (const m of (memoriesRes.data ?? []) as unknown as { id: string; content_raw: string; occurred_at_fuzzy: string | null; time_precision: string | null; is_draft: boolean }[]) {
    memoryById.set(m.id, m)
  }

  const items: ReviewItem[] = rows.map((r) => {
    const isEntity = ['entity_confirmation_needed', 'entity_merge_proposal'].includes(r.item_type)
    const isMemory = ['memory_elaboration_needed', 'synthesis_stale', 'sensitive_promotion'].includes(r.item_type)
    const primary = (r.context_json ?? {})['proposed_primary']
    return {
      id: r.id,
      item_type: r.item_type,
      item_id: r.item_id,
      context_json: r.context_json,
      priority: r.priority,
      surfaced_at: r.surfaced_at,
      entity: isEntity ? entityById.get(r.item_id) ?? null : null,
      proposed_primary_entity: isEntity && typeof primary === 'string'
        ? entityById.get(primary) ?? null
        : null,
      memory: isMemory ? memoryById.get(r.item_id) ?? null : null,
    }
  })

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-stone-400 hover:text-stone-900 transition-colors"
            >
              ← Dashboard
            </Link>
            <span className="text-stone-300">|</span>
            <span className="text-sm font-medium text-stone-700">Review</span>
          </div>
          <span className="text-xs text-stone-400">
            {items.length} open
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {rqErr ? (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
            Failed to load review queue: {rqErr.message}
          </div>
        ) : (
          <ReviewQueue initialItems={items} />
        )}
      </main>
    </div>
  )
}
