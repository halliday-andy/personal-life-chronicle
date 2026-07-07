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

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildJourneyTree, type JourneyPin } from '@/lib/journey/tree'
import JourneyList from '@/components/journey/JourneyList'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Journey — Life Chronicle' }

export default async function JourneyPage({
  searchParams,
}: {
  searchParams: { pin?: string }
}) {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return null // layout guard redirects; belt and braces

  const admin = createAdminClient()
  const { data: pins, error } = await admin.rpc('get_residence_pins', { p_user_id: user.id })
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

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">Journey</h1>
        {tree.stops.length > 0 && (
          <span className="text-sm text-stone-400">
            {tree.stops.length} stop{tree.stops.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-stone-500">
        Your life journey, read in order — the same stops as the globe. Open a stop to read it.
      </p>

      {tree.stops.length === 0 && tree.unanchored.length === 0 ? (
        <div className="mt-12 rounded-xl border border-stone-200 bg-white px-6 py-10 text-center">
          <p className="text-stone-600">Your journey starts with a first home.</p>
          <Link
            href="/globe"
            className="mt-2 inline-block text-sm text-amber-700 underline hover:text-amber-900"
          >
            Place it on the globe →
          </Link>
        </div>
      ) : (
        <JourneyList
          stops={tree.stops}
          unanchored={tree.unanchored}
          initialPin={searchParams.pin ?? null}
        />
      )}
    </main>
  )
}
