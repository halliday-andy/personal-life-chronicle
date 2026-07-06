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
import Markdown from './Markdown'

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
  entity_stub_proposal: {
    label: 'New mention',
    classes: 'bg-lime-50 text-lime-700 border-lime-200',
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
        <ReviewItemCard
          key={item.id}
          item={item}
          onResolve={resolveItem}
          onRemove={(it) => { setItems((prev) => prev.filter((i) => i.id !== it.id)); setErrorBanner(null) }}
          onRestore={(it, msg) => { setItems((prev) => [it, ...prev]); setErrorBanner(msg) }}
        />
      ))}
    </div>
  )
}

function ReviewItemCard({
  item,
  onResolve,
  onRemove,
  onRestore,
}: {
  item: ReviewItem
  onResolve: ResolveFn
  onRemove: (item: ReviewItem) => void
  onRestore: (item: ReviewItem, msg: string) => void
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
      {item.item_type === 'entity_stub_proposal' && (
        <EntityStubProposalBody item={item} onRemove={onRemove} onRestore={onRestore} />
      )}
      {!['entity_confirmation_needed', 'entity_merge_proposal', 'memory_elaboration_needed', 'entity_stub_proposal'].includes(item.item_type) && (
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

  // Attach-as-context (Slice 6.5): give this research a home on an entity
  // instead of the old Dismiss-only dead-end.
  const [attaching, setAttaching] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ id: string; type: string; canonical_name: string }[]>([])
  const [visibility, setVisibility] = useState<'private' | 'shareable'>('shareable')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!attaching) return
    const t = setTimeout(() => {
      fetch(`/api/entity?q=${encodeURIComponent(q)}&limit=8`)
        .then((r) => r.json())
        .then((d) => setResults(d.items ?? []))
        .catch(() => setResults([]))
    }, 200)
    return () => clearTimeout(t)
  }, [q, attaching])

  async function attach(entityId: string, entityName: string) {
    setBusy(true); setError(null)
    try {
      const sourceUrl = (body.match(/https?:\/\/[^\s)]+/) || [])[0] ?? ''
      const res = await fetch(`/api/entity/${entityId}/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, sourceUrl, visibility }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`)
      await onResolve(item, 'confirmed', { attached_as_context: true, entity_id: entityId }, `Attached as context to ${entityName}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not attach.')
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="text-sm text-stone-700 mb-2 max-h-64 overflow-y-auto rounded bg-stone-50 p-2">
        <Markdown>{body}</Markdown>
      </div>
      {rationale && (
        <p className="text-xs text-stone-500 italic mb-3">Queued because: {rationale}</p>
      )}
      {memory && (
        <p className="text-xs text-stone-500 italic mb-3 line-clamp-2">
          {memory.content_raw}
        </p>
      )}
      {!attaching ? (
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-800 hover:bg-stone-700 text-white"
            onClick={() => setAttaching(true)}
          >
            Attach as context…
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700"
            onClick={() => onResolve(item, 'dismissed')}
          >
            Dismiss
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-stone-200 bg-white p-2">
          <p className="mb-1 text-xs text-stone-500">Attach this research as a context note on…</p>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people, places, organizations…"
            autoFocus
            className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-stone-500"
          />
          <div className="mt-1 max-h-40 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                disabled={busy}
                onClick={() => attach(r.id, r.canonical_name)}
                className="block w-full rounded px-2 py-1 text-left text-sm text-stone-800 hover:bg-stone-100 disabled:opacity-50"
              >
                {r.canonical_name} <span className="text-xs text-stone-400">· {r.type}</span>
              </button>
            ))}
            {q && results.length === 0 && <p className="px-2 py-1 text-xs text-stone-400">No matches.</p>}
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="text-stone-500">Visibility:</span>
            <label className="flex items-center gap-1 text-stone-700"><input type="radio" checked={visibility === 'shareable'} onChange={() => setVisibility('shareable')} /> Shareable</label>
            <label className="flex items-center gap-1 text-stone-700"><input type="radio" checked={visibility === 'private'} onChange={() => setVisibility('private')} /> Private</label>
            <button onClick={() => { setAttaching(false); setError(null) }} disabled={busy} className="ml-auto text-stone-500 hover:text-stone-800">Cancel</button>
          </div>
          {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------
// entity_stub_proposal (globe stub resolution, 2026-07-06)
// ------------------------------------------------------------------

function EntityStubProposalBody({
  item,
  onRemove,
  onRestore,
}: {
  item: ReviewItem
  onRemove: (item: ReviewItem) => void
  onRestore: (item: ReviewItem, msg: string) => void
}) {
  const ctx = (item.context_json ?? {}) as {
    name?: string
    entity_type?: string
    pin_name?: string
    excerpt?: string
    suggested?: { entity_id: string; canonical_name: string; score: number } | null
  }
  const stubName = ctx.name ?? '(unnamed)'
  const entityType = ctx.entity_type === 'organization' ? 'organization' : 'person'

  // Editable name: "my father" should become a real name at creation; the
  // stub phrasing is kept as an alias server-side when renamed.
  const [name, setName] = useState(stubName)
  const [linkingExisting, setLinkingExisting] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ id: string; type: string; canonical_name: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!linkingExisting) return
    const t = setTimeout(() => {
      fetch(`/api/entity?q=${encodeURIComponent(q)}&limit=8`)
        .then((r) => r.json())
        .then((d) => setResults(d.items ?? []))
        .catch(() => setResults([]))
    }, 200)
    return () => clearTimeout(t)
  }, [q, linkingExisting])

  async function act(body: { action: 'create' | 'link' | 'dismiss'; name?: string; entityId?: string }) {
    setBusy(true)
    setError(null)
    onRemove(item) // optimistic, matching the queue's resolve pattern
    try {
      const res = await fetch(`/api/review-queue/${item.id}/resolve-stub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`)
    } catch (e) {
      onRestore(item, `Could not resolve: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="text-sm text-stone-800">
        <strong>{stubName}</strong> is mentioned in your recollection at{' '}
        <strong>{ctx.pin_name ?? 'a pin'}</strong> — add {entityType === 'person' ? 'them' : 'it'} as
        a {entityType} in your chronicle?
      </p>
      {ctx.excerpt && (
        <p className="mt-1 text-xs italic text-stone-500 line-clamp-2">“{ctx.excerpt}…”</p>
      )}

      {ctx.suggested && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] text-sky-900">
          <span>
            Looks like your existing <strong>{ctx.suggested.canonical_name}</strong>?
          </span>
          <button
            onClick={() => act({ action: 'link', entityId: ctx.suggested!.entity_id })}
            disabled={busy}
            className="ml-auto rounded-md bg-sky-700 px-2 py-0.5 text-white hover:bg-sky-800 disabled:opacity-50"
          >
            Same — link them
          </button>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          title="Edit before adding — e.g. give “my father” his real name (the original phrasing is kept as an alias)"
          className="w-56 rounded-md border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-stone-500"
        />
        <button
          onClick={() => act({ action: 'create', name })}
          disabled={busy || !name.trim()}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-800 hover:bg-stone-700 text-white disabled:opacity-50"
        >
          Add as {entityType}
        </button>
        <button
          onClick={() => setLinkingExisting((v) => !v)}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-stone-300 text-stone-700 hover:bg-stone-100 disabled:opacity-50"
        >
          Link to existing…
        </button>
        <button
          onClick={() => act({ action: 'dismiss' })}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>

      {linkingExisting && (
        <div className="mt-2 rounded-lg border border-stone-200 bg-white p-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your entities…"
            autoFocus
            className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-stone-500"
          />
          <div className="mt-1 max-h-40 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                disabled={busy}
                onClick={() => act({ action: 'link', entityId: r.id })}
                className="block w-full rounded px-2 py-1 text-left text-sm text-stone-800 hover:bg-stone-100 disabled:opacity-50"
              >
                {r.canonical_name} <span className="text-xs text-stone-400">· {r.type}</span>
              </button>
            ))}
            {q && results.length === 0 && <p className="px-2 py-1 text-xs text-stone-400">No matches.</p>}
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
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
