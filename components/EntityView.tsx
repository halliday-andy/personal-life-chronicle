'use client'

/**
 * EntityView — the per-entity context home (Slice 6.2 / 6.3).
 *
 * Renders the entity's identity, its context notes (shareable + a visually
 * separate owner-only private section), and the recollections that mention it
 * (links out — never hosted here). Hosts the Add-context form. Private notes
 * never leave the owner's view; published/synthesis paths read only shareable.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Markdown from './Markdown'
import { handleRichPaste } from '@/lib/richPaste'
import PinHopper from './globe/PinHopper'
import { useUiChrome } from './UiChromeContext'

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
  /**
   * Where this recollection lives (its role='location' pin) — the row's
   * provenance header, linking into the Journey. Reworked 2026-07-10
   * (Andy's Leola QA): the EXCERPT now always opens the memory itself;
   * geography is the secondary hop, not the primary landing.
   */
  home?: { relationship_id: string; name: string; when_text: string | null } | null
  /** Spine position of the home pin — the thread's reading order. */
  threadOrder?: number
}

interface Entity {
  id: string
  type: string
  canonical_name: string
  aliases: string[]
  description: string | null
  /** Life's Cast membership (metadata flag, persons only — Slice 7.2). */
  in_lifes_cast?: boolean
}

const TYPE_LABEL: Record<string, string> = {
  person: 'Person', place: 'Place', organization: 'Organization',
  concept: 'Concept', artifact: 'Artifact', vehicle: 'Vehicle',
  event_series: 'Event', // singular badge; "Events" tab label in EntitiesList
}

/**
 * AliasEditor — owner alias management (2026-07-07 task).
 *
 * Aliases previously only ever GREW (merges + extraction append; nothing
 * pruned), so junk like the leftover "Leo" on Leola Lapides was
 * unremovable and risked false matches in entity resolution (aliases are
 * exact-match inputs to the matcher). Chips with × remove; a small input
 * adds. PATCH /api/entity/[id] already replaces aliases wholesale with
 * case-insensitive dedupe — this is the UI it was waiting for.
 */
function AliasEditor({ entityId, initial }: { entityId: string; initial: string[] }) {
  const [aliases, setAliases] = useState<string[]>(initial)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(next: string[]) {
    setBusy(true)
    setError(null)
    const prev = aliases
    setAliases(next) // optimistic
    try {
      const res = await fetch(`/api/entity/${entityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aliases: next }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`)
    } catch (e) {
      setAliases(prev)
      setError(e instanceof Error ? e.message : 'Could not update aliases')
    } finally {
      setBusy(false)
    }
  }

  function addDraft() {
    const trimmed = draft.trim()
    if (!trimmed) return
    if (aliases.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
      setDraft('')
      setAdding(false)
      return
    }
    save([...aliases, trimmed])
    setDraft('')
    setAdding(false)
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-stone-500">
      {aliases.length > 0 && <span>also:</span>}
      {aliases.map((a) => (
        <span
          key={a}
          className="group inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-600"
        >
          {a}
          <button
            type="button"
            onClick={() => save(aliases.filter((x) => x !== a))}
            disabled={busy}
            aria-label={`Remove alias ${a}`}
            title="Remove this alias — it will no longer match during entity resolution"
            className="text-stone-300 hover:text-rose-600 disabled:opacity-30"
          >
            ×
          </button>
        </span>
      ))}
      {adding ? (
        <span className="inline-flex items-center gap-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addDraft() }
              if (e.key === 'Escape') { setAdding(false); setDraft('') }
            }}
            placeholder="Another name…"
            autoFocus
            className="w-36 rounded-full border border-stone-300 px-2 py-0.5 text-xs focus:border-stone-500 focus:outline-none"
          />
          <button type="button" onClick={addDraft} disabled={busy || !draft.trim()} className="text-xs text-stone-500 hover:text-stone-800 disabled:opacity-40">
            add
          </button>
          <button type="button" onClick={() => { setAdding(false); setDraft('') }} className="text-xs text-stone-400 hover:text-stone-700">
            cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={busy}
          title="Add another name this entity goes by — future mentions of it will resolve here"
          className="rounded-full border border-dashed border-stone-300 px-2 py-0.5 text-xs text-stone-400 hover:border-stone-400 hover:text-stone-700 disabled:opacity-50"
        >
          + alias
        </button>
      )}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  )
}

