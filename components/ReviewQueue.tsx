/**
 * ReviewQueue — client component powering /review.
 *
 * Single chronological feed (Andy's choice in Step 6g-5 design pass).
 * Each row picks a specialised card by item_type. Resolving an item
 * removes it optimistically; on API failure the item is restored and
 * an error banner shown.
 *
 * Confirm action on an entity_confirmation_needed card is a single
 * primary button "Confirm as <Name>"; the kebab menu hosts Rename,
 * Merge into…, and Reject.
 *
 * Merge target picker on entity_merge_proposal cards defaults to the
 * orchestrator's proposed_primary; a "change target" link reveals a
 * typeahead over the user's same-type entities.
 */

'use client'

import { useEffect, useState } from 'react'

type ResolveFn = (
  item: ReviewItem,
  resolution: string,
  payload?: Record<string, unknown>,
  note?: string,
) => Promise<boolean>

export interface EntityRef {
  id: string
  type: string
  canonical_name: string
  aliases: string[] | null
}

export interface MemoryRef {
  id: string
  content_raw: string
  occurred_at_fuzzy: string | null
  time_precision: string | null
  is_draft: boolean
}

export interface ReviewItem {
  id: string
  item_type: string
  item_id: string
  context_json: Record<string, unknown> | null
  priority: number
  surfaced_at: string
  entity: EntityRef | null
  proposed_primary_entity: EntityRef | null
  memory: MemoryRef | null
  /** Full original submission text for backlog items (the card's
   *  context_json.text is only the orchestrator's short summary). */
  fullText: string | null
}

