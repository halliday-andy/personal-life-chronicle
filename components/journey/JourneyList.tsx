'use client'

/**
 * JourneyList — J2 rail + J3 expand-to-detail
 * (docs/plans/2026-07-05-journey-view-design.md).
 *
 * The server page fetches the whole journey in ONE get_residence_pins
 * call and hands the tree here. Nothing else is fetched until a stop is
 * tapped: expansion lazily loads that pin's detail (recollection,
 * primary photo, fact chips, linked recollections, context titles,
 * per-child excerpts) from the existing single-pin route. Single-open
 * accordion — the reading column stays a column.
 *
 * Deliberately static motion-wise (reduced-motion safe); the globe
 * handoff links are J4.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Markdown from '../Markdown'
import { transitionPhrase, type JourneyNode } from '@/lib/journey/tree'
import { pinTypeMeta } from '@/lib/globe/pin-types'

/** The stop that hosts a pin id — the stop itself, or the stop whose
 *  subtree (anchored markers, any depth) contains it. */
function owningStopId(stops: JourneyNode[], pinId: string | null): string | null {
  if (!pinId) return null
  const contains = (n: JourneyNode): boolean =>
    n.relationship_id === pinId || n.children.some(contains)
  for (const s of stops) if (contains(s)) return s.relationship_id
  return null
}

interface StopDetail {
  body: string
  image: { url: string; filename: string | null } | null
  facts: {
    residence_type: string | null
    move_reason: string | null
    household_composition: string | null
    rough_temporal_range: string | null
  } | null
  linked: { id: string; excerpt: string }[]
  anchored: {
    relationship_id: string
    name: string
    excerpt: string
    place_entity_id?: string
    /** Recollections on this child beyond its shown overview excerpt. */
    linked_count?: number
  }[]
  context: { id: string; title: string; visibility: string }[]
}

const label = (s: string) => s.replace(/_/g, ' ')

