'use client'

/**
 * Pin modal — per-pin capture (Step 7 Slice 1).
 *
 * Opens when the user confirms a draft pin's location. Modal-first:
 * the sidekick stays quiet until engaged (a later slice). Captures a
 * verbatim free-form narrative + an optional free-text "when" (stored
 * unparsed; structured dates are Slice 2). Both fields are optional —
 * the user can save just the pin.
 */

import { useMemo, useState } from 'react'
import { PIN_TYPES, pinTypeMeta, SPINE_CODE } from '@/lib/globe/pin-types'

const GHOST_TEXTS = [
  'What kind of place was it? Who lived there? Why did you move here?',
  'Tell me what you remember — the house, the neighbourhood, the family, what brought you here.',
  'A house, an apartment, a base? Who else lived there? What kind of life did you have here?',
  'Just write what comes to mind — I’ll figure out the structure.',
]

export interface PinDraftData {
  whenText: string
  body: string
  position: number | null   // spine sequence slot; null = append / N/A for markers
  typeCode: string
  anchorId: string | null   // marker → a primary residence (null = standalone)
}

export default function PinModal({
  placeLabel,
  saving,
  primaries,
  onSave,
  onCancel,
}: {
  placeLabel: string
  saving: boolean
  primaries: { relationship_id: string; name: string }[]  // primary residences, in sequence
  onSave: (data: PinDraftData) => void
  onCancel: () => void
}) {
  const [body, setBody] = useState('')
  const [whenText, setWhenText] = useState('')
  const [typeCode, setTypeCode] = useState<string>(SPINE_CODE)
  // Sequence slot (spine only): 0 = before the first, i = after primaries[i-1].
  const [position, setPosition] = useState<number>(primaries.length)
  // Anchor (markers only): a primary residence relationship_id, or '' = standalone.
  const [anchorId, setAnchorId] = useState<string>(primaries[0]?.relationship_id ?? '')
  const ghost = useMemo(() => GHOST_TEXTS[Math.floor(Math.random() * GHOST_TEXTS.length)], [])

  const isSpine = typeCode === SPINE_CODE
  const meta = pinTypeMeta(typeCode)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={saving ? undefined : onCancel}
        aria-hidden
      />
      <div className="glass relative z-10 w-full max-w-lg rounded-2xl p-6 text-[var(--ink)]">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-dim)]">
          A place in your life
        </p>
        <h2 className="nocturne-display mt-1 text-3xl font-medium leading-tight">
          {placeLabel}
        </h2>

        <label className="mt-5 block text-sm text-[var(--ink-dim)]">What kind of place?</label>
        <select
          value={typeCode}
          onChange={(e) => setTypeCode(e.target.value)}
          disabled={saving}
          className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ember-soft)]"
        >
          {PIN_TYPES.map((t) => (
            <option key={t.code} value={t.code}>{t.label}</option>
          ))}
        </select>
        <p className="mt-1 text-xs leading-relaxed text-[var(--ink-dim)]/80">{meta.description}</p>

        <label className="mt-4 block text-sm text-[var(--ink-dim)]">Your memory of it</label>
        <textarea
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={ghost}
          rows={5}
          disabled={saving}
          className="mt-1 w-full resize-none rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm leading-relaxed text-[var(--ink)] placeholder-[var(--ink-dim)]/70 outline-none focus:border-[var(--ember-soft)]"
        />

        <label className="mt-4 block text-sm text-[var(--ink-dim)]">When? (optional)</label>
        <input
          type="text"
          value={whenText}
          onChange={(e) => setWhenText(e.target.value)}
          placeholder="e.g. 1962–1968, early 70s, “right after college”"
          disabled={saving}
          className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] placeholder-[var(--ink-dim)]/70 outline-none focus:border-[var(--ember-soft)]"
        />

        {/* Contextual placement: spine → sequence slot; markers → anchor. */}
        {isSpine && primaries.length > 0 && (
          <>
            <label className="mt-4 block text-sm text-[var(--ink-dim)]">Where does this fall in your life?</label>
            <select
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              disabled={saving}
              className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ember-soft)]"
            >
              <option value={0}>Before {primaries[0].name} (earliest)</option>
              {primaries.map((p, i) => (
                <option key={p.relationship_id} value={i + 1}>
                  After {p.name}
                  {i === primaries.length - 1 ? ' (most recent)' : ''}
                </option>
              ))}
            </select>
          </>
        )}

        {!isSpine && primaries.length > 0 && (
          <>
            <label className="mt-4 block text-sm text-[var(--ink-dim)]">{meta.anchorPrompt}</label>
            <select
              value={anchorId}
              onChange={(e) => setAnchorId(e.target.value)}
              disabled={saving}
              className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ember-soft)]"
            >
              {primaries.map((p) => (
                <option key={p.relationship_id} value={p.relationship_id}>{p.name}</option>
              ))}
              <option value="">Not sure / standalone</option>
            </select>
            <p className="mt-1 text-xs text-[var(--ink-dim)]/80">
              Connects this with a dashed line to that home.
            </p>
          </>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({
              whenText,
              body,
              position: isSpine && primaries.length ? position : null,
              typeCode,
              anchorId: isSpine ? null : (anchorId || null),
            })}
            disabled={saving}
            className="rounded-lg bg-[var(--ember)] px-5 py-2 text-sm font-medium text-[#241500] shadow-[0_0_20px_rgba(244,177,74,0.45)] hover:bg-[var(--ember-soft)] disabled:opacity-60"
          >
            {saving ? 'Placing…' : 'Add this place'}
          </button>
        </div>
      </div>
    </div>
  )
}
