'use client'

/**
 * MemoryCard — Step 6h-5.
 *
 * Interactive card for the /memories list. Replaces the previous
 * read-only inline component that used to live in the page file.
 *
 * Draft cards expose three primary actions in a row ABOVE the body
 * text (deliberately not below, to avoid the layout-shift trap the
 * PrivateNotesPanel caused on ProposalCard — when the panel collapses
 * after save, the buttons below it shift upward and can collect
 * accidental clicks):
 *
 *   Accept   → POST /api/memory/[id]/finalize
 *   Decline  → DELETE /api/memory/[id]   (drafts only; hard delete)
 *   Edit     → toggles inline edit mode for content_raw, date, precision
 *
 * Accept and Decline both use a two-click confirm pattern: first
 * click puts the button into a "click again to confirm" state for
 * 3 seconds; second click commits. This is the same protection
 * pattern GitHub uses on destructive ops, and it matches Andy's
 * earlier hardening request: an inadvertent click on the primary
 * action should never silently finalize a draft.
 *
 * Finalised memory cards show no action row — the only thing the
 * owner can do is edit private notes (via the existing
 * PrivateNotesPanel). content_raw is immutable post-finalize per
 * the Raw Vault invariant.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import PrivateNotesPanel from './PrivateNotesPanel'
import Markdown from './Markdown'

export interface MemoryRow {
  id: string
  content_raw: string
  occurred_at_fuzzy: string | null
  time_precision: string | null
  is_draft: boolean
  source: string
  created_at: string
  source_submission_id: string | null
  source_session_id: string | null
  private_notes: string | null
  /** interview_question (journalist model) is read from here. */
  metadata?: Record<string, unknown> | null
  // Entities this recollection mentions — chips link to each Entity View
  // (Slice 6.4), the path to add context. role='location' entities are NOT
  // here — they arrive as `locations` and render as the header anchor.
  entities?: { id: string; canonical_name: string; type: string }[]
  /**
   * Where this happened (role='location' links) — the memory's subject
   * anchor, rendered prominently so "this"/"here" in the text resolves
   * (Andy's QA 2026-07-10). Links to the Journey stop when pinned.
   */
  locations?: { id: string; canonical_name: string; pinRelationshipId: string | null }[]
}

const PRECISION_OPTIONS = [
  'unknown',
  'decade',
  'year',
  'season',
  'month',
  'day',
] as const

function precisionLabel(p: string | null): string {
  if (!p || p === 'unknown') return 'time unknown'
  return p
}

const CONFIRM_WINDOW_MS = 3000

