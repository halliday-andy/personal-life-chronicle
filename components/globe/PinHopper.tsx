'use client'

/**
 * PinHopper — Hopper 5a (the memory-stub notepad).
 *
 * A consumable checklist of to-be-recollected memories, hosted on an entity
 * (a pin's place entity today; a person entity when the Person page lands —
 * the component only knows entityId). Jot at the speed memories surface while
 * placing pins; check off once a stub has been written up as a real
 * recollection. Checking off is manual in 5a — the capture-assistant
 * interview loop that consumes stubs arrives with Hopper 5b (Slice 7).
 *
 * Two variants, one data model:
 *   - 'card'  — compact: quick-add + open stubs, shown inside the detail
 *               card's chip disclosure. Fetches even while closed so the
 *               chip can show a live count (onCountChange).
 *   - 'panel' — full: add, check-off, a collapsible written/consumed list
 *               with reopen, and delete. Lives on the pin edit panel.
 *
 * Styling uses the globe's nocturne CSS vars (this component currently only
 * renders on globe surfaces).
 */

import { useEffect, useRef, useState } from 'react'

export interface HopperStub {
  id: string
  body: string
  status: 'open' | 'consumed'
  created_by: 'owner' | 'assistant'
  created_at: string
  consumed_at: string | null
}

