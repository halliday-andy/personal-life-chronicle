'use client'

/**
 * ProposalCard — Step 6f.
 *
 * One card per draft memory the orchestrator created. Groups the
 * associated dimension and entity proposals from sibling tool calls
 * in the same orchestrator turn. Surfaces three primary actions
 * (Accept / Decline / Edit) plus inline correction affordances:
 *
 *   - Edit the verbatim content_raw while draft (Raw Vault grace period)
 *   - Rename an entity inline (UPDATE entities; old name stashed in aliases)
 *   - Remove a tag chip (DELETE memory_dimensions)
 *   - Remove an entity chip (DELETE memory_entities)
 *
 * Cards self-manage optimistic state. The parent (CaptureAssistant) just
 * renders whatever the cards report.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import PrivateNotesPanel from './PrivateNotesPanel'

// ── Shared types matching the orchestrator's proposals shape ─────

interface DimProposal {
  dimension_id: string
  dimension_code: string | null
  dimension_name: string
  dimension_type_code: string
  weight: number
  is_primary: boolean
  rationale: string
}

interface EntityProposal {
  extracted_name: string
  type: string
  role: string
  resolved_entity_id: string | null
  resolution_action: string
  match_confidence: number
  context?: string
  /** Present when resolution_action='created_with_merge_proposal' —
   *  powers the in-flow link-vs-create choice (task #39). */
  merge_candidate?: { entity_id: string; canonical_name: string } | null
  review_queue_id?: string | null
}

interface MemoryProposalData {
  memory_id: string
  content_raw: string
  occurred_at_fuzzy: string | null
  time_precision: string
  is_draft: boolean
  /** Initial private_notes value for the PrivateNotesPanel — usually null
   *  on a fresh draft, populated if the orchestrator routed a passage via
   *  flag_for_private_notes. */
  private_notes?: string | null
}

export interface MemoryCardData {
  memory: MemoryProposalData
  tagsRationale?: string
  tags: DimProposal[]
  entities: EntityProposal[]
  /** Passages that the orchestrator routed to private_notes in the same
   *  turn that created this draft. Used to show a "moved here" hint and
   *  to open the panel pre-expanded so the user sees what was moved. */
  routedToPrivateNotes?: string[]
}

export type CardStatus = 'pending' | 'accepted' | 'declined' | 'failed'

// ── Component ────────────────────────────────────────────────────

