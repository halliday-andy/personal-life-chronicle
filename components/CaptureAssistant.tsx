'use client'

/**
 * Capture Assistant — Step 6e MVP (chrome + thread + input).
 *
 * Floating button (desktop) / FAB (mobile) that opens a slide-out panel
 * housing the orchestrator's conversation. Mounted at the protected
 * layout so it's present on every signed-in screen and persists across
 * navigation.
 *
 * Proposals are surfaced as a simple list under each orchestrator reply.
 * The proper accept/adjust/decline proposal cards land in Step 6f.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ProposalCard, type MemoryCardData } from './ProposalCard'
import { ContextProposalCard, type ContextProposalData } from './ContextProposalCard'
import { useUiChrome } from './UiChromeContext'

type ConversationTurn = { role: 'user' | 'assistant'; content: string }

interface ProposalSummary {
  tool: string
  rationale: string
  persisted: boolean
  confidence?: number
  data: Record<string, unknown>
  iteration: number
}

interface OrchestratorResponse {
  reply: string
  proposals: ProposalSummary[]
  meta: {
    submission_id: string
    digest_hash: string
    iterations: number
    model: string
    system_prompt_version: string
  }
}

type ThreadEntry =
  | { kind: 'user'; content: string }
  | { kind: 'assistant'; reply: string; proposals: ProposalSummary[]; submissionId: string }
  | { kind: 'error'; stage: string; message: string }

const OPENING: ThreadEntry = {
  kind: 'assistant',
  reply:
    "Hi. Drop in anything — a fresh memory, a thought you don't want to lose, a chunk of notes from elsewhere, even a question for me. I'll figure out what to do with it and you'll always see my reasoning before anything's saved.",
  proposals: [],
  submissionId: 'opener',
}

export default function CaptureAssistant() {
  const { assistantSuppressed } = useUiChrome()
  const [open, setOpen] = useState(false)
  const [thread, setThread] = useState<ThreadEntry[]>([OPENING])
  const [input, setInput] = useState('')
  const [guidance, setGuidance] = useState('')
  const [showGuidance, setShowGuidance] = useState(false)
  const [loading, setLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // ── ⌘K / Ctrl+K opens the panel and focuses input ─────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // While suppressed the panel is hidden (display:none) behind a focused
      // surface like the globe pin editor — don't let ⌘K pop it open there.
      if (assistantSuppressed) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
        // microtask so the panel mounts before focus
        setTimeout(() => textareaRef.current?.focus(), 30)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, assistantSuppressed])

  // ── Auto-resize textarea and scroll thread on new content ─────────
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [input])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread, loading])

  const submit = useCallback(async () => {
    const content = input.trim()
    if (!content || loading) return

    const userGuidance = guidance.trim()
    setInput('')
    setLoading(true)

    // Optimistically push the user message into the thread
    setThread((prev) => [...prev, { kind: 'user', content }])

    // Build conversation_history from prior text turns (skip the opener
    // since it's a UI greeting, not a real Claude turn).
    const history: ConversationTurn[] = []
    for (const t of thread) {
      if (t.kind === 'user') history.push({ role: 'user', content: t.content })
      else if (t.kind === 'assistant' && t.submissionId !== 'opener') {
        history.push({ role: 'assistant', content: t.reply })
      }
    }

    try {
      const res = await fetch('/api/orchestrator/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_text: content,
          user_guidance: userGuidance || undefined,
          conversation_history: history,
        }),
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setThread((prev) => [
          ...prev,
          {
            kind: 'error',
            stage: body?.stage ?? 'unknown',
            message: body?.message ?? 'Request failed',
          },
        ])
      } else {
        const data = body as OrchestratorResponse
        setThread((prev) => [
          ...prev,
          {
            kind: 'assistant',
            reply: data.reply,
            proposals: data.proposals,
            submissionId: data.meta.submission_id,
          },
        ])
        // Clear guidance after a submission — it's per-message, not sticky
        setGuidance('')
        setShowGuidance(false)
      }
    } catch (err) {
      setThread((prev) => [
        ...prev,
        {
          kind: 'error',
          stage: 'network',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      ])
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }, [input, guidance, loading, thread])

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  // Step aside while a focused panel (e.g. the globe pin editor) is open:
  // the FAB is fixed at z-50 and would overlap such panels, hiding their
  // controls (it was covering the pin panel's Delete button). The assistant
  // stays available everywhere else, including the globe itself.
  //
  // We HIDE the subtree with display:none rather than returning null.
  // Returning null unmounts the thread and every ProposalCard, and each card
  // keeps its resolution state (resolved merges, accepted/declined status) in
  // local useState seeded from capture-time props. So suppress→restore (open
  // a pin editor, then reopen Capture) used to remount the cards from stale
  // props — resurrecting already-resolved merge prompts and flipping accepted
  // drafts back to pending. It looked like lost work (2026-06-17 QA). Hidden
  // keeps every child mounted with its state intact.

  return (
    <div className={assistantSuppressed ? 'hidden' : 'contents'}>
      {/* ── Floating button (closed state) ─────────────────────────── */}
      {!open && (
        <button
          onClick={() => {
            setOpen(true)
            setTimeout(() => textareaRef.current?.focus(), 30)
          }}
          aria-label="Open capture assistant (⌘K)"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white shadow-lg hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400 transition-colors"
        >
          <span>Capture</span>
          <span className="hidden sm:inline text-xs text-stone-400 font-mono">⌘K</span>
        </button>
      )}

      {/* ── Backdrop on mobile (closes on tap) ────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/20 sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Slide-out panel (desktop) / bottom sheet (mobile) ────── */}
      <aside
        className={`fixed z-50 bg-white border-stone-200 shadow-2xl transition-transform duration-300 ease-out
          flex flex-col
          ${open ? 'translate-x-0 translate-y-0' : 'translate-x-full sm:translate-y-0 translate-y-full sm:translate-x-full'}
          inset-x-0 bottom-0 top-12 rounded-t-2xl border-t
          sm:inset-x-auto sm:bottom-0 sm:top-0 sm:right-0 sm:w-[40vw] sm:max-w-[560px] sm:min-w-[420px] sm:rounded-none sm:border-l`}
        aria-hidden={!open}
      >
        {/* Header */}
        <header className="flex-none flex items-center justify-between px-4 sm:px-5 h-12 border-b border-stone-200">
          <span className="text-sm font-medium text-stone-700">Capture</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close capture assistant"
            className="text-stone-400 hover:text-stone-900 transition-colors text-lg leading-none w-7 h-7 rounded hover:bg-stone-100"
          >
            ×
          </button>
        </header>

        {/* Thread */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-5 py-4 space-y-4">
            {thread.map((entry, i) => {
              if (entry.kind === 'user') {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[88%] rounded-2xl rounded-br-sm bg-stone-900 text-white text-sm px-4 py-2.5 leading-relaxed whitespace-pre-wrap">
                      {entry.content}
                    </div>
                  </div>
                )
              }
              if (entry.kind === 'error') {
                return (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-2.5 leading-relaxed">
                      <div className="text-xs font-medium uppercase tracking-wide opacity-70 mb-1">
                        Error · stage {entry.stage}
                      </div>
                      {entry.message}
                    </div>
                  </div>
                )
              }
              const grouped = groupProposalsByMemory(entry.proposals)
              return (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[92%] space-y-2.5 w-full">
                    <div className="rounded-2xl rounded-bl-sm bg-white border border-stone-200 text-stone-800 text-sm px-4 py-2.5 leading-relaxed whitespace-pre-wrap shadow-sm">
                      {entry.reply}
                    </div>

                    {grouped.memoryCards.map((card) => (
                      <ProposalCard key={card.memory.memory_id} initial={card} />
                    ))}

                    {grouped.contextCards.map((card, j) => (
                      <ContextProposalCard key={`ctx-${j}`} initial={card} />
                    ))}

                    {grouped.otherProposals.length > 0 && (
                      <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 space-y-1">
                        {grouped.otherProposals.map((p, j) => (
                          <ProposalLine key={j} p={p} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-white border border-stone-200 px-4 py-3 shadow-sm">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce" />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="flex-none border-t border-stone-200 px-4 sm:px-5 py-3 space-y-2">
          {showGuidance ? (
            <textarea
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="Optional — tell me what this is. Who's speaking? When? How confident?"
              rows={2}
              className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          ) : (
            <button
              onClick={() => setShowGuidance(true)}
              className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
            >
              + Add context (optional)
            </button>
          )}

          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Share a memory, a thought, or a chunk of notes. (⌘↵ to send)"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-stone-300 px-3 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent disabled:opacity-50 max-h-[200px] overflow-y-auto leading-relaxed"
            />
            <button
              onClick={submit}
              disabled={!input.trim() || loading}
              className="flex-none rounded-xl bg-stone-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

// ── Grouping ────────────────────────────────────────────────────
//
// One orchestrator response can produce many tool calls. Visually we want
// to cluster create_memory with its sibling classify_dimensions and
// extract_entities calls into a single ProposalCard. Other tools
// (propose_interview, add_to_backlog, flag_for_private_notes,
// search_chronicle) get their own thin lines underneath.
//
// Heuristic: in the proposals[] array order, each create_memory starts a
// new cluster. classify_dimensions / extract_entities that follow it
// (before the next create_memory or end of list) belong to that cluster.

function groupProposalsByMemory(proposals: ProposalSummary[]): {
  memoryCards: MemoryCardData[]
  contextCards: ContextProposalData[]
  otherProposals: ProposalSummary[]
} {
  const memoryCards: MemoryCardData[] = []
  const contextCards: ContextProposalData[] = []
  const otherProposals: ProposalSummary[] = []
  let currentCard: MemoryCardData | null = null

  for (const p of proposals) {
    if (p.tool === 'propose_context_note') {
      // Context proposals stand alone — they never persist server-side, so
      // a well-formed payload becomes an Accept/Adjust/Decline card and a
      // handler error falls through to the thin proposal line.
      const d = p.data as Partial<ContextProposalData> & { error?: string }
      if (!d.error && typeof d.body === 'string' && d.body) {
        contextCards.push({
          body: d.body,
          entity: d.entity ?? null,
          suggested_entity_name: d.suggested_entity_name ?? '',
          candidates: d.candidates ?? [],
          visibility: d.visibility === 'private' ? 'private' : 'shareable',
          source_label: d.source_label ?? null,
          source_url: d.source_url ?? null,
          rationale: p.rationale,
        })
      } else {
        otherProposals.push(p)
      }
      continue
    }
    if (p.tool === 'create_memory' && p.persisted) {
      const d = p.data as {
        memory_id?: string
        content_raw?: string
        occurred_at_fuzzy?: string | null
        time_precision?: string
        is_draft?: boolean
      }
      if (!d.memory_id || !d.content_raw) continue
      currentCard = {
        memory: {
          memory_id: d.memory_id,
          content_raw: d.content_raw,
          occurred_at_fuzzy: d.occurred_at_fuzzy ?? null,
          time_precision: d.time_precision ?? 'unknown',
          is_draft: d.is_draft ?? true,
        },
        tags: [],
        entities: [],
      }
      memoryCards.push(currentCard)
    } else if (p.tool === 'classify_dimensions' && currentCard) {
      const tags = (p.data as { proposals?: unknown[] }).proposals
      if (Array.isArray(tags)) {
        currentCard.tags = tags as MemoryCardData['tags']
        currentCard.tagsRationale = p.rationale
      }
    } else if (p.tool === 'extract_entities' && currentCard) {
      const ents = (p.data as { proposals?: unknown[] }).proposals
      if (Array.isArray(ents)) {
        // Only show entities that resolved successfully (have an entity_id)
        currentCard.entities = (ents as MemoryCardData['entities']).filter(
          (e) => e.resolved_entity_id != null,
        )
      }
    } else if (
      p.tool === 'flag_for_private_notes' &&
      p.persisted &&
      currentCard
    ) {
      // The orchestrator routed a passage to this draft's private_notes
      // layer. Attach it to the card so PrivateNotesPanel can surface it
      // pre-expanded — the user shouldn't have to hunt for what was moved.
      const d = p.data as { memory_id?: string; passage?: string }
      if (d.memory_id === currentCard.memory.memory_id && d.passage) {
        currentCard.routedToPrivateNotes = [
          ...(currentCard.routedToPrivateNotes ?? []),
          d.passage,
        ]
      }
    } else if (p.tool === 'create_memory') {
      // create_memory that didn't persist (error path) — surface as other
      otherProposals.push(p)
    } else {
      otherProposals.push(p)
    }
  }

  return { memoryCards, contextCards, otherProposals }
}

function ProposalLine({ p }: { p: ProposalSummary }) {
  const persistedBadge = p.persisted ? (
    <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-medium uppercase tracking-wide px-1.5 py-0.5">
      Saved
    </span>
  ) : (
    <span className="rounded-full bg-stone-100 text-stone-500 border border-stone-200 text-[9px] font-medium uppercase tracking-wide px-1.5 py-0.5">
      Preview
    </span>
  )
  const conf =
    p.confidence !== undefined ? (
      <span className="text-[10px] text-stone-400 font-mono">{(p.confidence * 100).toFixed(0)}%</span>
    ) : null

  // Build a one-line headline summarising what the tool produced
  const headline = (() => {
    switch (p.tool) {
      case 'create_memory': {
        const text = String((p.data as { content_raw?: string }).content_raw ?? '').slice(0, 60)
        return `Draft memory: "${text}${text.length >= 60 ? '…' : ''}"`
      }
      case 'classify_dimensions': {
        const proposals = (p.data as { proposals?: Array<{ dimension_name: string }> }).proposals ?? []
        const names = proposals.map((x) => x.dimension_name).join(', ')
        return `Dimensions: ${names || '(none)'}`
      }
      case 'extract_entities': {
        const proposals = (p.data as { proposals?: Array<{ extracted_name: string; resolution_action: string }> }).proposals ?? []
        return `Entities: ${proposals.map((x) => `${x.extracted_name} (${x.resolution_action.replace(/_/g, ' ')})`).join(', ') || '(none)'}`
      }
      case 'propose_interview': {
        const d = p.data as { topic?: string; opening_question?: string }
        return `Follow-up: ${d.topic ?? ''}`
      }
      case 'flag_for_private_notes':
        return 'Flagged for private notes layer'
      case 'propose_context_note': {
        // Only error payloads land here (well-formed ones become cards).
        const d = p.data as { suggested_entity_name?: string; error?: string }
        return `Context note proposal${d.suggested_entity_name ? ` for ${d.suggested_entity_name}` : ''}${d.error ? ` — ${d.error}` : ''}`
      }
      case 'add_to_backlog':
        return `Queued for later: "${String((p.data as { text?: string }).text ?? '').slice(0, 60)}"`
      case 'search_chronicle':
        return `Searched chronicle`
      default:
        return p.tool
    }
  })()

  return (
    <div className="flex items-start gap-2 text-xs text-stone-700">
      <div className="flex items-center gap-1.5 flex-none pt-0.5">{persistedBadge}{conf}</div>
      <div className="flex-1 leading-snug">
        <div className="font-medium text-stone-800">{headline}</div>
        <div className="text-stone-500 text-[11px]">{p.rationale}</div>
      </div>
    </div>
  )
}
