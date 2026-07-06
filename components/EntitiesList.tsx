'use client'

/**
 * EntitiesList — client component powering /entities (Task #68).
 *
 * Type tabs at top (Person · Place · Organization · Artifact · Event series)
 * with counts. Search bar filters by canonical_name + aliases.
 * Per-row card with:
 *   - Name + aliases chips + mention count + type badge
 *   - Actions: Rename · Change type · Merge into… · Delete · View memories
 *
 * Reuses existing endpoints:
 *   PATCH /api/entity/[id]              — rename, aliases, type change
 *   POST  /api/entity/[id]/merge-into   — merge into same-type target
 *   DELETE /api/entity/[id]             — hard delete (CASCADE rules
 *                                          handle ripple)
 *   GET   /api/entity?type=&exclude=…   — typeahead source for the
 *                                          merge picker (already
 *                                          built in Step 6g-5)
 *
 * Optimistic state + router.refresh() after each mutation so the
 * mention counts and adjacent surfaces stay coherent.
 *
 * Layout choice: action row sits ABOVE the row body, same defence
 * against layout-shift inadvertent clicks that MemoryCard adopted
 * in Step 6h-5. Delete uses a two-click confirm with rose colouring.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface EntityRow {
  id: string
  type: string
  canonical_name: string
  aliases: string[]
  mention_count: number
  created_at: string
}

// All seven entity_type enum values. concept + vehicle were missing here
// (found 2026-07-06 when a ski method mistyped as 'place' could not be
// re-typed to Concept — the dropdown never offered it).
const TYPE_ORDER = ['person', 'place', 'organization', 'concept', 'artifact', 'vehicle', 'event_series'] as const
const TYPE_LABELS: Record<string, string> = {
  person: 'People',
  place: 'Places',
  organization: 'Organizations',
  concept: 'Concepts',
  artifact: 'Artifacts',
  vehicle: 'Vehicles',
  event_series: 'Event series',
}
const TYPE_BADGE_CLASSES: Record<string, string> = {
  person: 'bg-sky-50 text-sky-700 border-sky-200',
  place: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  organization: 'bg-violet-50 text-violet-700 border-violet-200',
  concept: 'bg-lime-50 text-lime-700 border-lime-200',
  artifact: 'bg-amber-50 text-amber-700 border-amber-200',
  vehicle: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  event_series: 'bg-teal-50 text-teal-700 border-teal-200',
}

const CONFIRM_WINDOW_MS = 3000

export default function EntitiesList({ initialItems }: { initialItems: EntityRow[] }) {
  const router = useRouter()
  const [items, setItems] = useState<EntityRow[]>(initialItems)
  const [activeType, setActiveType] = useState<string>(() => {
    // Default to the type with the most entities so the page feels alive
    const counts: Record<string, number> = {}
    for (const e of initialItems) counts[e.type] = (counts[e.type] ?? 0) + 1
    const ordered = TYPE_ORDER.filter((t) => (counts[t] ?? 0) > 0)
    return ordered[0] ?? 'person'
  })
  const [query, setQuery] = useState('')
  const [banner, setBanner] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  // Counts per type for the tab labels.
  const typeCounts: Record<string, number> = {}
  for (const e of items) typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1

  const filtered = items.filter((e) => {
    if (e.type !== activeType) return false
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    if (e.canonical_name.toLowerCase().includes(q)) return true
    if (e.aliases.some((a) => a.toLowerCase().includes(q))) return true
    return false
  })

  function onMutated(updater: (prev: EntityRow[]) => EntityRow[], info?: string) {
    setItems(updater)
    if (info) setBanner({ kind: 'info', text: info })
    router.refresh()
  }

  function onError(msg: string) {
    setBanner({ kind: 'error', text: msg })
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-500">No entities yet.</p>
        <p className="mt-2 text-sm text-stone-400">
          Drop a memory through the capture chat (⌘K) and the orchestrator will start extracting people, places, and organizations.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Type tabs */}
      <div className="flex gap-1 mb-4 border-b border-stone-200 -mx-1 px-1 overflow-x-auto">
        {TYPE_ORDER.map((t) => {
          const c = typeCounts[t] ?? 0
          const isActive = t === activeType
          return (
            <button
              key={t}
              type="button"
              onClick={() => setActiveType(t)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              } ${c === 0 ? 'opacity-50' : ''}`}
              disabled={c === 0}
            >
              {TYPE_LABELS[t]}
              <span className={`rounded-full px-1.5 text-[10px] ${
                isActive ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
              }`}>
                {c}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${TYPE_LABELS[activeType]?.toLowerCase() ?? activeType}…`}
          className="w-full text-sm border border-stone-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-stone-500"
        />
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={`mb-3 px-3 py-2 rounded-md text-sm ${
            banner.kind === 'error'
              ? 'border border-rose-200 bg-rose-50 text-rose-800'
              : 'border border-stone-200 bg-stone-50 text-stone-700'
          }`}
        >
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="float-right text-xs text-stone-400 hover:text-stone-700"
          >
            ✕
          </button>
          {banner.text}
        </div>
      )}

      {/* Entity rows */}
      {filtered.length === 0 ? (
        <p className="text-stone-500 text-sm py-12 text-center">
          {query
            ? `No ${TYPE_LABELS[activeType]?.toLowerCase()} match “${query}”.`
            : `No ${TYPE_LABELS[activeType]?.toLowerCase()} yet.`}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((entity) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              allEntities={items}
              onUpdated={(updated) =>
                onMutated((prev) => prev.map((p) => (p.id === updated.id ? updated : p)),
                  `Updated ${updated.canonical_name}.`)
              }
              onDeleted={(id, name) =>
                onMutated((prev) => prev.filter((p) => p.id !== id),
                  `Deleted ${name}.`)
              }
              onMerged={(sourceId, targetId, targetName) =>
                onMutated(
                  (prev) => prev.filter((p) => p.id !== sourceId),
                  `Merged into ${targetName}.`,
                )
              }
              onError={onError}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// One row + its actions
// ────────────────────────────────────────────────────────────────────

function EntityCard({
  entity,
  allEntities,
  onUpdated,
  onDeleted,
  onMerged,
  onError,
}: {
  entity: EntityRow
  allEntities: EntityRow[]
  onUpdated: (e: EntityRow) => void
  onDeleted: (id: string, name: string) => void
  onMerged: (sourceId: string, targetId: string, targetName: string) => void
  onError: (msg: string) => void
}) {
  const [busy, setBusy] = useState<null | 'rename' | 'type' | 'merge' | 'delete'>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Inline edit states.
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(entity.canonical_name)
  const [aliasesDraft, setAliasesDraft] = useState((entity.aliases ?? []).join(', '))

  const [changingType, setChangingType] = useState(false)
  const [typeDraft, setTypeDraft] = useState(entity.type)

  const [merging, setMerging] = useState(false)

  async function patch(body: Record<string, unknown>, label: 'rename' | 'type') {
    setBusy(label)
    try {
      const res = await fetch(`/api/entity/${entity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      const updated = await res.json()
      onUpdated({
        ...entity,
        canonical_name: updated.canonical_name ?? entity.canonical_name,
        type: updated.type ?? entity.type,
        aliases: updated.aliases ?? entity.aliases,
      })
      setRenaming(false)
      setChangingType(false)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function handleRenameSave() {
    const trimmed = nameDraft.trim()
    if (!trimmed) {
      onError('Name cannot be empty.')
      return
    }
    const aliases = aliasesDraft
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean)
    await patch({ canonical_name: trimmed, aliases }, 'rename')
  }

  async function handleTypeSave() {
    if (typeDraft === entity.type) {
      setChangingType(false)
      return
    }
    await patch({ type: typeDraft }, 'type')
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      setTimeout(() => setConfirmingDelete(false), CONFIRM_WINDOW_MS)
      return
    }
    setBusy('delete')
    try {
      const res = await fetch(`/api/entity/${entity.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      onDeleted(entity.id, entity.canonical_name)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
      setConfirmingDelete(false)
    }
  }

  async function handleMergeConfirm(targetId: string, targetName: string) {
    setBusy('merge')
    try {
      const res = await fetch(`/api/entity/${entity.id}/merge-into`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      setMerging(false)
      onMerged(entity.id, targetId, targetName)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <article className="rounded-xl border border-stone-200 bg-white p-3">
      {/* Action row — above body to dodge layout-shift inadvertent clicks */}
      {!renaming && !changingType && !merging && (
        <div className="flex items-center gap-1.5 mb-2 flex-wrap text-xs">
          <button
            type="button"
            onClick={() => { setNameDraft(entity.canonical_name); setAliasesDraft(entity.aliases.join(', ')); setRenaming(true) }}
            disabled={busy !== null}
            className="px-2.5 py-1 rounded-md border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => { setTypeDraft(entity.type); setChangingType(true) }}
            disabled={busy !== null}
            className="px-2.5 py-1 rounded-md border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            Change type
          </button>
          <button
            type="button"
            onClick={() => setMerging(true)}
            disabled={busy !== null}
            className="px-2.5 py-1 rounded-md border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            Merge into…
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy !== null}
            className={`px-2.5 py-1 rounded-md disabled:opacity-50 ${
              confirmingDelete
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'border border-stone-300 text-stone-700 hover:bg-stone-50'
            }`}
          >
            {busy === 'delete' ? 'Deleting…' : confirmingDelete ? 'Click again to delete' : 'Delete'}
          </button>
          <a
            href={`/entities/${entity.id}`}
            className="ml-auto px-2.5 py-1 rounded-md font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50"
          >
            Open ↗
          </a>
          <a
            href={`/memories?entity=${entity.id}`}
            className="px-2.5 py-1 rounded-md text-stone-500 hover:text-stone-700 hover:bg-stone-50"
          >
            View memories →
          </a>
        </div>
      )}

      {/* Body — name + aliases + counts, or one of the edit modes */}
      {renaming ? (
        <div className="space-y-2">
          <label className="block text-xs text-stone-500">
            Name
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              autoFocus
              disabled={busy === 'rename'}
              className="mt-0.5 block w-full text-sm border border-stone-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-stone-500"
            />
          </label>
          <label className="block text-xs text-stone-500">
            Aliases (comma-separated)
            <input
              type="text"
              value={aliasesDraft}
              onChange={(e) => setAliasesDraft(e.target.value)}
              placeholder="e.g. Berkeley, UC Berkeley"
              disabled={busy === 'rename'}
              className="mt-0.5 block w-full text-sm border border-stone-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-stone-500"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRenameSave}
              disabled={busy === 'rename' || !nameDraft.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-900 hover:bg-stone-700 text-white disabled:opacity-50"
            >
              {busy === 'rename' ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setRenaming(false)}
              disabled={busy === 'rename'}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : changingType ? (
        <div className="space-y-2">
          <label className="block text-xs text-stone-500">
            Type
            <select
              value={typeDraft}
              onChange={(e) => setTypeDraft(e.target.value)}
              disabled={busy === 'type'}
              className="mt-0.5 block w-full text-sm border border-stone-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-stone-500"
            >
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTypeSave}
              disabled={busy === 'type'}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-900 hover:bg-stone-700 text-white disabled:opacity-50"
            >
              {busy === 'type' ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setChangingType(false)}
              disabled={busy === 'type'}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : merging ? (
        <MergePicker
          source={entity}
          allEntities={allEntities}
          onCancel={() => setMerging(false)}
          onConfirm={handleMergeConfirm}
          busy={busy === 'merge'}
        />
      ) : (
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`rounded-full font-medium uppercase tracking-wide px-1.5 py-0.5 text-[10px] border ${TYPE_BADGE_CLASSES[entity.type] ?? 'bg-stone-50 text-stone-700 border-stone-200'}`}>
            {entity.type.replace('_', ' ')}
          </span>
          <span className="text-sm font-semibold text-stone-900">{entity.canonical_name}</span>
          {entity.aliases.length > 0 && (
            <span className="text-xs text-stone-500">
              a.k.a. {entity.aliases.join(', ')}
            </span>
          )}
          <span className="ml-auto text-xs text-stone-400">
            {entity.mention_count} {entity.mention_count === 1 ? 'mention' : 'mentions'}
          </span>
        </div>
      )}
    </article>
  )
}

// ────────────────────────────────────────────────────────────────────
// Merge picker — typeahead over same-type entities
// ────────────────────────────────────────────────────────────────────

function MergePicker({
  source,
  allEntities,
  onCancel,
  onConfirm,
  busy,
}: {
  source: EntityRow
  allEntities: EntityRow[]
  onCancel: () => void
  onConfirm: (targetId: string, targetName: string) => void
  busy: boolean
}) {
  const [q, setQ] = useState('')
  const candidates = allEntities.filter(
    (e) => e.type === source.type && e.id !== source.id,
  )
  const ql = q.trim().toLowerCase()
  const filtered = ql
    ? candidates.filter((e) =>
        e.canonical_name.toLowerCase().includes(ql) ||
        e.aliases.some((a) => a.toLowerCase().includes(ql)),
      )
    : candidates
  // Cap to 30 to keep the list scrollable but not infinite.
  const shown = filtered.slice(0, 30)

  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <div className="text-xs text-stone-600 mb-2">
        Merge <span className="font-semibold">{source.canonical_name}</span> into another {source.type.replace('_', ' ')}. The source will be deleted; its memories, aliases, and queue items move to the target.
      </div>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${source.type.replace('_', ' ')}s…`}
          autoFocus
          disabled={busy}
          className="flex-1 text-sm border border-stone-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-stone-500"
        />
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-200 hover:bg-stone-300 text-stone-700"
        >
          Cancel
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="text-xs text-stone-500">
          {candidates.length === 0
            ? `No other ${source.type.replace('_', ' ')}s to merge into.`
            : 'No matches.'}
        </p>
      ) : (
        <ul className="max-h-48 overflow-y-auto divide-y divide-stone-200 bg-white rounded border border-stone-200">
          {shown.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onConfirm(e.id, e.canonical_name)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50 disabled:opacity-50"
              >
                <span className="font-medium text-stone-900">{e.canonical_name}</span>
                {e.aliases.length > 0 && (
                  <span className="text-xs text-stone-500"> · {e.aliases.join(', ')}</span>
                )}
                <span className="text-xs text-stone-400 float-right">
                  {e.mention_count} {e.mention_count === 1 ? 'mention' : 'mentions'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
