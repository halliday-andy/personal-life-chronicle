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
 * Two themes, same markup (Slice 7.1): 'nocturne' (globe CSS vars — the
 * original) and 'light' (stone palette matching the Entity View, which hosts
 * the hopper on person pages).
 */

import { useEffect, useRef, useState } from 'react'

const THEMES = {
  nocturne: {
    input: 'border-[var(--glass-border)] bg-black/20 text-[var(--ink)] placeholder-[var(--ink-dim)] focus:border-[var(--ember-soft)]',
    addBtn: 'border-[var(--glass-border)] text-[var(--ink-dim)] hover:text-[var(--ink)]',
    dim: 'text-[var(--ink-dim)]',
    row: 'text-[var(--ink)]/85 hover:bg-white/5',
    rowDone: 'text-[var(--ink-dim)] hover:bg-white/5',
    check: 'accent-[var(--ember)]',
    tick: 'text-[var(--ember-soft)]',
    strike: 'decoration-[var(--ink-dim)]/50',
    removeHover: 'text-[var(--ink-dim)] hover:text-rose-300',
    reopenHover: 'hover:text-[var(--ink)]',
    toggle: 'text-[var(--ink-dim)] hover:text-[var(--ink)]',
    error: 'text-rose-300',
    panel: 'border-[var(--glass-border)] bg-black/10',
    panelTitle: 'text-[var(--ink-dim)]',
    panelHint: 'text-[var(--ink-dim)]/60',
  },
  light: {
    input: 'border-stone-300 bg-white text-stone-900 placeholder-stone-400 focus:border-amber-500',
    addBtn: 'border-stone-300 text-stone-500 hover:text-stone-800',
    dim: 'text-stone-400',
    row: 'text-stone-700 hover:bg-stone-100',
    rowDone: 'text-stone-400 hover:bg-stone-100',
    check: 'accent-amber-600',
    tick: 'text-amber-600',
    strike: 'decoration-stone-300',
    removeHover: 'text-stone-400 hover:text-rose-600',
    reopenHover: 'hover:text-stone-800',
    toggle: 'text-stone-400 hover:text-stone-700',
    error: 'text-rose-600',
    panel: 'border-stone-200 bg-white',
    panelTitle: 'text-stone-500',
    panelHint: 'text-stone-400',
  },
} as const

