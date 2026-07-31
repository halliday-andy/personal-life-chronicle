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
import { useEscapeKey } from '@/lib/ui/use-escape-key'

export interface TripFramingContext {
  tripId: string
  destinationName: string
  /** Origin suggestion — the destination pin's anchor residence, if any. */
  suggestedOriginId: string | null
  defaultWhen: string
  /** Current round-trip flag when re-framing an existing trip; omitted on
   *  a fresh trip (defaults true — KTD3's "returns to origin" default). */
  returnToOrigin?: boolean
  /** Is this trip still a draft (no origin yet)? Decides the exit set — a
   *  draft can be kept or discarded, a framed trip can only be cancelled.
   *  Explicit rather than inferred from `returnToOrigin` being present,
   *  because an implicit tell is a tell that eventually lies. */
  isDraft: boolean
}

export default function TripFramePanel({
  ctx,
  pins,
  onDone,
  onDismiss,
  onDiscard,
  onAddOrigin,
}: {
  ctx: TripFramingContext
  pins: { relationship_id: string; name: string; type_code: string | null }[]
  /** The frame SAVED. Distinct from onDismiss because a successful frame
   *  consumes the armed "trip from here" origin and a dismissal must not
   *  (F9a/R1) — the armed pin is applied here, not at trip creation, so
   *  clearing it on dismiss would strand a draft with no way back to the
   *  intent. */
  onDone: (notice: string | null) => void
  /** Closed WITHOUT writing — Escape, ✕, backdrop, or "keep as a draft".
   *  Never deletes; destruction takes a deliberate click. */
  onDismiss: () => void
  /** Abandon the trip outright (drafts only). Deletes the trip, keeps the
   *  pin — `delete_trip` retains the trip entity whenever jots, context or
   *  recollections still reference it, so nothing written is lost. */
  onDiscard?: () => void
  /** The origin isn't on the globe yet (U9/AE5) — hand off to origin
   *  capture: the next pin placed becomes this trip's origin. */
  onAddOrigin?: () => void
}) {
  const [originId, setOriginId] = useState<string>(ctx.suggestedOriginId ?? '')
  const [title, setTitle] = useState('')
  const [whenText, setWhenText] = useState(ctx.defaultWhen)
  const [yearHint, setYearHint] = useState('')
  // One-way support (2026-07-19, Andy's chalet→Calgary drive): the model
  // always had trips.return_to_origin; this is the missing UI for it.
  const [returnToOrigin, setReturnToOrigin] = useState<boolean>(ctx.returnToOrigin ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // Escape closes without writing, and refuses mid-save (F9a).
  useEscapeKey(onDismiss, !saving)

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
          returnToOrigin,
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
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden
        onClick={saving ? undefined : onDismiss}
      />
      <div className="glass relative z-10 w-full max-w-lg rounded-2xl p-6 text-[var(--ink)]">
        <button
          type="button"
          onClick={onDismiss}
          disabled={saving}
          aria-label="Close without saving"
          className="absolute right-4 top-4 rounded px-1.5 py-0.5 text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-50"
        >
          ✕
        </button>
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-dim)]">Frame the trip</p>
        <h2 className="nocturne-display mt-1 text-2xl font-medium leading-tight">
          {ctx.destinationName}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--ink-dim)]">
          {ctx.isDraft
            ? 'The destination is saved. Origin → destination is enough to complete the trip — or keep it as a draft and come back later.'
            : 'Adjust anything here and save, or close without changing it.'}
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

        <label className="mt-3 flex items-center gap-2 text-sm text-[var(--ink-dim)]">
          <input
            type="checkbox"
            checked={returnToOrigin}
            onChange={(e) => setReturnToOrigin(e.target.checked)}
            disabled={saving}
            className="accent-[var(--ember)]"
          />
          Returned to the origin (round trip)
        </label>
        {!returnToOrigin && (
          <p className="mt-1 text-xs text-[var(--ink-dim)]/80">
            One-way — the journey ends at {ctx.destinationName}; no return arc will draw.
          </p>
        )}

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

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          {/* Abandonment, drafts only (R2/F9b). A framed trip's equivalent is
              Unframe, which lives with the trip itself — offering it here too
              would be two routes to one deletion. Two-step confirm matches
              Unframe's existing ceremony rather than inventing a lighter one
              for the same action. */}
          {ctx.isDraft && onDiscard && (
            confirmDiscard ? (
              <button
                type="button"
                onClick={onDiscard}
                disabled={saving}
                className="mr-auto rounded-lg border border-rose-400/50 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
              >
                Really discard? The place stays on your globe.
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                disabled={saving}
                className="mr-auto rounded-lg px-3 py-2 text-sm text-[var(--ink-dim)] hover:text-rose-300 disabled:opacity-50"
              >
                Discard this trip
              </button>
            )
          )}
          <button
            type="button"
            onClick={onDismiss}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            {/* "Keep as a draft" is only true while it IS a draft. Re-framing
                an existing trip, the same button read as "demote this back to
                a draft" — a destructive-sounding label on the only exit, which
                is why the panel appeared to have none (F9b, rule 11). */}
            {ctx.isDraft ? 'Keep as a draft' : 'Cancel'}
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
