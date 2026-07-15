'use client'

/**
 * Travel Journal — Journey's second mode (Trips & Travel U5, KTD7).
 *
 * A chronological reading column of TRIPS, independent of residential
 * periods (R12): grouped by the user-entered year hint (KTD5 — never
 * parsed from the when-phrase), unhinted trips last under "Sometime".
 * Cards share Journey's grammar: heading + chips, single-open
 * accordion, everything already in the one get_trips payload so
 * expansion is instant. Drafts surface with an invitational framing
 * affordance (R13); ?trip= lands expanded and scrolled into view.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TRIP_SUBTYPE_LABELS, type TripRow, type TripStop } from '@/lib/globe/trip-types'

function groupTrips(trips: TripRow[]): { label: string; trips: TripRow[] }[] {
  const groups: { label: string; trips: TripRow[] }[] = []
  for (const t of trips) { // already ordered: year_hint NULLS LAST, created_at
    const label = t.year_hint !== null ? String(t.year_hint) : 'Sometime'
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.trips.push(t)
    else groups.push({ label, trips: [t] })
  }
  return groups
}

export default function TravelJournal({
  trips,
  initialTrip = null,
}: {
  trips: TripRow[]
  initialTrip?: string | null
}) {
  const [expandedId, setExpandedId] = useState<string | null>(initialTrip)

  // Deep-link arrival (?trip=): bring the card into view once.
  useEffect(() => {
    if (!initialTrip) return
    const el = document.getElementById(`journal-trip-${initialTrip}`)
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  }, [initialTrip])

  const drafts = trips.filter((t) => t.is_draft).length

  if (trips.length === 0) {
    return (
      <div className="mt-12 rounded-xl border border-stone-200 bg-white px-6 py-10 text-center">
        <p className="text-stone-600">Your travels are unwritten — every journey starts with a destination.</p>
        <Link
          href="/globe"
          className="mt-2 inline-block text-sm text-amber-700 underline hover:text-amber-900"
        >
          Mark a place you traveled to on the globe →
        </Link>
      </div>
    )
  }

  return (
    <>
      {drafts > 0 && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {drafts} trip{drafts === 1 ? '' : 's'} still need{drafts === 1 ? 's' : ''} framing —
          a destination is saved, the origin is not. Open one below to complete it.
        </p>
      )}
      {groupTrips(trips).map((g) => (
        <section key={g.label} className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">{g.label}</h2>
          <ol className="mt-2 space-y-3">
            {g.trips.map((t) => (
              <TripCard
                key={t.trip_id}
                trip={t}
                expanded={expandedId === t.trip_id}
                onToggle={() => {
                  const next = expandedId === t.trip_id ? null : t.trip_id
                  setExpandedId(next)
                  window.history.replaceState(null, '', next ? `/journey?mode=travel&trip=${next}` : '/journey?mode=travel')
                }}
              />
            ))}
          </ol>
        </section>
      ))}
    </>
  )
}

function ItineraryRow({ label, name, sub }: { label: string; name: string; sub?: string }) {
  return (
    <li className="flex items-baseline gap-2 text-sm">
      <span className="w-20 shrink-0 text-[10px] uppercase tracking-wide text-stone-400">{label}</span>
      <span className="font-medium text-stone-800">{name}</span>
      {sub && <span className="text-[11px] text-stone-400">{sub}</span>}
    </li>
  )
}

function TripCard({
  trip,
  expanded,
  onToggle,
}: {
  trip: TripRow
  expanded: boolean
  onToggle: () => void
}) {
  const name = trip.title || `Trip to ${trip.destination_name}`
  const outbound = trip.stops.filter((s: TripStop) => s.leg === 'outbound')
  const returns = trip.stops.filter((s: TripStop) => s.leg === 'return')
  return (
    <li id={`journal-trip-${trip.trip_id}`}>
      <div className="rounded-xl border border-stone-200 bg-white">
        <h3 className="m-0">
          <button
            type="button"
            id={`journal-trip-btn-${trip.trip_id}`}
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={`journal-trip-panel-${trip.trip_id}`}
            className="block w-full rounded-xl px-4 py-3.5 text-left transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span className="flex items-baseline gap-2">
              <span aria-hidden className="shrink-0 text-rose-400">✈</span>
              <span className="min-w-0 flex-1 truncate text-base font-semibold text-stone-900">{name}</span>
              {trip.is_draft && (
                <span className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-600">
                  needs framing
                </span>
              )}
              <span aria-hidden className="shrink-0 text-xs text-stone-400">{expanded ? '▾' : '▸'}</span>
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs font-normal">
              <span className="rounded-full border border-stone-200 px-2 py-0.5 text-stone-500">
                {TRIP_SUBTYPE_LABELS[trip.subtype]}
              </span>
              {trip.when_text && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                  {trip.when_text}
                </span>
              )}
              <span className="text-stone-500">
                {trip.origin_name ?? '…'} → {trip.destination_name}
              </span>
            </span>
          </button>
        </h3>

        {expanded && (
          <div
            id={`journal-trip-panel-${trip.trip_id}`}
            role="region"
            aria-labelledby={`journal-trip-btn-${trip.trip_id}`}
            className="border-t border-stone-100 px-4 py-3"
          >
            {trip.is_draft ? (
              <p className="text-sm text-stone-600">
                The destination is on the globe; where the trip started isn&apos;t written yet.{' '}
                <Link
                  href={`/globe?trip=${trip.trip_id}`}
                  className="text-amber-700 underline hover:text-amber-900"
                >
                  Frame this trip on the globe →
                </Link>
              </p>
            ) : (
              <ul className="space-y-1">
                <ItineraryRow label="From" name={trip.origin_name ?? ''} />
                {outbound.map((s) => (
                  <ItineraryRow key={s.stop_id} label="via" name={s.name} />
                ))}
                <ItineraryRow label="To" name={trip.destination_name} sub="destination" />
                {returns.map((s) => (
                  <ItineraryRow key={s.stop_id} label="back via" name={s.name} />
                ))}
                {trip.return_to_origin && trip.origin_name && (
                  <ItineraryRow label="Returns" name={trip.origin_name} />
                )}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap gap-3 border-t border-stone-100 pt-3 text-xs">
              <Link
                href={`/globe?trip=${trip.trip_id}`}
                className="text-amber-700 hover:text-amber-900 hover:underline"
              >
                Show on globe →
              </Link>
              <Link
                href={`/memories?entity=${trip.trip_entity_id}`}
                className="text-amber-700 hover:text-amber-900 hover:underline"
              >
                Recollections from this trip →
              </Link>
            </div>
          </div>
        )}
      </div>
    </li>
  )
}
