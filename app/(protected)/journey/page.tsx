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
import { buildJourneyTree, transitionPhrase, type JourneyNode, type JourneyPin } from '@/lib/journey/tree'
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
          {/* The ember thread (J2): each stop draws its own rail segment —
              marker + a line running to the next stop — so the thread stays
              continuous at any card height and ends cleanly at "now".
              Static by design; nothing here animates (reduced-motion safe). */}
          <ol className="mt-6">
            {tree.stops.map((stop, i) => (
              <StopCard
                key={stop.relationship_id}
                node={stop}
                index={i}
                isOrigin={i === 0}
                isCurrent={i === tree.stops.length - 1}
                nextMoveReason={
                  i < tree.stops.length - 1 ? tree.stops[i + 1].move_reason : null
                }
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

// ── Stop card — one primary residence on the ember thread ─────────

function StopCard({
  node,
  index,
  isOrigin,
  isCurrent,
  nextMoveReason,
}: {
  node: JourneyNode
  index: number
  isOrigin: boolean
  isCurrent: boolean
  nextMoveReason: string | null
}) {
  const phrase = transitionPhrase(nextMoveReason)
  return (
    <li className="flex gap-3 sm:gap-4">
      {/* Rail: the marker + this stop's segment of the thread. */}
      <div className="flex w-5 shrink-0 flex-col items-center" aria-hidden>
        {isOrigin ? (
          <span
            className="text-xl leading-none text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.55)]"
            title="The beginning"
          >
            ★
          </span>
        ) : (
          <span
            className={
              'mt-1.5 block rounded-full ' +
              (isCurrent
                ? 'h-3 w-3 bg-amber-400 ring-2 ring-amber-200'
                : 'h-2.5 w-2.5 bg-amber-500/80')
            }
            title={`Stop ${index + 1}`}
          />
        )}
        {!isCurrent && (
          <span className="mt-1 w-px flex-1 bg-gradient-to-b from-amber-400/70 via-amber-300/50 to-amber-400/70" />
        )}
      </div>

      {/* Card + (below it) the transition toward the next stop. */}
      <div className={'min-w-0 flex-1 ' + (isCurrent ? '' : 'pb-2')}>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="flex items-baseline gap-2">
            <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-stone-900">
              {node.name}
            </h2>
            {isCurrent && (
              <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                now
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {isOrigin && <span className="text-amber-600">The beginning</span>}
            {node.when_text && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                {node.when_text}
              </span>
            )}
          </div>
          {node.description && (
            <p className="mt-1.5 text-sm italic text-stone-500">{node.description}</p>
          )}
          {node.children.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-l border-stone-200 pl-4">
              {node.children.map((c) => (
                <ChildRow key={c.relationship_id} node={c} depth={1} />
              ))}
            </ul>
          )}
        </div>

        {/* Transition narration: the NEXT stop's move_reason, spoken on the
            thread. Absent data renders nothing (design §4). */}
        {phrase && (
          <p className="mb-1 mt-2 text-[11px] italic text-amber-700/70">↓ {phrase}</p>
        )}
        {!isCurrent && !phrase && <div className="h-4" />}
      </div>
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