export default function JourneyList({
  stops,
  unanchored,
  initialPin = null,
}: {
  stops: JourneyNode[]
  unanchored: JourneyNode[]
  /** ?pin= deep link (J4): the stop hosting this pin opens on load and
   *  the pin's row scrolls into view. */
  initialPin?: string | null
}) {
  const router = useRouter()
  // Single-open accordion + per-stop detail cache (an expanded stop that
  // was closed and reopened doesn't refetch).
  const [expandedId, setExpandedId] = useState<string | null>(() => owningStopId(stops, initialPin))
  const [details, setDetails] = useState<Record<string, StopDetail | 'loading' | 'error'>>({})

  // Deep-link arrival: bring the linked pin's row into view once, without
  // scroll-jacking later interactions. Reduced motion → instant jump.
  useEffect(() => {
    if (!initialPin) return
    const el = document.getElementById(`journey-pin-${initialPin}`)
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- arrival-only
  }, [])

  // Keep ?pin= in the URL matching the open stop, so surface switches and
  // shared links land oriented here (J4). replace, never push — expanding
  // shouldn't pollute browser history.
  function toggle(stopId: string) {
    setExpandedId((cur) => {
      const next = cur === stopId ? null : stopId
      router.replace(next ? `/journey?pin=${next}` : '/journey', { scroll: false })
      return next
    })
  }

  useEffect(() => {
    if (!expandedId) return
    if (details[expandedId] && details[expandedId] !== 'error') return
    let active = true
    setDetails((d) => ({ ...d, [expandedId]: 'loading' }))
    fetch(`/api/globe/residence/${expandedId}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => {
        if (!active) return
        setDetails((prev) => ({
          ...prev,
          [expandedId]: {
            body: d.body ?? '',
            image: d.image ?? null,
            facts: d.facts ?? null,
            linked: d.linked ?? [],
            anchored: d.anchored ?? [],
            context: d.context ?? [],
          },
        }))
      })
      .catch(() => { if (active) setDetails((prev) => ({ ...prev, [expandedId]: 'error' })) })
    return () => { active = false }
    // details deliberately omitted: it's the cache this effect writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId])

  return (
    <>
      <ol className="mt-6">
        {stops.map((stop, i) => (
          <StopCard
            key={stop.relationship_id}
            node={stop}
            index={i}
            isOrigin={i === 0}
            isCurrent={i === stops.length - 1}
            nextMoveReason={i < stops.length - 1 ? stops[i + 1].move_reason : null}
            expanded={expandedId === stop.relationship_id}
            detail={details[stop.relationship_id]}
            onToggle={() => toggle(stop.relationship_id)}
          />
        ))}
      </ol>

      {unanchored.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Elsewhere · not yet anchored
          </h2>
          <p className="mt-1 text-xs text-stone-400">
            Places without a home to hang from — pick an anchor in the pin&apos;s Edit panel on
            the globe and they join the journey.
          </p>
          <ul className="mt-2 space-y-1.5">
            {unanchored.map((n) => (
              <ChildRow key={n.relationship_id} node={n} depth={1} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// ── Stop card on the ember thread ─────────────────────────────────

function StopCard({
  node,
  index,
  isOrigin,
  isCurrent,
  nextMoveReason,
  expanded,
  detail,
  onToggle,
}: {
  node: JourneyNode
  index: number
  isOrigin: boolean
  isCurrent: boolean
  nextMoveReason: string | null
  expanded: boolean
  detail: StopDetail | 'loading' | 'error' | undefined
  onToggle: () => void
}) {
  const phrase = transitionPhrase(nextMoveReason)
  return (
    <li id={`journey-pin-${node.relationship_id}`} className="flex gap-3 sm:gap-4">
      {/* Rail: marker + this stop's thread segment (J2). */}
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
              (isCurrent ? 'h-3 w-3 bg-amber-400 ring-2 ring-amber-200' : 'h-2.5 w-2.5 bg-amber-500/80')
            }
            title={`Stop ${index + 1}`}
          />
        )}
        {!isCurrent && (
          <span className="mt-1 w-px flex-1 bg-gradient-to-b from-amber-400/70 via-amber-300/50 to-amber-400/70" />
        )}
      </div>

      <div className={'min-w-0 flex-1 ' + (isCurrent ? '' : 'pb-2')}>
        <div className="rounded-xl border border-stone-200 bg-white">
          {/* Accordion header (J3/J5): the place name is a real heading so
              screen readers can walk the journey by headings; the button
              inside carries the disclosure semantics. */}
          <h2 className="m-0">
            <button
              type="button"
              id={`journey-stop-btn-${node.relationship_id}`}
              onClick={onToggle}
              aria-expanded={expanded}
              aria-controls={`journey-stop-panel-${node.relationship_id}`}
              className="block w-full rounded-xl px-4 py-4 text-left transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <span className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-lg font-semibold text-stone-900">
                  {node.name}
                </span>
                {isCurrent && (
                  <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                    now
                  </span>
                )}
                <span aria-hidden className="shrink-0 text-xs text-stone-400">
                  {expanded ? '▾' : '▸'}
                </span>
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs font-normal">
                {isOrigin && <span className="text-amber-600">The beginning</span>}
                {node.when_text && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                    {node.when_text}
                  </span>
                )}
              </span>
              {node.description && (
                <span className="mt-1.5 block text-sm font-normal italic text-stone-500">
                  {node.description}
                </span>
              )}
            </button>
          </h2>

          {expanded && (
            <div
              id={`journey-stop-panel-${node.relationship_id}`}
              role="region"
              aria-labelledby={`journey-stop-btn-${node.relationship_id}`}
              className="border-t border-stone-100 px-4 py-3"
            >
              <StopDetailBody node={node} detail={detail} />
            </div>
          )}

          {node.children.length > 0 && (
            <ul className="space-y-1.5 border-l border-stone-200 mx-4 mb-4 pl-4">
              {node.children.map((c) => {
                const roll = expanded && typeof detail === 'object'
                  ? detail.anchored.find((a) => a.relationship_id === c.relationship_id)
                  : undefined
                return (
                  <ChildRow
                    key={c.relationship_id}
                    node={c}
                    depth={1}
                    excerpt={roll?.excerpt}
                    moreCount={roll?.linked_count}
                    placeEntityId={roll?.place_entity_id}
                  />
                )
              })}
            </ul>
          )}
        </div>

        {phrase && (
          <p className="mb-1 mt-2 text-[11px] italic text-amber-700/70">
            <span aria-hidden>↓ </span>
            {phrase}
          </p>
        )}
        {!isCurrent && !phrase && <div className="h-4" />}
      </div>
    </li>
  )
}

// ── Expanded detail (J3, lazily fetched) ──────────────────────────

function StopDetailBody({
  node,
  detail,
}: {
  node: JourneyNode
  detail: StopDetail | 'loading' | 'error' | undefined
}) {
  if (!detail || detail === 'loading') {
    return (
      <div className="space-y-2" role="status">
        <span className="sr-only">Loading this stop&apos;s detail…</span>
        <div aria-hidden className="h-3 w-3/4 rounded bg-stone-100" />
        <div aria-hidden className="h-3 w-2/3 rounded bg-stone-100" />
        <div aria-hidden className="h-3 w-1/2 rounded bg-stone-100" />
      </div>
    )
  }
  if (detail === 'error') {
    return (
      <p className="text-xs text-rose-600">
        Could not load this stop&apos;s detail — check the connection and tap again.
      </p>
    )
  }

  const factChips = detail.facts
    ? ([
        detail.facts.residence_type && label(detail.facts.residence_type),
        detail.facts.move_reason &&
          detail.facts.move_reason !== 'unknown' &&
          `moved: ${label(detail.facts.move_reason)}`,
        detail.facts.household_composition && `with ${detail.facts.household_composition}`,
        detail.facts.rough_temporal_range,
      ].filter(Boolean) as string[])
    : []

  return (
    <div className="space-y-3">
      {detail.image && (
        // Signed Supabase URL — next/image can't optimize it, only proxy it.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={detail.image.url}
          alt={detail.image.filename ?? node.name}
          loading="lazy"
          className="max-h-56 rounded-lg object-cover"
        />
      )}

      {detail.body ? (
        <div className="max-h-72 overflow-y-auto">
          <Markdown className="text-sm text-stone-800">{detail.body}</Markdown>
        </div>
      ) : (
        <p className="text-sm italic text-stone-400">
          No recollection here yet — add one from the pin on the globe.
        </p>
      )}

      {factChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {factChips.map((c) => (
            <span
              key={c}
              className="rounded-full border border-stone-200 px-2 py-0.5 text-xs text-stone-500"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {detail.linked.length > 0 && (
        <div>
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
            Recollections from this time
          </h3>
          <ul className="mt-1 space-y-1">
            {detail.linked.map((r) => (
              <li key={r.id} className="text-xs leading-relaxed text-stone-600">
                <Link
                  href={`/memories?entity=${node.place_entity_id}`}
                  className="hover:text-stone-900 hover:underline"
                >
                  {r.excerpt}…
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail.context.length > 0 && (
        <div>
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Context</h3>
          <ul className="mt-1 space-y-1">
            {detail.context.map((c) => (
              <li key={c.id} className="text-xs">
                <Link
                  href={`/entities/${node.place_entity_id}`}
                  className="text-stone-600 hover:text-stone-900 hover:underline"
                >
                  {c.visibility === 'private' && <span title="Private">🔒 </span>}
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-1 text-xs">
        <Link
          href={`/globe?pin=${node.relationship_id}`}
          className="text-amber-700 hover:text-amber-900 hover:underline"
        >
          Show on globe →
        </Link>
        <Link
          href={`/entities/${node.place_entity_id}`}
          className="text-amber-700 hover:text-amber-900 hover:underline"
        >
          Open place page ↗
        </Link>
        <Link
          href={`/memories?entity=${node.place_entity_id}`}
          className="text-amber-700 hover:text-amber-900 hover:underline"
        >
          All recollections →
        </Link>
      </div>
    </div>
  )
}

// ── Child row — an anchored marker ────────────────────────────────

function ChildRow({
  node,
  depth,
  excerpt,
  moreCount,
  placeEntityId,
}: {
  node: JourneyNode
  depth: number
  excerpt?: string
  /** Recollections on this child beyond the shown overview (2026-07-09). */
  moreCount?: number
  placeEntityId?: string
}) {
  const meta = pinTypeMeta(node.type_code)
  return (
    <li id={`journey-pin-${node.relationship_id}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0 self-center rounded-full"
          style={{ backgroundColor: meta.color }}
          title={meta.label}
        />
        <Link
          href={`/globe?pin=${node.relationship_id}`}
          title={`Show ${node.name} on the globe`}
          className="font-medium text-stone-800 hover:text-amber-800 hover:underline"
        >
          {node.name}
        </Link>
        <span className="text-[11px] text-stone-400">{meta.label}</span>
        {node.when_text && <span className="text-[11px] text-stone-500">· {node.when_text}</span>}
      </div>
      {node.description && <p className="pl-4 text-xs italic text-stone-400">{node.description}</p>}
      {excerpt && <p className="pl-4 text-xs leading-relaxed text-stone-500">{excerpt}…</p>}
      {/* A place accumulating recollections must not look inert from the
          Journey (Andy's QA 2026-07-09): surface the count with a direct
          reading path — the filtered /memories list for this place. */}
      {(moreCount ?? 0) > 0 && placeEntityId && (
        <p className="pl-4 text-[11px]">
          <Link
            href={`/memories?entity=${placeEntityId}`}
            className="text-amber-700/80 hover:text-amber-800 hover:underline"
            title={`Read the recollections at ${node.name}`}
          >
            +{moreCount} more {moreCount === 1 ? 'recollection' : 'recollections'} →
          </Link>
        </p>
      )}
      {node.children.length > 0 && (
        <ul className={depth < 2 ? 'mt-1 space-y-1 border-l border-stone-100 pl-4' : 'mt-1 space-y-1'}>
          {node.children.map((c) => (
            <ChildRow key={c.relationship_id} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}
