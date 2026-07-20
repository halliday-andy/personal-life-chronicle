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

import { useState } from 'react'
import { pinTypeMeta } from '@/lib/globe/pin-types'
import PinHopper from './PinHopper'
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
}

export interface ContextEntry {
  id: string
  title: string
  visibility: string
}

// Which collection is expanded. Only one opens at a time so the read-view card
// never grows tall enough to occlude its own pin — presence stays visible as
// counts, content is opt-in (2026-06-26 reframe).
type OpenChip = 'recollections' | 'context' | 'related' | 'hopper' | null

export default function PinConnections({
  entityId,
  placeName,
  linked,
  context,
  anchored,
  onSelectAnchored,
  variant,
}: {
  entityId: string
  placeName: string
  linked: LinkedRecollection[]
  context: ContextEntry[]
  anchored: AnchoredPin[]
  onSelectAnchored: (relationshipId: string) => void
  variant: 'card' | 'panel'
}) {
  const [openChip, setOpenChip] = useState<OpenChip>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [stubCount, setStubCount] = useState(0)

  // The hopper joins the single-open chip set only on the read card; the edit
  // panel keeps its own full always-open hopper (see file header).
  const includeHopper = variant === 'card'

  const chips = [
    linked.length > 0 && { key: 'recollections' as const, label: `${linked.length} recollection${linked.length === 1 ? '' : 's'}` },
    context.length > 0 && { key: 'context' as const, label: `${context.length} context` },
    anchored.length > 0 && { key: 'related' as const, label: `${anchored.length} related pin${anchored.length === 1 ? '' : 's'}` },
    includeHopper && { key: 'hopper' as const, label: stubCount > 0 ? `✎ ${stubCount} to write` : '✎ jot' },
  ].filter(Boolean) as { key: Exclude<OpenChip, null>; label: string }[]

  // Panel variant with no connections yet: render nothing rather than an empty
  // bordered block. (The read card always has at least the jot chip.)
  if (chips.length === 0) return null

  return (
    <div className="mt-3 border-t border-[var(--glass-border)] pt-3">
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

      {openChip === 'related' && anchored.length > 0 && (
        <div className="mt-2">
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {anchored.map((a) => (
              <li key={a.relationship_id}>
                <button
                  onClick={() => onSelectAnchored(a.relationship_id)}
                  title={`Open ${a.name}`}
                  className="w-full rounded-lg px-1 py-0.5 text-left text-xs leading-relaxed text-[var(--ink)]/80 hover:bg-white/5 hover:text-[var(--ink)]"
                >
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: pinTypeMeta(a.type_code).color }} />
                  <span className="font-medium text-[var(--ink)]">{a.name}</span>
                  {a.excerpt ? <span className="text-[var(--ink-dim)]"> — {a.excerpt}</span> : null}
                  {(a.linked_count ?? 0) > 0 && (
                    <span className="text-[var(--ember-soft)]"> · +{a.linked_count} more</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
