/**
 * Interview message endpoint.
 *
 * Two Supabase clients in use, by design:
 *
 *   - userClient (anon key + auth cookie): used ONLY to verify the caller's
 *     identity via auth.getUser(). It runs through Supabase RLS.
 *   - adminClient (service role key): used for all subsequent writes
 *     (interview_sessions, memories, transcript updates) and the read of
 *     existing session state for THIS authenticated user. The admin client
 *     bypasses RLS because RLS is currently enabled on these tables but the
 *     viewer_can_access() function still returns FALSE pending Step 13.
 *
 * This is an alpha shortcut documented in memory/project_lc_build_progress.md
 * and feature_capture_assistant.md. Production hardening (Capture Agent
 * running under a restricted INSERT-only DB role) is a separate concern.
 *
 * All writes are scoped to user.id (taken from the authenticated session),
 * so the admin client cannot accidentally cross users.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are the interviewer for Life Chronicle, a personal memory-collection system. Your PRIMARY job is to capture memories the person shares by calling the record_memory tool. Conversation is the wrapper around that act, not a substitute for it.

## The recording rule (do this every turn)

When the user's message contains a recollection — anything with a specific person, place, event, or moment from their life — you MUST call the record_memory tool BEFORE generating your text reply. Default to recording. Err on the side of capturing rather than asking for elaboration first.

Examples that MUST be recorded:
- "In my sophomore year at Dartmouth, Leola came to visit me for Winter Carnival…" → record
- "We used to spend summers at my grandmother's lake house" → record (recurring event_series memory)
- "The day my father died, I was driving home from Atlanta" → record
- "I remember being scared of the dark hallway at our house on Elm Street" → record

Examples that should NOT be recorded:
- "I want to tell you about my childhood" → preamble only, ask what they'd like to share
- "I had a happy childhood" → too general, gently invite a specific recollection
- A question to you ("How does this work?") → answer the question, do not record

If you are unsure whether something is a memory, RECORD IT. A spurious record can be cleaned up in review; a lost memory cannot be recovered.

## After recording

Once you've called record_memory, generate a brief text reply that:
- Acknowledges what they shared with warmth (a sentence of reflection)
- Asks ONE follow-up question that either deepens this memory or invites an adjacent one

Never announce "I've recorded that" — the system surfaces the confirmation visually. Just continue the conversation naturally.

## Tone

Warm and unhurried. Never clinical. Concise — a sentence of reflection plus one question is the usual pattern. Follow the person's lead.`

const RECORD_MEMORY_TOOL: Anthropic.Tool = {
  name: 'record_memory',
  description:
    'PRIMARY ACTION: Capture a memory the person just shared. Call this every time the user message contains a recollection — anything with a specific person, place, event, time, or moment. This is your default behavior. Capturing is cheap; missing a memory is the failure mode to avoid. Only skip calling this when the user message is a question to you, a meta-comment about how the system works, or pure preamble with no concrete content yet ("I want to tell you about my childhood").',
  input_schema: {
    type: 'object' as const,
    properties: {
      content_raw: {
        type: 'string',
        description: "The memory in the person's own words, verbatim",
      },
      occurred_at_fuzzy: {
        type: 'string',
        description:
          'Approximate time, e.g. "summer of 1987", "when I was about ten", "before we moved to London". Omit if no time clue was given.',
      },
      time_precision: {
        type: 'string',
        enum: ['unknown', 'decade', 'year', 'season', 'month', 'day'],
        description: 'How precisely the time is known',
      },
    },
    required: ['content_raw'],
  },
}

type TranscriptTurn = { role: 'user' | 'assistant'; content: string; timestamp: string }

const isDev = process.env.NODE_ENV !== 'production'

function failure(stage: string, err: unknown, status = 500): NextResponse {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[interview] stage=${stage} FAILED`, err)
  return NextResponse.json(
    {
      error: 'interview_failed',
      stage,
      // Surface details in dev so the UI is diagnostic; redact in prod.
      message: isDev ? message : 'Something went wrong. Please try again.',
    },
    { status },
  )
}

export async function POST(request: NextRequest) {
  let stage = 'auth'
  try {
    // ── Auth ──────────────────────────────────────────────────────────
    const userClient = createUserClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    stage = 'parse-body'
    const body = await request.json()
    const { content, session_id } = body as { content: string; session_id?: string }
    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Admin client for all writes/reads from here on.
    const admin = createAdminClient()

    // ── Load or create session ────────────────────────────────────────
    stage = 'session-load'
    let sessionId = session_id
    let transcript: TranscriptTurn[] = []
    let turnCount = 0
    let existingMemoryIds: string[] = []

    if (sessionId) {
      const { data: existing, error: loadErr } = await admin
        .from('interview_sessions')
        .select('transcript, turn_count, memory_ids')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single()
      if (loadErr && loadErr.code !== 'PGRST116') {
        // PGRST116 = no rows; treated as "session not found, create new"
        return failure('session-load', loadErr)
      }
      if (existing) {
        transcript = (existing.transcript as TranscriptTurn[]) ?? []
        turnCount = existing.turn_count ?? 0
        existingMemoryIds = existing.memory_ids ?? []
      } else {
        sessionId = undefined
      }
    }

    if (!sessionId) {
      stage = 'session-create'
      const { data: newSession, error: createErr } = await admin
        .from('interview_sessions')
        .insert({
          user_id: user.id,
          agent_type: 'chat_interviewer',
          channel: 'app',
          started_at: new Date().toISOString(),
          turn_count: 0,
          transcript: [],
          memory_ids: [],
          metadata: {},
        })
        .select('id')
        .single()
      if (createErr || !newSession) {
        return failure('session-create', createErr ?? new Error('insert returned no row'))
      }
      sessionId = newSession.id
    }

    // ── Build Anthropic message history ──────────────────────────────
    const messages: Anthropic.MessageParam[] = transcript.map((t) => ({
      role: t.role,
      content: t.content,
    }))
    messages.push({ role: 'user', content })

    // ── Call Claude ──────────────────────────────────────────────────
    stage = 'anthropic-call'
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [RECORD_MEMORY_TOOL],
      messages,
    })

    // ── Process tool calls — record memories ─────────────────────────
    stage = 'memory-record'
    const newMemoryIds: string[] = []
    const toolResultContent: Anthropic.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type !== 'tool_use' || block.name !== 'record_memory') continue

      const input = block.input as {
        content_raw: string
        occurred_at_fuzzy?: string
        time_precision?: string
      }

      // NOTE: no `privacy_tier` field — that ENUM column is deprecated and was
      // removed from the deployed schema in favor of Access Cards (cards +
      // record_card_grants). Per CLAUDE.md item 3, do not reintroduce it.
      const { data: memory, error: memError } = await admin
        .from('memories')
        .insert({
          user_id: user.id,
          content_raw: input.content_raw,
          occurred_at_fuzzy: input.occurred_at_fuzzy ?? null,
          time_precision: input.time_precision ?? 'unknown',
          source: 'text_entry',
          confidence: 'certain',
          source_session_id: sessionId,
          is_draft: false,
          metadata: {},
        })
        .select('id')
        .single()

      if (memError || !memory) {
        // Bubble the insert failure up rather than letting Claude generate
        // an empty conversational reply over a "memory not recorded" tool
        // result. The user needs to see the actual error.
        return failure('memory-record', memError ?? new Error('insert returned no row'))
      }

      newMemoryIds.push(memory.id)
      toolResultContent.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: 'Memory recorded.',
      })

      // Emit memory/ingested for Tagger + Entity agents (Step 6).
      // Non-fatal — a missed event is better than a lost memory.
      try {
        await inngest.send({
          name: 'memory/ingested',
          data: { memory_id: memory.id, user_id: user.id },
        })
      } catch (sendErr) {
        console.warn('[interview] inngest.send failed (memory still saved)', sendErr)
      }
    }

    // ── If Claude used tools, get its follow-up text reply ───────────
    stage = 'anthropic-followup'
    let reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    if (response.stop_reason === 'tool_use' && toolResultContent.length > 0) {
      const followUp = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        tools: [RECORD_MEMORY_TOOL],
        messages: [
          ...messages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResultContent },
        ],
      })
      reply = followUp.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
    }

    // ── Persist updated session state ────────────────────────────────
    stage = 'session-update'
    const now = new Date().toISOString()
    const updatedTranscript: TranscriptTurn[] = [
      ...transcript,
      { role: 'user', content, timestamp: now },
      { role: 'assistant', content: reply, timestamp: now },
    ]
    const { error: updateErr } = await admin
      .from('interview_sessions')
      .update({
        transcript: updatedTranscript,
        turn_count: turnCount + 1,
        memory_ids: [...existingMemoryIds, ...newMemoryIds],
      })
      .eq('id', sessionId)
    if (updateErr) {
      console.warn('[interview] session update failed (reply still returned)', updateErr)
    }

    return NextResponse.json({
      reply,
      session_id: sessionId,
      memories_recorded: newMemoryIds.length,
    })
  } catch (err) {
    return failure(stage, err)
  }
}
