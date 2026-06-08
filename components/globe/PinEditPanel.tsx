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

import { useEffect, useState } from 'react'

export interface EditablePin {
  relationship_id: string
  name: string
  when_text: string | null
  has_memory: boolean
}

const CONFIRM_MS = 3000

export default function PinEditPanel({
  pin,
  relocated,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  pin: EditablePin
  relocated: boolean
  saving: boolean
  onSave: (fields: { name: string; whenText: string; body: string }) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(pin.name)
  const [whenText, setWhenText] = useState(pin.when_text ?? '')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Load the recollection text for this pin.
  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/globe/residence/${pin.relationship_id}`)
      .then((r) => r.json())
      .then((d) => { if (active) { setBody(d.body ?? ''); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [pin.relationship_id])

  return (
    <aside className="glass absolute right-4 top-4 bottom-4 z-30 flex w-[min(380px,92vw)] flex-col rounded-2xl p-5 text-[var(--ink)]">
      <div className="flex items-start justify-between">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-dim)]">Residence</p>
        <button onClick={onClose} disabled={saving} className="text-lg leading-none text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-50">
          ✕
        </button>
      </div>

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

      <label className="mt-3 block text-xs text-[var(--ink-dim)]">Recollection</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={saving || loading}
        placeholder={loading ? 'Loading…' : 'Add a memory of this place…'}
        className="mt-1 min-h-[8rem] flex-1 resize-none rounded-lg border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm leading-relaxed text-[var(--ink)] placeholder-[var(--ink-dim)]/70 outline-none focus:border-[var(--ember-soft)]"
      />

      {relocated && (
        <p className="mt-2 text-xs text-[var(--ember-soft)]">Pin moved — Save to keep the new location.</p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => onSave({ name, whenText, body })}
          disabled={saving || loading}
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
    </aside>
  )
}
