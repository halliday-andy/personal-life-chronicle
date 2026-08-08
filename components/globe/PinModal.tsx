'use client'

/**
 * Pin modal — per-pin capture (Step 7 Slice 1).
 *
 * Opens when the user confirms a draft pin's location. Modal-first:
 * the sidekick stays quiet until engaged (a later slice). Captures a
 * verbatim free-form narrative + an optional free-text "when" (stored
 * unparsed; structured dates are Slice 2). Both fields are optional —
 * the user can save just the pin.
 */

import { useEffect, useMemo, useState } from 'react'
import { PIN_TYPES, pinTypeMeta, SPINE_CODE } from '@/lib/globe/pin-types'
import { anchorCandidates, isUnplacedHome } from '@/lib/globe/anchor-options'
import { TRIP_SUBTYPES, TRIP_SUBTYPE_LABELS, tripSubtypeDefaultPinCode, type TripLeg, type TripSubtype } from '@/lib/globe/trip-types'
import { handleRichPaste } from '@/lib/richPaste'
import { useEscapeKey } from '@/lib/ui/use-escape-key'

/** Virtual selector value — a Trip is framing around a pin, not a pin type. */
const TRIP_OPTION = 'trip'

const GHOST_TEXTS = [
  'What kind of place was it? Who lived there? Why did you move here?',
  'Tell me what you remember — the house, the neighbourhood, the family, what brought you here.',
  'A house, an apartment, a base? Who else lived there? What kind of life did you have here?',
  'Just write what comes to mind — I’ll figure out the structure.',
]

export interface PinDraftData {
  name: string              // the name shown on the pin (editable; overrides the search label)
  whenText: string
  description: string        // placard — a short one-line description (item 1)
  body: string
  position: number | null   // spine sequence slot; null = append / N/A for markers
  typeCode: string
  anchorId: string | null   // marker → a primary residence (null = standalone)
  /** Adopt this existing entity as the pin's place instead of creating a
   *  new one (2026-07-07 duplicate-twin fix); null = create fresh. */
  entityId: string | null
  /** Destination-first trip capture: frame this pin as a trip destination
   *  right after it saves (Trips & Travel U3); null = a plain pin. */
  trip: { subtype: TripSubtype } | null
  /** Primary residence saved WITHOUT a spine slot — "decide later"
   *  (U9, KTD10). Placed via the pin's sequence picker whenever. */
  unsequenced: boolean
}

/** Sentinel slot value for "Decide later — not yet placed" (U9). */
const DECIDE_LATER = -1

