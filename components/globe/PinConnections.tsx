'use client'

/**
 * PinConnections — a pin's connected collections (recollections, context,
 * related pins) as a compact count-chip row with single-open disclosure.
 *
 * Mounted by BOTH the read view (PinDetailCard, variant="card") and the edit
 * view (PinEditPanel, variant="panel") so the two surfaces can never drift
 * apart again — the root cause of the 2026-07-20 reconciliation
 * (docs/plans/2026-07-20-pin-card-reconciliation-design.md).
 *
 * The hopper is the one place the surfaces genuinely differ:
 *  - variant="card": the hopper is the 4th chip, part of the single-open set,
 *    so the bottom popover never grows tall enough to occlude its own pin
 *    (the 2026-06-26 constraint). This component mounts PinHopper variant="card".
 *  - variant="panel": only the 3 collection chips render; the edit panel keeps
 *    its own full always-open PinHopper variant="panel" mounted separately.
 *
 * Mount with key={relationshipId} so navigating pins resets the open chip.
 */

import { useEffect, useRef, useState } from 'react'
import { pinTypeMeta } from '@/lib/globe/pin-types'
import PinHopper from './PinHopper'
import PinTrips, { type TripCardContext } from './PinTrips'
import Markdown from '../Markdown'

export interface LinkedRecollection {
  id: string
  excerpt: string
  text: string
  created_at: string
}

export interface AnchoredPin {
  relationship_id: string
  name: string
  type_code: string | null
  excerpt: string
  /** Recollections on this child beyond its overview excerpt (2026-07-09). */
  linked_count?: number
  /** The pin's own era phrase — what makes the ordered list read as a sequence. */
  when_text?: string | null
  /** Direct places (anchored to the host) are draggable; descendants aren't. */
  anchor_residence_id?: string | null
}

export interface ContextEntry {
  id: string
  title: string
  visibility: string
}

// Which collection is expanded. Only one opens at a time so the read-view card
// never grows tall enough to occlude its own pin — presence stays visible as
// counts, content is opt-in (2026-06-26 reframe).
type OpenChip = 'recollections' | 'context' | 'hopper' | 'trips' | null

