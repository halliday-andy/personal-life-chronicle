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

import { useState } from 'react'
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
  // Entities this recollection mentions — chips link to each Entity View
  // (Slice 6.4), the path to add context.
  entities?: { id: string; canonical_name: string; type: string }[]
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
  const [busy, setBusy] = useState<null | 'accept' | 'decline' | 'save' | 'edit'>(null)
  const [error, setError] = useState<string | null>(null)

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

  const dimmed = memory.is_draft
  const isDraft = memory.is_draft

  return (
    <article
      className={`rounded-xl border p-4 ${
        dimmed ? 'bg-stone-50 border-stone-200' : 'bg-white border-stone-200'
      }`}
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
          {memory.occurred_at_fuzzy
            ? `${memory.occurred_at_fuzzy} · ${precisionLabel(memory.time_precision)}`
            : precisionLabel(memory.time_precision)}
        </span>
        <span className="ml-auto text-stone-400">
          {new Date(memory.created_at).toLocaleDateString()}
        </span>
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
          </div>
        </div>
      ) : (
        // Verbatim content_raw rendered as markdown — pasted research notes
        // keep their headings/lists; plain prose is unaffected (QA item 7).
        <Markdown className={`text-sm ${dimmed ? 'text-stone-600' : 'text-stone-900'}`}>
          {memory.content_raw}
        </Markdown>
      )}

      {/* Entity chips — link out to each mentioned entity's View (where its
          context notes live). The path from a recollection to "add context". */}
      {!editing && (memory.entities?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {memory.entities!.map((e) => (
            <a
              key={e.id}
              href={`/entities/${e.id}`}
              title={`Open ${e.canonical_name}`}
              className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] text-stone-600 hover:border-stone-400 hover:text-stone-900"
            >
              {e.canonical_name}
            </a>
          ))}
        </div>
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
        {memory.source_session_id ? ' · from interview session' : ''}
      </div>
    </article>
  )
}
