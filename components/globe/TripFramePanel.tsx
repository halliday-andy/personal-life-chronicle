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
 *
 * R22 (2026-08-03) added the other end. The panel used to STATE the
 * destination as a settled fact — "The destination is saved" — which sent
 * Andy hunting for a control that did not exist, because `retarget_trip`
 * was reachable only by an agent running SQL. A panel that names a field
 * it cannot edit must either say so or offer the edit; this offers it.
 * The trip's KIND arrived by the same reasoning: `frame_trip` has always
 * taken `p_subtype` and no caller ever sent one.
 */

import { useState } from 'react'
import { useEscapeKey } from '@/lib/ui/use-escape-key'
import PinSelect, { type SelectablePin } from './PinSelect'
import { buildTripPatchPayload } from '@/lib/globe/trip-patch-payload'
import { TRIP_SUBTYPES, TRIP_SUBTYPE_LABELS, type TripSubtype } from '@/lib/globe/trip-types'
import { isRelocation } from '@/lib/globe/trip-kind'

export interface TripFramingContext {
  tripId: string
  /** The DESTINATION's own name — never the trip's title. The two were
   *  conflated (`t.title || t.destination_name`), which is why the one-way
   *  hint could read "the journey ends at The epic solo road trip in the
   *  overloaded Fiat 128". Same family as F26; R22 made it load-bearing,
   *  since the destination is now editable and the sentence must track it. */
  destinationName: string
  /** Which pin the trip currently ends at — pre-selects the destination
   *  selector, and is the baseline the retarget decision compares against. */
  destinationRelationshipId: string
  /** The trip's CURRENT title, so re-framing edits it rather than appearing
   *  untitled. Empty on a fresh trip. Kept separate from `destinationName`,
   *  which conflated the two — once a trip was titled, its title became the
   *  "destination name" and got quoted back inside the placeholder example,
   *  so a saved title looked like ghost text in an empty field (F26,
   *  Andy 2026-08-01). */
  defaultTitle?: string
  /** The trip's CURRENT year hint, same reasoning as the title — 5 of 6 of
   *  Andy's trips carry one, and re-framing showed the field blank. */
  defaultYearHint?: string
  /** The trip's CURRENT kind. Always known: a subtype is chosen at
   *  creation, so there is no "unset" state to represent. */
  subtype: TripSubtype
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
  pins: SelectablePin[]
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
  const [destinationId, setDestinationId] = useState<string>(ctx.destinationRelationshipId)
  // Default ON: the old destination is usually the story of the journey —
  // Wendy's apartment is where the Fiat 128 stopped, not somewhere to
  // discard. Matches `retarget_trip`'s own default rather than restating it.
  const [demoteOldToStop, setDemoteOldToStop] = useState(true)
  const [subtype, setSubtype] = useState<TripSubtype>(ctx.subtype)
  const [title, setTitle] = useState(ctx.defaultTitle ?? '')
  const [whenText, setWhenText] = useState(ctx.defaultWhen)
  const [yearHint, setYearHint] = useState(ctx.defaultYearHint ?? '')
  // One-way support (2026-07-19, Andy's chalet→Calgary drive): the model
  // always had trips.return_to_origin; this is the missing UI for it.
  const [returnToOrigin, setReturnToOrigin] = useState<boolean>(ctx.returnToOrigin ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // Escape closes without writing, and refuses mid-save (F9a).
  useEscapeKey(onDismiss, !saving)

  const nameOf = (relId: string) =>
    pins.find((p) => p.relationship_id === relId)?.name ?? ctx.destinationName
  // Where the trip ends AS CURRENTLY CHOSEN — every sentence about the
  // journey's end reads from this, so the copy tracks the selector instead
  // of describing the state the panel opened in.
  const destinationLabel = nameOf(destinationId)
  const retargeting = destinationId !== ctx.destinationRelationshipId
  // Said at the moment of the decision, not only afterwards on the card:
  // a one-way trip ending at a home is the case R6 part 1 unlocked, and
  // without the word it reads like a mistake.
  const relocating = isRelocation({
    subtype,
    return_to_origin: returnToOrigin,
    destination_type_code: pins.find((p) => p.relationship_id === destinationId)?.type_code,
  })

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
        body: JSON.stringify(
          buildTripPatchPayload(
            { originId, destinationId, demoteOldToStop, title, whenText, yearHint: year, subtype, returnToOrigin },
            ctx.destinationRelationshipId,
          ),
        ),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail || b.error || `HTTP ${res.status}`)
      }
      onDone(
        retargeting
          ? `The trip now ends at ${destinationLabel}${demoteOldToStop ? ` — ${ctx.destinationName} is a stop along the way.` : '.'}`
          : originId
            ? `Trip framed — ${title.trim() || ctx.destinationName} has its origin.`
            : `Trip saved — frame the origin whenever you're ready.`,
      )
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
      <div className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 text-[var(--ink)]">
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
          {/* A titled trip is known by its title; an untitled one by where it
              went. Resolved HERE rather than by the caller passing a title
              under the name `destinationName` — that conflation is what made
              the one-way sentence name a trip instead of a place. */}
          {ctx.defaultTitle?.trim() || ctx.destinationName}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--ink-dim)]">
          {ctx.isDraft
            ? 'Origin → destination is enough to complete the trip — change either if you recorded it differently, or keep it as a draft and come back later.'
            : 'Adjust anything here and save, or close without changing it. Both ends of the journey can move.'}
        </p>

        <div className="mt-5">
          <PinSelect
            id="trip-origin"
            label="Where did the trip start?"
            value={originId}
            onChange={setOriginId}
            pins={pins}
            disabled={saving}
            suggestedId={ctx.suggestedOriginId}
            suggestionSuffix="home at the time"
            allowNone
            noneLabel="Decide later"
            onAddNew={onAddOrigin}
            addNewLabel="＋ Pin a new origin on the globe…"
          />
        </div>

        {/* R22. No "decide later" and no "pin a new one": the column is NOT
            NULL, and origin capture only ever sets an ORIGIN — offering a
            destination equivalent would name a mode that does not exist. */}
        <div className="mt-3">
          <PinSelect
            id="trip-destination"
            label="Where did it end?"
            value={destinationId}
            onChange={setDestinationId}
            pins={pins}
            disabled={saving}
            allowNone={false}
          />
        </div>

        {retargeting && (
          <label className="mt-2 flex items-start gap-2 text-sm text-[var(--ink-dim)]">
            <input
              type="checkbox"
              checked={demoteOldToStop}
              onChange={(e) => setDemoteOldToStop(e.target.checked)}
              disabled={saving}
              className="mt-0.5 accent-[var(--ember)]"
            />
            <span>
              Keep <strong className="font-medium text-[var(--ink)]">{ctx.destinationName}</strong> as a stop along the way
              {!demoteOldToStop && (
                <span className="block text-xs text-[var(--ink-dim)]/80">
                  Unchecked, it drops off this trip entirely — the pin stays on your globe.
                </span>
              )}
            </span>
          </label>
        )}

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
            One-way — the journey ends at {destinationLabel}; no return arc will draw.
            {/* "will be named one" was true when the reading replaced the
                kind. It rides alongside now, so the sentence has to say so —
                the kind above stays whatever you chose. */}
            {relocating && ' Ending at a home also reads as a relocation — noted alongside the kind you chose, not instead of it.'}
          </p>
        )}

        {/* The kind was chosen at capture, when the least was known about the
            journey — the same reason the destination needed to become
            editable (R5's destination-first capture). */}
        <label htmlFor="trip-subtype" className="mt-4 block text-sm text-[var(--ink-dim)]">
          What kind of trip was it?
        </label>
        <select
          id="trip-subtype"
          value={subtype}
          onChange={(e) => setSubtype(e.target.value as TripSubtype)}
          disabled={saving}
          className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ember-soft)]"
        >
          {TRIP_SUBTYPES.map((s) => (
            <option key={s} value={s}>{TRIP_SUBTYPE_LABELS[s]}</option>
          ))}
        </select>

        <label htmlFor="trip-title" className="mt-4 block text-sm text-[var(--ink-dim)]">Trip title (optional)</label>
        <input
          id="trip-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`e.g. “The ${ctx.destinationName} conference”, “Honeymoon”`}
          disabled={saving}
          className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] placeholder-[var(--ink-dim)]/70 outline-none focus:border-[var(--ember-soft)]"
        />

        <div className="mt-4 flex gap-3">
          <div className="flex-1">
            <label htmlFor="trip-when" className="block text-sm text-[var(--ink-dim)]">When? (free text)</label>
            <input
              id="trip-when"
              type="text"
              value={whenText}
              onChange={(e) => setWhenText(e.target.value)}
              placeholder="e.g. “spring 1984”, “mid 90s”"
              disabled={saving}
              className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] placeholder-[var(--ink-dim)]/70 outline-none focus:border-[var(--ember-soft)]"
            />
          </div>
          <div className="w-32">
            <label htmlFor="trip-year" className="block text-sm text-[var(--ink-dim)]">Year (optional)</label>
            <input
              id="trip-year"
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