export function ProposalCard({ initial }: { initial: MemoryCardData }) {
  const router = useRouter()
  const [memory, setMemory] = useState(initial.memory)
  const [tags, setTags] = useState(initial.tags)
  const [entities, setEntities] = useState(initial.entities)
  const [status, setStatus] = useState<CardStatus>('pending')
  const [editing, setEditing] = useState(false)
  const [draftText, setDraftText] = useState(initial.memory.content_raw)
  const [draftDate, setDraftDate] = useState(initial.memory.occurred_at_fuzzy ?? '')
  const [busy, setBusy] = useState<string | null>(null) // which action is in flight
  const [error, setError] = useState<string | null>(null)
  const [renamingEntityId, setRenamingEntityId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Grow the draft editor to fit the whole recollection (capped at 60vh,
  // floored so a short draft still gets a comfortable box) so the user keeps
  // visual context of the full text while editing. resize-y on the textarea
  // still lets them drag it taller/shorter by hand. Runs when the editor
  // opens and as the text changes.
  const editRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!editing) return
    const ta = editRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const max = Math.round(window.innerHeight * 0.6)
    ta.style.height = Math.min(Math.max(ta.scrollHeight, 128), max) + 'px'
  }, [editing, draftText])

  // ── Actions ─────────────────────────────────────────────────────

  async function handleAccept() {
    setBusy('accept')
    setError(null)
    try {
      const res = await fetch(`/api/memory/${memory.memory_id}/finalize`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json())?.error ?? 'Failed to accept')
      setStatus('accepted')
      // Invalidate any server-rendered surface that lists this memory
      // (e.g. /memories) so it doesn't show stale draft state. Without
      // this, the user accepts a draft here but a /memories tab opened
      // earlier keeps showing the draft badge until manual refresh.
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('failed')
    } finally {
      setBusy(null)
    }
  }

  async function handleDecline() {
    setBusy('decline')
    setError(null)
    try {
      const res = await fetch(`/api/memory/${memory.memory_id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json())?.error ?? 'Failed to decline')
      setStatus('declined')
      // Same invalidation as Accept — /memories had this draft in its
      // list; it should disappear without manual refresh.
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('failed')
    } finally {
      setBusy(null)
    }
  }

  async function handleSaveEdit() {
    setBusy('save')
    setError(null)
    try {
      const body: Record<string, unknown> = {}
      if (draftText.trim() && draftText !== memory.content_raw) body.content_raw = draftText.trim()
      if (draftDate !== (memory.occurred_at_fuzzy ?? '')) {
        body.occurred_at_fuzzy = draftDate.trim() || null
      }
      if (Object.keys(body).length === 0) {
        setEditing(false)
        return
      }
      const res = await fetch(`/api/memory/${memory.memory_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json())?.error ?? 'Failed to save')
      const updated = await res.json()
      setMemory((m) => ({ ...m, ...updated }))
      setEditing(false)
      // Content/date/precision changed — keep /memories coherent.
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(null)
    }
  }

  async function handleRemoveTag(dim: DimProposal) {
    setBusy(`tag-${dim.dimension_id}`)
    try {
      const res = await fetch(
        `/api/memory/${memory.memory_id}/dimension/${dim.dimension_id}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error((await res.json())?.error ?? 'Failed')
      setTags((t) => t.filter((x) => x.dimension_id !== dim.dimension_id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(null)
    }
  }

  async function handleRemoveEntity(ent: EntityProposal) {
    if (!ent.resolved_entity_id) return
    setBusy(`ent-${ent.resolved_entity_id}`)
    try {
      const res = await fetch(
        `/api/memory/${memory.memory_id}/entity/${ent.resolved_entity_id}?role=${encodeURIComponent(ent.role)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error((await res.json())?.error ?? 'Failed')
      setEntities((e) =>
        e.filter((x) => !(x.resolved_entity_id === ent.resolved_entity_id && x.role === ent.role)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(null)
    }
  }

  async function handleRenameEntity(ent: EntityProposal) {
    if (!ent.resolved_entity_id) return
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === ent.extracted_name) {
      setRenamingEntityId(null)
      return
    }
    setBusy(`rename-${ent.resolved_entity_id}`)
    try {
      const res = await fetch(`/api/entity/${ent.resolved_entity_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonical_name: trimmed }),
      })
      if (!res.ok) throw new Error((await res.json())?.error ?? 'Failed')
      setEntities((e) =>
        e.map((x) =>
          x.resolved_entity_id === ent.resolved_entity_id
            ? { ...x, extracted_name: trimmed }
            : x,
        ),
      )
      setRenamingEntityId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(null)
    }
  }

  // In-flow duplicate resolution (task #39): the entity agent created a
  // new entity but flagged a likely existing match. The user decides
  // here, on the card, instead of archaeologising a review backlog.
  async function handleLinkToExisting(ent: EntityProposal) {
    if (!ent.resolved_entity_id || !ent.merge_candidate) return
    setBusy(`merge-${ent.resolved_entity_id}`)
    setError(null)
    try {
      const res = await fetch(`/api/entity/${ent.resolved_entity_id}/merge-into`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: ent.merge_candidate.entity_id }),
      })
      if (!res.ok) throw new Error((await res.json())?.error ?? 'Merge failed')
      // The merge_entities function re-points links and closes the queue
      // row; reflect the surviving entity on the chip.
      setEntities((list) =>
        list.map((x) =>
          x.resolved_entity_id === ent.resolved_entity_id
            ? {
                ...x,
                resolved_entity_id: ent.merge_candidate!.entity_id,
                extracted_name: ent.merge_candidate!.canonical_name,
                resolution_action: 'linked_existing',
                merge_candidate: null,
                review_queue_id: null,
              }
            : x,
        ),
      )
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(null)
    }
  }

  async function handleKeepSeparate(ent: EntityProposal) {
    if (!ent.review_queue_id) {
      // Nothing queued (preview-mode data) — just clear the prompt.
      setEntities((list) =>
        list.map((x) =>
          x.resolved_entity_id === ent.resolved_entity_id
            ? { ...x, merge_candidate: null, review_queue_id: null }
            : x,
        ),
      )
      return
    }
    setBusy(`keep-${ent.resolved_entity_id}`)
    setError(null)
    try {
      const res = await fetch(`/api/review-queue/${ent.review_queue_id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution: 'rejected', note: 'Kept separate from proposal card' }),
      })
      if (!res.ok) throw new Error((await res.json())?.error ?? 'Failed')
      setEntities((list) =>
        list.map((x) =>
          x.resolved_entity_id === ent.resolved_entity_id
            ? { ...x, resolution_action: 'created_new', merge_candidate: null, review_queue_id: null }
            : x,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(null)
    }
  }

  // ── Resolved-state renderings ───────────────────────────────────

  if (status === 'accepted') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-emerald-700 font-medium">
          <span>✓ Saved to your chronicle</span>
        </div>
        <p className="mt-1 text-emerald-700/80 text-xs line-clamp-2">{memory.content_raw}</p>
      </div>
    )
  }
  if (status === 'declined') {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500 italic">
        Declined and discarded.
      </div>
    )
  }

  // ── Pending card ────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium uppercase tracking-wide px-1.5 py-0.5 text-[10px]">
            Draft
          </span>
          {memory.occurred_at_fuzzy && !editing && (
            <span className="text-xs text-stone-500">{memory.occurred_at_fuzzy}</span>
          )}
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-stone-400 hover:text-stone-900 transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {/* Content */}
      {editing ? (
        <div className="space-y-2">
          <textarea
            ref={editRef}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={6}
            className="w-full resize-y min-h-[8rem] max-h-[60vh] overflow-y-auto rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent leading-relaxed"
          />
          <input
            type="text"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            placeholder="approximate time (optional)"
            className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setEditing(false)
                setDraftText(memory.content_raw)
                setDraftDate(memory.occurred_at_fuzzy ?? '')
              }}
              disabled={busy !== null}
              className="text-xs text-stone-500 hover:text-stone-900 px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={busy !== null}
              className="text-xs bg-stone-900 text-white rounded-md px-3 py-1 hover:bg-stone-700 disabled:opacity-50"
            >
              {busy === 'save' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">
          {memory.content_raw}
        </p>
      )}

      {/* Tag chips */}
      {!editing && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t.dimension_id}
              className={`inline-flex items-center gap-1 rounded-full border text-[11px] px-2 py-0.5 ${
                t.is_primary
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-stone-50 text-stone-700 border-stone-200'
              }`}
              title={t.rationale}
            >
              {t.dimension_name}
              <button
                onClick={() => handleRemoveTag(t)}
                disabled={busy !== null}
                aria-label={`Remove tag ${t.dimension_name}`}
                className={`${t.is_primary ? 'text-white/60 hover:text-white' : 'text-stone-400 hover:text-stone-900'} disabled:opacity-30`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Entity chips */}
      {!editing && entities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entities.map((e) => (
            <EntityChip
              key={`${e.resolved_entity_id}:${e.role}`}
              entity={e}
              busy={busy}
              renaming={renamingEntityId === e.resolved_entity_id}
              onStartRename={() => {
                setRenamingEntityId(e.resolved_entity_id)
                setRenameValue(e.extracted_name)
              }}
              renameValue={renameValue}
              onRenameChange={setRenameValue}
              onConfirmRename={() => handleRenameEntity(e)}
              onCancelRename={() => setRenamingEntityId(null)}
              onRemove={() => handleRemoveEntity(e)}
            />
          ))}
        </div>
      )}

      {/* In-flow duplicate prompts (task #39): one strip per entity the
          agent suspects duplicates an existing one. */}
      {!editing &&
        entities
          .filter((e) => e.resolution_action === 'created_with_merge_proposal' && e.merge_candidate)
          .map((e) => (
            <div
              key={`dup-${e.resolved_entity_id}`}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] text-sky-900"
            >
              <span>
                Is <strong>{e.extracted_name}</strong> the same as your existing{' '}
                <strong>{e.merge_candidate!.canonical_name}</strong>?
              </span>
              <span className="ml-auto flex gap-1.5">
                <button
                  onClick={() => handleLinkToExisting(e)}
                  disabled={busy !== null}
                  className="rounded-md bg-sky-700 px-2 py-0.5 text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  {busy === `merge-${e.resolved_entity_id}` ? 'Linking…' : 'Same — link them'}
                </button>
                <button
                  onClick={() => handleKeepSeparate(e)}
                  disabled={busy !== null}
                  className="rounded-md border border-sky-300 px-2 py-0.5 text-sky-800 hover:bg-sky-100 disabled:opacity-50"
                >
                  {busy === `keep-${e.resolved_entity_id}` ? 'Keeping…' : 'Different — keep separate'}
                </button>
              </span>
            </div>
          ))}

      {/* Orchestrator-routed-passage hint, when applicable */}
      {!editing &&
        initial.routedToPrivateNotes &&
        initial.routedToPrivateNotes.length > 0 && (
          <div className="flex items-start gap-1.5 text-[11px] text-stone-500 italic px-1">
            <span aria-hidden>🔒</span>
            <span>
              {initial.routedToPrivateNotes.length === 1
                ? 'A passage from your submission was moved to private notes (owner-only).'
                : `${initial.routedToPrivateNotes.length} passages from your submission were moved to private notes (owner-only).`}
            </span>
          </div>
        )}

      {/* Private notes panel — collapsed by default, auto-expanded when
          the orchestrator routed a passage so the user sees it. */}
      {!editing && (
        <PrivateNotesPanel
          memoryId={memory.memory_id}
          initialNotes={
            initial.routedToPrivateNotes && initial.routedToPrivateNotes.length > 0
              ? initial.routedToPrivateNotes.join('\n\n---\n\n')
              : (initial.memory.private_notes ?? null)
          }
          startExpanded={
            (initial.routedToPrivateNotes?.length ?? 0) > 0
          }
        />
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
        </p>
      )}

      {/* Primary actions */}
      {!editing && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleAccept}
            disabled={busy !== null}
            className="flex-1 rounded-lg bg-stone-900 text-white text-xs font-medium py-1.5 hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            {busy === 'accept' ? 'Saving…' : 'Accept'}
          </button>
          <button
            onClick={handleDecline}
            disabled={busy !== null}
            className="flex-1 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium py-1.5 hover:bg-stone-50 disabled:opacity-50 transition-colors"
          >
            {busy === 'decline' ? 'Discarding…' : 'Decline'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Entity chip with inline rename ───────────────────────────────

function EntityChip({
  entity,
  busy,
  renaming,
  onStartRename,
  renameValue,
  onRenameChange,
  onConfirmRename,
  onCancelRename,
  onRemove,
}: {
  entity: EntityProposal
  busy: string | null
  renaming: boolean
  onStartRename: () => void
  renameValue: string
  onRenameChange: (v: string) => void
  onConfirmRename: () => void
  onCancelRename: () => void
  onRemove: () => void
}) {
  const typeColours: Record<string, string> = {
    person: 'bg-violet-50 text-violet-700 border-violet-200',
    place: 'bg-sky-50 text-sky-700 border-sky-200',
    organization: 'bg-amber-50 text-amber-700 border-amber-200',
    event_series: 'bg-rose-50 text-rose-700 border-rose-200',
    vehicle: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    artifact: 'bg-orange-50 text-orange-700 border-orange-200',
    concept: 'bg-lime-50 text-lime-700 border-lime-200',
  }
  const colour = typeColours[entity.type] ?? 'bg-stone-50 text-stone-700 border-stone-200'

  if (renaming) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border text-[11px] pl-2 pr-1 py-0.5 ${colour}`}>
        <input
          value={renameValue}
          onChange={(ev) => onRenameChange(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') onConfirmRename()
            if (ev.key === 'Escape') onCancelRename()
          }}
          autoFocus
          className="bg-white/60 border border-current/30 rounded px-1 py-0 text-[11px] w-32 focus:outline-none"
        />
        <button onClick={onConfirmRename} disabled={busy !== null} className="hover:underline">
          ✓
        </button>
        <button onClick={onCancelRename} className="hover:underline">
          ✕
        </button>
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border text-[11px] px-2 py-0.5 ${colour}`}
      title={`${entity.type} · role: ${entity.role}`}
    >
      <button
        onClick={onStartRename}
        disabled={busy !== null}
        className="hover:underline"
        title="Rename"
      >
        {entity.extracted_name}
      </button>
      <button
        onClick={onRemove}
        disabled={busy !== null}
        aria-label={`Remove ${entity.extracted_name}`}
        className="opacity-60 hover:opacity-100"
      >
        ×
      </button>
    </span>
  )
}
