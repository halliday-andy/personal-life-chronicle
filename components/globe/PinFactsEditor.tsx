'use client'

/**
 * PinFactsEditor — the owner's hand on the four extracted pin facts.
 *
 * Design: docs/plans/2026-07-10-pin-facts-editor-enhancement.md. Until now the
 * facts Claude extracted from a recollection rendered as chips on the Journey
 * and drove its transition phrases, but were editable NOWHERE — a misspelling
 * or a wrong move_reason could only be repaired by asking Claude to re-run the
 * extraction, a roll the owner can't steer.
 *
 * Two rules shape the UI:
 *  - Saves are immediate and per-field (like the gallery, unlike the staged
 *    Save button). The endpoint reads "field present = the owner set this", so
 *    sending one field at a time is what makes an untouched fact stay
 *    extraction's to fill.
 *  - An edited field is STICKY and says so. Re-extraction will never overwrite
 *    it again, and the owner should be able to see which facts are now theirs.
 */

import { useEffect, useRef, useState } from 'react'
import { MOVE_REASONS, RESIDENCE_TYPES, factOptionLabel } from '@/lib/globe/fact-vocabulary'

export interface PinFactsValue {
  residence_type: string | null
  residence_detail: string | null
  household_composition: string | null
  move_reason: string | null
}

/** How long to let the async re-extraction run before re-reading the facts. */
const REFRESH_SETTLE_MS = 3500

export default function PinFactsEditor({
  relationshipId,
  facts,
  ownerEdited,
  hasRecollection,
  onChange,
}: {
  relationshipId: string
  facts: PinFactsValue
  ownerEdited: string[]
  hasRecollection: boolean
  onChange: (facts: PinFactsValue, ownerEdited: string[]) => void
}) {
  // Text fields are drafted locally and committed on blur, so typing isn't a
  // save per keystroke. Selects commit on change.
  const [detail, setDetail] = useState(facts.residence_detail ?? '')
  const [household, setHousehold] = useState(facts.household_composition ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Re-sync the drafts when the facts change underneath us (a refresh landing,
  // or the panel switching to another pin).
  useEffect(() => {
    setDetail(facts.residence_detail ?? '')
    setHousehold(facts.household_composition ?? '')
  }, [facts.residence_detail, facts.household_composition])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const isOwned = (field: string) => ownerEdited.includes(field)

  async function save(field: keyof PinFactsValue, value: string | null) {
    // Nothing changed → no write, so a blur can't mark a field sticky by
    // accident. This is the difference between "I looked at it" and "I set it".
    if ((facts[field] ?? null) === (value ?? null)) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/globe/residence/${relationshipId}/facts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`)
      onChange(d.facts as PinFactsValue, (d.factsOwnerEdited ?? []) as string[])
      setNotice('Saved — this is yours now, re-reading won’t change it.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that fact.')
      // Put the drafts back to the last known-good values.
      setDetail(facts.residence_detail ?? '')
      setHousehold(facts.household_composition ?? '')
    } finally {
      setBusy(false)
    }
  }

  async function refresh() {
    setRefreshing(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/globe/residence/${relationshipId}/facts`, { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`)
      setNotice('Re-reading your recollection…')
      // Extraction runs asynchronously, so there is nothing to await. Give it a
      // moment, then re-read; if it hasn't landed the owner can ask again.
      timerRef.current = setTimeout(async () => {
        try {
          const r = await fetch(`/api/globe/residence/${relationshipId}`)
          const fresh = await r.json()
          if (r.ok) {
            onChange(fresh.facts as PinFactsValue, (fresh.factsOwnerEdited ?? []) as string[])
            setNotice('Facts re-read from your recollection. Anything you edited was left alone.')
          }
        } catch { setNotice('Still working — reopen this pin in a moment to see the result.') }
        finally { setRefreshing(false) }
      }, REFRESH_SETTLE_MS)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not refresh the facts.')
      setRefreshing(false)
    }
  }

  const labelCls = 'block text-xs text-[var(--ink-dim)]'
  const fieldCls =
    'mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-black/20 px-2 py-1.5 text-sm text-[var(--ink)] placeholder-[var(--ink-dim)]/70 outline-none focus:border-[var(--ember-soft)] disabled:opacity-60'

  /** The "yours now" marker — why a field will survive the next re-reading. */
  const OwnedMark = ({ field }: { field: string }) =>
    isOwned(field) ? (
      <span
        className="ml-1.5 text-[var(--ember-soft)]"
        title="You set this. Re-reading the recollection won’t overwrite it."
      >
        ● yours
      </span>
    ) : null

  return (
    <div className="mt-4 border-t border-[var(--glass-border)] pt-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--ink)]">
          Facts
          <span className="ml-2 font-normal text-[var(--ink-dim)]/70">— read from your recollection, yours to correct</span>
        </span>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing || busy || !hasRecollection}
          title={
            hasRecollection
              ? 'Read the recollection again and refill the facts you haven’t set yourself'
              : 'Add a recollection first — there’s nothing to read yet'
          }
          className="shrink-0 text-xs text-[var(--ember-soft)] hover:text-[var(--ember)] disabled:opacity-50"
        >
          {refreshing ? 'Re-reading…' : '↻ Refresh from recollection'}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Kind of place<OwnedMark field="residence_type" /></label>
          <select
            value={facts.residence_type ?? ''}
            disabled={busy || refreshing}
            onChange={(e) => save('residence_type', e.target.value || null)}
            className={fieldCls}
          >
            <option value="">— not set —</option>
            {RESIDENCE_TYPES.map((c) => (
              <option key={c} value={c}>{factOptionLabel(c)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Why you moved<OwnedMark field="move_reason" /></label>
          <select
            value={facts.move_reason ?? ''}
            disabled={busy || refreshing}
            onChange={(e) => save('move_reason', e.target.value || null)}
            className={fieldCls}
          >
            <option value="">— not set —</option>
            {MOVE_REASONS.map((c) => (
              <option key={c} value={c}>{factOptionLabel(c)}</option>
            ))}
          </select>
        </div>
      </div>

      <label className={`mt-2 ${labelCls}`}>The place itself<OwnedMark field="residence_detail" /></label>
      <input
        value={detail}
        disabled={busy || refreshing}
        onChange={(e) => setDetail(e.target.value)}
        onBlur={() => save('residence_detail', detail.trim() || null)}
        placeholder="a small third-floor walk-up"
        className={fieldCls}
      />

      <label className={`mt-2 ${labelCls}`}>Who lived there with you<OwnedMark field="household_composition" /></label>
      <input
        value={household}
        disabled={busy || refreshing}
        onChange={(e) => setHousehold(e.target.value)}
        onBlur={() => save('household_composition', household.trim() || null)}
        placeholder="my parents and my brother Doug"
        className={fieldCls}
      />

      {error && <p className="mt-1.5 text-xs text-rose-300">{error}</p>}
      {!error && notice && <p className="mt-1.5 text-xs text-[var(--ink-dim)]">{notice}</p>}
    </div>
  )
}