export default function MemoryCard({ m }: { m: MemoryRow }) {
  const router = useRouter()

  // Live snapshot — starts from the server-rendered values, mutated
  // on successful PATCH/finalize so the card reflects the change
  // immediately without waiting for router.refresh().
  const [memory, setMemory] = useState(m)

  // Edit-mode state.
  const [editing, setEditing] = useState(false)
  const [draftText, setDraftText] = useState(m.content_raw)
  const [draftDate, setDraftDate] = useState(m.occurred_at_fuzzy ?? '')
  const [draftPrecision, setDraftPrecision] = useState<string>(
    m.time_precision ?? 'unknown',
  )

  // Action-in-flight + error.
  const [busy, setBusy] = useState<null | 'accept' | 'decline' | 'save' | 'edit' | 'link' | 'convert'>(null)
  const [error, setError] = useState<string | null>(null)

  // Entity-link editing (micro-slice 2026-07-06): "+ link" typeahead +
  // per-chip unlink. Owner graph repair for references extraction can't
  // see (pronouns) — no prose rewrite needed.
  const [linking, setLinking] = useState(false)
  const [linkQ, setLinkQ] = useState('')
  const [linkResults, setLinkResults] = useState<{ id: string; canonical_name: string; type: string }[]>([])

  // Transient confirmation after a finalized edit preserved a revision.
  const [revisionNotice, setRevisionNotice] = useState(false)

  // Convert-to-context (2026-07-10): research captured as a memory before
  // the context layer existed moves to entity_context_notes on the entity
  // it's ABOUT; the memory row is then deleted (two-click confirmed).
  const [converting, setConverting] = useState(false)
  const [convQ, setConvQ] = useState('')
  const [convResults, setConvResults] = useState<{ id: string; canonical_name: string; type: string }[]>([])
  const [convEntity, setConvEntity] = useState<{ id: string; canonical_name: string } | null>(null)
  const [convVisibility, setConvVisibility] = useState<'shareable' | 'private'>('shareable')
  const [convConfirm, setConvConfirm] = useState(false)

  useEffect(() => {
    if (!converting) return
    const t = setTimeout(() => {
      fetch(`/api/entity?q=${encodeURIComponent(convQ)}&limit=8`)
        .then((r) => r.json())
        .then((d) => setConvResults(d.items ?? []))
        .catch(() => setConvResults([]))
    }, 200)
    return () => clearTimeout(t)
  }, [convQ, converting])

  async function handleConvert() {
    if (!convEntity) return
    if (!convConfirm) {
      setConvConfirm(true)
      setTimeout(() => setConvConfirm(false), CONFIRM_WINDOW_MS)
      return
    }
    setBusy('convert')
    setError(null)
    try {
      const res = await fetch(`/api/memory/${memory.id}/convert-to-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: convEntity.id, visibility: convVisibility }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`)
      setRemoved(true) // the memory row is gone; context lives on the entity page
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed.')
      setConvConfirm(false)
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    if (!linking) return
    const t = setTimeout(() => {
      fetch(`/api/entity?q=${encodeURIComponent(linkQ)}&limit=8`)
        .then((r) => r.json())
        .then((d) => setLinkResults(d.items ?? []))
        .catch(() => setLinkResults([]))
    }, 200)
    return () => clearTimeout(t)
  }, [linkQ, linking])

  // Two-click confirm state for Accept and Decline. Each holds the
  // timestamp at which the user first clicked; a second click within
  // CONFIRM_WINDOW_MS commits the action. A setTimeout clears the
  // state if the user doesn't follow through.
  const [confirmingAccept, setConfirmingAccept] = useState(false)
  const [confirmingDecline, setConfirmingDecline] = useState(false)
  const [confirmingDeleteFinal, setConfirmingDeleteFinal] = useState(false)

  // ── Hidden after a successful Decline (the row will fully unmount
  //    on router.refresh(), but we hide it optimistically). ───────
  const [removed, setRemoved] = useState(false)

  // ── Row-anchor deep link (Slice 7.1): /memories#<memory_id> lands on
  //    this card — scroll it into view and flash a highlight ring so the
  //    eye finds it in a long list. Mount-only: anchor navigations arrive
  //    from other pages, so the card mounts fresh with the hash set. ──
  const articleRef = useRef<HTMLElement>(null)
  const [anchored, setAnchored] = useState(false)
  useEffect(() => {
    if (window.location.hash.slice(1) !== m.id) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Let the list paint before measuring scroll position.
    requestAnimationFrame(() => {
      articleRef.current?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'center',
      })
    })
    setAnchored(true)
    const t = setTimeout(() => setAnchored(false), 2600)
    return () => clearTimeout(t)
  }, [m.id])
  if (removed) return null

  // ── Action handlers ──────────────────────────────────────────────

  async function handleAccept() {
    if (!confirmingAccept) {
      setConfirmingAccept(true)
      setError(null)
      setTimeout(() => setConfirmingAccept(false), CONFIRM_WINDOW_MS)
      return
    }
    setBusy('accept')
    setError(null)
    try {
      const res = await fetch(`/api/memory/${memory.id}/finalize`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      setMemory((prev) => ({ ...prev, is_draft: false }))
      setConfirmingAccept(false)
      // Refresh the server-rendered page so the counts and ordering
      // are coherent across cards.
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function handleDecline() {
    if (!confirmingDecline) {
      setConfirmingDecline(true)
      setError(null)
      setTimeout(() => setConfirmingDecline(false), CONFIRM_WINDOW_MS)
      return
    }
    setBusy('decline')
    setError(null)
    try {
      const res = await fetch(`/api/memory/${memory.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      setRemoved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  // Owner curation of finalized memories (duplicates, test entries —
  // decided with Andy 2026-06-13). Same two-click confirm as Decline;
  // the API additionally requires ?confirm=final.
  async function handleDeleteFinal() {
    if (!confirmingDeleteFinal) {
      setConfirmingDeleteFinal(true)
      setError(null)
      setTimeout(() => setConfirmingDeleteFinal(false), CONFIRM_WINDOW_MS)
      return
    }
    setBusy('decline')
    setError(null)
    try {
      const res = await fetch(`/api/memory/${memory.id}?confirm=final`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      setRemoved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  function handleStartEdit() {
    setDraftText(memory.content_raw)
    setDraftDate(memory.occurred_at_fuzzy ?? '')
    setDraftPrecision(memory.time_precision ?? 'unknown')
    setEditing(true)
    setError(null)
    // Cancel any pending confirm windows — they shouldn't carry into edit.
    setConfirmingAccept(false)
    setConfirmingDecline(false)
  }

  async function handleSave() {
    setBusy('save')
    setError(null)
    try {
      const body: Record<string, unknown> = {}
      const trimmedText = draftText.trim()
      if (trimmedText && trimmedText !== memory.content_raw) {
        body.content_raw = trimmedText
      }
      if ((draftDate || '') !== (memory.occurred_at_fuzzy ?? '')) {
        body.occurred_at_fuzzy = draftDate.trim() || null
      }
      if (draftPrecision !== (memory.time_precision ?? 'unknown')) {
        body.time_precision = draftPrecision
      }
      if (Object.keys(body).length === 0) {
        setEditing(false)
        return
      }
      const res = await fetch(`/api/memory/${memory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody?.error ?? `HTTP ${res.status}`)
      }
      const updated = await res.json()
      setMemory((prev) => ({
        ...prev,
        content_raw: updated.content_raw ?? prev.content_raw,
        occurred_at_fuzzy:
          updated.occurred_at_fuzzy !== undefined
            ? updated.occurred_at_fuzzy
            : prev.occurred_at_fuzzy,
        time_precision:
          updated.time_precision !== undefined
            ? updated.time_precision
            : prev.time_precision,
      }))
      setEditing(false)
      if (updated.revision_saved) {
        setRevisionNotice(true)
        setTimeout(() => setRevisionNotice(false), 6000)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  function handleCancelEdit() {
    setEditing(false)
    setError(null)
  }

  async function handleLinkEntity(ent: { id: string; canonical_name: string; type: string }) {
    setBusy('link')
    setError(null)
    try {
      const res = await fetch(`/api/memory/${memory.id}/entity/${ent.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setMemory((prev) => ({
        ...prev,
        entities: [...(prev.entities ?? []), { id: ent.id, canonical_name: ent.canonical_name, type: ent.type }],
      }))
      setLinking(false)
      setLinkQ('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function handleUnlinkEntity(ent: { id: string; canonical_name: string }) {
    setBusy('link')
    setError(null)
    try {
      const res = await fetch(`/api/memory/${memory.id}/entity/${ent.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error ?? `HTTP ${res.status}`)
      }
      setMemory((prev) => ({
        ...prev,
        entities: (prev.entities ?? []).filter((e) => e.id !== ent.id),
      }))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const dimmed = memory.is_draft
  const isDraft = memory.is_draft

  return (
    <article
      id={memory.id}
      ref={articleRef}
      className={`scroll-mt-20 rounded-xl border p-4 transition-shadow duration-700 ${
        dimmed ? 'bg-stone-50 border-stone-200' : 'bg-white border-stone-200'
      } ${anchored ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-100' : ''}`}
    >
      {/* Header strip — badge + date + capture date */}
      <div className="flex items-start gap-2 mb-2 text-xs">
        {isDraft ? (
          <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium uppercase tracking-wide px-1.5 py-0.5 text-[10px]">
            Draft · awaiting review
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium uppercase tracking-wide px-1.5 py-0.5 text-[10px]">
            Final
          </span>
        )}
        <span className="text-stone-400">
          {/* time_precision is the fuzziness CLASSIFIER (decade/year/season/
              month/day) for the future Temporal Agent — appending "time
              unknown" beside an actual when-phrase is noise (Andy,
              2026-07-10). A real precision still shows; a memory with no
              when-phrase at all keeps "time unknown" as its placeholder. */}
          {memory.occurred_at_fuzzy
            ? memory.time_precision && memory.time_precision !== 'unknown'
              ? `${memory.occurred_at_fuzzy} · ${precisionLabel(memory.time_precision)}`
              : memory.occurred_at_fuzzy
            : precisionLabel(memory.time_precision)}
        </span>
        {/* The subject anchor: WHERE this happened. Resolves "this"/"here"
            in the text at a glance; links to the Journey stop when the
            place is pinned, else its entity page (2026-07-10). */}
        {(memory.locations ?? []).length > 0 && (
          <span className="min-w-0 truncate text-stone-500">
            at{' '}
            {(memory.locations ?? []).map((loc, i) => (
              <span key={loc.id}>
                {i > 0 && <span className="text-stone-300"> · </span>}
                <a
                  href={loc.pinRelationshipId ? `/journey?pin=${loc.pinRelationshipId}` : `/entities/${loc.id}`}
                  title={loc.pinRelationshipId ? `Read ${loc.canonical_name} in the journey` : `Open ${loc.canonical_name}`}
                  className="font-bold text-amber-700/90 hover:text-amber-800 hover:underline"
                >
                  {loc.canonical_name}
                </a>
              </span>
            ))}
          </span>
        )}
        <span className="ml-auto text-stone-400">
          {new Date(memory.created_at).toLocaleDateString()}
        </span>
        {!isDraft && !editing && (
          <button
            type="button"
            onClick={handleStartEdit}
            disabled={busy !== null}
            title="Edit this recollection — your original text is preserved as a revision"
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-stone-400 hover:text-stone-900 disabled:opacity-50"
          >
            Edit
          </button>
        )}
        {!isDraft && !editing && (
          <button
            type="button"
            onClick={() => { setConverting((v) => !v); setConvConfirm(false) }}
            disabled={busy !== null}
            title="This text is research, not a first-person recollection — move it to the CONTEXT layer of the entity it's about"
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-stone-400 hover:text-stone-900 disabled:opacity-50"
          >
            To context…
          </button>
        )}
        {!isDraft && !editing && (
          <button
            type="button"
            onClick={handleDeleteFinal}
            disabled={busy !== null}
            title="Permanently remove this memory and its revisions"
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium disabled:opacity-50 ${
              confirmingDeleteFinal
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'text-stone-300 hover:text-rose-600'
            }`}
          >
            {busy === 'decline'
              ? 'Deleting…'
              : confirmingDeleteFinal
              ? 'Click again — permanent'
              : 'Delete'}
          </button>
        )}
      </div>

      {/* Convert-to-context panel (2026-07-10) */}
      {converting && !editing && (
        <div className="mb-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
          <p className="text-stone-600">
            Move this text to the <span className="font-medium">Context</span> layer — background about an
            entity, not a first-person recollection. The verbatim text becomes a context note on the entity
            you pick, and <span className="font-medium text-rose-700">this memory card is deleted</span>.
          </p>
          {!convEntity ? (
            <div className="mt-2">
              <input
                value={convQ}
                onChange={(e) => setConvQ(e.target.value)}
                placeholder="Which entity is this about? Type to search…"
                autoFocus
                className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-xs outline-none focus:border-stone-500"
              />
              {convResults.length > 0 && (
                <ul className="mt-1 max-h-32 overflow-y-auto rounded-md border border-stone-200 bg-white">
                  {convResults.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setConvEntity({ id: r.id, canonical_name: r.canonical_name })}
                        className="block w-full px-2 py-1.5 text-left hover:bg-stone-50"
                      >
                        <span className="font-medium text-stone-800">{r.canonical_name}</span>
                        <span className="ml-1.5 text-stone-400">{r.type.replace('_', ' ')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-stone-700">
                → context on <span className="font-semibold">{convEntity.canonical_name}</span>
                <button type="button" onClick={() => setConvEntity(null)} className="ml-1 text-stone-400 hover:text-stone-700">×</button>
              </span>
              <label className="flex items-center gap-1 text-stone-600">
                <input type="radio" checked={convVisibility === 'shareable'} onChange={() => setConvVisibility('shareable')} /> shareable
              </label>
              <label className="flex items-center gap-1 text-stone-600">
                <input type="radio" checked={convVisibility === 'private'} onChange={() => setConvVisibility('private')} /> 🔒 private
              </label>
              <button
                type="button"
                onClick={handleConvert}
                disabled={busy !== null}
                className={`rounded-md px-2.5 py-1 font-medium disabled:opacity-50 ${
                  convConfirm ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-stone-800 text-white hover:bg-stone-700'
                }`}
              >
                {busy === 'convert' ? 'Converting…' : convConfirm ? 'Click again — deletes this card' : 'Convert'}
              </button>
              <button type="button" onClick={() => { setConverting(false); setConvConfirm(false) }} className="text-stone-500 hover:text-stone-800">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action row (drafts only, never below the panel — see file header) */}
      {isDraft && !editing && (
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={handleAccept}
            disabled={busy !== null}
            className={`px-3 py-1.5 text-xs font-medium rounded-md disabled:opacity-50 ${
              confirmingAccept
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-stone-900 text-white hover:bg-stone-700'
            }`}
          >
            {busy === 'accept'
              ? 'Saving…'
              : confirmingAccept
              ? 'Click again to finalize'
              : 'Accept'}
          </button>
          <button
            type="button"
            onClick={handleDecline}
            disabled={busy !== null}
            className={`px-3 py-1.5 text-xs font-medium rounded-md disabled:opacity-50 ${
              confirmingDecline
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'border border-stone-300 text-stone-700 hover:bg-stone-100'
            }`}
          >
            {busy === 'decline'
              ? 'Discarding…'
              : confirmingDecline
              ? 'Click again to delete'
              : 'Decline'}
          </button>
          <button
            type="button"
            onClick={handleStartEdit}
            disabled={busy !== null}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-stone-300 text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            Edit
          </button>
          {(confirmingAccept || confirmingDecline) && (
            <span className="text-[10px] text-stone-500 italic">
              waiting 3s for confirm…
            </span>
          )}
        </div>
      )}

      {/* Body — either read-only or edit mode */}
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={Math.max(4, Math.min(20, draftText.split('\n').length + 1))}
            className="w-full text-sm border border-stone-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-stone-500"
            disabled={busy !== null}
          />
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <label className="flex items-center gap-1 text-stone-500">
              When:
              <input
                type="text"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                placeholder="e.g. fall 1973, junior year, early 80s"
                className="text-sm border border-stone-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:border-stone-500 min-w-[16rem]"
                disabled={busy !== null}
              />
            </label>
            <label className="flex items-center gap-1 text-stone-500">
              Precision:
              <select
                value={draftPrecision}
                onChange={(e) => setDraftPrecision(e.target.value)}
                className="text-sm border border-stone-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:border-stone-500"
                disabled={busy !== null}
              >
                {PRECISION_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy !== null || !draftText.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-900 hover:bg-stone-700 text-white disabled:opacity-50"
            >
              {busy === 'save' ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={busy !== null}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700"
            >
              Cancel
            </button>
            {!isDraft && (
              <span className="text-[10px] text-stone-400 italic">
                Saving preserves your original text as a revision.
              </span>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* The eliciting question (journalist model, 2026-07-10): an
              answer without its question reads as an orphaned fragment —
              show what this recollection was responding to. */}
          {typeof memory.metadata?.interview_question === 'string' && memory.metadata.interview_question && (
            <p className="mb-1.5 rounded-lg bg-stone-50 px-3 py-1.5 text-xs italic text-stone-500">
              asked: &ldquo;{String(memory.metadata.interview_question).slice(0, 280)}
              {String(memory.metadata.interview_question).length > 280 ? '…' : ''}&rdquo;
            </p>
          )}
          {/* Verbatim content_raw rendered as markdown — pasted research notes
              keep their headings/lists; plain prose is unaffected (QA item 7). */}
          <Markdown className={`text-sm ${dimmed ? 'text-stone-600' : 'text-stone-900'}`}>
            {memory.content_raw}
          </Markdown>
        </>
      )}

      {/* Entity chips — link out to each mentioned entity's View (where its
          context notes live). Owner-editable (micro-slice 2026-07-06): × unlinks,
          "+ link" adds an entity extraction couldn't see (pronoun references,
          unnamed roles) — graph repair without rewriting the prose. */}
      {!editing && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {(memory.entities ?? []).map((e) => (
            <span
              key={e.id}
              className="group inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] text-stone-600"
            >
              <a
                href={`/entities/${e.id}`}
                title={`Open ${e.canonical_name}`}
                className="hover:text-stone-900"
              >
                {e.canonical_name}
              </a>
              <button
                type="button"
                onClick={() => handleUnlinkEntity(e)}
                disabled={busy !== null}
                aria-label={`Unlink ${e.canonical_name} from this recollection`}
                title="Unlink from this recollection (the entity itself is kept)"
                className="text-stone-300 hover:text-rose-600 disabled:opacity-30"
              >
                ×
              </button>
            </span>
          ))}
          {linking ? (
            <span className="relative inline-flex items-center gap-1">
              <input
                value={linkQ}
                onChange={(e) => setLinkQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setLinking(false); setLinkQ('') } }}
                placeholder="Search people, places…"
                autoFocus
                className="w-44 rounded-full border border-stone-300 px-2 py-0.5 text-[11px] focus:outline-none focus:border-stone-500"
              />
              <button
                type="button"
                onClick={() => { setLinking(false); setLinkQ('') }}
                className="text-[11px] text-stone-400 hover:text-stone-700"
              >
                cancel
              </button>
              {linkResults.filter((r) => !(memory.entities ?? []).some((e) => e.id === r.id)).length > 0 && (
                <div className="absolute left-0 top-full z-10 mt-1 max-h-40 w-64 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
                  {linkResults
                    .filter((r) => !(memory.entities ?? []).some((e) => e.id === r.id))
                    .map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        disabled={busy !== null}
                        onClick={() => handleLinkEntity(r)}
                        className="block w-full px-2 py-1 text-left text-xs text-stone-800 hover:bg-stone-100 disabled:opacity-50"
                      >
                        {r.canonical_name} <span className="text-stone-400">· {r.type}</span>
                      </button>
                    ))}
                </div>
              )}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setLinking(true)}
              disabled={busy !== null}
              title="Link a person, place, or organization this recollection is about"
              className="rounded-full border border-dashed border-stone-300 px-2 py-0.5 text-[11px] text-stone-400 hover:border-stone-400 hover:text-stone-700 disabled:opacity-50"
            >
              + link
            </button>
          )}
        </div>
      )}

      {/* Transient confirmation that a finalized edit preserved the original */}
      {revisionNotice && (
        <p className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
          Saved — your previous text is preserved as a revision.
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
          {error}
        </p>
      )}

      {/* Photos placeholder — memory-level photos attach HERE via the
          memory_media table (already in schema: memory_id, media_id,
          caption, sort_order), deliberately separate from the globe
          pin's entity_media gallery so recollection photos never
          clutter the pin's photo set. Decided with Andy 2026-06-13;
          build is queued as a task. */}
      <div
        className="mt-2 flex items-center gap-1.5 text-[11px] text-stone-300"
        title="Photos for this recollection will attach here — separate from any place's pin gallery on the globe. Coming soon."
      >
        <span aria-hidden>📷</span>
        <span className="italic">Photos — coming soon</span>
      </div>

      {/* Private notes panel — owner-only commentary, available on
          drafts and finals alike (private_notes is not Raw-Vault-bound). */}
      <PrivateNotesPanel
        memoryId={memory.id}
        initialNotes={memory.private_notes}
      />

      {/* Metadata strip */}
      <div className="mt-2 text-[10px] text-stone-400 font-mono">
        {memory.id.slice(0, 8)} · {memory.source}
        {memory.source_submission_id ? ' · from orchestrator' : ''}
        {memory.source_session_id ? (
          <>
            {' · '}
            <a
              href={`/sessions/${memory.source_session_id}`}
              className="text-stone-500 underline decoration-stone-300 hover:text-stone-800"
              title="Read the interview conversation this recollection came from"
            >
              view conversation ↗
            </a>
          </>
        ) : ''}
      </div>
    </article>
  )
}