export default function PinModal({
  placeLabel,
  saving,
  primaries,
  allPins,
  onSave,
  onCancel,
  originCapture = false,
  defaultTypeCode,
  defaultAnchorId,
  armedOriginName,
  stopCaptureFor,
}: {
  placeLabel: string
  saving: boolean
  primaries: { relationship_id: string; name: string }[]  // primary residences, in sequence
  allPins: { relationship_id: string; name: string; type_code: string | null; sort_order: number | null }[]  // every globe pin (Log anchors to any)
  onSave: (data: PinDraftData) => void
  onCancel: () => void
  /** Trip origin capture (U9/AE5): default the sequence slot to
   *  "decide later" — the origin home may predate the spine. */
  originCapture?: boolean
  /** Preselect the type — "Start a trip from here" opens the modal on
   *  Trip (2026-07-19); the user can still change it. */
  defaultTypeCode?: string
  /** Preselect the anchor — while "Start a trip from here" is armed, the
   *  armed home is the era this destination belongs to, so the anchor
   *  default matches the trip origin instead of the first spine home
   *  (Andy's chalet→Calgary confusion, 2026-07-19). */
  defaultAnchorId?: string
  /** The armed origin's NAME, when "Start a trip from here" sent the user
   *  here. Present = this dialog is being reused in a specific MODE, and
   *  rule 11 says it must say so in its own title and primary action: the
   *  banner carrying that context is suppressed while the modal is open
   *  (`GlobeView` renders it on `!modalOpen`), so without this the only cue
   *  disappears exactly when it is needed (F4, 2026-07-30). */
  armedOriginName?: string
  /** Route-building placed this draft (R22 add-on): the pin about to be
   *  saved becomes a STOP on the named trip's named leg. Same rule-11
   *  contract as `armedOriginName` — the route banner is covered while
   *  this dialog is open, so the mode has to be stated here or the only
   *  cue vanishes exactly when it is needed (F4, 2026-07-30). */
  stopCaptureFor?: { tripName: string; leg: TripLeg }
}) {
  // Escape closes, matching the backdrop's existing dismiss — and refuses
  // while a save is in flight, for the same reason the backdrop does (F9a).
  useEscapeKey(onCancel, !saving)

  const [name, setName] = useState(placeLabel === 'This place' ? '' : placeLabel)
  const [body, setBody] = useState('')
  const [whenText, setWhenText] = useState('')
  const [placard, setPlacard] = useState('')
  const [typeCode, setTypeCode] = useState<string>(defaultTypeCode ?? SPINE_CODE)
  const [tripSubtype, setTripSubtype] = useState<TripSubtype>('vacation')
  // Sequence slot (spine only): 0 = before the first, i = after
  // primaries[i-1], DECIDE_LATER = save unsequenced (U9).
  const [position, setPosition] = useState<number>(originCapture ? DECIDE_LATER : primaries.length)
  // Anchor (markers only): a home relationship_id, or '' = standalone.
  const [anchorId, setAnchorId] = useState<string>(defaultAnchorId ?? primaries[0]?.relationship_id ?? '')
  const ghost = useMemo(() => GHOST_TEXTS[Math.floor(Math.random() * GHOST_TEXTS.length)], [])

  // Duplicate-twin guard (2026-07-07): if the pin name exactly matches an
  // existing unpinned place/organization entity, offer to ADOPT it — the
  // pin then carries all its linked recollections and context instead of
  // minting a lookalike (Phillips Exeter, Hanover/Dartmouth).
  const [match, setMatch] = useState<{ id: string; canonical_name: string; type: string; mention_count: number } | null>(null)
  const [useExisting, setUseExisting] = useState(false)
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)
  useEffect(() => {
    const trimmed = name.trim()
    if (!trimmed) { setMatch(null); setUseExisting(false); return }
    const t = setTimeout(() => {
      fetch(`/api/globe/entity-match?name=${encodeURIComponent(trimmed)}`)
        .then((r) => r.json())
        .then((d) => {
          const c = (d.candidates ?? [])[0] ?? null
          setMatch(c)
          // A different candidate resets both the choice and the dismissal.
          setUseExisting((prev) => (c ? prev : false))
        })
        .catch(() => setMatch(null))
    }, 350)
    return () => clearTimeout(t)
  }, [name])

  const isSpine = typeCode === SPINE_CODE
  const isTrip = typeCode === TRIP_OPTION
  // A trip destination saves as a normal pin typed by its subtype (KTD4).
  const effectiveCode = isTrip ? tripSubtypeDefaultPinCode[tripSubtype] : typeCode
  // A Log anchors to ANY place; other markers anchor to a HOME — incl.
  // unsequenced primaries and second/short-stay residences (2026-07-18,
  // lib/globe/anchor-options: home-ness is the type, not the spine slot).
  const anchorOptions = anchorCandidates(allPins, typeCode)
  const meta = pinTypeMeta(effectiveCode)

  // The mode is stated only while it is TRUE: change the type away from a
  // trip and this reverts to the generic dialog, preserving the guarantee
  // that the type stays changeable here.
  const settingTripDestination = Boolean(armedOriginName) && isTrip
  // Same contract, the other direction: choosing "Trip" here means the user
  // has decided this place is a journey of its own rather than a waypoint
  // on one, so the stop framing steps aside instead of arguing with them.
  const capturingStop = Boolean(stopCaptureFor) && !isTrip

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={saving ? undefined : onCancel}
        aria-hidden
      />
      {/* max-h + scroll: the mode statement lives at the TOP, so anything
          that pushes this dialog past the viewport pushes the one line that
          says which mode you are in out of reach. Same guard TripFramePanel
          took when its own content grew (R22). */}
      <div className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 text-[var(--ink)]">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-dim)]">
          {settingTripDestination
            ? 'Where did the trip go?'
            : capturingStop
              ? 'A stop along the way'
              : 'A place in your life'}
        </p>
        {settingTripDestination && (
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]">
            The trip from <strong>{armedOriginName}</strong> — pin the place that
            marked the turn toward home.
          </p>
        )}
        {capturingStop && stopCaptureFor && (
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]">
            Somewhere you passed through on <strong>{stopCaptureFor.tripName}</strong> — it
            joins the {stopCaptureFor.leg} leg after the stops already there.
            It becomes a place of its own too, so it can carry its own recollection.
          </p>
        )}
        <label htmlFor="pin-name" className="mt-1 block text-xs text-[var(--ink-dim)]">Name on the pin</label>
        <input
          id="pin-name"
