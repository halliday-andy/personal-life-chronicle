/**
 * Orchestrator Agent — core.
 *
 * Single entry point: runOrchestrator({...}). Composes the three-layer
 * prompt, calls Claude Sonnet 4.5 with the tool registry, iterates the
 * tool-use loop until Claude stops calling tools (or the safety cap is
 * reached), then returns a structured response.
 *
 * Reference: documentation/feature_capture_assistant.md §4.
 */

import type Anthropic from '@anthropic-ai/sdk'
import { DEFAULT_AGENT_MODEL, getAnthropicClient } from '@/lib/agents/shared/anthropic'
import { getAgentSupabase, logAssumption } from '@/lib/agents/shared/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ORCHESTRATOR_SYSTEM_PROMPT, SYSTEM_PROMPT_VERSION } from './system'
import type { ChronicleDigest } from './digest'
import { getChronicleDigest } from './digest-cache'
import { ORCHESTRATOR_TOOLS, executeTool, type ToolResultPayload } from './tools'

const MAX_TOOL_ITERATIONS = 5
const MAX_OUTPUT_TOKENS = 2048

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface OrchestratorInput {
  user_id: string
  submission_text: string
  /** Optional user-supplied guidance about what they're sharing (see spec §4.2). */
  user_guidance?: string
  /** Optional context about where the user is in the app (e.g. "placing globe pins"). */
  active_context?: string
  /** Optional prior conversation in this session. */
  conversation_history?: ConversationTurn[]
  /** Injected clients for testing / shared connections. */
  supabase?: SupabaseClient
  anthropic?: Anthropic
}

export interface OrchestratorProposal extends ToolResultPayload {
  iteration: number
}

export interface OrchestratorResponse {
  /** Short conversational reply for the user. */
  reply: string
  /** Each tool the orchestrator invoked, in order. */
  proposals: OrchestratorProposal[]
  /** Diagnostics: digest hash, iteration count, model + prompt versions. */
  meta: {
    digest_hash: string
    iterations: number
    model: string
    system_prompt_version: string
    stop_reason: string | null | undefined
    digest_stats: ChronicleDigest['stats']
  }
}

export async function runOrchestrator(input: OrchestratorInput): Promise<OrchestratorResponse> {
  const supabase = getAgentSupabase(input.supabase)
  const anthropic = input.anthropic ?? getAnthropicClient()

  // ─── Layer B: per-user chronicle digest (cached) ─────────────────
  // Read from user_chronicle_digests. Regenerates lazily if stale,
  // missing, or older than the cache TTL. See digest-cache.ts.
  const digest = await getChronicleDigest(input.user_id, supabase)

  // ─── Compose the system blocks with cache_control on A and B ─────
  // Layer A is a constant; cache it long. Layer B is per-user; cache it
  // for the duration its hash remains valid (Anthropic prompt cache TTL
  // is ~5 min by default).
  const systemBlocks: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> = [
    {
      type: 'text',
      text: ORCHESTRATOR_SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: `## Layer B — chronicle context for this user (digest hash: ${digest.hash})\n\n${digest.text}`,
      cache_control: { type: 'ephemeral' },
    },
  ]

  // ─── Layer C: conversation history + current submission ──────────
  const messages: Anthropic.MessageParam[] = []
  for (const turn of input.conversation_history ?? []) {
    messages.push({ role: turn.role, content: turn.content })
  }

  const submissionParts: string[] = []
  if (input.user_guidance && input.user_guidance.trim()) {
    submissionParts.push(`The user added this context: "${input.user_guidance.trim()}"`)
  }
  if (input.active_context && input.active_context.trim()) {
    submissionParts.push(`Active app context: ${input.active_context.trim()}`)
  }
  submissionParts.push(`User submission:\n\n"""\n${input.submission_text}\n"""`)
  messages.push({ role: 'user', content: submissionParts.join('\n\n') })

  // ─── Multi-turn tool-use loop ────────────────────────────────────
  const proposals: OrchestratorProposal[] = []
  let iteration = 0
  let finalReply = ''
  let lastStopReason: string | null | undefined = null

  while (iteration < MAX_TOOL_ITERATIONS) {
    iteration++

    const response = await anthropic.messages.create({
      model: DEFAULT_AGENT_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemBlocks,
      tools: ORCHESTRATOR_TOOLS,
      messages,
    })

    lastStopReason = response.stop_reason

    // Append the assistant's response to history so the next round sees it.
    messages.push({ role: 'assistant', content: response.content })

    // Collect any text the assistant emitted this round (it's the running reply).
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    )
    if (textBlocks.length > 0) {
      finalReply = textBlocks.map((b) => b.text).join('\n').trim()
    }

    // If no tool_use blocks, we're done.
    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )
    if (toolUses.length === 0) break

    // Execute the tool calls for this iteration in parallel. Claude has
    // already decided on all tool calls in this iteration before any of
    // them run, so there is no dependency chain to preserve — every tool
    // call sees the same state. executeTool() never throws (errors are
    // returned as payloads), which makes Promise.all safe here.
    //
    // We preserve ordering of both proposals[] and toolResultBlocks by
    // iterating in the original toolUses order after the parallel work.
    const payloads = await Promise.all(
      toolUses.map((tu) =>
        executeTool(tu.name, tu.input as Record<string, unknown>, {
          user_id: input.user_id,
          supabase,
        }),
      ),
    )

    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = []
    for (let i = 0; i < toolUses.length; i++) {
      const tu = toolUses[i]
      const payload = payloads[i]

      proposals.push({ ...payload, iteration })

      toolResultBlocks.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify({
          persisted: payload.persisted,
          rationale: payload.rationale,
          data: payload.data,
          confidence: payload.confidence,
        }),
      })
    }

    messages.push({ role: 'user', content: toolResultBlocks })

    // If Claude stopped naturally and just emitted text alongside tool calls,
    // give it one more chance to wrap up — but if the previous stop_reason
    // was 'end_turn', we're truly done.
    if (response.stop_reason === 'end_turn' && toolUses.length === 0) break
  }

  // ─── Audit log ────────────────────────────────────────────────────
  // Single summary row per orchestrator run.
  await logAssumption(supabase, {
    user_id: input.user_id,
    agent: 'capture_agent', // orchestrator_reasoning enum value lands later; use capture_agent until then
    assumption_type: 'other',
    memory_id: null,
    summary: `Orchestrator run: ${proposals.length} tool call(s) over ${iteration} iteration(s); reply ${finalReply.length} chars`,
    decision_json: {
      input: input.submission_text.slice(0, 500),
      decision: `Produced ${proposals.length} proposal(s)`,
      confidence:
        proposals.length === 0
          ? 0
          : proposals.reduce((s, p) => s + (p.confidence ?? 0.5), 0) / proposals.length,
      reasoning: 'See proposals[] for per-tool rationale.',
      digest_hash: digest.hash,
      iterations: iteration,
      tool_names: proposals.map((p) => p.tool),
      system_prompt_version: SYSTEM_PROMPT_VERSION,
    },
    model_version: DEFAULT_AGENT_MODEL,
    prompt_hash: digest.hash,
  })

  return {
    reply: finalReply,
    proposals,
    meta: {
      digest_hash: digest.hash,
      iterations: iteration,
      model: DEFAULT_AGENT_MODEL,
      system_prompt_version: SYSTEM_PROMPT_VERSION,
      stop_reason: lastStopReason,
      digest_stats: digest.stats,
    },
  }
}
