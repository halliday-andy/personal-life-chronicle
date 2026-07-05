'use client'

/**
 * ContextProposalCard — Slice 6.5b.
 *
 * One card per propose_context_note tool call. The orchestrator classified
 * (part of) a submission as third-person context and proposed the entity it
 * belongs to; nothing is persisted until the user accepts here. Accept posts
 * to the existing /api/entity/[id]/context endpoint (the 6.5a machinery);
 * Adjust opens an inline editor (entity typeahead via /api/entity?q=,
 * visibility, source, body); Decline just dismisses — there is nothing to
 * delete.
 *
 * Like ProposalCard, state is local so the card survives the capture panel's
 * display:none suppression (never unmount stateful proposal UI).
 */

import { useEffect, useState } from 'react'
import Markdown from './Markdown'

export interface ContextEntityRef {
  id: string
  type: string
  canonical_name: string
}

export interface ContextProposalData {
  body: string
  entity: ContextEntityRef | null
  suggested_entity_name: string
  candidates: ContextEntityRef[]
  visibility: 'shareable' | 'private'
  source_label: string | null
  source_url: string | null
  rationale: string
}

type Status = 'pending' | 'accepted' | 'declined'

export function ContextProposalCard({ initial }: { initial: ContextProposalData }) {
  const [status, setStatus] = useState<Status>('pending')
  const [entity, setEntity] = useState<ContextEntityRef | null>(initial.entity)
  const [visibility, setVisibility] = useState<'shareable' | 'private'>(initial.visibility)
  const [body, setBody] = useState(initial.body)
  const [sourceLabel, setSourceLabel] = useState(initial.source_label ?? '')
  const [sourceUrl, setSourceUrl] = useState(initial.source_url ?? '')
  // Open the editor straight away when the orchestrator couldn't resolve
  // the entity — the user must pick one before Accept means anything.
  const [adjusting, setAdjusting] = useState(initial.entity === null)
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Entity typeahead (reuses /api/entity, same as the /review picker) ──
  const [q, setQ] = useState(initial.entity ? '' : initial.suggested_entity_name)
  const [results, setResults] = useState<ContextEntityRef[]>(initial.candidates)

  useEffect(() => {
    if (!adjusting) return
    const t = setTimeout(() => {
      fetch(`/api/entity?q=${encodeURIComponent(q)}&limit=8`)
        .then((r) => r.json())
        .then((d) => setResults(d.items ?? []))
        .catch(() => setResults([]))
    }, 200)
    return () => clearTimeout(t)
  }, [q, adjusting])

  async function handleAccept() {
    if (!entity) {
      setAdjusting(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/entity/${entity.id}/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body,
          sourceLabel: sourceLabel.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          visibility,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`)
      setStatus('accepted')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the note')
    } finally {
      setBusy(false)
    }
  }

  // ── Resolved states ─────────────────────────────────────────────

  if (status === 'accepted' && entity) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-emerald-700 font-medium">
          <span>
            ✓ Context saved to <strong>{entity.canonical_name}</strong>
            {visibility === 'private' && ' (private)'}
          </span>
        </div>
        <a
          href={`/entities/${entity.id}`}
          className="mt-1 inline-block text-xs text-emerald-700/80 underline hover:text-emerald-900"
        >
          Open its page ↗
        </a>
      </div>
    )
  }
  if (status === 'declined') {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500 italic">
        Context proposal dismissed — nothing was saved.
      </div>
    )
  }

  // ── Pending card ────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-teal-200 bg-white px-4 py-3 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-medium uppercase tracking-wide px-1.5 py-0.5 text-[10px]">
            Context note
          </span>
          {entity ? (
            <span className="text-xs text-stone-600">
              on <strong className="text-stone-800">{entity.canonical_name}</strong>
              <span className="text-stone-400"> · {entity.type}</span>
            </span>
          ) : (
            <span className="text-xs text-amber-700">
              about “{initial.suggested_entity_name}” — pick the entity below
            </span>
          )}
          <span
            className={`rounded-full border text-[10px] px-1.5 py-0.5 ${
              visibility === 'private'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-stone-50 text-stone-500 border-stone-200'
            }`}
          >
            {visibility === 'private' ? '🔒 private' : 'shareable'}
          </span>
        </div>
        {!adjusting && (
          <button
            onClick={() => setAdjusting(true)}
            className="text-xs text-stone-400 hover:text-stone-900 transition-colors"
          >
            Adjust
          </button>
        )}
      </div>

      {/* Body preview (rendered as markdown, like the entity page will) */}
      <div
        className={`rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700 ${
          expanded ? 'max-h-80 overflow-y-auto' : 'max-h-24 overflow-hidden'
        }`}
      >
        <Markdown>{body}</Markdown>
      </div>
      {body.length > 300 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-stone-400 hover:text-stone-700"
        >
          {expanded ? '▴ Collapse' : '▾ Show all'}
        </button>
      )}

      {/* Rationale + source */}
      <p className="text-[11px] text-stone-500 italic">{initial.rationale}</p>
      {!adjusting && (sourceLabel || sourceUrl) && (
        <p className="text-[11px] text-stone-500">
          Source: {sourceLabel || null}
          {sourceLabel && sourceUrl ? ' · ' : null}
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noreferrer" className="underline">
              {sourceUrl}
            </a>
          )}
        </p>
      )}

      {/* Adjust editor */}
      {adjusting && (
        <div className="rounded-lg border border-stone-200 bg-white p-2 space-y-2">
          <p className="text-xs text-stone-500">Attach this as a context note on…</p>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people, places, organizations…"
            autoFocus={!entity}
            className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-stone-500"
          />
          <div className="max-h-32 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                disabled={busy}
                onClick={() => setEntity(r)}
                className={`block w-full rounded px-2 py-1 text-left text-sm hover:bg-stone-100 disabled:opacity-50 ${
                  entity?.id === r.id ? 'bg-teal-50 text-teal-900' : 'text-stone-800'
                }`}
              >
                {r.canonical_name} <span className="text-xs text-stone-400">· {r.type}</span>
                {entity?.id === r.id && <span className="ml-1 text-teal-600">✓</span>}
              </button>
            ))}
            {q && results.length === 0 && (
              <p className="px-2 py-1 text-xs text-stone-400">No matches.</p>
            )}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-md border border-stone-300 px-2 py-1.5 text-sm text-stone-800 outline-none focus:border-stone-500"
          />
          <div className="flex gap-2">
            <input
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              placeholder="Source label (optional)"
              className="flex-1 rounded-md border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
            />
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="Source URL (optional)"
              className="flex-1 rounded-md border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
            />
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-stone-500">Visibility:</span>
            <label className="flex items-center gap-1 text-stone-700">
              <input
                type="radio"
                checked={visibility === 'shareable'}
                onChange={() => setVisibility('shareable')}
              />{' '}
              Shareable
            </label>
            <label className="flex items-center gap-1 text-stone-700">
              <input
                type="radio"
                checked={visibility === 'private'}
                onChange={() => setVisibility('private')}
              />{' '}
              Private
            </label>
            <button
              onClick={() => setAdjusting(false)}
              disabled={busy}
              className="ml-auto text-stone-500 hover:text-stone-800"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
        </p>
      )}

      {/* Primary actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleAccept}
          disabled={busy || !body.trim() || (!entity && !adjusting)}
          className="flex-1 rounded-lg bg-teal-700 text-white text-xs font-medium py-1.5 hover:bg-teal-800 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Saving…' : entity ? `Accept — save to ${entity.canonical_name}` : 'Pick an entity first'}
        </button>
        <button
          onClick={() => setStatus('declined')}
          disabled={busy}
          className="flex-1 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium py-1.5 hover:bg-stone-50 disabled:opacity-50 transition-colors"
        >
          Decline
        </button>
      </div>
    </div>
  )
}