export default function PinHopper({
  entityId,
  variant,
  open = true,
  onCountChange,
}: {
  entityId: string
  variant: 'card' | 'panel'
  /** card variant: data loads regardless; UI renders only while open. */
  open?: boolean
  /** Reports the OPEN stub count whenever it changes (chip label). */
  onCountChange?: (n: number) => void
}) {
  const [stubs, setStubs] = useState<HopperStub[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [showConsumed, setShowConsumed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep the latest callback out of the fetch effect's dependencies so a
  // parent re-render (new inline closure) can't re-trigger the load.
  const onCountRef = useRef(onCountChange)
  onCountRef.current = onCountChange

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setShowConsumed(false)
    fetch(`/api/entity/${entityId}/stubs`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => {
        if (!active) return
        const list = (d.stubs ?? []) as HopperStub[]
        setStubs(list)
        setLoading(false)
        onCountRef.current?.(list.filter((s) => s.status === 'open').length)
      })
      .catch(() => { if (active) { setError('Could not load your jotted memories.'); setLoading(false) } })
    return () => { active = false }
  }, [entityId])

  function report(list: HopperStub[]) {
    setStubs(list)
    onCountRef.current?.(list.filter((s) => s.status === 'open').length)
  }

  async function add() {
    const body = input.trim()
    if (!body || busy) return
    setBusy('add')
    setError(null)
    try {
      const res = await fetch(`/api/entity/${entityId}/stubs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`)
      report([d.stub as HopperStub, ...stubs])
      setInput('')
      inputRef.current?.focus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the jot.')
    } finally {
      setBusy(null)
    }
  }

  async function setStatus(stub: HopperStub, status: 'open' | 'consumed') {
    if (busy) return
    setBusy(stub.id)
    setError(null)
    try {
      const res = await fetch(`/api/entity/${entityId}/stubs?stub=${stub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`)
      report(stubs.map((s) => (s.id === stub.id ? (d.stub as HopperStub) : s)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the jot.')
    } finally {
      setBusy(null)
    }
  }

  async function remove(stub: HopperStub) {
    if (busy) return
    setBusy(stub.id)
    setError(null)
    try {
      const res = await fetch(`/api/entity/${entityId}/stubs?stub=${stub.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      report(stubs.filter((s) => s.id !== stub.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the jot.')
    } finally {
      setBusy(null)
    }
  }

  // Card variant fetches while closed (for the chip count) but renders nothing.
  if (variant === 'card' && !open) return null

  const openStubs = stubs.filter((s) => s.status === 'open')
  const consumedStubs = stubs.filter((s) => s.status === 'consumed')

  const addRow = (
    <div className="flex gap-1.5">
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        placeholder="Jot a memory to come back to…"
        disabled={busy === 'add'}
        className="min-w-0 flex-1 rounded-lg border border-[var(--glass-border)] bg-black/20 px-2.5 py-1.5 text-xs text-[var(--ink)] placeholder-[var(--ink-dim)] outline-none focus:border-[var(--ember-soft)] disabled:opacity-50"
      />
      <button
        onClick={add}
        disabled={!input.trim() || busy !== null}
        className="shrink-0 rounded-lg border border-[var(--glass-border)] px-2.5 py-1.5 text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-40"
        title="Add to the hopper (Enter)"
      >
        Jot
      </button>
    </div>
  )

  const openList = openStubs.length > 0 && (
    <ul className={`space-y-1 overflow-y-auto ${variant === 'card' ? 'max-h-32' : 'max-h-48'}`}>
      {openStubs.map((s) => (
        <li key={s.id} className="group flex items-start gap-2 rounded-lg px-1 py-0.5 text-xs leading-relaxed text-[var(--ink)]/85 hover:bg-white/5">
          <input
            type="checkbox"
            checked={false}
            onChange={() => setStatus(s, 'consumed')}
            disabled={busy !== null}
            title="Mark written — this memory has become a recollection"
            className="mt-0.5 shrink-0 accent-[var(--ember)]"
          />
          <span className="min-w-0 flex-1 break-words">{s.body}</span>
          <button
            onClick={() => remove(s)}
            disabled={busy !== null}
            aria-label="Remove this jot"
            className="shrink-0 text-[var(--ink-dim)] opacity-0 transition group-hover:opacity-100 hover:text-rose-300 disabled:opacity-30"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )

  const body = (
    <div className="space-y-2">
      {addRow}
      {loading && <p className="text-xs text-[var(--ink-dim)]">Fetching your jotted memories…</p>}
      {!loading && openStubs.length === 0 && (
        <p className="text-xs italic text-[var(--ink-dim)]">
          Nothing waiting — jot the memories this place brings to mind, and write them up when there&apos;s time.
        </p>
      )}
      {openList}
      {variant === 'panel' && consumedStubs.length > 0 && (
        <div>
          <button
            onClick={() => setShowConsumed((v) => !v)}
            aria-expanded={showConsumed}
            className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)]"
          >
            {showConsumed ? '▾' : '▸'} {consumedStubs.length} written
          </button>
          {showConsumed && (
            <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto">
              {consumedStubs.map((s) => (
                <li key={s.id} className="group flex items-start gap-2 rounded-lg px-1 py-0.5 text-xs leading-relaxed text-[var(--ink-dim)] hover:bg-white/5">
                  <span className="mt-0.5 shrink-0 text-[var(--ember-soft)]">✓</span>
                  <span className="min-w-0 flex-1 break-words line-through decoration-[var(--ink-dim)]/50">{s.body}</span>
                  <button
                    onClick={() => setStatus(s, 'open')}
                    disabled={busy !== null}
                    title="Reopen — still to write"
                    className="shrink-0 opacity-0 transition group-hover:opacity-100 hover:text-[var(--ink)] disabled:opacity-30"
                  >
                    ↩
                  </button>
                  <button
                    onClick={() => remove(s)}
                    disabled={busy !== null}
                    aria-label="Remove this jot"
                    className="shrink-0 opacity-0 transition group-hover:opacity-100 hover:text-rose-300 disabled:opacity-30"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  )

  if (variant === 'card') return <div className="mt-2">{body}</div>

  return (
    <div className="mt-4 rounded-lg border border-[var(--glass-border)] bg-black/10 p-3">
      <p className="mb-2 text-xs text-[var(--ink-dim)]">
        Memories to write
        <span className="text-[var(--ink-dim)]/60"> — jot now, recollect later</span>
      </p>
      {body}
    </div>
  )
}
