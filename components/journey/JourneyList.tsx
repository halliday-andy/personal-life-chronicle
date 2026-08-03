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

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Markdown from '../Markdown'
import { transitionPhrase, type JourneyNode } from '@/lib/journey/tree'
import { pinTypeMeta } from '@/lib/globe/pin-types'
import { isHomeType } from '@/lib/globe/anchor-options'

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
    /** "The place itself" — editable; see PinFacts (F15, 2026-08-01). */
    residence_detail: string | null
    household_composition: string | null
    /** Extraction artifact — not editable anywhere; rendered separately. */
    rough_temporal_range: string | null
  } | null
  linked: LinkedRecollection[]
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

/** A recollection that mentions this place — cited by excerpt, readable in full. */
interface LinkedRecollection {
  id: string
  excerpt: string
  /** Full verbatim text, already in the stop payload — "… more" needs no fetch. */
  text?: string
  occurred_at_fuzzy?: string | null
  /** Where this recollection lives (its location pin) — null when native
   *  to this stop. Grounds retrospective mentions (2026-07-09). */
  home?: { relationship_id: string; name: string; when_text: string | null } | null
}

const label = (s: string) => s.replace(/_/g, ' ')

export default function JourneyList({
  stops,
  unplaced = [],
  unanchored,
  initialPin = null,
}: {
  stops: JourneyNode[]
  /** Unsequenced homes (U9) — on the globe, not yet on the thread. */
  unplaced?: JourneyNode[]
  unanchored: JourneyNode[]
  /** ?pin= deep link (J4): the stop hosting this pin opens on load and
   *  the pin's row scrolls into view. */
  initialPin?: string | null
}) {
  // Single-open accordion + per-stop detail cache (an expanded stop that
  // was closed and reopened doesn't refetch).
  const [expandedId, setExpandedId] = useState<string | null>(() => owningStopId(stops, initialPin))
  const [details, setDetails] = useState<Record<string, StopDetail | 'loading' | 'error'>>({})

  // Owner-dragged order of a stop's places, per stop. The server tree already
  // arrives ordered (lib/journey/stop-order.ts); this holds the OPTIMISTIC
  // sequence between a drop and the PATCH landing, so the row doesn't snap
  // back while the request is in flight. Keyed by stop, so dragging in one
  // stop can never disturb another.
  const [placeOrder, setPlaceOrder] = useState<Record<string, string[]>>({})
  const [orderError, setOrderError] = useState<string | null>(null)

  async function reorderPlaces(stopId: string, ids: string[], previous: string[]) {
    setPlaceOrder((o) => ({ ...o, [stopId]: ids }))
    setOrderError(null)
    try {
      const res = await fetch(`/api/globe/residence/${stopId}/stop-order`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: ids }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      // The server is the authority on which siblings exist — it appends any
      // this client didn't know about rather than dropping them.
      if (Array.isArray(d.order)) setPlaceOrder((o) => ({ ...o, [stopId]: d.order as string[] }))
    } catch {
      setPlaceOrder((o) => ({ ...o, [stopId]: previous })) // put it back
      setOrderError('Couldn’t save that order — it’s been put back.')
    }
  }

  // Deep-link / in-page arrival: bring the target pin's row into view ONCE
  // — but only after the owning stop's detail panel has rendered. Scrolling
  // at mount aimed correctly and was then shoved away when the async detail
  // inserted content above the child rows (Andy's J4 QA, 2026-07-10: the
  // Mars Hill arrival ended up centered on Loring's recollection).
  // State, not a ref: jumping to a pin whose owning stop is ALREADY the
  // expanded one changes no other state — the render (and this effect)
  // must be driven by the arrival target itself.
  const [arrivalPin, setArrivalPin] = useState<string | null>(initialPin)
  useEffect(() => {
    if (!arrivalPin) return
    const detail = expandedId ? details[expandedId] : undefined
    if (expandedId && (!detail || detail === 'loading')) return // panel still growing
    setArrivalPin(null)
    const el = document.getElementById(`journey-pin-${arrivalPin}`)
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  }, [arrivalPin, details, expandedId])

  // In-page pin jump (2026-07-10): the provenance headers in "Recollections
  // that mention this place" point at other JOURNEY pins. A real <Link>
  // navigation to the page we're already on scrolls to top and changes
  // nothing (the mounted list ignores new params) — so jump internally:
  // expand the owning stop, mirror the URL, and let the arrival effect
  // scroll once that stop's detail is in.
  // URL mirror (J4): plain history.replaceState, the same idiom the globe
  // uses — the address bar updates instantly, nothing re-renders, no
  // server round-trip of this force-dynamic page, and the Back button
  // stays unpolluted. Cold deep links read ?pin= server-side regardless.
  // (router.replace here used to sit INSIDE a setState updater — a
  // render-phase side effect React may drop, which is why the URL never
  // visibly changed: Andy's J4 QA, 2026-07-10.)
  function mirrorPinUrl(relId: string | null) {
    window.history.replaceState(null, '', relId ? `/journey?pin=${relId}` : '/journey')
  }

  function goToPin(relId: string) {
    const owner = owningStopId(stops, relId)
    setArrivalPin(relId)
    // Unanchored pins (no owning stop) live in the "Elsewhere" section —
    // collapse so the arrival scroll isn't waiting on any detail panel.
    setExpandedId(owner ?? null)
    mirrorPinUrl(relId)
  }

  // Accordion layout-shift guard (Andy's QA 2026-07-09): single-open means
  // clicking stop B while stop A ABOVE it is expanded collapses A in the
  // same render — everything below A leaps up by A's detail height and the
  // clicked title vanishes off the top of the viewport. Remember where the
  // clicked header sat on screen, and after the re-render scroll by exactly
  // the drift so it stays pinned under the pointer. Instant compensation,
  // not animation — reduced-motion safe.
  const pendingAnchorRef = useRef<{ id: string; top: number } | null>(null)

  // Keep ?pin= in the URL matching the open stop, so surface switches and
  // shared links land oriented here (J4). replace, never push — expanding
  // shouldn't pollute browser history.
  function toggle(stopId: string) {
    const header = document.getElementById(`journey-stop-btn-${stopId}`)
    if (header) pendingAnchorRef.current = { id: stopId, top: header.getBoundingClientRect().top }
    const next = expandedId === stopId ? null : stopId
    setExpandedId(next)
    mirrorPinUrl(next)
  }

  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current
    if (!anchor) return
    pendingAnchorRef.current = null
    const header = document.getElementById(`journey-stop-btn-${anchor.id}`)
    if (!header) return
    const drift = header.getBoundingClientRect().top - anchor.top
    if (drift !== 0) window.scrollBy({ top: drift, behavior: 'auto' })
  }, [expandedId])

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
            onGoToPin={goToPin}
            placeOrder={placeOrder[stop.relationship_id]}
            onReorderPlaces={reorderPlaces}
          />
        ))}
      </ol>
      {orderError && (
        <p role="status" className="mt-2 text-center text-xs text-rose-600">{orderError}</p>
      )}

      {unplaced.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Not yet placed · homes awaiting their spot
          </h2>
          <p className="mt-1 text-xs text-stone-400">
            Homes you&apos;ve pinned without deciding where they fall — place them from the
            pin&apos;s Edit panel on the globe and they join the thread.
          </p>
          <ul className="mt-2 space-y-1.5">
            {unplaced.map((n) => (
              <li key={n.relationship_id} id={`journey-pin-${n.relationship_id}`}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 shrink-0 self-center rounded-full border border-dashed border-amber-500 bg-amber-100"
                    title="Not yet placed"
                  />
                  <span className="font-medium text-stone-800">{n.name}</span>
                  {n.when_text && <span className="text-[11px] text-stone-500">· {n.when_text}</span>}
                  <Link
                    href={`/globe?pin=${n.relationship_id}&edit=1`}
                    className="text-[11px] text-amber-700 hover:text-amber-900 hover:underline"
                  >
                    Place it in sequence →
                  </Link>
                </div>
                {n.description && <p className="pl-4 text-xs italic text-stone-400">{n.description}</p>}
                {n.children.length > 0 && (
                  <ul className="mt-1 space-y-1 border-l border-stone-100 pl-4">
                    {n.children.map((c) => (
                      <ChildRow key={c.relationship_id} node={c} depth={1} />
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
  onGoToPin,
  placeOrder,
  onReorderPlaces,
}: {
  node: JourneyNode
  index: number
  isOrigin: boolean
  isCurrent: boolean
  nextMoveReason: string | null
  expanded: boolean
  detail: StopDetail | 'loading' | 'error' | undefined
  onToggle: () => void
  onGoToPin: (relationshipId: string) => void
  /** Optimistic order of this stop's places while a reorder is in flight. */
  placeOrder?: string[]
  onReorderPlaces: (stopId: string, ids: string[], previous: string[]) => void
}) {
  const phrase = transitionPhrase(nextMoveReason)
  const [dragId, setDragId] = useState<string | null>(null)

  // The tree already arrives in the owner's order; placeOrder only overrides it
  // between a drop and the server confirming. An id the override doesn't
  // mention still renders — never drop a place because a stale order omitted it.
  const places = placeOrder
    ? [
        ...placeOrder
          .map((id) => node.children.find((c) => c.relationship_id === id))
          .filter((c): c is JourneyNode => Boolean(c)),
        ...node.children.filter((c) => !placeOrder.includes(c.relationship_id)),
      ]
    : node.children

  function handleDrop(targetId: string) {
    const dragged = dragId
    setDragId(null)
    if (!dragged || dragged === targetId) return
    const ids = places.map((c) => c.relationship_id)
    const from = ids.indexOf(dragged)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, dragged)
    onReorderPlaces(node.relationship_id, next, ids)
  }
  return (
    <li id={`journey-pin-${node.relationship_id}`} className="flex gap-3 sm:gap-4">
      {/* Stop ordinal (2026-07-26, Andy's ask): the globe's detail card reads
          "· stop 8 of 14", and Journey computed the very same ordinal but hid
          it in a hover title — so the two surfaces could not confirm each
          other when you jumped between them. Its own quiet gutter beside the
          rail, deliberately subordinate to the place name: this is
          ORIENTATION, not identity. The number renumbers whenever a home is
          inserted earlier, so the durable handle stays name + when-phrase.
          No denominator here — unlike the globe, the whole arc is visible. */}
      <div
        className={
          'w-4 shrink-0 text-right text-[11px] leading-none tabular-nums text-stone-400 ' +
          (isOrigin ? 'mt-1' : 'mt-1.5')
        }
        aria-hidden
      >
        {index + 1}
      </div>

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
                {/* The rail and its ordinal are aria-hidden decoration, so the
                    stop number would otherwise be sighted-only. Announced
                    here instead, ahead of the name. */}
                <span className="sr-only">Stop {index + 1}. </span>
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
              <StopDetailBody node={node} detail={detail} onGoToPin={onGoToPin} />
            </div>
          )}

          {places.length > 0 && (
            <ul className="space-y-1.5 border-l border-stone-200 mx-4 mb-4 pl-4">
              {places.map((c) => (
                <li
                  key={c.relationship_id}
                  // Drag to reorder the places at this stop (2026-07-26).
                  // Chronological sorting isn't available — when_text is free
                  // prose and invariant #5 keeps it that way — so the sequence
                  // is the owner's assertion. Pointer-only for now; keyboard
                  // reorder is deferred per the MVP accessibility policy
                  // (memory/feedback_lc_accessibility_deferral.md).
                  draggable={places.length > 1}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', c.relationship_id)
                    e.dataTransfer.effectAllowed = 'move'
                    setDragId(c.relationship_id)
                  }}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                  onDrop={(e) => { e.preventDefault(); handleDrop(c.relationship_id) }}
                  className={
                    (places.length > 1 ? 'cursor-grab ' : '') +
                    (dragId === c.relationship_id ? 'opacity-40 ' : '') +
                    'rounded transition-colors'
                  }
                >
                  <ChildRow
                    node={c}
                    depth={1}
                    // The roll-up covers the whole anchored SUBTREE — pass it
                    // down so grandchildren (a Log on a workplace) gain their
                    // excerpts too, not only direct children (2026-07-09).
                    rollup={expanded && typeof detail === 'object' ? detail.anchored : undefined}
                  />
                </li>
              ))}
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
  onGoToPin,
}: {
  node: JourneyNode
  detail: StopDetail | 'loading' | 'error' | undefined
  onGoToPin: (relationshipId: string) => void
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

  // Homes only — the same predicate the facts EDITOR uses (F17, 2026-08-01).
  const showFacts = isHomeType(node.type_code)

  const factChips = detail.facts && showFacts
    ? ([
        detail.facts.residence_type && label(detail.facts.residence_type),
        detail.facts.move_reason &&
          detail.facts.move_reason !== 'unknown' &&
          `moved: ${label(detail.facts.move_reason)}`,
        detail.facts.residence_detail,
        detail.facts.household_composition && `with ${detail.facts.household_composition}`,
      ].filter(Boolean) as string[])
    : []

  // See PinDetailCard: the owner's facts are chips; the chronicle's own
  // reading is separated and labelled, because it cannot be corrected
  // (F15/F16, 2026-08-01).
  const chronicleReading = showFacts ? (detail.facts?.rough_temporal_range ?? null) : null

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

      {chronicleReading && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-stone-400">
            The chronicle&apos;s reading · not yours to edit
          </p>
          <p className="mt-0.5 text-xs italic text-stone-500">{chronicleReading}</p>
        </div>
      )}

      {detail.linked.length > 0 && (
        <div>
          {/* Honest label (Andy's QA 2026-07-09): this list is ENTITY
              LINKAGE — every recollection that mentions this place, from
              any era (a later Mount Snow memory that name-drops Dartmouth
              belongs here). "From this time" promised era-scoping, which
              is the Temporal Agent's future job, not this query's. */}
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
            Recollections that mention this place
          </h3>
          {/* Each row: a small provenance header (the recollection's HOME
              pin + its period — so a Mount Snow memory name-dropping
              Dartmouth reads as retrospective at a glance; native
              recollections show their own verbatim when-phrase instead),
              then the excerpt indented beneath it (Andy's QA 2026-07-09). */}
          <ul className="mt-1.5 space-y-2.5">
            {detail.linked.map((r) => (
              <LinkedRecollectionRow
                key={r.id}
                r={r}
                placeEntityId={node.place_entity_id}
                onGoToPin={onGoToPin}
              />
            ))}
          </ul>
        </div>
      )}

      {detail.context.length > 0 && (
        <div>
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Context</h3>
          <ul className="mt-1 space-y-1">
            {detail.context.map((c) => (
              // break-words: titles are derived clean now, but pasted
              // research is exactly where monster tokens come from —
              // the row must never be able to overflow the card.
              <li key={c.id} className="min-w-0 break-words text-xs">
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
        {/* Straight into the pin edit panel — the reading surface's one-click
            path to fixing text/photos/fields (Andy, 2026-07-10). */}
        <Link
          href={`/globe?pin=${node.relationship_id}&edit=1`}
          className="text-amber-700 hover:text-amber-900 hover:underline"
          title="Open this pin's edit panel on the globe — recollection text, photos, name, when"
        >
          Edit on globe →
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

// ── A cited recollection, readable in place ───────────────────────

/**
 * One "recollection that mentions this place". The citation shows a 240-char
 * excerpt; "… more" expands the full verbatim text INLINE (Andy's call,
 * 2026-07-26).
 *
 * Why inline rather than a link out: Journey is the reading surface. Sending
 * the reader to /memories to finish a sentence costs them their place in the
 * stop and lands them in a filtered list they have to navigate back from.
 * The link out survives as a secondary action, for editing.
 *
 * The excerpt used to be a bare link with only a hover colour as its
 * affordance — navigable content rendered as dead text, which is why Andy
 * read it as unclickable (the same class as the 2026-07-20 context-card
 * finding). The "… more" control is now explicit and reachable by keyboard.
 */
function LinkedRecollectionRow({
  r,
  placeEntityId,
  onGoToPin,
}: {
  r: LinkedRecollection
  placeEntityId: string
  onGoToPin: (relationshipId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  // The stop payload already carries the full text (the pin detail card has
  // expanded these in place since 338d2b3), so there is nothing to fetch and
  // no loading state — expansion is instant.
  const full = r.text ?? ''
  const panelId = `journey-recollection-${r.id}`
  const toggle = () => setExpanded((v) => !v)
  return (
    <li className="text-xs leading-relaxed">
      {r.home ? (
        <Link
          href={`/journey?pin=${r.home.relationship_id}`}
          title={`Go to ${r.home.name} in the journey`}
          className="font-medium text-amber-700/90 hover:text-amber-800 hover:underline"
          onClick={(e) => {
            // Plain click: jump in place (a real navigation to the page we're
            // on scrolls to top and changes nothing — 2026-07-10). Modified
            // clicks keep native behavior.
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
            e.preventDefault()
            onGoToPin(r.home!.relationship_id)
          }}
        >
          {r.home.name}
          {r.home.when_text && <span className="font-normal text-stone-400"> · {r.home.when_text}</span>}
        </Link>
      ) : r.occurred_at_fuzzy ? (
        <span className="font-medium text-stone-500">{r.occurred_at_fuzzy}</span>
      ) : null}

      <div className="border-l-2 border-stone-100 pl-3 text-stone-600">
        {expanded ? (
          <div id={panelId} className="journey-recollection-full">
            <Markdown>{full}</Markdown>
          </div>
        ) : (
          <p className="m-0">
            {r.excerpt}
            {/* The excerpt used to be a bare link whose only affordance was a
                hover colour — invisible on touch, and the trailing "…" read as
                "cut off" rather than "there's more" (Andy's QA). */}
            …{' '}
            <button
              type="button"
              onClick={toggle}
              aria-expanded={expanded}
              aria-controls={panelId}
              className="font-medium text-amber-700 hover:text-amber-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              more
            </button>
          </p>
        )}

        {expanded && (
          <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px]">
            <button
              type="button"
              onClick={toggle}
              aria-expanded
              aria-controls={panelId}
              className="font-medium text-amber-700 hover:text-amber-800 hover:underline"
            >
              Show less
            </button>
            <Link
              href={`/memories?entity=${placeEntityId}#${r.id}`}
              className="text-stone-400 hover:text-stone-700 hover:underline"
            >
              Open in memories ↗
            </Link>
          </p>
        )}
      </div>
    </li>
  )
}

// ── Child row — an anchored marker ────────────────────────────────

function ChildRow({
  node,
  depth,
  rollup,
}: {
  node: JourneyNode
  depth: number
  /** The expanded stop's subtree roll-up — each row finds its own entry. */
  rollup?: StopDetail['anchored']
}) {
  const meta = pinTypeMeta(node.type_code)
  const roll = rollup?.find((a) => a.relationship_id === node.relationship_id)
  const excerpt = roll?.excerpt
  const moreCount = roll?.linked_count
  const placeEntityId = roll?.place_entity_id
  return (
    <li id={`journey-pin-${node.relationship_id}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0 self-center rounded-full"
          style={{ backgroundColor: meta.color }}
          title={meta.label}
        />
        {/* draggable={false} matters twice over (F18, Andy's QA 2026-08-01).
            An <a href> is natively draggable in every browser, so (1) a
            GRANDCHILD — which has no reorder machinery at all — still
            appeared to drag, then dropped with no effect; and (2) on a
            DIRECT child, grabbing the title started the anchor's own drag
            INSTEAD of the row's, so reorder-by-title silently failed and
            only worked if you grabbed the row outside the link. Suppressing
            the link's drag hands the gesture back to the <li>. */}
        <Link
          href={`/globe?pin=${node.relationship_id}`}
          title={`Show ${node.name} on the globe`}
          draggable={false}
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
            draggable={false}
          >
            +{moreCount} more {moreCount === 1 ? 'recollection' : 'recollections'} →
          </Link>
        </p>
      )}
      {node.children.length > 0 && (
        <ul className={depth < 2 ? 'mt-1 space-y-1 border-l border-stone-100 pl-4' : 'mt-1 space-y-1'}>
          {node.children.map((c) => (
            <ChildRow key={c.relationship_id} node={c} depth={depth + 1} rollup={rollup} />
          ))}
        </ul>
      )}
    </li>
  )
}
