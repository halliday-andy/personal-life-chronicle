'use client'

/**
 * Trip framing panel (Trips & Travel U3).
 *
 * Opens right after a destination pin saves with "Trip" chosen — the
 * trip already exists as a draft, so everything here is optional
 * (R5/R9): confirm the origin (suggested first: the home the pin was
 * anchored to), title the trip, refine the timeframe, add a year hint
 * for Travel Journal ordering. "Keep as a draft" is a first-class exit,
 * not a cancel — the destination is preserved either way.
 *
 * Also reused by the pin detail card's "Frame as trip" action (U6).
 */

import { useState } from 'react'

export interface TripFramingContext {
  tripId: string
  destinationName: string
  /** Origin suggestion — the destination pin's anchor residence, if any. */
  suggestedOriginId: string | null
  defaultWhen: string
}

export default function TripFramePanel({
  ctx,
  pins,
  onDone,
  onAddOrigin,
}: {
  ctx: TripFramingContext
  pins: { relationship_id: string; name: string; type_code: string | null }[]
  onDone: (notice: string | null) => void
  /** The origin isn't on the globe yet (U9/AE5) — hand off to origin
   *  capture: the next pin placed becomes this trip's origin. */
  onAddOrigin?: () => void
}) {
  const [originId, setOriginId] = useState<string>(ctx.suggestedOriginId ?? '')
  const [title, setTitle] = useState('')
  const [whenText, setWhenText] = useState(ctx.defaultWhen)
  const [yearHint, setYearHint] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const suggested = pins.find((p) => p.relationship_id === ctx.suggestedOriginId)
  const others = pins.filter((p) => p.relationship_id !== ctx.suggestedOriginId)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const year = yearHint.trim() === '' ? null : Number(yearHint.trim())
      if (year !== null && (!Number.isInteger(year) || year < 0 || year > 9999)) {
        throw new Error('The year hint should be a four-digit year.')
      }
      const res = await fetch(`/api/trips/${ctx.tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originRelationshipId: originId || null,
          title: title.trim() || undefined,
          whenText: whenText.trim() || undefined,
          yearHint: year,
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail || b.error || `HTTP ${res.status}`)
      }
      onDone(originId
        ? `Trip framed — ${title.trim() || ctx.destinationName} has its origin.`
        : `Trip saved — frame the origin whenever you're ready.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not frame the trip.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden />
      <div className="glass relative z-10 w-full max-w-lg rounded-2xl p-6 text-[var(--ink)]">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-dim)]">Frame the trip</p>
        <h2 className="nocturne-display mt-1 text-2xl font-medium leading-tight">
          {ctx.destinationName}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--ink-dim)]">
          The destination is saved. Origin → destination is enough to complete the trip —
          or keep it as a draft and come back later.
        </p>

        <label className="mt-5 block text-sm text-[var(--ink-dim)]">Where did the trip start?</label>
        <select
          value={originId}
          onChange={(e) => {
            if (e.target.value === '__new__') { onAddOrigin?.(); return }
            setOriginId(e.target.value)
          }}
          disabled={saving}
          className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ember-soft)]"
        >
          {suggested && (
            <option value={suggested.relationship_id}>
              {suggested.name} (home at the time)
            </option>
          )}
          {others.map((p) => (
            <option key={p.relationship_id} value={p.relationship_id}>{p.name}</option>
          ))}
          {onAddOrigin && (
            <option value="__new__">＋ Pin a new origin on the globe…</option>
          )}
          <option value="">Decide later</option>
        </select>

        <label className="mt-4 block text-sm text-[var(--ink-dim)]">Trip title (optional)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`e.g. “The ${ctx.destinationName} conference”, “Honeymoon”`}
          disabled={saving}
          className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] placeholder-[var(--ink-dim)]/70 outline-none focus:border-[var(--ember-soft)]"
        />

        <div className="mt-4 flex gap-3">
          <div className="flex-1">
            <label className="block text-sm text-[var(--ink-dim)]">When? (free text)</label>
            <input
              type="text"
              value={whenText}
              onChange={(e) => setWhenText(e.target.value)}
              placeholder="e.g. “spring 1984”, “mid 90s”"
              disabled={saving}
              className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] placeholder-[var(--ink-dim)]/70 outline-none focus:border-[var(--ember-soft)]"
            />
          </div>
          <div className="w-32">
            <label className="block text-sm text-[var(--ink-dim)]">Year (optional)</label>
            <input
              type="text"
              inputMode="numeric"
              value={yearHint}
              onChange={(e) => setYearHint(e.target.value)}
              placeholder="1984"
              disabled={saving}
              className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] placeholder-[var(--ink-dim)]/70 outline-none focus:border-[var(--ember-soft)]"
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-[var(--ink-dim)]/80">
          The year orders your Travel Journal — only what you type here is used, never a guess from the phrase.
        </p>

        {error && (
          <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200">{error}</p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onDone(null)}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            Keep as a draft
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-[var(--ember)] px-5 py-2 text-sm font-medium text-[#241500] shadow-[0_0_20px_rgba(244,177,74,0.45)] hover:bg-[var(--ember-soft)] disabled:opacity-60"
          >
            {saving ? 'Framing…' : 'Save the frame'}
          </button>
        </div>
      </div>
    </div>
  )
}
