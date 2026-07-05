'use client'

/**
 * PinEditPanel — right-side glass panel for editing a selected residence
 * pin (Step 7 Slice 4a). Loads the recollection text, edits name / when /
 * recollection, and exposes Save and a permanence-aware Delete.
 *
 * Relocation happens on the globe (the selected pin is draggable in
 * GlobeView); this panel just shows a "moved" hint and includes the
 * staged coordinates in the save via the parent's onSave.
 */

import { useEffect, useRef, useState } from 'react'
import { preprocessPinImage } from '@/lib/globe/image-preprocess'
import { PIN_TYPES, pinTypeMeta, SPINE_CODE } from '@/lib/globe/pin-types'
import { spineSlotOptions } from '@/lib/globe/reorder'
import PhotoLightbox from './PhotoLightbox'
import PinHopper from './PinHopper'
import Markdown from '../Markdown'

export interface EditablePin {
  relationship_id: string
  place_entity_id: string
  name: string
  when_text: string | null
  has_memory: boolean
  type_code: string | null
  anchor_residence_id: string | null
  prior_anchor_residence_id: string | null
  description: string | null
}

interface GalleryImage {
  media_id: string
  url: string
  filename: string | null
  is_primary: boolean
}

const CONFIRM_MS = 3000

// Resizable-panel bounds (QA item 5). Min keeps the form usable; max is a
// fraction of the viewport so the globe never fully disappears.
const DEFAULT_PANEL_WIDTH = 380
const MIN_PANEL_WIDTH = 320
const PANEL_WIDTH_KEY = 'lc-pin-panel-width'
function clampPanelWidth(px: number): number {
  const max = Math.round(window.innerWidth * 0.85)
  return Math.max(MIN_PANEL_WIDTH, Math.min(px, max))
}