value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
          autoFocus
          placeholder="Name this place"
          className="nocturne-display mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-2xl font-medium leading-tight text-[var(--ink)] placeholder-[var(--ink-dim)]/50 outline-none focus:border-[var(--ember-soft)]"
        />

        {match && !useExisting && dismissedFor !== match.id && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--ember-soft)]/40 bg-[var(--ember)]/10 px-3 py-2 text-xs text-[var(--ink)]">
            <span className="min-w-0 flex-1">
              This looks like your existing <strong>{match.canonical_name}</strong>
              {match.mention_count > 0 && (
                <span className="text-[var(--ink-dim)]"> · {match.mention_count} recollection{match.mention_count === 1 ? '' : 's'} mention it</span>
              )}
              {' '}— pin it instead of creating a duplicate?
            </span>
            <span className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => setUseExisting(true)}
                disabled={saving}
                className="rounded-lg bg-[var(--ember)] px-2.5 py-1 font-medium text-[#241500] hover:bg-[var(--ember-soft)] disabled:opacity-50"
              >
                Pin the existing
              </button>
              <button
                type="button"
                onClick={() => setDismissedFor(match.id)}
                disabled={saving}
                className="rounded-lg border border-[var(--glass-border)] px-2.5 py-1 text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-50"
              >
                Create new
              </button>
            </span>
          </div>
        )}
        {match && useExisting && (
          <p className="mt-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
            Pinning your existing <strong>{match.canonical_name}</strong> — its recollections and
            context come with it.{' '}
            <button
              type="button"
              onClick={() => setUseExisting(false)}
              className="underline hover:text-emerald-100"
            >
              undo
            </button>
          </p>
        )}

        <label htmlFor="pin-type" className="mt-5 block text-sm text-[var(--ink-dim)]">What kind of place?</label>
        <select
          id="pin-type"
