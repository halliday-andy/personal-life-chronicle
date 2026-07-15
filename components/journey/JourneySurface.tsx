'use client'

/**
 * JourneySurface — the two-mode host (Trips & Travel U5, KTD7):
 * Residential Journey (existing JourneyList) and Travel Journal, one
 * segmented control. Both datasets arrive from the server page in one
 * pass; switching is instant and remembers each mode's scroll position
 * so flipping back lands where you left off.
 */

import { useLayoutEffect, useRef, useState } from 'react'
import JourneyList from './JourneyList'
import TravelJournal from './TravelJournal'
import type { JourneyNode } from '@/lib/journey/tree'
import type { TripRow } from '@/lib/globe/trip-types'

type Mode = 'residential' | 'travel'

export default function JourneySurface({
  stops,
  unanchored,
  trips,
  initialPin = null,
  initialTrip = null,
  initialMode = 'residential',
}: {
  stops: JourneyNode[]
  unanchored: JourneyNode[]
  trips: TripRow[]
  initialPin?: string | null
  initialTrip?: string | null
  initialMode?: Mode
}) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const scrollMemory = useRef<Record<Mode, number>>({ residential: 0, travel: 0 })
  const restoreTo = useRef<number | null>(null)

  const switchMode = (next: Mode) => {
    if (next === mode) return
    scrollMemory.current[mode] = window.scrollY
    restoreTo.current = scrollMemory.current[next]
    setMode(next)
    window.history.replaceState(null, '', next === 'travel' ? '/journey?mode=travel' : '/journey')
  }

  useLayoutEffect(() => {
    if (restoreTo.current === null) return
    window.scrollTo({ top: restoreTo.current, behavior: 'auto' })
    restoreTo.current = null
  }, [mode])

  const seg = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => switchMode(m)}
      aria-pressed={mode === m}
      className={
        'rounded-full px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ' +
        (mode === m
          ? 'bg-stone-900 font-medium text-white'
          : 'text-stone-500 hover:text-stone-800')
      }
    >
      {label}
    </button>
  )

  return (
    <>
      <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1" role="group" aria-label="Journey mode">
        {seg('residential', 'Residential Journey')}
        {seg('travel', 'Travel Journal')}
      </div>

      {mode === 'residential' ? (
        stops.length === 0 && unanchored.length === 0 ? (
          <EmptyResidential />
        ) : (
          <JourneyList stops={stops} unanchored={unanchored} initialPin={initialPin} />
        )
      ) : (
        <TravelJournal trips={trips} initialTrip={initialTrip} />
      )}
    </>
  )
}

function EmptyResidential() {
  return (
    <div className="mt-12 rounded-xl border border-stone-200 bg-white px-6 py-10 text-center">
      <p className="text-stone-600">Your journey starts with a first home.</p>
      <a
        href="/globe"
        className="mt-2 inline-block text-sm text-amber-700 underline hover:text-amber-900"
      >
        Place it on the globe →
      </a>
    </div>
  )
}
