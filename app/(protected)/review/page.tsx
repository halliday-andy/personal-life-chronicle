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
  // Draft memories are a separate store (memories.is_draft, accepted on
  // /memories) but the dashboard calls them "awaiting review" — surface
  // their count here too so the two pages can never contradict each
  // other ("1 draft awaiting review" vs "nothing waiting", 2026-06-13).
  const [{ data: rqRaw, error: rqErr }, draftsRes] = await Promise.all([
    admin
      .from('review_queue')
      .select('id, item_type, item_id, context_json, priority, surfaced_at, resolved_at')
      .eq('user_id', user.id)
      .is('resolved_at', null)
      .order('surfaced_at', { ascending: false })
      .limit(500),
    admin
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_draft', true),
  ])
  const draftCount = draftsRes.count ?? 0

  const rows = (rqRaw ?? []) as unknown as RawRow[]

  // --- Hydrate referenced entities + memories + backlog submissions --
  const entityIds = new Set<string>()
  const memoryIds = new Set<string>()
  const submissionIds = new Set<string>()
  for (const r of rows) {
    if (['entity_confirmation_needed', 'entity_merge_proposal'].includes(r.item_type)) {
      entityIds.add(r.item_id)
      const primary = (r.context_json ?? {})['proposed_primary']
      if (typeof primary === 'string') entityIds.add(primary)
    }
    if (['memory_elaboration_needed', 'synthesis_stale', 'sensitive_promotion'].includes(r.item_type)) {
      memoryIds.add(r.item_id)
    }
    // Orchestrator backlog items (add_to_backlog) anchor item_id to the
    // capture submission — pull its full input_text so the card can show
    // the user's complete research, not just the short summary.
    if (r.item_type === 'memory_elaboration_needed') {
      const src = (r.context_json ?? {})['source_submission_id']
      submissionIds.add(typeof src === 'string' ? src : r.item_id)
    }
  }

  const [entitiesRes, memoriesRes, submissionsRes] = await Promise.all([
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
    submissionIds.size > 0
      ? admin
          .from('capture_submissions')
          .select('id, input_text')
          .in('id', Array.from(submissionIds))
      : Promise.resolve({ data: [], error: null }),
  ])

  const submissionTextById = new Map<string, string>()
  for (const s of (submissionsRes.data ?? []) as unknown as { id: string; input_text: string | null }[]) {
    if (s.input_text) submissionTextById.set(s.id, s.input_text)
  }

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
      fullText:
        r.item_type === 'memory_elaboration_needed'
          ? submissionTextById.get(
              (typeof (r.context_json ?? {})['source_submission_id'] === 'string'
                ? ((r.context_json ?? {})['source_submission_id'] as string)
                : r.item_id),
            ) ?? null
          : null,
    }
  })

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto flex items-baseline justify-between px-4 sm:px-6 pt-6">
        <h1 className="text-lg font-semibold text-stone-900">Review</h1>
        <span className="text-xs text-stone-400">{items.length} open</span>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {draftCount > 0 && (
          <Link
            href="/memories"
            className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:border-amber-300 transition-colors"
          >
            <span className="rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              Draft
            </span>
            <span>
              {draftCount} draft {draftCount === 1 ? 'memory' : 'memories'} awaiting acceptance —
              accept or decline in Memories
            </span>
            <span className="ml-auto text-xs text-amber-700">Open Memories →</span>
          </Link>
        )}
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
