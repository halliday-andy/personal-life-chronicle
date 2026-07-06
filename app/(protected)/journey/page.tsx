/**
 * /journey — J1 walking skeleton (2026-07-05 design, supersedes "Resume
 * View"). The residential strand as a readable column: primary stops in
 * spine order, anchored markers nested beneath their anchor, mobile-first.
 *
 * Server-rendered from ONE get_residence_pins call — no per-row fetching
 * (rows carry name / when phrase / placard already). Lazy expand-to-detail
 * is J3; the ember-spine emotional layer is J2; ?pin= handoff is J4.
 * Ordering is spine sort_order — when_text renders verbatim, never parsed
 * (invariant #5).
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildJourneyTree, type JourneyNode, type JourneyPin } from '@/lib/journey/tree'
import { pinTypeMeta } from '@/lib/globe/pin-types'

export const dynamic = 'force-dynamic'

export default async function JourneyPage() {
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
        Your life journey, read in order — the same stops as the globe.
      </p>

      {tree.stops.length === 0 && tree.unanchored.length === 0 ? (
        <div className="mt-12 rounded-xl border border-stone-200 bg-white px-6 py-10 text-center">
          <p className="text-stone-600">
            Your journey starts with a first home.
          </p>
          <Link
            href="/globe"
            className="mt-2 inline-block text-sm text-amber-700 underline hover:text-amber-900"
          >
            Place it on the globe →
          </Link>
        </div>
      ) : (
        <>
          <ol className="mt-6 space-y-4">
            {tree.stops.map((stop, i) => (
              <StopCard
                key={stop.relationship_id}
                node={stop}
                index={i}
                isOrigin={i === 0}
                isCurrent={i === tree.stops.length - 1}
              />
            ))}
          </ol>

          {tree.unanchored.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Elsewhere · not yet anchored
              </h2>
              <p className="mt-1 text-xs text-stone-400">
                Places without a home to hang from — pick an anchor in the pin&apos;s
                Edit panel on the globe and they join the journey.
              </p>
              <ul className="mt-2 space-y-1.5">
                {tree.unanchored.map((n) => (
                  <ChildRow key={n.relationship_id} node={n} depth={1} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  )
}

// ── Stop card — one primary residence ─────────────────────────────

function StopCard({
  node,
  index,
  isOrigin,
  isCurrent,
}: {
  node: JourneyNode
  index: number
  isOrigin: boolean
  isCurrent: boolean
}) {
  return (
    <li className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-baseline gap-2">
        <span
          aria-hidden
          className={isOrigin ? 'text-amber-500' : 'text-amber-600/70'}
          title={isOrigin ? 'The beginning' : `Stop ${index + 1}`}
        >
          {isOrigin ? '★' : '●'}
        </span>
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-stone-900">
          {node.name}
        </h2>
        {isCurrent && (
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
            now
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 pl-6 text-xs">
        {isOrigin && <span className="text-amber-600">The beginning</span>}
        {node.when_text && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
            {node.when_text}
          </span>
        )}
      </div>
      {node.description && (
        <p className="mt-1.5 pl-6 text-sm italic text-stone-500">{node.description}</p>
      )}
      {node.children.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-l border-stone-200 pl-4 sm:ml-6 sm:pl-5">
          {node.children.map((c) => (
            <ChildRow key={c.relationship_id} node={c} depth={1} />
          ))}
        </ul>
      )}
    </li>
  )
}

// ── Child row — an anchored marker (workplace, vacation, Log…) ────

function ChildRow({ node, depth }: { node: JourneyNode; depth: number }) {
  const meta = pinTypeMeta(node.type_code)
  return (
    <li>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0 self-center rounded-full"
          style={{ backgroundColor: meta.color }}
          title={meta.label}
        />
        <span className="font-medium text-stone-800">{node.name}</span>
        <span className="text-[11px] text-stone-400">{meta.label}</span>
        {node.when_text && <span className="text-[11px] text-stone-500">· {node.when_text}</span>}
      </div>
      {node.description && (
        <p className="pl-4 text-xs italic text-stone-400">{node.description}</p>
      )}
      {node.children.length > 0 && (
        // Visual indent caps at two levels for readability; deeper anchor
        // chains render at the same indent (design decision 4).
        <ul className={depth < 2 ? 'mt-1 space-y-1 border-l border-stone-100 pl-4' : 'mt-1 space-y-1'}>
          {node.children.map((c) => (
            <ChildRow key={c.relationship_id} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}
