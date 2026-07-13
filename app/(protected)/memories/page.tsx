/**
 * Memories list — Step 6e quick-fix for Task #37; entity filter added
 * 2026-06-04 to support the "View memories" link from /entities (per
 * Andy's feedback that the link existed but did nothing).
 *
 * Query params:
 *   ?entity=<uuid>   filter to memories that mention this entity
 *                    (INNER JOIN on memory_entities); a banner shows
 *                    the entity name and a clear-filter affordance
 *
 * Chronological list with draft vs finalised distinction.
 * Throwaway scaffolding; the Timeline view in Step 7+ supersedes this
 * with chronological-by-time_estimate sort, multi-select, PDF export.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MemoryCard, { type MemoryRow } from '@/components/MemoryCard'
import { PIN_TYPE_CODES } from '@/lib/entity/mention-pins'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function MemoriesPage({
  searchParams,
}: {
  searchParams: { entity?: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const entityFilter =
    typeof searchParams.entity === 'string' && UUID_RE.test(searchParams.entity)
      ? searchParams.entity
      : null

  // RLS isn't activated yet (viewer_can_access stub returns FALSE).
  // Use admin client scoped by user_id. When Step 13 lands and RLS goes
  // live, flip back to the user-scoped client.
  const admin = createAdminClient()

  // ── Optional entity filter ─────────────────────────────────────
  // When ?entity=<id> is present, fetch the entity (for the banner)
  // and the memory_id set that mentions it. If the entity doesn't
  // belong to this user, treat as "no match" — we never reveal the
  // existence of other users' entities through a 404 vs empty
  // distinction.
  let entityForBanner: { id: string; canonical_name: string; type: string } | null = null
  let filterMemoryIds: string[] | null = null
  if (entityFilter) {
    const { data: ent } = await admin
      .from('entities')
      .select('id, canonical_name, type, user_id')
      .eq('id', entityFilter)
      .eq('user_id', user.id)
      .maybeSingle()
    if (ent) {
      entityForBanner = { id: ent.id, canonical_name: ent.canonical_name, type: ent.type }
      const { data: links } = await admin
        .from('memory_entities')
        .select('memory_id')
        .eq('entity_id', entityFilter)
      filterMemoryIds = ((links ?? []) as { memory_id: string }[]).map((l) => l.memory_id)
    } else {
      // Entity not owned by user (or doesn't exist) → render zero results.
      filterMemoryIds = []
    }
  }

  // ── Memories query ─────────────────────────────────────────────
  let query = admin
    .from('memories')
    .select(
      // Safe to include private_notes here: this page is owner-only
      // (the redirect above gates it behind the authenticated user).
      // Step 13 RLS will enforce this at the database layer too.
      // metadata rides along for interview_question (journalist model).
      'id, content_raw, occurred_at_fuzzy, time_precision, is_draft, source, created_at, source_submission_id, source_session_id, private_notes, metadata',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (filterMemoryIds !== null) {
    if (filterMemoryIds.length === 0) {
      // Avoid the empty-IN-list footgun (PostgREST returns ALL rows
      // for .in() with []). Short-circuit to zero results.
      query = query.eq('id', '00000000-0000-0000-0000-000000000000')
    } else {
      query = query.in('id', filterMemoryIds)
    }
  }

  const { data: memories, error } = await query

  const rows = (memories ?? []) as MemoryRow[]

  // Entity chips per memory (Slice 6.4): one join over the listed memories,
  // grouped by memory_id, so each card can link out to its entities' Views.
  //
  // role='location' entities are SPLIT OUT (Andy's QA 2026-07-10): they are
  // the memory's subject anchor — "My father helped me buy THIS" is opaque
  // until the card says "at My Mt. Snow Chalet". They render as a header
  // label (linking into the Journey when the place is pinned), not as
  // peer chips — which also removes the × that could divorce a memory
  // from its pin.
  const memIds = rows.map((m) => m.id)
  if (memIds.length > 0) {
    const { data: links } = await admin
      .from('memory_entities')
      .select('memory_id, role, entities!inner(id, canonical_name, type)')
      .in('memory_id', memIds)
    type Ent = { id: string; canonical_name: string; type: string }
    type LinkRow = { memory_id: string; role: string; entities: Ent | Ent[] | null }
    const byMem = new Map<string, Ent[]>()
    const locByMem = new Map<string, Ent[]>()
    for (const l of (links ?? []) as LinkRow[]) {
      const e = Array.isArray(l.entities) ? l.entities[0] : l.entities
      if (!e) continue
      const target = l.role === 'location' ? locByMem : byMem
      const arr = target.get(l.memory_id) ?? []
      if (!arr.some((x) => x.id === e.id)) arr.push(e)
      target.set(l.memory_id, arr)
    }
    // Which located places are globe pins? The label links to the Journey.
    const locPlaceIds = Array.from(new Set(Array.from(locByMem.values()).flat().map((e) => e.id)))
    const pinByPlace = new Map<string, string>()
    if (locPlaceIds.length > 0) {
      const { data: relRows } = await admin
        .from('relationships')
        .select('id, object_id, relationship_types!inner(code)')
        .eq('user_id', user.id)
        .in('object_id', locPlaceIds)
      type RelRow = { id: string; object_id: string; relationship_types: { code: string } | { code: string }[] | null }
      for (const r of (relRows ?? []) as RelRow[]) {
        const rt = Array.isArray(r.relationship_types) ? r.relationship_types[0] : r.relationship_types
        if (rt && (PIN_TYPE_CODES as ReadonlySet<string>).has(rt.code) && !pinByPlace.has(r.object_id)) {
          pinByPlace.set(r.object_id, r.id)
        }
      }
    }
    for (const m of rows) {
      m.entities = byMem.get(m.id) ?? []
      m.locations = (locByMem.get(m.id) ?? []).map((e) => ({
        id: e.id,
        canonical_name: e.canonical_name,
        pinRelationshipId: pinByPlace.get(e.id) ?? null,
      }))
    }
  }

  const draftCount = rows.filter((m) => m.is_draft).length
  const finalisedCount = rows.length - draftCount

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto flex items-baseline justify-between px-4 sm:px-6 pt-6">
        <h1 className="text-lg font-semibold text-stone-900">Memories</h1>
        <span className="text-xs text-stone-400">
          {entityFilter
            ? `${rows.length} matching`
            : `${rows.length} total · ${finalisedCount} final · ${draftCount} draft${draftCount === 1 ? '' : 's'}`}
        </span>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 mb-6 text-sm">
            Failed to load memories: {error.message}
          </div>
        )}

        {/* Filter banner — shown when ?entity=<id> is set */}
        {entityFilter && (
          <FilterBanner
            entity={entityForBanner}
            rawId={entityFilter}
            resultCount={rows.length}
          />
        )}

        {rows.length === 0 ? (
          entityFilter ? (
            <FilteredEmptyState entity={entityForBanner} />
          ) : (
            <div className="text-center py-20">
              <p className="text-stone-500">No memories recorded yet.</p>
              <p className="mt-2 text-sm text-stone-400">
                Use the Capture button (⌘K) to begin.
              </p>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {!entityFilter && (
              <p className="text-xs text-stone-400 mb-2">
                Sorted by capture time. A proper Timeline view sorting by inferred event time
                arrives in Step 7.
              </p>
            )}
            {rows.map((m) => (
              <MemoryCard key={m.id} m={m} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Inline UI fragments ──────────────────────────────────────────

function FilterBanner({
  entity,
  rawId,
  resultCount,
}: {
  entity: { id: string; canonical_name: string; type: string } | null
  rawId: string
  resultCount: number
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 mb-4 flex items-center gap-3 text-sm">
      <span className="text-stone-700">
        Memories mentioning{' '}
        <span className="font-semibold text-stone-900">
          {entity?.canonical_name ?? <code className="font-mono text-xs">{rawId.slice(0, 8)}…</code>}
        </span>
        {entity && (
          <span className="text-stone-400 text-xs ml-1.5">({entity.type.replace('_', ' ')})</span>
        )}
        <span className="text-stone-400 text-xs ml-2">
          · {resultCount} {resultCount === 1 ? 'memory' : 'memories'}
        </span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-3 text-xs">
        <Link
          href="/entities"
          className="text-stone-600 hover:text-stone-900 underline transition-colors"
        >
          Manage in Entities
        </Link>
        <Link
          href="/review"
          className="text-stone-600 hover:text-stone-900 underline transition-colors"
        >
          Review queue
        </Link>
        <Link
          href="/memories"
          className="text-stone-500 hover:text-stone-900 transition-colors"
        >
          × clear filter
        </Link>
      </span>
    </div>
  )
}

function FilteredEmptyState({
  entity,
}: {
  entity: { id: string; canonical_name: string; type: string } | null
}) {
  if (!entity) {
    return (
      <div className="text-center py-16">
        <p className="text-stone-500">Entity not found.</p>
        <p className="mt-2 text-sm text-stone-400">
          It may have been deleted, or doesn&rsquo;t belong to you.{' '}
          <Link href="/memories" className="underline">Clear filter</Link>.
        </p>
      </div>
    )
  }
  return (
    <div className="text-center py-16">
      <p className="text-stone-500">
        No memories currently link to{' '}
        <span className="font-semibold text-stone-700">{entity.canonical_name}</span>.
      </p>
      <p className="mt-2 text-sm text-stone-400">
        This entity has no active mentions. It may be orphaned from a deleted memory or rejected merge.
      </p>
      <div className="mt-4 flex items-center justify-center gap-3 text-sm">
        <Link
          href={`/entities`}
          className="text-stone-600 hover:text-stone-900 underline"
        >
          Manage in Entities
        </Link>
        <span className="text-stone-300">·</span>
        <Link
          href="/memories"
          className="text-stone-500 hover:text-stone-900"
        >
          Clear filter
        </Link>
      </div>
    </div>
  )
}
