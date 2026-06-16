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

const label = (s: string) => s.replace(/_/g, ' ')

export default function PinDetailCard({
  pin,
  position,
  total,
  onEdit,
  onClose,
}: {
  pin: { relationship_id: string; place_entity_id: string; name: string; when_text: string | null; place_subtype: string | null; type_code: string | null }
  position: number   // 0-based index in the SPINE sequence; -1 for off-spine markers
  total: number      // number of primary residences (spine length)
  onEdit: () => void
  onClose: () => void
}) {
  const [body, setBody] = useState('')
  const [image, setImage] = useState<PinImageInfo | null>(null)
  const [imageCount, setImageCount] = useState(0)
  const [facts, setFacts] = useState<PinFacts | null>(null)
  const [linked, setLinked] = useState<LinkedRecollection[]>([])
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
    fetch(`/api/globe/residence/${pin.relationship_id}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => {
        if (!active) return
        setBody(d.body ?? '')
        setImage(d.image ?? null)
        setImageCount(d.images?.length ?? (d.image ? 1 : 0))
        setFacts(d.facts ?? null)
        setLinked(d.linked ?? [])
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
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
            <div className="group relative">
              {imageCount > 1 && (
                <span className="absolute -right-1.5 -top-1.5 z-10 rounded-full bg-[var(--ember)] px-1.5 text-[10px] font-medium leading-4 text-[#241500]">
                  +{imageCount - 1}
                </span>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL; next/image can't optimize it */}
              <img
                src={image.url}
                alt={pin.name}
                title="Double-click to enlarge"
                onDoubleClick={() => setLightbox(image.url)}
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
          <p className="max-h-28 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]/90">
            {loading ? 'Loading…' : body || <span className="text-[var(--ink-dim)]">No recollection yet — Edit to add one.</span>}
          </p>
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
          {linked.length > 0 && (
            <div className="mt-3 border-t border-[var(--glass-border)] pt-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-dim)]">
                  More recollections here · {linked.length}
                </p>
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
                      <button
                        onClick={() => setExpandedId(expanded ? null : r.id)}
                        className="w-full text-left hover:text-[var(--ink)]"
                        title={expanded ? 'Collapse' : 'Read the full recollection'}
                      >
                        <span className="mr-1.5 text-[var(--ember-soft)]">{expanded ? '▾' : '▸'}</span>
                        {expanded ? (
                          <span className="whitespace-pre-wrap">{r.text}</span>
                        ) : (
                          <>
                            {r.excerpt}
                            {truncated ? '…' : ''}
                          </>
                        )}
                      </button>
                    </li>
                  )
                })}
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
