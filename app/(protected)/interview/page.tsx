'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

const OPENING_MESSAGE: Message = {
  role: 'assistant',
  content:
    "This is a free-form memory capture session — share whatever comes to mind and I'll record it. The structured Phase 0 onboarding (where we'll build your timeline, name your life chapters, and seed the key people and places in your story) comes next. For now, just tell me a memory — anything at all.",
}

export default function InterviewPage() {
  const [messages, setMessages] = useState<Message[]>([OPENING_MESSAGE])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [memoriesRecorded, setMemoriesRecorded] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [input])

  const sendMessage = useCallback(async () => {
    const content = input.trim()
    if (!content || loading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content }])
    setLoading(true)

    try {
      const res = await fetch('/api/interview/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, session_id: sessionId }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const detail =
          data?.message && data?.stage
            ? `(stage: ${data.stage}) ${data.message}`
            : data?.message ?? 'Request failed'
        throw new Error(detail)
      }

      setSessionId(data.session_id)
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
      setMemoriesRecorded((n) => n + (data.memories_recorded ?? 0))
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error'
      console.error('[interview]', detail)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Something went wrong. ${detail}`,
        },
      ])
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }, [input, loading, sessionId])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    // h-[calc(100vh-3.5rem)] fills the viewport below the global AppNav (h-14).
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 flex-none">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-stone-700">Free-form Memory Capture</span>
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              Phase 0 onboarding not yet started
            </span>
          </div>
          {memoriesRecorded > 0 && (
            <span className="text-xs text-stone-400">
              {memoriesRecorded} {memoriesRecorded === 1 ? 'memory' : 'memories'} recorded
            </span>
          )}
        </div>
      </header>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-stone-900 text-white rounded-br-sm'
                    : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm shadow-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
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
      <div className="flex-none bg-white border-t border-stone-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Share any memory — Wispr Flow or type (⌘↵ to send)"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-stone-300 px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent disabled:opacity-50 max-h-48 overflow-y-auto leading-relaxed"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="flex-none rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
          <p className="mt-2 text-xs text-stone-400 text-center">
            Memories are captured automatically as you share them
          </p>
        </div>
      </div>
    </div>
  )
}