export default function EntityView({ entity, notes: initialNotes, recollections }: {
  entity: Entity
  notes: ContextNote[]
  recollections: MentionRecollection[]
}) {
  const [notes, setNotes] = useState<ContextNote[]>(initialNotes)
  const [adding, setAdding] = useState(false)
  const contextSectionRef = useRef<HTMLElement>(null)
  const [body, setBody] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'shareable'>('private')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Open-stub count for the person page's hopper heading (Slice 7.1).
  const [hopperCount, setHopperCount] = useState<number | null>(null)
  // Life's Cast membership (Slice 7.2) — deliberate promote/demote.
  const [inCast, setInCast] = useState(entity.in_lifes_cast === true)
  const [castBusy, setCastBusy] = useState(false)
  const [castError, setCastError] = useState<string | null>(null)
  // Person-anchored recollection capture (Slice 7.3) — no pin required.
  const router = useRouter()
  // Ambient context for the assistant (2026-07-09): this page's entity is
  // what "this person"/"this place" means in a capture conversation.
  const { setViewingEntity } = useUiChrome()
  useEffect(() => {
    setViewingEntity({ entity_id: entity.id, entity_name: entity.canonical_name, entity_type: entity.type })
    return () => setViewingEntity(null)
  }, [entity.id, entity.canonical_name, entity.type, setViewingEntity])
  // Deep-link from the pin card's "＋ Add New Context ↗": open the composer on
  // arrival and scroll it into view (2026-07-20). Client-only param read, so no
  // Suspense boundary is needed.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('addContext')) {
      setAdding(true)
      contextSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])
  const [addingRec, setAddingRec] = useState(false)
  const [recBody, setRecBody] = useState('')
  const [recWhen, setRecWhen] = useState('')
  const [recBusy, setRecBusy] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)
  const [recSaved, setRecSaved] = useState(false)

  async function addRecollection() {
    if (!recBody.trim() || recBusy) return
    setRecBusy(true)
    setRecError(null)
    try {
      const res = await fetch(`/api/entity/${entity.id}/recollection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: recBody, when: recWhen }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`)
      setRecBody(''); setRecWhen(''); setAddingRec(false)
      setRecSaved(true)
      setTimeout(() => setRecSaved(false), 4000)
      router.refresh() // mentions list is server-fetched — pull the new row in
    } catch (e) {
      setRecError(e instanceof Error ? e.message : 'Could not save the recollection.')
    } finally {
      setRecBusy(false)
    }
  }

  async function toggleCast() {
    if (castBusy) return
    setCastBusy(true)
    setCastError(null)
    const next = !inCast
    try {
      const res = await fetch(`/api/entity/${entity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ in_lifes_cast: next }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`)
      setInCast(d.in_lifes_cast === true)
    } catch (e) {
      setCastError(e instanceof Error ? e.message : "Could not update Life's Cast.")
    } finally {
      setCastBusy(false)
    }
  }

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
          {/* Life's Cast (Slice 7.2): a deliberate act — the Cast never
              auto-populates. Persons only; the flag lives in metadata. */}
          {entity.type === 'person' && (
            <button
              onClick={toggleCast}
              disabled={castBusy}
              title={inCast
                ? "Remove from Life's Cast"
                : "Life's Cast — the key people of your chronicle. Adding someone is always your call."}
              className={`ml-auto shrink-0 rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:opacity-50 ${
                inCast
                  ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'border-stone-300 text-stone-500 hover:border-amber-300 hover:text-amber-700'
              }`}
            >
              {inCast ? "★ In Life's Cast" : "☆ Add to Life's Cast"}
            </button>
          )}
        </div>
        {castError && <p className="mt-1 text-xs text-rose-600">{castError}</p>}
        <AliasEditor entityId={entity.id} initial={entity.aliases} />
        {entity.description && <p className="mt-1 text-sm text-stone-600">{entity.description}</p>}

        {/* Context ─────────────────────────────────────────────── */}
        <section ref={contextSectionRef} className="mt-6">
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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Recollections that mention {entity.canonical_name}{recollections.length > 0 ? ` · ${recollections.length}` : ''}
            </h2>
            {/* Person-anchored capture (Slice 7.3): a memory about a person
                needs no place pin. Saves FINAL; when-phrase kept verbatim. */}
            {entity.type === 'person' && !addingRec && (
              <button
                onClick={() => setAddingRec(true)}
                className="rounded-lg bg-stone-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
              >
                Add recollection
              </button>
            )}
          </div>

          {recSaved && (
            <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Saved to your chronicle — it now appears below and in Recollections.
            </p>
          )}

          {addingRec && (
            <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4">
              <p className="mb-1.5 text-xs text-stone-500">
                A memory about {entity.canonical_name} — first person, your words. No place needed.
              </p>
              <textarea
                value={recBody}
                onChange={(e) => setRecBody(e.target.value)}
                onPaste={(e) => handleRichPaste(e, setRecBody)}
                placeholder="What happened, as you remember it…"
                rows={5}
                autoFocus
                className="w-full resize-y rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
              />
              <input
                value={recWhen}
                onChange={(e) => setRecWhen(e.target.value)}
                placeholder="When was this? Your words — “summer of 1982”, “around when we graduated” (optional)"
                className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
              {recError && <p className="mt-2 text-sm text-rose-600">{recError}</p>}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={addRecollection}
                  disabled={recBusy || !recBody.trim()}
                  className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
                >
                  {recBusy ? 'Saving…' : 'Save recollection'}
                </button>
                <button
                  onClick={() => { setAddingRec(false); setRecError(null) }}
                  disabled={recBusy}
                  className="text-sm text-stone-500 hover:text-stone-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {recollections.length === 0 ? (
            <p className="mt-2 text-sm text-stone-400">None yet.</p>
          ) : (
            // Each mention is a distinct bordered row — separation and the
            // link affordance must read at rest, not only on hover
            // (Andy's QA, 2026-07-06). Metadata = the memory's own fuzzy
            // time phrase + capture date.
            // The thread (2026-07-10, Andy's Leola QA): rows read forward
            // in spine order, each led by its home pin's provenance header
            // (→ Journey). The EXCERPT always opens the memory itself —
            // the person's story first, geography one step away.
            <ul className="mt-2 space-y-2.5">
              {recollections.map((r) => (
                <li key={r.id}>
                  {r.home && (
                    <Link
                      href={`/journey?pin=${r.home.relationship_id}`}
                      title={`Go to ${r.home.name} in the journey`}
                      className="text-[11px] font-medium text-amber-700/90 hover:text-amber-800 hover:underline"
                    >
                      {r.home.name}
                      {r.home.when_text && <span className="font-normal text-stone-400"> · {r.home.when_text}</span>}
                    </Link>
                  )}
                  <Link
                    href={`/memories?entity=${entity.id}#${r.id}`}
                    title="Read this recollection"
                    className="group block rounded-lg border border-stone-200 bg-white px-3 py-2 transition-colors hover:border-stone-400 hover:bg-stone-50"
                  >
                    <span className="block text-sm leading-relaxed text-stone-700 group-hover:text-stone-900">
                      {r.excerpt || '(untitled recollection)'}{r.excerpt.length >= 220 ? '…' : ''}
                    </span>
                    <span className="mt-1 flex items-baseline gap-2 text-[11px] text-stone-400">
                      {r.occurred_at_fuzzy && <span className="text-stone-500">{r.occurred_at_fuzzy}</span>}
                      <span>captured {new Date(r.created_at).toLocaleDateString()}</span>
                      <span className="ml-auto text-stone-300 transition-colors group-hover:text-stone-500">
                        read this recollection →
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* The Hopper — person host (Slice 7.1) ─────────────────── */}
        {/* Same component as the pin edit panel's notepad; a person page
            collects to-be-recollected memories about this person. The
            capture-assistant consume loop arrives with Hopper 5b. */}
        {entity.type === 'person' && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Memories to write{hopperCount ? ` · ${hopperCount}` : ''}
            </h2>
            <p className="mt-1 text-xs text-stone-400">
              Jot the memories {entity.canonical_name} brings to mind — write them up when there&apos;s time.
            </p>
            <PinHopper
              entityId={entity.id}
              hostName={entity.canonical_name}
              variant="panel"
              theme="light"
              showTitle={false}
              onCountChange={setHopperCount}
            />
          </section>
        )}
      </div>
    </div>
  )
}

// Shared add/edit fields so both surfaces stay in lockstep (same title hint,
// placeholder, source inputs, and visibility control).
function NoteFields({
  body, setBody, sourceLabel, setSourceLabel, sourceUrl, setSourceUrl, visibility, setVisibility,
}: {
  body: string; setBody: React.Dispatch<React.SetStateAction<string>>
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
        onPaste={(e) => handleRichPaste(e, setBody)}
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
