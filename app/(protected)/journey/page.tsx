/**
 * /journey — the residential strand as a readable column
 * (docs/plans/2026-07-05-journey-view-design.md; supersedes "Resume View").
 *
 * J1: spine-ordered stop cards, markers nested under their anchor,
 *     mobile-first, ONE get_residence_pins call.
 * J2: ember-thread rail, origin star, "now" marker, move_reason
 *     transition narration.
 * J3: tap a stop → lazily fetched detail (recollection, photo, facts,
 *     linked recollections, context, per-child excerpts) — zero detail
 *     requests until a stop is opened. Rendered by JourneyList (client).
 *
 * Ordering is spine sort_order — when_text renders verbatim, never
 * parsed (invariant #5). The `?pin=` globe handoff is J4.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildJourneyTree, type JourneyPin } from '@/lib/journey/tree'
import JourneySurface from '@/components/journey/JourneySurface'
import type { TripRow } from '@/lib/globe/trip-types'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Journey — Life Chronicle' }

export default async function JourneyPage({
  searchParams,
}: {
  searchParams: { pin?: string; trip?: string; mode?: string }
}) {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return null // layout guard redirects; belt and braces

  const admin = createAdminClient()
  // Both modes' data in one pass (U5): the residential tree and the
  // trips. Switching modes is instant; nothing refetches.
  const [{ data: pins, error }, { data: trips }, { data: homeBase }] = await Promise.all([
    admin.rpc('get_residence_pins', { p_user_id: user.id }),
    admin.rpc('get_trips', { p_user_id: user.id }),
    admin.from('relationships').select('id').eq('user_id', user.id)
      .filter('metadata->>home_base', 'eq', 'true').limit(1).maybeSingle(),
  ])
  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-stone-900">Journey</h1>
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Could not lay out your journey — {error.message}. Try reloading.
        </p>
      </main>
    )
  }

  const tree = buildJourneyTree((pins ?? []) as JourneyPin[])
  const tripRows = (trips ?? []) as TripRow[]
  // ?trip= or ?mode=travel lands in the Travel Journal (U5).
  const initialMode =
    searchParams.mode === 'travel' || (searchParams.trip && !searchParams.pin)
      ? ('travel' as const)
      : ('residential' as const)

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">Journey</h1>
        <span className="text-sm text-stone-400">
          {tree.stops.length > 0 && `${tree.stops.length} stop${tree.stops.length === 1 ? '' : 's'}`}
          {tree.stops.length > 0 && tripRows.length > 0 && ' · '}
          {tripRows.length > 0 && `${tripRows.length} trip${tripRows.length === 1 ? '' : 's'}`}
        </span>
      </div>
      <p className="mt-1 text-sm text-stone-500">
        Your life journey, read in order — the places you lived, and the journeys you made.
      </p>

      <JourneySurface
        stops={tree.stops}
        unplaced={tree.unplaced}
        unanchored={tree.unanchored}
        trips={tripRows}
        homeBaseId={homeBase?.id ?? null}
        initialPin={searchParams.pin ?? null}
        initialTrip={searchParams.trip ?? null}
        initialMode={initialMode}
      />
    </main>
  )
}
