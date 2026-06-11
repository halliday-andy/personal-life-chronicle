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
}

const label = (s: string) => s.replace(/_/g, ' ')

export default function PinDetailCard({
  pin,
  position,
  total,
  onEdit,
  onClose,
}: {
  pin: { relationship_id: string; name: string; when_text: string | null; place_subtype: string | null }
  position: number   // 0-based index in the residence sequence
  total: number
  onEdit: () => void
  onClose: () => void
}) {
  const [body, setBody] = useState('')
  const [image, setImage] = useState<PinImageInfo | null>(null)
  const [facts, setFacts] = useState<PinFacts | null>(null)
  const [loading, setLoading] = useState(true)
  // A failed load must look like a failure, never like an empty pin —
  // otherwise a dead server reads as "no recollection yet" (data-loss scare,
  // 2026-06-10) and invites edits that could overwrite real content.
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
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
        setFacts(d.facts ?? null)
        setLoading(false)
      })
      .catch(() => { if (active) { setLoadError(true); setLoading(false) } })
    return () => { active = false }
  }, [pin.relationship_id, reloadKey])

  const handleFile = useCallback(async (file: File) => {
    setImageBusy(true)
    setImageError(null)
    try {
      // HEIC→JPEG + compression toward ~2MB happens client-side so every
      // browser can render what lands in storage.
      const prepared = await preprocessPinImage(file)
      const form = new FormData()
      form.append('file', prepared)
      const res = await fetch(`/api/globe/residence/${pin.relationship_id}/image`, {
        method: 'POST',
        body: form,
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`)
      setImage(d.image ?? null)
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
      const res = await fetch(`/api/globe/residence/${pin.relationship_id}/image`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setImage(null)
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
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-dim)]">
            Residence{total > 1 ? ` · stop ${position + 1} of ${total}` : ''}
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
              {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL; next/image can't optimize it */}
              <img
                src={image.url}
                alt={pin.name}
                className="h-28 w-28 rounded-xl border border-[var(--glass-border)] object-cover"
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
        </div>
      </div>
      )}

      {imageError && <p className="mt-2 text-xs text-rose-300">{imageError}</p>}
    </div>
  )
}