value={typeCode}
          onChange={(e) => setTypeCode(e.target.value)}
          disabled={saving}
          className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ember-soft)]"
        >
          {PIN_TYPES.map((t) => (
            <option key={t.code} value={t.code}>{t.label}</option>
          ))}
          <option value={TRIP_OPTION}>Trip — somewhere I traveled</option>
        </select>
        <p className="mt-1 text-xs leading-relaxed text-[var(--ink-dim)]/80">
          {isTrip
            ? 'A journey, not just a place. Begin with the destination — the place that marked the turn toward home — and frame the origin and stops next.'
            : meta.description}
        </p>

        {isTrip && (
          <>
            <label htmlFor="pin-trip-subtype" className="mt-4 block text-sm text-[var(--ink-dim)]">What kind of trip?</label>
            <select
              id="pin-trip-subtype"
value={tripSubtype}
              onChange={(e) => setTripSubtype(e.target.value as TripSubtype)}
              disabled={saving}
              className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ember-soft)]"
            >
              {TRIP_SUBTYPES.map((s) => (
                <option key={s} value={s}>{TRIP_SUBTYPE_LABELS[s]}</option>
              ))}
            </select>
          </>
        )}

        <label htmlFor="pin-body" className="mt-4 block text-sm text-[var(--ink-dim)]">Your memory of it</label>
        <textarea
          id="pin-body"
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={(e) => handleRichPaste(e, setBody)}
          placeholder={ghost}
          rows={5}
          disabled={saving}
          className="mt-1 w-full resize-none rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm leading-relaxed text-[var(--ink)] placeholder-[var(--ink-dim)]/70 outline-none focus:border-[var(--ember-soft)]"
        />

        <label htmlFor="pin-when" className="mt-4 block text-sm text-[var(--ink-dim)]">When? (optional)</label>
        <input
          id="pin-when"
          type="text"
          value={whenText}
          onChange={(e) => setWhenText(e.target.value)}
          placeholder="e.g. 1962–1968, early 70s, “right after college”"
          disabled={saving}
          className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] placeholder-[var(--ink-dim)]/70 outline-none focus:border-[var(--ember-soft)]"
        />

        <label htmlFor="pin-placard" className="mt-4 block text-sm text-[var(--ink-dim)]">Placard (optional)</label>
        <input
          id="pin-placard"
          type="text"
          value={placard}
          onChange={(e) => setPlacard(e.target.value)}
          maxLength={120}
          placeholder="A one-line description, shown on hover"
          disabled={saving}
          className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] placeholder-[var(--ink-dim)]/70 outline-none focus:border-[var(--ember-soft)]"
        />

        {/* Contextual placement: spine → sequence slot; markers → anchor. */}
        {isSpine && (primaries.length > 0 || originCapture) && (
          <>
            <label htmlFor="pin-position" className="mt-4 block text-sm text-[var(--ink-dim)]">Where does this fall in your life?</label>
            <select
              id="pin-position"
value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              disabled={saving}
              className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ember-soft)]"
            >
              {primaries.length > 0 && (
                <option value={0}>Before {primaries[0].name} (earliest)</option>
              )}
              {primaries.map((p, i) => (
                <option key={p.relationship_id} value={i + 1}>
                  After {p.name}
                  {i === primaries.length - 1 ? ' (most recent)' : ''}
                </option>
              ))}
              <option value={DECIDE_LATER}>Decide later — not yet placed</option>
            </select>
            {position === DECIDE_LATER && (
              <p className="mt-1 text-xs text-[var(--ink-dim)]/80">
                The home stays off the journey&apos;s thread until you place it — everything else
                (memories, photos, jots) works now.
              </p>
            )}
          </>
        )}

        {!isSpine && anchorOptions.length > 0 && (
          <>
            <label htmlFor="pin-anchor" className="mt-4 block text-sm text-[var(--ink-dim)]">{meta.anchorPrompt}</label>
            {settingTripDestination && (
              <p className="mt-0.5 text-xs text-[var(--ink-dim)]/80">
                This is the era the pin belongs to, not the trip&apos;s origin —
                the origin is already <strong>{armedOriginName}</strong>, and you
                change it in the next step.
              </p>
            )}
            <select
              id="pin-anchor"
value={anchorId}
              onChange={(e) => setAnchorId(e.target.value)}
              disabled={saving}
              className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ember-soft)]"
            >
              {anchorOptions.map((p) => (
                <option key={p.relationship_id} value={p.relationship_id}>
                  {p.name}{isUnplacedHome(p) ? ' · not yet placed' : p.type_code && p.type_code !== 'lived_at' ? ` · ${pinTypeMeta(p.type_code).label}` : ''}
                </option>
              ))}
              <option value="">Not sure / standalone</option>
            </select>
            <p className="mt-1 text-xs text-[var(--ink-dim)]/80">
              {isTrip
                ? 'Which home era does this belong to? It draws a dashed line to that home — the trip’s origin is a separate question, asked next.'
                : capturingStop
                  // "that home" is not safe here: a stop anchors to the
                  // trip's destination, which may be a hotel or a hillside.
                  ? 'Pre-set to where the trip was heading. Change it if this belongs to somewhere else.'
                  : 'Connects this with a dashed line to that home.'}
            </p>
          </>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({
              name,
              whenText,
              description: placard,
              body,
              position: isSpine && primaries.length && position !== DECIDE_LATER ? position : null,
              typeCode: effectiveCode,
              anchorId: isSpine ? null : (anchorId || null),
              entityId: useExisting && match ? match.id : null,
              trip: isTrip ? { subtype: tripSubtype } : null,
              unsequenced: isSpine && position === DECIDE_LATER,
            })}
            disabled={saving}
            className="rounded-lg bg-[var(--ember)] px-5 py-2 text-sm font-medium text-[#241500] shadow-[0_0_20px_rgba(244,177,74,0.45)] hover:bg-[var(--ember-soft)] disabled:opacity-60"
          >
            {saving
              ? (settingTripDestination ? 'Setting…' : capturingStop ? 'Adding…' : 'Placing…')
              : (settingTripDestination ? 'Set the destination' : capturingStop ? 'Add this stop' : 'Add this place')}
          </button>
        </div>
      </div>
    </div>
  )
}