export default function PinConnections({
  entityId,
  placeName,
  linked,
  context,
  anchored,
  onSelectAnchored,
  variant,
  relationshipId,
  hostIsHome = false,
  tripCtx,
}: {
  entityId: string
  placeName: string
  linked: LinkedRecollection[]
  context: ContextEntry[]
  anchored: AnchoredPin[]
  onSelectAnchored: (relationshipId: string) => void
  variant: 'card' | 'panel'
  /** The host pin — the reorder endpoint's subject. */
  relationshipId: string
  /** Home types read as a "stop"; a workplace with Logs under it does not. */
  hostIsHome?: boolean
  /** The pin's trips, as a single assembled object (R4, 2026-08-01). Absent
   *  on surfaces that have no globe behind them. `PinConnections` never
   *  inspects it — it only sizes the chip and hands it to `PinTrips`. */
  tripCtx?: TripCardContext
}) {
  const [openChip, setOpenChip] = useState<OpenChip>(null)
  const [tripCount, setTripCount] = useState(0)
  const disclosureRef = useRef<HTMLDivElement>(null)

  // Opening a chip appends its panel BELOW the chip row, inside a scrollable
  // host (the edit panel's `overflow-y-auto` column at PinEditPanel.tsx:283,
  // or the detail card). Nothing scrolled, so on a long pin the panel opened
  // past the fold and the chip read as a DEAD CONTROL — Andy reproduced this
  // on Zaragoza AB after it first appeared un-reproducible (F10, raised
  // 2026-07-30, confirmed with screenshots 2026-08-01).
  //
  // Rule 13: a mode switch that changes an element's height must keep that
  // element in view. `block: 'nearest'` scrolls the minimum needed, so an
  // already-visible panel is left alone.
  useEffect(() => {
    if (!openChip) return
    disclosureRef.current?.scrollIntoView({ block: 'nearest' })
  }, [openChip])
  const [dragId, setDragId] = useState<string | null>(null)
  const [order, setOrder] = useState<string[] | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [stubCount, setStubCount] = useState(0)

  // The hopper joins the single-open chip set only on the read card; the edit
  // panel keeps its own full always-open hopper (see file header).
  const includeHopper = variant === 'card'

  // Places arrive already ordered (orderAnchoredSubtree); `order` holds the
  // optimistic sequence between a drop and the PATCH landing. A place the
  // override doesn't mention still renders — never drop one on a stale order.
  const places = order
    ? [
        ...order.map((id) => anchored.find((a) => a.relationship_id === id)).filter((a): a is AnchoredPin => Boolean(a)),
        ...anchored.filter((a) => !order.includes(a.relationship_id)),
      ]
    : anchored
  // Only DIRECT places reorder; descendants follow their parent (Andy's call
  // 2026-07-26 — "grandchildren are likely to remain underneath their parents").
  const directIds = places.filter((a) => a.anchor_residence_id === relationshipId).map((a) => a.relationship_id)
  const canDrag = directIds.length > 1

  async function handleDrop(targetId: string) {
    const dragged = dragId
    setDragId(null)
    if (!dragged || dragged === targetId) return
    if (!directIds.includes(dragged) || !directIds.includes(targetId)) return
    const from = directIds.indexOf(dragged)
    const to = directIds.indexOf(targetId)
    const next = [...directIds]
    next.splice(from, 1)
    next.splice(to, 0, dragged)
    const previous = order
    setOrder(next)
    setOrderError(null)
    try {
      const res = await fetch(`/api/globe/residence/${relationshipId}/stop-order`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      if (Array.isArray(d.order)) setOrder(d.order as string[])
    } catch {
      setOrder(previous)
      setOrderError('Couldn’t save that order — it’s been put back.')
    }
  }

  const chips = [
    linked.length > 0 && { key: 'recollections' as const, label: `${linked.length} recollection${linked.length === 1 ? '' : 's'}` },
    // ALWAYS present, unlike the others (Andy's QA 2026-07-26): gating this
    // chip on context.length > 0 meant the "＋ Add New Context" affordance
    // lived inside a disclosure that only existed once context already did —
    // so you could only add context to a pin that already had some. Ten of
    // Andy's fourteen homes had no route to it at all.
    // Class-of-bug: never hide the control that CREATES the first item behind
    // the existence of an item.
    { key: 'context' as const, label: context.length > 0 ? `${context.length} context` : '＋ context' },
    // Always present when the surface has a globe behind it: a home offers
    // "start a trip from here" even with no trips yet, and a marker pin
    // offers "frame it as a trip" (F2 — the control belongs on the pin).
    tripCtx && { key: 'trips' as const, label: tripCount > 0 ? `✈ ${tripCount} trip${tripCount === 1 ? '' : 's'}` : '✈ trips' },
    includeHopper && { key: 'hopper' as const, label: stubCount > 0 ? `✎ ${stubCount} to write` : '✎ jot' },
  ].filter(Boolean) as { key: Exclude<OpenChip, null>; label: string }[]

  // Panel variant with no connections yet: render nothing rather than an empty
  // bordered block. (The read card always has at least the jot chip.)
  if (chips.length === 0) return null

  return (
    <div className="mt-3 border-t border-[var(--glass-border)] pt-3">
      {/* Places at this stop — ELEVATED above the chips (Andy's QA 2026-07-26).
          This used to be a "N related pins" count chip at the very bottom of a
          long card, in faint text, behind a click: a four-month stay inside a
          twelve-month home read as an afterthought. It is now the stop's
          content, in the owner's dragged order, each with its own era phrase
          so the sequence reads as a progression. Pointer-only drag; keyboard
          reorder deferred per the MVP accessibility policy. */}
      {places.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-dim)]">
            {hostIsHome ? 'Places at this stop' : 'Related places'}
          </p>
          <ul className="mt-1 space-y-0.5">
            {places.map((a) => {
              const draggable = canDrag && a.anchor_residence_id === relationshipId
              const nested = a.anchor_residence_id !== relationshipId
              return (
                <li
                  key={a.relationship_id}
                  draggable={draggable}
                  onDragStart={draggable ? (e) => {
                    e.dataTransfer.setData('text/plain', a.relationship_id)
                    e.dataTransfer.effectAllowed = 'move'
                    setDragId(a.relationship_id)
                  } : undefined}
                  onDragEnd={draggable ? () => setDragId(null) : undefined}
                  onDragOver={draggable ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } : undefined}
                  onDrop={draggable ? (e) => { e.preventDefault(); void handleDrop(a.relationship_id) } : undefined}
                  className={
                    (draggable ? 'cursor-grab ' : '') +
                    (dragId === a.relationship_id ? 'opacity-40 ' : '') +
                    (nested ? 'pl-3 ' : '')
                  }
                >
                  <button
                    onClick={() => onSelectAnchored(a.relationship_id)}
                    title={`Open ${a.name}`}
                    className="w-full rounded-lg px-1 py-0.5 text-left text-xs leading-relaxed text-[var(--ink)]/80 hover:bg-white/5 hover:text-[var(--ink)]"
                  >
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: pinTypeMeta(a.type_code).color }} />
                    <span className="font-medium text-[var(--ink)]">{a.name}</span>
                    <span className="text-[var(--ink-dim)]/70"> · {pinTypeMeta(a.type_code).label}</span>
                    {a.when_text ? <span className="text-[var(--ember-soft)]"> · {a.when_text}</span> : null}
                    {a.excerpt ? <span className="block pl-3.5 text-[var(--ink-dim)]">{a.excerpt}</span> : null}
                    {(a.linked_count ?? 0) > 0 && (
                      <span className="block pl-3.5 text-[var(--ember-soft)]">+{a.linked_count} more</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          {orderError && <p className="mt-1 text-[11px] text-rose-300">{orderError}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => {
          const open = openChip === c.key
          return (
            <button
              key={c.key}
              onClick={() => setOpenChip(open ? null : c.key)}
              aria-expanded={open}
              className={
                'rounded-full border px-2.5 py-0.5 text-xs transition ' +
                (open
                  ? 'border-[var(--ember-soft)] text-[var(--ember-soft)]'
                  : 'border-[var(--glass-border)] text-[var(--ink-dim)] hover:text-[var(--ink)]')
              }
            >
              {c.label}
            </button>
          )
        })}
      </div>

      <div ref={disclosureRef}>
      {openChip === 'recollections' && linked.length > 0 && (
        <div className="mt-2">
          <div className="flex items-baseline justify-end">
            <a
              href={`/memories?entity=${entityId}`}
              className="shrink-0 text-xs text-[var(--ember-soft)] hover:text-[var(--ember)]"
            >
              View all in Recollections →
            </a>
          </div>
          <ul className="mt-1.5 max-h-40 space-y-1.5 overflow-y-auto">
            {linked.map((r) => {
              const expanded = expandedId === r.id
              const truncated = r.text.length > r.excerpt.length || r.excerpt.length >= 240
              return (
                <li key={r.id} className="text-xs leading-relaxed text-[var(--ink)]/80">
                  {/* Toggle stays a plain-text button (no block markdown nested
                      inside <button>); the expanded recollection renders as
                      markdown below it. */}
                  <button
                    onClick={() => setExpandedId(expanded ? null : r.id)}
                    className="w-full text-left hover:text-[var(--ink)]"
                    title={expanded ? 'Collapse' : 'Read the full recollection'}
                  >
                    <span className="mr-1.5 text-[var(--ember-soft)]">{expanded ? '▾' : '▸'}</span>
                    {expanded ? 'Collapse' : (
                      <>
                        {r.excerpt}
                        {truncated ? '…' : ''}
                      </>
                    )}
                  </button>
                  {expanded && <Markdown className="mt-1 pl-4">{r.text}</Markdown>}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {openChip === 'context' && (
        <div className="mt-2">
          {/* Existing context is the primary content — you opened the chip to
              SEE it (Andy's finding 2026-07-20). "Add" is the secondary action,
              top-right. All context lives on the place's entity page, so a row
              opens it there — navigate, not expand-in-place: notes are often
              long pasted research and the card stays short over its own pin.
              The trailing ↗ is the same "opens elsewhere" signal used above.
              "Add New Context" deep-links with the composer pre-opened. */}
          <div className="flex items-baseline justify-end">
            <a
              href={`/entities/${entityId}?addContext=1`}
              className="shrink-0 text-xs text-[var(--ember-soft)] hover:text-[var(--ember)]"
              title="Add background research about this place — opens the composer on the place page"
            >
              ＋ Add New Context ↗
            </a>
          </div>
          {context.length === 0 && (
            <p className="mt-1.5 text-xs italic text-[var(--ink-dim)]">
              No background about this place yet — research, history, anything that frames the memories.
            </p>
          )}
          <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
            {context.map((c) => (
              <li key={c.id}>
                <a
                  href={`/entities/${entityId}`}
                  title={`Open “${c.title}” on the place page`}
                  className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-xs leading-relaxed hover:bg-white/5"
                >
                  {c.visibility === 'private' ? (
                    <span className="shrink-0" title="Private — only you can see this">🔒</span>
                  ) : (
                    <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ember-soft)]" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium text-[var(--ink)]">{c.title}</span>
                  <span aria-hidden className="shrink-0 text-[var(--ember-soft)]">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mounted regardless of which chip is open so the stub count stays live
          on the chip; renders its UI only while its chip is open (card only). */}
      {includeHopper && (
        <PinHopper
          entityId={entityId}
          hostName={placeName}
          variant="card"
          open={openChip === 'hopper'}
          onCountChange={setStubCount}
        />
      )}
      {/* Mounted regardless of which chip is open so the trips' own jot
          counts stay live — same discipline as the hopper above. */}
      {tripCtx && (
        <PinTrips ctx={tripCtx} open={openChip === 'trips'} onCountChange={setTripCount} />
      )}
      </div>

    </div>
  )
}
