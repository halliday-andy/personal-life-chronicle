'use client'

/**
 * PinDetailCard — read view for a selected residence pin (Step 7 Slice 2).
 *
 * Sits below the globe (bottom-center). Pin click opens this card; the
 * Edit button hands off to PinEditPanel (Slice 4a), which also enables
 * drag-to-relocate. Shows the recollection, the pin's single image
 * (upload / replace / remove here), and any AI-extracted facts.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { preprocessPinImage } from '@/lib/globe/image-preprocess'
import { pinTypeMeta } from '@/lib/globe/pin-types'
import PhotoLightbox from './PhotoLightbox'
import PinHopper from './PinHopper'
import Markdown from '../Markdown'

export interface PinFacts {
  residence_type: string | null
  move_reason: string | null
  household_composition: string | null
  rough_temporal_range: string | null
}

export interface PinImageInfo {
  media_id: string
  url: string
  filename: string | null
  is_primary?: boolean
}

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
}

export interface ContextEntry {
  id: string
  title: string
  visibility: string
}

// Which secondary collection is expanded under the body. Only one opens at a
// time so the card never grows tall enough to occlude its own pin — presence
// stays visible as counts, content is opt-in (2026-06-26 reframe).
type OpenChip = 'recollections' | 'context' | 'anchored' | 'hopper' | null

const label = (s: string) => s.replace(/_/g, ' ')

export default function PinDetailCard({
  pin,
  position,
  total,
  refining,
  onNavigate,
  onRefine,
  onEdit,
  onClose,
  onSelectAnchored,
}: {
  pin: { relationship_id: string; place_entity_id: string; name: string; when_text: string | null; place_subtype: string | null; type_code: string | null }
  position: number   // 0-based index in the SPINE sequence; -1 for off-spine markers
  total: number      // number of primary residences (spine length)
  refining: boolean  // drag-to-refine armed from this card (Phase-5 finding 1)
  onNavigate: (dir: -1 | 1) => void  // step prev/next along the spine + fly there
  onRefine: () => void  // arm drag-to-refine without opening the full edit panel
  onEdit: () => void
  onClose: () => void
  onSelectAnchored: (relationshipId: string) => void  // open a pin anchored here (Slice 3.6)
}) {
  // Prev/next walks the residential spine; shown only on spine pins with
  // neighbours (markers are off-spine, position -1).
  const onSpine = position >= 0 && total > 1
  const [body, setBody] = useState('')
  const [image, setImage] = useState<PinImageInfo | null>(null)
  const [imageCount, setImageCount] = useState(0)
  const [facts, setFacts] = useState<PinFacts | null>(null)
  const [linked, setLinked] = useState<LinkedRecollection[]>([])
  const [anchored, setAnchored] = useState<AnchoredPin[]>([])
  const [context, setContext] = useState<ContextEntry[]>([])
  const [stubCount, setStubCount] = useState(0)
  const [openChip, setOpenChip] = useState<OpenChip>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // A failed load must look like a failure, never like an empty pin —
  // otherwise a dead server reads as "no recollection yet" (data-loss scare,
  // 2026-06-10) and invites edits that could overwrite real content.
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageNotice, setImageNotice] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(false)
    setOpenChip(null)
    setExpandedId(null)
    fetch(`/api/globe/residence/${pin.relationship_id}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => {
        if (!active) return
        setBody(d.body ?? '')
        setImage(d.image ?? null)
        setImageCount(d.images?.length ?? (d.image ? 1 : 0))
        setFacts(d.facts ?? null)
        setLinked(d.linked ?? [])
        setAnchored(d.anchored ?? [])
        setContext(d.context ?? [])
        setLoading(false)
      })
      .catch(() => { if (active) { setLoadError(true); setLoading(false) } })
    return () => { active = false }
  }, [pin.relationship_id, reloadKey])

  const handleFile = useCallback(async (file: File) => {
    setImageBusy(true)
    setImageError(null)
    setImageNotice(null)
    try {
      // HEIC→JPEG + compression toward ~2MB happens client-side so every
      // browser can render what lands in storage. From the card, a new
      // upload always becomes the pin photo (primary); a previous photo
      // is demoted into the gallery, not deleted.
      const { file: prepared, warning } = await preprocessPinImage(file)
      const form = new FormData()
      form.append('file', prepared)
      form.append('primary', 'true')
      const res = await fetch(`/api/globe/residence/${pin.relationship_id}/image`, {
        method: 'POST',
        body: form,
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`)
      setImage(d.image ?? null)
      setImageCount(d.images?.length ?? (d.image ? 1 : 0))
      setImageNotice(warning)
    } catch (e) {
      setImageError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setImageBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [pin.relationship_id])

  const handleRemoveImage = useCallback(async () => {
    setImageBusy(true)
    setImageError(null)
    try {
      // No media_id = remove the primary; the newest remaining gallery
      // image (if any) is promoted server-side.
      const res = await fetch(`/api/globe/residence/${pin.relationship_id}/image`, { method: 'DELETE' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const next = (d.images ?? [])[0] ?? null
      setImage(next)
      setImageCount(d.images?.length ?? 0)
    } catch (e) {
      setImageError(e instanceof Error ? e.message : 'Could not remove the photo.')
    } finally {
      setImageBusy(false)
    }
  }, [pin.relationship_id])

  const factChips = facts
    ? ([
        facts.residence_type && label(facts.residence_type),
        facts.move_reason && facts.move_reason !== 'unknown' && `moved: ${label(facts.move_reason)}`,
        facts.household_composition,
        facts.rough_temporal_range,
      ].filter(Boolean) as string[])
    : []

  return (
    <div className="glass absolute bottom-6 left-1/2 z-30 w-[min(640px,94vw)] -translate-x-1/2 rounded-2xl p-5 text-[var(--ink)]">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-[var(--ink-dim)]">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: pinTypeMeta(pin.type_code).color }} />
            {pinTypeMeta(pin.type_code).label}
            {position >= 0 && total > 1 ? ` · stop ${position + 1} of ${total}` : ''}
          </p>
          <h2 className="nocturne-display mt-0.5 text-2xl font-medium leading-tight">{pin.name}</h2>
          {pin.when_text && <p className="mt-0.5 text-sm text-[var(--ember-soft)]">{pin.when_text}</p>}
          {/* Into the entity/context surfaces — where this place's context notes live (Slice 6). */}
          <a href={`/entities/${pin.place_entity_id}`} className="mt-0.5 inline-block text-xs text-[var(--ink-dim)] hover:text-[var(--ink)]">
            Open place page ↗
          </a>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onSpine && (
            <div className="mr-1 flex items-center gap-1">
              <button
                onClick={() => onNavigate(-1)}
                disabled={position === 0}
                aria-label="Previous home"
                title="Previous home"
                className="rounded-lg border border-[var(--glass-border)] px-2 py-1.5 text-sm text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-30"
              >
                ←
              </button>
              <button
                onClick={() => onNavigate(1)}
                disabled={position === total - 1}
                aria-label="Next home"
                title="Next home"
                className="rounded-lg border border-[var(--glass-border)] px-2 py-1.5 text-sm text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-30"
              >
                →
              </button>
            </div>
          )}
          <button
            onClick={onRefine}
            title="Drag the pin to a new spot on the globe"
            className={
              'rounded-lg border px-3 py-1.5 text-sm ' +
              (refining
                ? 'border-[var(--ember-soft)] text-[var(--ember-soft)]'
                : 'border-[var(--glass-border)] text-[var(--ink-dim)] hover:text-[var(--ink)]')
            }
          >
            Refine location
          </button>
          <button
            onClick={onEdit}
            className="rounded-lg border border-[var(--glass-border)] px-3 py-1.5 text-sm text-[var(--ink-dim)] hover:text-[var(--ink)]"
          >
            Edit
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-lg leading-none text-[var(--ink-dim)] hover:text-[var(--ink)]"
          >
            ✕
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-rose-400/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          <span>Couldn’t load this pin’s details — your recollection and photo are safe, but the connection failed.</span>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="ml-auto shrink-0 rounded-lg border border-rose-400/40 px-3 py-1 text-xs hover:bg-rose-900/40"
          >
            Retry
          </button>
        </div>
      ) : (
      <div className="mt-3 flex gap-4">
        <div className="shrink-0">
          {image ? (
            // onDoubleClick lives on the wrapper, not the <img>: the hover
            // overlay below covers the full image (inset-0), so a handler on
            // the img alone never fires while hovering — which is exactly
            // when the user double-clicks (QA item 5.6).
            <div
              className="group relative"
              title="Double-click to enlarge"
              onDoubleClick={() => setLightbox(image.url)}
            >
              {imageCount > 1 && (
                <span className="absolute -right-1.5 -top-1.5 z-10 rounded-full bg-[var(--ember)] px-1.5 text-[10px] font-medium leading-4 text-[#241500]">
                  +{imageCount - 1}
                </span>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL; next/image can't optimize it */}
              <img
                src={image.url}
                alt={pin.name}
                className="h-28 w-28 cursor-zoom-in rounded-xl border border-[var(--glass-border)] object-cover"
              />
              <div className="absolute inset-0 hidden items-end justify-center gap-2 rounded-xl bg-black/55 pb-2 group-hover:flex">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={imageBusy}
                  className="rounded px-2 py-0.5 text-xs text-[var(--ink)] hover:text-[var(--ember-soft)] disabled:opacity-50"
                >
                  Replace
                </button>
                <button
                  onClick={handleRemoveImage}
                  disabled={imageBusy}
                  className="rounded px-2 py-0.5 text-xs text-rose-300 hover:text-rose-200 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={imageBusy}
              className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--glass-border)] text-[var(--ink-dim)] hover:border-[var(--ember-soft)] hover:text-[var(--ink)] disabled:opacity-50"
            >
              <span className="text-xl leading-none">+</span>
              <span className="text-xs">{imageBusy ? 'Uploading…' : 'Add a photo'}</span>
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="max-h-28 overflow-y-auto text-sm text-[var(--ink)]/90">
            {loading ? (
              'Loading…'
            ) : body ? (
              <Markdown>{body}</Markdown>
            ) : (
              <span className="text-[var(--ink-dim)]">No recollection yet — Edit to add one.</span>
            )}
          </div>
          {factChips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {factChips.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-[var(--glass-border)] px-2 py-0.5 text-xs text-[var(--ink-dim)]"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
          {/* Secondary collections collapse to a single count-chip row so the
              card stays short over its own pin; tapping a chip discloses just
              that list (single-open), tapping again collapses (2026-06-26).
              The hopper chip is ALWAYS present (Hopper 5a) — jotting a memory
              at the moment a pin surfaces it is the point of the feature. */}
          {(
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--glass-border)] pt-3">
              {([
                linked.length > 0 && { key: 'recollections' as const, label: `${linked.length} recollection${linked.length === 1 ? '' : 's'}` },
                context.length > 0 && { key: 'context' as const, label: `${context.length} context` },
                anchored.length > 0 && { key: 'anchored' as const, label: `${anchored.length} anchored` },
                { key: 'hopper' as const, label: stubCount > 0 ? `✎ ${stubCount} to write` : '✎ jot' },
              ].filter(Boolean) as { key: Exclude<OpenChip, null>; label: string }[]).map((c) => {
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
          )}

          {openChip === 'recollections' && linked.length > 0 && (
            <div className="mt-2">
              <div className="flex items-baseline justify-end">
                <a
                  href={`/memories?entity=${pin.place_entity_id}`}
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
                      {/* Toggle stays a plain-text button (no block markdown
                          nested inside <button>); the expanded recollection
                          renders as markdown below it (QA item 7). */}
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

          {openChip === 'context' && context.length > 0 && (
            <div className="mt-2">
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {context.map((c) => (
                  <li key={c.id}>
                    {/* All context lives on the place's entity page; rows link
                        there rather than deep-linking each note (YAGNI). */}
                    <a
                      href={`/entities/${pin.place_entity_id}`}
                      title={`Open ${pin.name} context`}
                      className="flex w-full items-center gap-1.5 rounded-lg px-1 py-0.5 text-left text-xs leading-relaxed text-[var(--ink)]/80 hover:bg-white/5 hover:text-[var(--ink)]"
                    >
                      {c.visibility === 'private' && <span title="Private — only you can see this">🔒</span>}
                      <span className="truncate">{c.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mounted regardless of which chip is open so the stub count stays
              live on the chip; it renders its UI only while its chip is open. */}
          <PinHopper
            entityId={pin.place_entity_id}
            variant="card"
            open={openChip === 'hopper'}
            onCountChange={setStubCount}
          />

          {openChip === 'anchored' && anchored.length > 0 && (
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
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      )}

      {imageError && <p className="mt-2 text-xs text-rose-300">{imageError}</p>}
      {imageNotice && <p className="mt-2 text-xs text-amber-300/90">{imageNotice}</p>}

      {lightbox && <PhotoLightbox url={lightbox} alt={pin.name} onClose={() => setLightbox(null)} />}
    </div>
  )
}
