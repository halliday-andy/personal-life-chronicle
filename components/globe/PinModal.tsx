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

const GHOST_TEXTS = [
  'What kind of place was it? Who lived there? Why did you move here?',
  'Tell me what you remember — the house, the neighbourhood, the family, what brought you here.',
  'A house, an apartment, a base? Who else lived there? What kind of life did you have here?',
  'Just write what comes to mind — I’ll figure out the structure.',
]

export interface PinDraftData {
  whenText: string
  body: string
  position: number | null   // where in the residence sequence; null = append
}

export default function PinModal({
  placeLabel,
  saving,
  existingPins,
  onSave,
  onCancel,
}: {
  placeLabel: string
  saving: boolean
  existingPins: { name: string }[]   // current residences, in sequence
  onSave: (data: PinDraftData) => void
  onCancel: () => void
}) {
  const [body, setBody] = useState('')
  const [whenText, setWhenText] = useState('')
  // Sequence slot: 0 = before the first pin, i = after existingPins[i-1].
  // Default = after the last pin (the most recent residence).
  const [position, setPosition] = useState<number>(existingPins.length)
  const ghost = useMemo(() => GHOST_TEXTS[Math.floor(Math.random() * GHOST_TEXTS.length)], [])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={saving ? undefined : onCancel}
        aria-hidden
      />
      <div className="glass relative z-10 w-full max-w-lg rounded-2xl p-6 text-[var(--ink)]">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-dim)]">
          A place you lived
        </p>
        <h2 className="nocturne-display mt-1 text-3xl font-medium leading-tight">
          {placeLabel}
        </h2>

        <label className="mt-5 block text-sm text-[var(--ink-dim)]">Your memory of it</label>
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

        {existingPins.length > 0 && (
          <>
            <label className="mt-4 block text-sm text-[var(--ink-dim)]">Where does this fall in your life?</label>
            <select
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              disabled={saving}
              className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ember-soft)]"
            >
              <option value={0}>Before {existingPins[0].name} (earliest)</option>
              {existingPins.map((p, i) => (
                <option key={i} value={i + 1}>
                  After {p.name}
                  {i === existingPins.length - 1 ? ' (most recent)' : ''}
                </option>
              ))}
            </select>
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
            onClick={() => onSave({ whenText, body, position: existingPins.length ? position : null })}
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
