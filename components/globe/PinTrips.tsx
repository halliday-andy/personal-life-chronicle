'use client'

/**
 * PinTrips — a pin's trips, on the pin's own card (R4, 2026-08-01).
 *
 * This content used to live in three floating strips over the globe at
 * `top-20`, which caused three separate findings in one QA walk:
 *
 *  - **F1** the strip (`z-30`) painted over the search dropdown (`z-20`,
 *    expanding down into the same band), hiding pin-search's "Your pins"
 *    group — a blocker, and invisible as a cause.
 *  - **F2** "Start a trip from here" was the only pin-scoped control living
 *    in globe chrome; Andy hunted the card and the edit panel for it. Rule
 *    10: a control scoped to a selected object belongs on that object's
 *    surface.
 *  - **F8** a trip's jots host on the TRIP entity, so from the destination
 *    pin they were invisible — the pin's own hopper honestly read zero.
 *
 * Moving the whole thing onto the card retires all three: the band empties,
 * so F1 dies by construction rather than by a stacking rule someone has to
 * maintain; the control sits where the app's conventions say it should; and
 * the trip — with its jots — is reachable from the pin it belongs to,
 * WITHOUT merging the two hoppers' counts, which would make "jots" mean the
 * place's own jots on one pin and a mixture on another.
 *
 * Mounted by `PinConnections`, exactly as `PinHopper` is: it owns its own
 * disclosure state and reports a count upward for the chip label. Actions
 * that are genuinely globe-level (arming an origin, drawing a route, opening
 * the framing panel) are callbacks — the globe still owns its own modes.
 */

import { useEffect, useRef, useState } from 'react'
import PinHopper from './PinHopper'
import { TRIP_SUBTYPE_LABELS, type TripRow, type TripSubtype } from '@/lib/globe/trip-types'
import { tripKind, RELOCATION_READING } from '@/lib/globe/trip-kind'

export const TRIP_ROUTE_COLOR = '#e0709b'

/** Everything the card needs to render and act on a pin's trips. Assembled
 *  once by GlobeView and passed through as a single object — seven separate
 *  pass-through props would make `PinConnections` know about trips, which it
 *  has no business doing. */
export interface TripCardContext {
  /** Trips touching this pin — as destination, origin, or itinerary stop. */
  trips: TripRow[]
  /** Of those, the ones that STARTED here (the home summary's number). */
  originatedHere: number
  isHome: boolean
  isHomeBase: boolean
  /** Future Places read "Been there now?" rather than "was this a journey?" */
  isFuturePlace: boolean
  /** Reveal this pin's trips the moment the card opens, without a click.
   *  TRUE ONLY FOR A TRIP'S DESTINATION (Andy, 2026-08-01): landing on the
   *  place a trip went TO, the trip is the point of the pin, and it usually
   *  has exactly one. Deliberately NOT true for an origin — a home with many
   *  departures is the case F21 just stopped from burying the map. */
  autoOpen: boolean
  onStartTripFromHere: () => void
  onFrame: (trip: TripRow) => void
  onRoute: (tripId: string) => void
  onUnframe: (tripId: string) => void
  onFrameAsTrip: (subtype: TripSubtype) => void
  /** Fired when this panel opens or closes. The globe uses it to decide
   *  whether to PAINT this pin's routes: selection alone no longer draws
   *  them, because that override had no off-switch and a home with many
   *  departures buried the map (F21, Andy 2026-08-01). Opening the chip is
   *  the "show me these" gesture; closing it is the way out. */
  onOpenChange?: (open: boolean) => void
}

const btn =
  'rounded-lg border border-[var(--glass-border)] px-2 py-0.5 hover:text-[var(--ember-soft)]'