export default function PinEditPanel({
  pin,
  relocated,
  saving,
  position,
  total,
  primaries,
  allPins,
  onMove,
  onMoveTo,
  onSave,
  onDelete,
  onClose,
}: {
  pin: EditablePin
  relocated: boolean
  saving: boolean
  position: number   // 0-based index in the SPINE; -1 for off-spine markers
  total: number      // number of primary residences
  primaries: { relationship_id: string; name: string }[]
  allPins: { relationship_id: string; name: string; type_code: string | null }[]  // every globe pin (Log anchors to any)
  onMove: (dir: -1 | 1) => void
  onMoveTo: (toIndex: number) => void
  onSave: (fields: { name: string; whenText: string; body: string; typeCode: string; anchorId: string | null; description: string }) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(pin.name)
  const [whenText, setWhenText] = useState(pin.when_text ?? '')
  const [placard, setPlacard] = useState(pin.description ?? '')
  const [body, setBody] = useState('')
  // The recollection shows RENDERED markdown by default (so formatting isn't
  // "lost" behind raw ** / # syntax); "Edit text" reveals the raw editor.
  const [bodyEditing, setBodyEditing] = useState(false)
  const [typeCode, setTypeCode] = useState(pin.type_code ?? SPINE_CODE)
  const [anchorId, setAnchorId] = useState(pin.anchor_residence_id ?? '')

  // When a primary is re-typed to a marker, default the anchor picker to a
  // sensible primary rather than "standalone" (Phase-5 finding 2): prefer the
  // anchor this pin carried before it joined the spine (prior_anchor_residence_id),
  // else the primary immediately before it in the spine, else any other primary.
  function defaultAnchorFor(): string {
    const others = primaries.filter((p) => p.relationship_id !== pin.relationship_id)
    if (others.length === 0) return ''
    const prior = pin.prior_anchor_residence_id
    if (prior && others.some((p) => p.relationship_id === prior)) return prior
    const selfIdx = primaries.findIndex((p) => p.relationship_id === pin.relationship_id)
    if (selfIdx > 0) return primaries[selfIdx - 1].relationship_id
    return others[0].relationship_id
  }
  function handleTypeChange(next: string) {
    // Only auto-fill on the spine→marker transition, so an explicit
    // "standalone" choice on a marker→marker switch is never clobbered.
    if (typeCode === SPINE_CODE && next !== SPINE_CODE && !anchorId) {
      setAnchorId(defaultAnchorFor())
    }
    setTypeCode(next)
  }
  // A Log anchors to ANY place; other markers anchor to a primary residence.
  const anchorOptions = typeCode === 'logged_at'
    ? allPins
    : primaries.map((p) => ({ ...p, type_code: 'lived_at' as string | null }))
  const [loading, setLoading] = useState(true)
  // If the recollection fails to load, Save MUST stay disabled: saving the
  // panel's empty textarea would overwrite the real recollection (PATCH
  // sends the full field set). Near-miss on 2026-06-10 when a dead dev
  // server made a rich pin render as empty.
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [images, setImages] = useState<GalleryImage[]>([])
  const [linkedCount, setLinkedCount] = useState(0)
  const [galleryBusy, setGalleryBusy] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)
  const [galleryNotice, setGalleryNotice] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // User-resizable width (QA item 5): drag the left edge to trade globe
  // visibility for photo size. Persisted so the choice is sticky.
  const [panelWidth, setPanelWidth] = useState<number>(DEFAULT_PANEL_WIDTH)
  const resizingRef = useRef(false)
  useEffect(() => {
    const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY))
    if (saved) setPanelWidth(clampPanelWidth(saved))
  }, [])
  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!resizingRef.current) return
      // Panel is anchored 16px (right-4) from the right edge; width grows
      // leftward as the pointer moves toward the globe.
      setPanelWidth(clampPanelWidth(window.innerWidth - 16 - e.clientX))
    }
    function onUp() {
      if (!resizingRef.current) return
      resizingRef.current = false
      document.body.style.userSelect = ''
      setPanelWidth((w) => { localStorage.setItem(PANEL_WIDTH_KEY, String(w)); return w })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  // Load the recollection text + photo gallery for this pin.
  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(false)
    fetch(`/api/globe/residence/${pin.relationship_id}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { if (active) { setBody(d.body ?? ''); setImages(d.images ?? []); setLinkedCount(d.linked?.length ?? 0); setLoading(false) } })
      .catch(() => { if (active) { setLoadError(true); setLoading(false) } })
    return () => { active = false }
  }, [pin.relationship_id, reloadKey])

  // Gallery actions are immediate (not staged with Save): every verb
  // returns the full refreshed gallery, primary first.
  async function galleryCall(run: () => Promise<Response>) {
    setGalleryBusy(true)
    setGalleryError(null)
    setGalleryNotice(null)
    try {
      const res = await run()
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`)
      setImages(d.images ?? [])
    } catch (e) {
      setGalleryError(e instanceof Error ? e.message : 'Photo action failed.')
    } finally {
      setGalleryBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleAddPhoto(file: File) {
    setGalleryNotice(null)
    let warning: string | null = null
    await galleryCall(async () => {
      // Best-effort: HEIC conversion/compression never blocks the upload;
      // a failure falls back to the original file + a soft warning.
      const prepared = await preprocessPinImage(file)
      warning = prepared.warning
      const form = new FormData()
      form.append('file', prepared.file)
      return fetch(`/api/globe/residence/${pin.relationship_id}/image`, { method: 'POST', body: form })
    })
    if (warning) setGalleryNotice(warning)
  }

  return (
    <aside
      className="glass absolute right-4 top-4 bottom-4 z-30 flex max-w-[92vw] flex-col rounded-2xl p-5 text-[var(--ink)]"
      style={{ width: panelWidth }}
    >
      {/* Drag the left edge to widen the panel (bigger photos) or narrow it
          (more globe). QA item 5 — user-selectable, sticky width. */}
      <div
        onPointerDown={(e) => {
          e.preventDefault()
          resizingRef.current = true
          document.body.style.userSelect = 'none'
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        }}
        onDoubleClick={() => { setPanelWidth(DEFAULT_PANEL_WIDTH); localStorage.setItem(PANEL_WIDTH_KEY, String(DEFAULT_PANEL_WIDTH)) }}
        title="Drag to resize · double-click to reset"
        className="absolute -left-1 top-0 bottom-0 z-10 w-2 cursor-ew-resize rounded-l-2xl hover:bg-[var(--ember-soft)]/30"
      />
      <div className="flex items-start justify-between">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-[var(--ink-dim)]">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: pinTypeMeta(typeCode).color }} />
          {pinTypeMeta(typeCode).label}
          {position >= 0 && total > 1 ? ` · stop ${position + 1} of ${total}` : ''}
        </p>
        <button onClick={onClose} disabled={saving} className="text-lg leading-none text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-50">
          ✕
        </button>
      </div>

      {/* Reorder applies only to the residential spine. The selector is the
          authoritative control (jump to any slot in one write); Earlier/Later
          are quick adjacent nudges. */}
      {position >= 0 && total > 1 && (
        <div className="mt-3">
          <label className="block text-xs text-[var(--ink-dim)]">Where does this fall in your life?</label>
          <select
            value={position}
            onChange={(e) => onMoveTo(Number(e.target.value))}
            disabled={saving}
            className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ember-soft)]"
          >
            {spineSlotOptions(primaries.map((p) => p.name), position).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-[var(--ink-dim)]">Nudge</span>
            <button
              onClick={() => onMove(-1)}
              disabled={saving || position === 0}
              title="Move earlier"
              className="rounded-lg border border-[var(--glass-border)] px-2.5 py-1 text-sm text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-30"
            >
              ↑ Earlier
            </button>
            <button
              onClick={() => onMove(1)}
              disabled={saving || position === total - 1}
              title="Move later"
              className="rounded-lg border border-[var(--glass-border)] px-2.5 py-1 text-sm text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-30"
            >
              ↓ Later
            </button>
          </div>
        </div>
      )}

      <label className="mt-3 block text-xs text-[var(--ink-dim)]">Place name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={saving}
        className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ember-soft)]"
      />

      <label className="mt-3 block text-xs text-[var(--ink-dim)]">When</label>
      <input
        value={whenText}
        onChange={(e) => setWhenText(e.target.value)}
        disabled={saving}
        placeholder="e.g. 1959 to 1960"
        className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] placeholder-[var(--ink-dim)]/70 outline-none focus:border-[var(--ember-soft)]"
      />

      <label className="mt-3 block text-xs text-[var(--ink-dim)]">Placard <span className="text-[var(--ink-dim)]/60">— a one-line description, shown on hover</span></label>
      <input
        value={placard}
        onChange={(e) => setPlacard(e.target.value)}
        disabled={saving}
        maxLength={120}
        placeholder="e.g. The college town where it all began"
        className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] placeholder-[var(--ink-dim)]/70 outline-none focus:border-[var(--ember-soft)]"
      />

      <label className="mt-3 block text-xs text-[var(--ink-dim)]">Type of place</label>
      <select
        value={typeCode}
        onChange={(e) => handleTypeChange(e.target.value)}
        disabled={saving}
        className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ember-soft)]"
      >
        {PIN_TYPES.map((t) => (
          <option key={t.code} value={t.code}>{t.label}</option>
        ))}
      </select>
      <p className="mt-1 text-xs leading-relaxed text-[var(--ink-dim)]/80">{pinTypeMeta(typeCode).description}</p>

      {typeCode !== SPINE_CODE && anchorOptions.length > 0 && (
        <>
          <label className="mt-3 block text-xs text-[var(--ink-dim)]">{pinTypeMeta(typeCode).anchorPrompt}</label>
          <select
            value={anchorId}
            onChange={(e) => setAnchorId(e.target.value)}
            disabled={saving}
            className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ember-soft)]"
          >
            {anchorOptions
              .filter((p) => p.relationship_id !== pin.relationship_id)
              .map((p) => (
                <option key={p.relationship_id} value={p.relationship_id}>
                  {p.name}{p.type_code && p.type_code !== 'lived_at' ? ` · ${pinTypeMeta(p.type_code).label}` : ''}
                </option>
              ))}
            <option value="">Not sure / standalone</option>
          </select>
        </>
      )}

      <div className="mt-3 flex items-center justify-between">
        <label className="block text-xs text-[var(--ink-dim)]">Recollection</label>
        {!loading && !loadError && body.trim() && (
          <button
            type="button"
            onClick={() => setBodyEditing((v) => !v)}
            className="text-xs text-[var(--ember-soft)] hover:text-[var(--ember)]"
          >
            {bodyEditing ? 'Done editing' : 'Edit text'}
          </button>
        )}
      </div>
      {!loading && !loadError && body.trim() && !bodyEditing ? (
        // Rendered view — markdown formatting preserved, not raw syntax.
        <div className="mt-1 max-h-60 flex-1 overflow-y-auto rounded-lg border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm leading-relaxed text-[var(--ink)]">
          <Markdown>{body}</Markdown>
        </div>
      ) : (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={saving || loading || loadError}
          placeholder={loading ? 'Loading…' : 'Add a memory of this place…'}
          className="mt-1 min-h-[8rem] flex-1 resize-none rounded-lg border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm leading-relaxed text-[var(--ink)] placeholder-[var(--ink-dim)]/70 outline-none focus:border-[var(--ember-soft)]"
        />
      )}

      {loadError && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
          <span>Couldn’t load the recollection — editing is locked so nothing gets overwritten.</span>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="ml-auto shrink-0 rounded border border-rose-400/40 px-2 py-0.5 hover:bg-rose-900/40"
          >
            Retry
          </button>
        </div>
      )}

      {/* Photo gallery — many per pin, one primary (the globe photo).
          Actions apply immediately, independent of Save. */}
      {!loadError && (
        <div className="mt-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAddPhoto(f) }}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--ink-dim)]">
              Photos{images.length > 0 ? ` · ${images.length}` : ''}
            </span>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={saving || loading || galleryBusy}
              className="rounded-lg border border-[var(--glass-border)] px-2.5 py-1 text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-40"
            >
              {galleryBusy ? 'Working…' : '+ Add photo'}
            </button>
          </div>
          {images.length > 0 && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {images.map((img) => (
                <div key={img.media_id} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL */}
                  <img
                    src={img.url}
                    alt={img.filename ?? 'Pin photo'}
                    title="Double-click to enlarge"
                    onDoubleClick={() => setLightbox(img.url)}
                    className={`aspect-square w-full cursor-zoom-in rounded-lg object-cover ${
                      img.is_primary
                        ? 'ring-2 ring-[var(--ember)]'
                        : 'border border-[var(--glass-border)] opacity-80'
                    }`}
                  />
                  {img.is_primary && (
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] leading-4 text-[var(--ember-soft)]">
                      ★ pin photo
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 hidden justify-center gap-2 rounded-b-lg bg-black/65 py-0.5 group-hover:flex">
                    {!img.is_primary && (
                      <button
                        onClick={() =>
                          galleryCall(() =>
                            fetch(`/api/globe/residence/${pin.relationship_id}/image`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ media_id: img.media_id }),
                            }),
                          )
                        }
                        disabled={galleryBusy}
                        title="Make this the pin photo"
                        className="text-[10px] text-[var(--ink)] hover:text-[var(--ember-soft)] disabled:opacity-50"
                      >
                        ★ primary
                      </button>
                    )}
                    <button
                      onClick={() =>
                        galleryCall(() =>
                          fetch(
                            `/api/globe/residence/${pin.relationship_id}/image?media_id=${encodeURIComponent(img.media_id)}`,
                            { method: 'DELETE' },
                          ),
                        )
                      }
                      disabled={galleryBusy}
                      title="Remove this photo"
                      className="text-[10px] text-rose-300 hover:text-rose-200 disabled:opacity-50"
                    >
                      ✕ remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {galleryError && <p className="mt-1 text-xs text-rose-300">{galleryError}</p>}
          {galleryNotice && <p className="mt-1 text-xs text-amber-300/90">{galleryNotice}</p>}
        </div>
      )}

      {/* The hopper (Hopper 5a) — jotted memories still to be written up as
          recollections. Full variant: add, check off, reopen, delete. */}
      <PinHopper entityId={pin.place_entity_id} variant="panel" />

      {/* Other memories that mention this place — edited in the
          Recollections surface, not here (this panel owns only the
          pin's overview text). */}
      {!loadError && linkedCount > 0 && (
        <a
          href={`/memories?entity=${pin.place_entity_id}`}
          className="mt-2 block text-xs text-[var(--ember-soft)] hover:text-[var(--ember)]"
        >
          ◆ {linkedCount} more recollection{linkedCount === 1 ? '' : 's'} mention
          {linkedCount === 1 ? 's' : ''} this place — view in Recollections →
        </a>
      )}

      {relocated && (
        <p className="mt-2 text-xs text-[var(--ember-soft)]">Pin moved — Save to keep the new location.</p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => onSave({
            name, whenText, body,
            typeCode,
            anchorId: typeCode === SPINE_CODE ? null : (anchorId || null),
            description: placard,
          })}
          disabled={saving || loading || loadError}
          className="rounded-lg bg-[var(--ember)] px-4 py-2 text-sm font-medium text-[#241500] hover:bg-[var(--ember-soft)] disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={() => {
            if (!confirmDelete) {
              setConfirmDelete(true)
              setTimeout(() => setConfirmDelete(false), CONFIRM_MS)
            } else {
              onDelete()
            }
          }}
          disabled={saving}
          className={`ml-auto rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
            confirmDelete
              ? 'bg-rose-600 text-white hover:bg-rose-700'
              : 'border border-[var(--glass-border)] text-[var(--ink-dim)] hover:text-[var(--ink)]'
          }`}
        >
          {confirmDelete ? 'Delete permanently — can’t be undone' : 'Delete'}
        </button>
      </div>

      {lightbox && <PhotoLightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </aside>
  )
}
