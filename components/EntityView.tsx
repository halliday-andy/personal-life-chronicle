'use client'

/**
 * EntityView — the per-entity context home (Slice 6.2 / 6.3).
 *
 * Renders the entity's identity, its context notes (shareable + a visually
 * separate owner-only private section), and the recollections that mention it
 * (links out — never hosted here). Hosts the Add-context form. Private notes
 * never leave the owner's view; published/synthesis paths read only shareable.
 */

import { useState } from 'react'
import Link from 'next/link'
import Markdown from './Markdown'

export interface ContextNote {
  id: string
  body: string
  source_label: string | null
  source_url: string | null
  created_by: string
  visibility: string
  created_at: string
}

interface NoteDraft {
  body: string
  sourceLabel: string
  sourceUrl: string
  visibility: 'private' | 'shareable'
}

export interface MentionRecollection {
  id: string
  excerpt: string
  occurred_at_fuzzy: string | null
  created_at: string
}

interface Entity {
  id: string
  type: string
  canonical_name: string
  aliases: string[]
  description: string | null
}

const TYPE_LABEL: Record<string, string> = {
  person: 'Person', place: 'Place', organization: 'Organization',
  artifact: 'Artifact', event_series: 'Event series',
}

export default function EntityView({ entity, notes: initialNotes, recollections }: {
  entity: Entity
  notes: ContextNote[]
  recollections: MentionRecollection[]
}) {
  const [notes, setNotes] = useState<ContextNote[]>(initialNotes)
  const [adding, setAdding] = useState(false)
  const [body, setBody] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'shareable'>('private')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shareable = notes.filter((n) => n.visibility === 'shareable')
  const priv = notes.filter((n) => n.visibility === 'private')

  async function addNote() {
    if (!body.trim()) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/entity/${entity.id}/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, sourceLabel, sourceUrl, visibility }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`)
      setNotes((cur) => [d.note as ContextNote, ...cur])
      setBody(''); setSourceLabel(''); setSourceUrl(''); setVisibility('private'); setAdding(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the note.')
    } finally {
      setBusy(false)
    }
  }

  async function removeNote(id: string) {
    setNotes((cur) => cur.filter((n) => n.id !== id)) // optimistic
    await fetch(`/api/entity/${entity.id}/context?note=${id}`, { method: 'DELETE' }).catch(() => {})
  }

  // Edit an existing note (set its `## title`, fix the body, retarget
  // visibility/source). Throws on failure so the card can surface it; the
  // returned note re-slots into shareable/private automatically.
  async function updateNote(id: string, patch: NoteDraft) {
    const res = await fetch(`/api/entity/${entity.id}/context?note=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`)
    setNotes((cur) => cur.map((n) => (n.id === id ? (d.note as ContextNote) : n)))
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
        <Link href="/entities" className="text-sm text-stone-500 hover:text-stone-800">← Entities</Link>

        <div className="mt-3 flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold text-stone-900">{entity.canonical_name}</h1>
          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-600">{TYPE_LABEL[entity.type] ?? entity.type}</span>
        </div>
        {entity.aliases.length > 0 && (
          <p className="mt-1 text-sm text-stone-500">also: {entity.aliases.join(', ')}</p>
        )}
        {entity.description && <p className="mt-1 text-sm text-stone-600">{entity.description}</p>}

        {/* Context ─────────────────────────────────────────────── */}
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Context</h2>
            {!adding && (
              <button onClick={() => setAdding(true)} className="rounded-lg bg-stone-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700">
                Add context
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-stone-400">Background and research about this entity — separate from your recollections. Many notes welcome; nothing is overwritten.</p>

          {adding && (
            <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4">
              <NoteFields
                body={body} setBody={setBody}
                sourceLabel={sourceLabel} setSourceLabel={setSourceLabel}
                sourceUrl={sourceUrl} setSourceUrl={setSourceUrl}
                visibility={visibility} setVisibility={setVisibility}
              />
              {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
              <div className="mt-3 flex items-center gap-2">
                <button onClick={addNote} disabled={busy || !body.trim()} className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
                  {busy ? 'Saving…' : 'Save note'}
                </button>
                <button onClick={() => { setAdding(false); setError(null) }} disabled={busy} className="text-sm text-stone-500 hover:text-stone-800">Cancel</button>
              </div>
            </div>
          )}

          {notes.length === 0 && !adding && (
            <p className="mt-3 text-sm text-stone-400">No context yet.</p>
          )}

          {shareable.length > 0 && (
            <div className="mt-3 space-y-2">
              {shareable.map((n) => <NoteCard key={n.id} note={n} onRemove={() => removeNote(n.id)} onSave={(patch) => updateNote(n.id, patch)} />)}
            </div>
          )}

          {priv.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <span>🔒</span> Private — for your eyes only (never shared or published)
              </p>
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-2">
                {priv.map((n) => <NoteCard key={n.id} note={n} onRemove={() => removeNote(n.id)} onSave={(patch) => updateNote(n.id, patch)} />)}
              </div>
            </div>
          )}
        </section>

        {/* Recollections ───────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Recollections that mention {entity.canonical_name}{recollections.length > 0 ? ` · ${recollections.length}` : ''}
          </h2>
          {recollections.length === 0 ? (
            <p className="mt-2 text-sm text-stone-400">None yet.</p>
          ) : (
            // Each mention is a distinct bordered row — separation and the
            // link affordance must read at rest, not only on hover
            // (Andy's QA, 2026-07-06). Metadata = the memory's own fuzzy
            // time phrase + capture date.
            <ul className="mt-2 space-y-2">
              {recollections.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/memories?entity=${entity.id}`}
                    title="Open in Recollections"
                    className="group block rounded-lg border border-stone-200 bg-white px-3 py-2 transition-colors hover:border-stone-400 hover:bg-stone-50"
                  >
                    <span className="block text-sm leading-relaxed text-stone-700 group-hover:text-stone-900">
                      {r.excerpt || '(untitled recollection)'}{r.excerpt.length >= 200 ? '…' : ''}
                    </span>
                    <span className="mt-1 flex items-baseline gap-2 text-[11px] text-stone-400">
                      {r.occurred_at_fuzzy && <span className="text-stone-500">{r.occurred_at_fuzzy}</span>}
                      <span>captured {new Date(r.created_at).toLocaleDateString()}</span>
                      <span className="ml-auto text-stone-300 transition-colors group-hover:text-stone-500">
                        open in Recollections →
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

// Shared add/edit fields so both surfaces stay in lockstep (same title hint,
// placeholder, source inputs, and visibility control).
function NoteFields({
  body, setBody, sourceLabel, setSourceLabel, sourceUrl, setSourceUrl, visibility, setVisibility,
}: {
  body: string; setBody: (v: string) => void
  sourceLabel: string; setSourceLabel: (v: string) => void
  sourceUrl: string; setSourceUrl: (v: string) => void
  visibility: 'private' | 'shareable'; setVisibility: (v: 'private' | 'shareable') => void
}) {
  return (
    <>
      <p className="mb-1.5 text-xs text-stone-500">
        Start with a title so it’s easy to find later:{' '}
        <span className="text-stone-400">## B-47s in the Cold War</span>
      </p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="## A short title&#10;&#10;Background, research, a fact worth keeping…"
        rows={4}
        className="w-full resize-y rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
      />
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="Source label (optional)" className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500" />
        <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Source URL (optional)" className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <span className="text-xs text-stone-500">Visibility:</span>
        <label className="flex items-center gap-1.5 text-sm text-stone-700">
          <input type="radio" checked={visibility === 'private'} onChange={() => setVisibility('private')} /> Private <span className="text-xs text-stone-400">(for your eyes only)</span>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-stone-700">
          <input type="radio" checked={visibility === 'shareable'} onChange={() => setVisibility('shareable')} /> Shareable
        </label>
      </div>
    </>
  )
}

function NoteCard({ note, onRemove, onSave }: {
  note: ContextNote
  onRemove: () => void
  onSave: (patch: NoteDraft) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(note.body)
  const [sourceLabel, setSourceLabel] = useState(note.source_label ?? '')
  const [sourceUrl, setSourceUrl] = useState(note.source_url ?? '')
  const [visibility, setVisibility] = useState<'private' | 'shareable'>(note.visibility === 'shareable' ? 'shareable' : 'private')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEdit() {
    // Re-seed from the note each time so a cancelled edit doesn't leak into
    // the next one.
    setBody(note.body)
    setSourceLabel(note.source_label ?? '')
    setSourceUrl(note.source_url ?? '')
    setVisibility(note.visibility === 'shareable' ? 'shareable' : 'private')
    setError(null)
    setEditing(true)
  }

  async function save() {
    if (!body.trim()) return
    setBusy(true); setError(null)
    try {
      await onSave({ body, sourceLabel, sourceUrl, visibility })
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the note.')
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-stone-300 bg-white p-3">
        <NoteFields
          body={body} setBody={setBody}
          sourceLabel={sourceLabel} setSourceLabel={setSourceLabel}
          sourceUrl={sourceUrl} setSourceUrl={setSourceUrl}
          visibility={visibility} setVisibility={setVisibility}
        />
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <div className="mt-3 flex items-center gap-2">
          <button onClick={save} disabled={busy || !body.trim()} className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          <button onClick={() => { setEditing(false); setError(null) }} disabled={busy} className="text-sm text-stone-500 hover:text-stone-800">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="group rounded-lg border border-stone-200 bg-white p-3">
      <div className="text-sm text-stone-800">
        <Markdown>{note.body}</Markdown>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-stone-400">
        {note.source_url ? (
          <a href={note.source_url} target="_blank" rel="noopener noreferrer" className="text-stone-500 hover:underline">
            {note.source_label || note.source_url}
          </a>
        ) : note.source_label ? (
          <span>{note.source_label}</span>
        ) : null}
        <span className="ml-auto">{note.created_by === 'assistant' ? 'Assistant' : 'You'} · {new Date(note.created_at).toLocaleDateString()}</span>
        <button onClick={startEdit} className="opacity-0 transition group-hover:opacity-100 hover:text-stone-700" aria-label="Edit note">Edit</button>
        <button onClick={onRemove} className="opacity-0 transition group-hover:opacity-100 hover:text-rose-600" aria-label="Remove note">Remove</button>
      </div>
    </div>
  )
}