export default function PinTrips({
  ctx,
  open,
  onCountChange,
}: {
  ctx: TripCardContext
  open: boolean
  onCountChange?: (n: number) => void
}) {
  // Owned here, not by the globe: these are disclosure states of this panel.
  const [confirmUnframe, setConfirmUnframe] = useState<string | null>(null)
  const [openJots, setOpenJots] = useState<string | null>(null)
  const [jotCounts, setJotCounts] = useState<Record<string, number>>({})

  const { trips, isHome, isFuturePlace } = ctx

  // Report the count for the chip label. A home reports its departures; any
  // other pin reports the trips touching it.
  const count = isHome ? ctx.originatedHere : trips.length
  useEffect(() => { onCountChange?.(count) }, [count, onCountChange])

  // Report open/closed upward. Held in a ref so an inline arrow from the
  // caller cannot make this fire on every render.
  const openChangeRef = useRef(ctx.onOpenChange)
  useEffect(() => { openChangeRef.current = ctx.onOpenChange })
  useEffect(() => { openChangeRef.current?.(open) }, [open])
  // Report CLOSED on unmount, so deselecting a pin cannot leave the globe's
  // route gate stuck open. This has to live here rather than as a reset in
  // GlobeView: child effects run BEFORE parent effects, so a parent reset
  // keyed on selection would fire after this component reported itself open
  // and silently clobber an auto-opened panel.
  useEffect(() => () => { openChangeRef.current?.(false) }, [])

  // Rendered even while closed, hidden by CSS rather than unmounted, so the
  // trips' own PinHoppers keep their counts live and do not refetch on every
  // open/close — the detail card's established pattern.
  return (
    <div className={open ? 'mt-2 space-y-2 text-xs text-[var(--ink)]' : 'hidden'}>
      {/* ── A home summarises rather than enumerates (U7/R19): a house with
             many departures links to the Travel Journal instead of stacking
             rows. Its real job here is the origin-first entry point. ── */}
      {isHome && (
        <div className="flex flex-wrap items-center gap-2">
          <span style={{ color: TRIP_ROUTE_COLOR }}>✈</span>
          {ctx.originatedHere > 0 && (
            <span>
              {ctx.originatedHere} trip{ctx.originatedHere === 1 ? '' : 's'} originated here
            </span>
          )}
          {ctx.isHomeBase && (
            <span className="rounded-full border border-[var(--glass-border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--ember-soft)]">
              home base
            </span>
          )}
          <button type="button" onClick={ctx.onStartTripFromHere} className={btn}>
            Start a trip from here
          </button>
          {ctx.originatedHere > 0 && (
            <a href="/journey?mode=travel" className={`ml-auto ${btn}`}>
              Travel Journal →
            </a>
          )}
        </div>
      )}

      {/* ── A non-home pin with no trip yet: the invitation to frame it. ── */}
      {!isHome && trips.length === 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span style={{ color: TRIP_ROUTE_COLOR }}>✈</span>
          <span className="text-[var(--ink-dim)]">
            {isFuturePlace
              ? 'Been there now? It becomes a real place + trip:'
              : 'This was a journey? Frame it as a trip:'}
          </span>
          {(Object.keys(TRIP_SUBTYPE_LABELS) as TripSubtype[]).map((s) => (
            <button key={s} type="button" onClick={() => ctx.onFrameAsTrip(s)} className={btn}>
              {TRIP_SUBTYPE_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* ── The trips themselves. ── */}
      {trips.map((t) => (
        <div key={t.trip_id} className="rounded-lg border border-[var(--glass-border)] px-2 py-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span style={{ color: TRIP_ROUTE_COLOR }}>✈</span>
            <span className="font-medium">{t.title || `Trip to ${t.destination_name}`}</span>
            {/* The owner's chosen kind, then the chronicle's reading of it.
                Never the reading INSTEAD (rule 15): "Relocation" briefly
                replaced the subtype, and a trip the owner had called a road
                trip stopped saying so anywhere. */}
            <span className="text-[var(--ink-dim)]">
              {tripKind(t).label}
              {t.when_text ? ` · ${t.when_text}` : ''}
            </span>
            {tripKind(t).relocation && (
              <span className="italic text-[var(--ink-dim)]/70">· {RELOCATION_READING}</span>
            )}
            {t.is_draft && (
              <span
                className="rounded-full border border-[var(--glass-border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
                style={{ color: TRIP_ROUTE_COLOR }}
              >
                needs framing
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => ctx.onFrame(t)} className={btn}>
              {t.is_draft ? 'Frame' : 'Edit frame'}
            </button>
            {/* Route editing draws ON THE MAP, so it stays a globe-level mode
                — the chip opens it, the globe owns it. */}
            <button type="button" onClick={() => ctx.onRoute(t.trip_id)} className={btn}>
              Route
            </button>
            {confirmUnframe === t.trip_id ? (
              <button
                type="button"
                onClick={() => ctx.onUnframe(t.trip_id)}
                className="rounded-lg border border-rose-400/50 px-2 py-0.5 text-rose-300 hover:bg-rose-500/10"
              >
                Really remove the trip? The pin stays.
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setConfirmUnframe(t.trip_id)
                  setTimeout(() => setConfirmUnframe((c) => (c === t.trip_id ? null : c)), 4000)
                }}
                className="rounded-lg border border-[var(--glass-border)] px-2 py-0.5 text-[var(--ink-dim)] hover:text-rose-300"
              >
                Unframe
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpenJots((c) => (c === t.trip_id ? null : t.trip_id))}
              className={`${btn} ${openJots === t.trip_id ? 'text-[var(--ember-soft)]' : ''}`}
            >
              ✎ jots{(jotCounts[t.trip_id] ?? 0) > 0 ? ` · ${jotCounts[t.trip_id]}` : ''}
            </button>
          </div>
          {/* F8: the trip's OWN hopper, reachable from the destination pin at
              last — and still hosted by the trip entity, so the place's jot
              count stays honest about the place's own jots. */}
          <PinHopper
            entityId={t.trip_entity_id}
            hostName={t.title || `Trip to ${t.destination_name}`}
            variant="card"
            open={openJots === t.trip_id}
            onCountChange={(n) =>
              setJotCounts((m) => (m[t.trip_id] === n ? m : { ...m, [t.trip_id]: n }))}
          />
        </div>
      ))}

      {/* ── Repeat visits stay distinct trips on the same pin (U7/R17). ── */}
      {!isHome && trips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--glass-border)] pt-1.5 text-[var(--ink-dim)]">
          <span>Another trip here:</span>
          {(Object.keys(TRIP_SUBTYPE_LABELS) as TripSubtype[]).map((s) => (
            <button key={s} type="button" onClick={() => ctx.onFrameAsTrip(s)} className={btn}>
              {TRIP_SUBTYPE_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