const TYPE_BADGE: Record<string, { label: string; classes: string }> = {
  entity_confirmation_needed: {
    label: 'New person',
    classes: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  entity_merge_proposal: {
    label: 'Possible duplicate',
    classes: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  memory_elaboration_needed: {
    label: 'Tell me more',
    classes: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  temporal_constraint: {
    label: 'Time clarification',
    classes: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  synthesis_stale: {
    label: 'Synthesis refresh',
    classes: 'bg-stone-50 text-stone-700 border-stone-200',
  },
  sensitive_promotion: {
    label: 'Sensitive review',
    classes: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  assumption_review: {
    label: 'Assumption check',
    classes: 'bg-stone-50 text-stone-700 border-stone-200',
  },
  contribution_review: {
    label: 'Contribution',
    classes: 'bg-stone-50 text-stone-700 border-stone-200',
  },
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const sec = Math.max(0, Math.round((now - then) / 1000))
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d ago`
  const mon = Math.round(day / 30)
  if (mon < 12) return `${mon}mo ago`
  return `${Math.round(mon / 12)}y ago`
}

export default function ReviewQueue({ initialItems }: { initialItems: ReviewItem[] }) {
  const [items, setItems] = useState<ReviewItem[]>(initialItems)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  async function resolveItem(
    item: ReviewItem,
    resolution: string,
    payload: Record<string, unknown> = {},
    note?: string,
  ): Promise<boolean> {
    // Optimistic remove.
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    setErrorBanner(null)
    try {
      const res = await fetch(`/api/review-queue/${item.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, payload, note }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = body?.error || `HTTP ${res.status}`
        setItems((prev) => [item, ...prev])
        setErrorBanner(`Could not resolve: ${msg}`)
        return false
      }
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setItems((prev) => [item, ...prev])
      setErrorBanner(`Network error: ${msg}`)
      return false
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-500">Nothing waiting for review.</p>
        <p className="mt-2 text-sm text-stone-400">
          The orchestrator surfaces items here when it needs your input.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {errorBanner && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
          {errorBanner}
        </div>
      )}
      {items.map((item) => (
        <ReviewItemCard key={item.id} item={item} onResolve={resolveItem} />
      ))}
    </div>
  )
}

function ReviewItemCard({
  item,
  onResolve,
}: {
  item: ReviewItem
  onResolve: ResolveFn
}) {
  const badge = TYPE_BADGE[item.item_type] ?? {
    label: item.item_type,
    classes: 'bg-stone-50 text-stone-700 border-stone-200',
  }
  return (
    <article className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start gap-2 mb-3 text-xs">
        <span className={`rounded-full font-medium uppercase tracking-wide px-2 py-0.5 text-[10px] border ${badge.classes}`}>
          {badge.label}
        </span>
        <span className="text-stone-400">{timeAgo(item.surfaced_at)}</span>
      </div>

      {item.item_type === 'entity_confirmation_needed' && (
        <EntityConfirmationBody item={item} onResolve={onResolve} />
      )}
      {item.item_type === 'entity_merge_proposal' && (
        <EntityMergeProposalBody item={item} onResolve={onResolve} />
      )}
      {item.item_type === 'memory_elaboration_needed' && (
        <MemoryElaborationBody item={item} onResolve={onResolve} />
      )}
      {!['entity_confirmation_needed', 'entity_merge_proposal', 'memory_elaboration_needed'].includes(item.item_type) && (
        <GenericBody item={item} onResolve={onResolve} />
      )}
    </article>
  )
}

// ------------------------------------------------------------------
// entity_confirmation_needed
// ------------------------------------------------------------------

function EntityConfirmationBody({
  item,
  onResolve,
}: {
  item: ReviewItem
  onResolve: ResolveFn
}) {
  const onResolveTyped = onResolve
  const ent = item.entity
  const ctx = item.context_json ?? {}
  const extractedName = typeof ctx.extracted_name === 'string' ? ctx.extracted_name : null
  const contextQuote = typeof ctx.context_quote === 'string' ? ctx.context_quote : null
  const name = ent?.canonical_name ?? extractedName ?? '(deleted)'

  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(name)
  const [merging, setMerging] = useState(false)
  const [reassigning, setReassigning] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  if (!ent) {
    return (
      <div className="text-sm text-stone-500 italic">
        Referenced entity no longer exists.
        <div className="mt-3">
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700"
            onClick={() => onResolveTyped(item, 'dismissed')}
          >
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-sm text-stone-700 mb-1">
        New person mentioned:{' '}
        <span className="font-semibold text-stone-900">{name}</span>
      </div>
      {contextQuote && (
        <p className="text-xs text-stone-500 italic mb-3">“{contextQuote}”</p>
      )}

      {renaming ? (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 text-sm border border-stone-300 rounded-md px-2 py-1.5 focus:outline-none focus:border-sky-400"
            autoFocus
          />
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-sky-600 hover:bg-sky-700 text-white"
            onClick={() =>
              onResolveTyped(item, 'renamed', { canonical_name: newName.trim() })
            }
            disabled={!newName.trim()}
          >
            Save
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700"
            onClick={() => { setRenaming(false); setNewName(name) }}
          >
            Cancel
          </button>
        </div>
      ) : merging ? (
        <MergePicker
          source={ent}
          intent="merge"
          onCancel={() => setMerging(false)}
          onConfirm={(targetId) =>
            onResolveTyped(item, 'merged', { merged_into_id: targetId })
          }
        />
      ) : reassigning ? (
        <MergePicker
          source={ent}
          intent="reassign"
          onCancel={() => setReassigning(false)}
          onConfirm={(targetId) =>
            onResolveTyped(item, 'merged', { merged_into_id: targetId })
          }
        />
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-sky-600 hover:bg-sky-700 text-white"
            onClick={() => onResolveTyped(item, 'confirmed')}
          >
            Confirm as {name}
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-stone-300 text-stone-700 hover:bg-stone-50"
            onClick={() => setReassigning(true)}
            title="Pick which existing entity the orchestrator should have linked to"
          >
            Actually this was…
          </button>
          <div className="relative">
            <button
              className="px-2 py-1.5 text-xs rounded-md text-stone-600 hover:bg-stone-100"
              onClick={() => setMenuOpen((m) => !m)}
              aria-label="More actions"
            >
              ⋯
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 mt-1 w-52 bg-white border border-stone-200 rounded-md shadow-md z-10 text-sm"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  className="block w-full text-left px-3 py-2 hover:bg-stone-50"
                  onClick={() => { setMenuOpen(false); setRenaming(true) }}
                >
                  Fix name…
                </button>
                <button
                  className="block w-full text-left px-3 py-2 hover:bg-stone-50"
                  onClick={() => { setMenuOpen(false); setMerging(true) }}
                  title="Assert this entity is the same real-world individual as another"
                >
                  Merge with…
                </button>
                <button
                  className="block w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-700"
                  onClick={() => { setMenuOpen(false); onResolveTyped(item, 'rejected') }}
                >
                  Delete (extraction was wrong)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------
// entity_merge_proposal
// ------------------------------------------------------------------

function EntityMergeProposalBody({
  item,
  onResolve,
}: {
  item: ReviewItem
  onResolve: ResolveFn
}) {
  const duplicate = item.entity
  const primary = item.proposed_primary_entity
  const ctx = item.context_json ?? {}
  const rationale = typeof ctx.rationale === 'string' ? ctx.rationale : null

  const [changingTarget, setChangingTarget] = useState(false)
  const [chosenTargetId, setChosenTargetId] = useState<string | null>(
    primary?.id ?? null,
  )

  if (!duplicate) {
    return (
      <div className="text-sm text-stone-500 italic">
        Duplicate entity no longer exists.
        <div className="mt-3">
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700"
            onClick={() => onResolve(item, 'dismissed')}
          >
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-sm text-stone-700 mb-2">
        <span className="font-semibold text-stone-900">{duplicate.canonical_name}</span>
        {' may be the same person as '}
        <span className="font-semibold text-stone-900">
          {primary?.canonical_name ?? '(unknown)'}
        </span>
        {'.'}
      </div>
      {rationale && (
        <p className="text-xs text-stone-500 italic mb-3">{rationale}</p>
      )}

      {changingTarget ? (
        <MergePicker
          source={duplicate}
          onCancel={() => setChangingTarget(false)}
          onConfirm={(targetId) => {
            setChosenTargetId(targetId)
            setChangingTarget(false)
            return onResolve(item, 'merged', { merged_into_id: targetId })
          }}
        />
      ) : (
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
            onClick={() => onResolve(item, 'merged', { merged_into_id: chosenTargetId ?? primary?.id })}
            disabled={!chosenTargetId && !primary?.id}
          >
            Merge into {primary?.canonical_name ?? '…'}
          </button>
          <button
            className="text-xs text-stone-500 hover:text-stone-700 underline"
            onClick={() => setChangingTarget(true)}
          >
            change target
          </button>
          <span className="flex-1" />
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700"
            onClick={() => onResolve(item, 'rejected')}
          >
            Keep separate
          </button>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------
// memory_elaboration_needed (Phase 2 — read-only at MVP)
// ------------------------------------------------------------------

function MemoryElaborationBody({
  item,
  onResolve,
}: {
  item: ReviewItem
  onResolve: ResolveFn
}) {
  const memory = item.memory
  const ctx = item.context_json ?? {}
  // Prefer the FULL original submission text (hydrated as item.fullText);
  // context_json.text is only the orchestrator's short summary. item.memory
  // is usually null (item_id is the capture submission, not a memory).
  const summary = typeof ctx.text === 'string' ? ctx.text : null
  const prompt = typeof ctx.prompt === 'string' ? ctx.prompt : null
  const rationale = typeof ctx.rationale === 'string' ? ctx.rationale : null
  const body = item.fullText ?? summary ?? prompt ?? 'Elaboration prompt'
  return (
    <div>
      <div className="text-sm text-stone-700 mb-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-stone-50 p-2">
        {body}
      </div>
      {rationale && (
        <p className="text-xs text-stone-500 italic mb-3">Queued because: {rationale}</p>
      )}
      {memory && (
        <p className="text-xs text-stone-500 italic mb-3 line-clamp-2">
          {memory.content_raw}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700"
          onClick={() => onResolve(item, 'dismissed')}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// generic fallback (sensitive_promotion, temporal_constraint, etc.)
// ------------------------------------------------------------------

function GenericBody({
  item,
  onResolve,
}: {
  item: ReviewItem
  onResolve: ResolveFn
}) {
  return (
    <div>
      <div className="text-xs text-stone-500 mb-3 font-mono">
        {item.item_type} · {item.item_id.slice(0, 8)}
      </div>
      <pre className="text-xs text-stone-600 bg-stone-50 rounded p-2 mb-3 overflow-x-auto">
        {JSON.stringify(item.context_json, null, 2)}
      </pre>
      <button
        className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700"
        onClick={() => onResolve(item, 'dismissed')}
      >
        Dismiss
      </button>
    </div>
  )
}

// ------------------------------------------------------------------
// Merge target picker — typeahead over same-type entities.
// ------------------------------------------------------------------

/**
 * MergePicker supports two distinct user intents that share the same
 * underlying operation (merge_entities re-points FKs from source to
 * target and deletes the source):
 *
 *   intent='merge'     — "These two distinct entities I know about
 *                         are actually the same one." Real-world
 *                         identity claim. Rare, deliberate.
 *
 *   intent='reassign'  — "The orchestrator misread the text; the
 *                         memory was actually mentioning this other
 *                         existing entity, not a new one." Common,
 *                         especially with voice transcription.
 *
 * The DB doesn't care about the difference — same RPC, same effect.
 * The user does care: framing affects what they're willing to do
 * with confidence. (See Task #66 for the design rationale.)
 */
function MergePicker({
  source,
  onCancel,
  onConfirm,
  intent = 'merge',
}: {
  source: EntityRef
  onCancel: () => void
  onConfirm: (targetId: string) => Promise<boolean> | void
  intent?: 'merge' | 'reassign'
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<EntityRef[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch once with empty q; client-side filter beyond that.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/entity?type=${encodeURIComponent(source.type)}&exclude=${source.id}&limit=500`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return
        if (body?.items) setResults(body.items as EntityRef[])
        else setError(body?.error ?? 'Failed to load entities')
      })
      .catch((e) => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [source.id, source.type])

  const filtered = q
    ? results.filter((e) => {
        const ql = q.toLowerCase()
        if (e.canonical_name.toLowerCase().includes(ql)) return true
        if (e.aliases?.some((a) => a.toLowerCase().includes(ql))) return true
        return false
      })
    : results

  return (
    <div className="border border-stone-200 rounded-md p-3 bg-stone-50">
      <p className="text-xs text-stone-600 mb-2 leading-relaxed">
        {intent === 'reassign'
          ? <>The orchestrator picked up <span className="font-semibold">{source.canonical_name}</span> as a new {source.type}. If it actually meant an existing {source.type}, pick them below — the memory&rsquo;s link will move, and {source.canonical_name} will be removed.</>
          : <>Merge <span className="font-semibold">{source.canonical_name}</span> with another {source.type} you&rsquo;re asserting is the same individual. Source will be deleted; memories, aliases, and queue items move to the target.</>}
      </p>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${source.type}s…`}
          className="flex-1 text-sm border border-stone-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-violet-400"
          autoFocus
        />
        <button
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-200 hover:bg-stone-300 text-stone-700"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="text-xs text-rose-600 mb-2">{error}</p>
      )}
      {loading ? (
        <p className="text-xs text-stone-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-stone-500">No matches.</p>
      ) : (
        <ul className="max-h-48 overflow-y-auto divide-y divide-stone-200 bg-white rounded border border-stone-200">
          {filtered.map((e) => (
            <li key={e.id}>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50"
                onClick={() => onConfirm(e.id)}
              >
                <span className="font-medium text-stone-900">{e.canonical_name}</span>
                {e.aliases && e.aliases.length > 0 && (
                  <span className="text-xs text-stone-500"> · {e.aliases.join(', ')}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
