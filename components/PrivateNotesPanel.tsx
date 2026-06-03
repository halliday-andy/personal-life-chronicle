'use client'

/**
 * PrivateNotesPanel — Step 6h.
 *
 * Owner-only commentary surface for a memory. Collapsed by default with a
 * lock icon and "for your eyes only" caption, expands on click to reveal
 * the notes content and an inline editor.
 *
 * Lifecycle:
 *   - Collapsed (default)                → 🔒 strip with count if non-empty
 *   - Expanded, no notes                 → call-to-action to add
 *   - Expanded, has notes                → text body + Edit button
 *   - Editing                            → textarea + Save / Cancel
 *
 * Privacy posture at MVP:
 *   - Application layer never includes private_notes in any select that
 *     reaches a non-owner viewer.
 *   - At Step 13 (RLS activation) a column-level grant will make the
 *     field invisible to non-owner roles at the database level too.
 *
 * The orchestrator's flag_for_private_notes tool APPENDS via its own path
 * (see lib/agents/orchestrator/tools.ts). This panel REPLACES via PATCH —
 * the user is the editor of their own commentary.
 */

import { useState } from 'react'

interface Props {
  memoryId: string
  initialNotes: string | null
  /** Optional callback for parent to refresh related state on save. */
  onSaved?: (newNotes: string | null) => void
  /** Optional default-open behaviour (e.g. when orchestrator just routed
   *  a passage to private_notes and we want the user to see it). */
  startExpanded?: boolean
}

export default function PrivateNotesPanel({
  memoryId,
  initialNotes,
  onSaved,
  startExpanded = false,
}: Props) {
  const [notes, setNotes] = useState<string | null>(initialNotes)
  const [expanded, setExpanded] = useState(startExpanded)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasNotes = notes !== null && notes.trim().length > 0

  async function save(value: string) {
    setSaving(true)
    setError(null)
    const trimmed = value.trim()
    const payload = trimmed === '' ? null : trimmed
    try {
      const res = await fetch(`/api/memory/${memoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ private_notes: payload }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error ?? `HTTP ${res.status}`)
        return false
      }
      const updated = await res.json()
      setNotes(updated.private_notes ?? null)
      onSaved?.(updated.private_notes ?? null)
      setEditing(false)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setSaving(false)
    }
  }

  // ── Collapsed state ────────────────────────────────────────────
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full mt-2 flex items-center gap-2 px-2 py-1 text-xs text-stone-500 hover:text-stone-700 hover:bg-stone-50 rounded transition-colors"
      >
        <span aria-hidden>🔒</span>
        <span className="font-medium">
          Private notes{hasNotes ? ` · ${noteSummary(notes!)}` : ''}
        </span>
        <span className="text-stone-400 text-[10px] ml-auto">
          for your eyes only · click to {hasNotes ? 'view' : 'add'}
        </span>
      </button>
    )
  }

  // ── Expanded states ────────────────────────────────────────────
  return (
    <div className="mt-2 rounded-md border border-stone-200 bg-stone-50/60 px-3 py-2">
      <div className="flex items-center gap-2 mb-1 text-xs">
        <span aria-hidden>🔒</span>
        <span className="font-medium text-stone-700">Private notes</span>
        <span className="text-stone-400 text-[10px]">for your eyes only</span>
        <span className="flex-1" />
        {!editing && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-stone-400 hover:text-stone-700 text-xs"
            aria-label="Collapse"
          >
            ▾
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder="Anything you want to remember about this memory that nobody else should ever see."
            className="w-full text-sm border border-stone-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-stone-500"
            autoFocus
            disabled={saving}
          />
          {error && (
            <p className="mt-1 text-xs text-rose-600">{error}</p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => save(draft)}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-800 hover:bg-stone-900 text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(notes ?? '')
                setEditing(false)
                setError(null)
              }}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700"
            >
              Cancel
            </button>
            {hasNotes && (
              <button
                type="button"
                onClick={() => save('')}
                disabled={saving}
                className="ml-auto px-3 py-1.5 text-xs font-medium rounded-md text-rose-700 hover:bg-rose-50"
              >
                Clear notes
              </button>
            )}
          </div>
        </div>
      ) : hasNotes ? (
        <div>
          <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
            {notes}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setDraft(notes ?? ''); setEditing(true) }}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700"
            >
              Edit
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-stone-500 italic mb-2">
            Nothing here yet. Add a private note only you will see.
          </p>
          <button
            type="button"
            onClick={() => { setDraft(''); setEditing(true) }}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-800 hover:bg-stone-900 text-white"
          >
            Add a private note
          </button>
        </div>
      )}
    </div>
  )
}

function noteSummary(s: string): string {
  const stripped = s.replace(/\s+/g, ' ').trim()
  if (stripped.length === 0) return ''
  if (stripped.length <= 40) return `“${stripped}”`
  return `${stripped.slice(0, 40)}…`
}