export type HopperTheme = keyof typeof THEMES

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
  theme = 'nocturne',
  showTitle = true,
  open = true,
  onCountChange,
}: {
  entityId: string
  variant: 'card' | 'panel'
  /** 'nocturne' on globe surfaces (default); 'light' on the Entity View. */
  theme?: HopperTheme
  /** panel variant: hide the internal title when the host supplies its own heading. */
  showTitle?: boolean
  /** card variant: data loads regardless; UI renders only while open. */
  open?: boolean
  /** Reports the OPEN stub count whenever it changes (chip label). */
  onCountChange?: (n: number) => void
}) {
  const t = THEMES[theme]
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

  // One line per memory (Andy, 2026-07-09): a multi-line paste would be
  // silently joined into one compound jot by the single-line input — the
  // browser strips the newlines. Intercept it and jot each line separately,
  // so a pasted list honors the atomicity the consume loop depends on
  // (one stub → one recollection → one check-off).
  async function pasteLines(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text/plain')
    if (!text.includes('\n')) return // single-line paste: default behavior
    e.preventDefault()
    if (busy) return
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    setBusy('add')
    setError(null)
    const added: HopperStub[] = []
    try {
      for (const body of lines) {
        const res = await fetch(`/api/entity/${entityId}/stubs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`)
        added.push(d.stub as HopperStub)
      }
      setInput('')
    } catch (err) {
      setError(
        (err instanceof Error ? err.message : 'Could not save every line.') +
        (added.length ? ` (${added.length} of ${lines.length} jotted)` : ''),
      )
    } finally {
      // Newest first, matching the API's ordering on reload.
      if (added.length) report([...added.reverse(), ...stubs])
      setBusy(null)
      inputRef.current?.focus()
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
    <div>
      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          onPaste={pasteLines}
          placeholder="Jot a memory to come back to…"
          disabled={busy === 'add'}
          className={`min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-xs outline-none disabled:opacity-50 ${t.input}`}
        />
        <button
          onClick={add}
          disabled={!input.trim() || busy !== null}
          className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs disabled:opacity-40 ${t.addBtn}`}
          title="Add to the hopper (Enter)"
        >
          Jot
        </button>
      </div>
      {/* Atomicity tip (Andy, 2026-07-09): a jot is ONE memory — the
          consume loop checks stubs off one-for-one against recollections.
          Elaboration belongs in the write-up, not here. */}
      <p className={`mt-1 text-[10px] ${t.dim}`}>
        One line per memory — jot each one separately.
      </p>
    </div>
  )

  const openList = openStubs.length > 0 && (
    <ul className={`space-y-1 overflow-y-auto ${variant === 'card' ? 'max-h-32' : 'max-h-48'}`}>
      {openStubs.map((s) => (
        <li key={s.id} className={`group flex items-start gap-2 rounded-lg px-1 py-0.5 text-xs leading-relaxed ${t.row}`}>
          <input
            type="checkbox"
            checked={false}
            onChange={() => setStatus(s, 'consumed')}
            disabled={busy !== null}
            title="Mark written — this memory has become a recollection"
            className={`mt-0.5 shrink-0 ${t.check}`}
          />
          <span className="min-w-0 flex-1 break-words">{s.body}</span>
          <button
            onClick={() => remove(s)}
            disabled={busy !== null}
            aria-label="Remove this jot"
            className={`shrink-0 opacity-0 transition group-hover:opacity-100 disabled:opacity-30 ${t.removeHover}`}
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
      {loading && <p className={`text-xs ${t.dim}`}>Fetching your jotted memories…</p>}
      {!loading && openStubs.length === 0 && (
        <p className={`text-xs italic ${t.dim}`}>
          Nothing waiting — jot the memories this place brings to mind, and write them up when there&apos;s time.
        </p>
      )}
      {openList}
      {variant === 'panel' && consumedStubs.length > 0 && (
        <div>
          <button
            onClick={() => setShowConsumed((v) => !v)}
            aria-expanded={showConsumed}
            className={`text-xs ${t.toggle}`}
          >
            {showConsumed ? '▾' : '▸'} {consumedStubs.length} written
          </button>
          {showConsumed && (
            <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto">
              {consumedStubs.map((s) => (
                <li key={s.id} className={`group flex items-start gap-2 rounded-lg px-1 py-0.5 text-xs leading-relaxed ${t.rowDone}`}>
                  <span className={`mt-0.5 shrink-0 ${t.tick}`}>✓</span>
                  <span className={`min-w-0 flex-1 break-words line-through ${t.strike}`}>{s.body}</span>
                  <button
                    onClick={() => setStatus(s, 'open')}
                    disabled={busy !== null}
                    title="Reopen — still to write"
                    className={`shrink-0 opacity-0 transition group-hover:opacity-100 disabled:opacity-30 ${t.reopenHover}`}
                  >
                    ↩
                  </button>
                  <button
                    onClick={() => remove(s)}
                    disabled={busy !== null}
                    aria-label="Remove this jot"
                    className={`shrink-0 opacity-0 transition group-hover:opacity-100 disabled:opacity-30 ${t.removeHover}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className={`text-xs ${t.error}`}>{error}</p>}
    </div>
  )

  if (variant === 'card') return <div className="mt-2">{body}</div>

  return (
    <div className={`mt-4 rounded-lg border p-3 ${t.panel}`}>
      {showTitle && (
        <p className={`mb-2 text-xs ${t.panelTitle}`}>
          Memories to write
          <span className={t.panelHint}> — jot now, recollect later</span>
        </p>
      )}
      {body}
    </div>
  )
}
