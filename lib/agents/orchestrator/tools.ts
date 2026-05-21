/**
 * Orchestrator tool registry.
 *
 * Defines the Anthropic tools the Orchestrator can call and a single
 * dispatch function that routes a tool_use block to the right handler.
 *
 * Tool handlers fall into three categories:
 *   1. Sub-agent delegations — call the existing dual-mode sub-agents
 *      (Tagger, Entity) via their inline tool wrappers
 *   2. Direct persistence — create_memory writes a draft memory and emits
 *      memory/ingested for the async sub-agent fanout
 *   3. Pure proposals — propose_interview, flag_for_private_notes,
 *      add_to_backlog return structured suggestions for the user to
 *      review. No persistence in 6b; the tables/columns required for
 *      these to persist arrive in substeps 6d (private_notes,
 *      capture_submissions) and 6g (Review Queue with the elaboration
 *      item_type).
 *
 * Reference: documentation/feature_capture_assistant.md §4.3.
 */

import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { inngest } from '@/lib/inngest/client'
import { runTagger, type TaggerResult } from '@/lib/agents/tagger/core'
import { runEntity, type EntityResult } from '@/lib/agents/entity/core'

export interface ToolContext {
  user_id: string
  supabase: SupabaseClient
}

export interface ToolResultPayload {
  tool: string
  /** Whether the call modified the database. */
  persisted: boolean
  /** Human-readable rationale of what the tool did (1–2 sentences). */
  rationale: string
  /** Tool-specific structured output. */
  data: Record<string, unknown>
  /** Optional confidence in [0,1]; absent when not applicable. */
  confidence?: number
}

export const ORCHESTRATOR_TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_memory',
    description:
      "Write a new draft memory from the user's submission. Use for clear recollections — anything with a specific person, place, event, or moment. The memory is saved with is_draft=true; the user finalises it later via the Review Queue. The verbatim text is preserved exactly as supplied (Raw Vault sanctity). After creation, the Tagger and Entity sub-agents run asynchronously via Inngest.",
    input_schema: {
      type: 'object' as const,
      properties: {
        content_raw: {
          type: 'string',
          description: "The memory in the user's own words, verbatim.",
        },
        occurred_at_fuzzy: {
          type: 'string',
          description:
            'Approximate time if discernible, e.g. "summer of 1987", "when I was about ten". Omit if not stated.',
        },
        time_precision: {
          type: 'string',
          enum: ['unknown', 'decade', 'year', 'season', 'month', 'day'],
          description: 'How precisely the time is known.',
        },
        rationale: {
          type: 'string',
          description: 'One sentence on why this is being captured as a memory.',
        },
      },
      required: ['content_raw', 'rationale'],
    },
  },
  {
    name: 'classify_dimensions',
    description:
      "Get proposed dimension tags for a piece of text from the Tagger sub-agent. Returns proposals only by default (persist=false); the user approves before any memory_dimensions rows are written.",
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The text to classify.' },
        memory_id: { type: 'string', description: 'Optional memory_id if persisting.' },
        persist: {
          type: 'boolean',
          description: 'Default false. Set true only when the user has approved.',
        },
        rationale: { type: 'string', description: 'One sentence on why classification is useful here.' },
      },
      required: ['text', 'rationale'],
    },
  },
  {
    name: 'extract_entities',
    description:
      "Get proposed named entities (people, places, organizations, vehicles, event series) from a piece of text, with resolution against the user's existing entity graph. Returns proposals only by default; the user approves before writes.",
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The text to extract from.' },
        memory_id: { type: 'string', description: 'Optional memory_id if persisting.' },
        persist: {
          type: 'boolean',
          description: 'Default false. Set true only when the user has approved.',
        },
        rationale: { type: 'string', description: 'One sentence on why extraction is useful here.' },
      },
      required: ['text', 'rationale'],
    },
  },
  {
    name: 'search_chronicle',
    description:
      "Look up existing memories or entities related to the submission, by name or free-text query. Use when the user references something that may already exist in the chronicle so you can avoid duplicates and link consistently.",
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Free-text query (e.g. a person name, a place name, a theme).' },
        kind: {
          type: 'string',
          enum: ['memory', 'entity', 'both'],
          description: 'What to search.',
        },
        limit: { type: 'number', description: 'Max results; default 5.' },
      },
      required: ['query', 'kind'],
    },
  },
  {
    name: 'propose_interview',
    description:
      "Suggest a follow-up interview thread the user might want to pursue. Use when the submission hints at a richer story than the current text captures (e.g. a name dropped without context). Returns a proposal; no persistence in this step.",
    input_schema: {
      type: 'object' as const,
      properties: {
        topic: { type: 'string', description: 'The topic or memory to draw out further.' },
        opening_question: { type: 'string', description: 'A warm, one-line opening question to begin the thread.' },
        rationale: { type: 'string', description: 'Why this is worth following up on.' },
      },
      required: ['topic', 'opening_question', 'rationale'],
    },
  },
  {
    name: 'flag_for_private_notes',
    description:
      "Suggest that a passage of text be moved to the memory's private_notes layer (owner-only) rather than the main content. Use when the submission contains honest commentary or social-context observations the user might not want shared even via Access Cards. Returns a proposal; no-op on persistence until substep 6d ships the private_notes column.",
    input_schema: {
      type: 'object' as const,
      properties: {
        passage: { type: 'string', description: 'The passage you would move to private_notes.' },
        rationale: { type: 'string', description: 'Why this seems more personal.' },
      },
      required: ['passage', 'rationale'],
    },
  },
  {
    name: 'add_to_backlog',
    description:
      "Queue a Things-to-come-back-to item — a thought the user wants to develop later. Use when the submission is intentionally incomplete (a stub) or when an interesting tangent comes up that the user hasn't asked you to develop now. Returns a proposal; persistence to review_queue lands when memory_elaboration_needed is added to the item_type enum.",
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The stub or note to queue.' },
        rationale: { type: 'string', description: 'Why this belongs in the backlog rather than as a memory now.' },
      },
      required: ['text', 'rationale'],
    },
  },
]

/**
 * Dispatch a tool_use block to its handler. Returns a ToolResultPayload
 * that the orchestrator will (a) feed back to Claude as a tool_result and
 * (b) include in the user-facing proposals list.
 *
 * Failures return a payload with `persisted=false` and an `error` field
 * in `data` — never throws.
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResultPayload> {
  try {
    switch (name) {
      case 'create_memory':
        return await handleCreateMemory(input, context)
      case 'classify_dimensions':
        return await handleClassifyDimensions(input, context)
      case 'extract_entities':
        return await handleExtractEntities(input, context)
      case 'search_chronicle':
        return await handleSearchChronicle(input, context)
      case 'propose_interview':
        return handleProposeInterview(input)
      case 'flag_for_private_notes':
        return handleFlagPrivateNotes(input)
      case 'add_to_backlog':
        return handleAddBacklog(input)
      default:
        return {
          tool: name,
          persisted: false,
          rationale: 'Unknown tool',
          data: { error: `No handler for tool: ${name}` },
        }
    }
  } catch (err) {
    return {
      tool: name,
      persisted: false,
      rationale: 'Tool execution failed',
      data: { error: err instanceof Error ? err.message : String(err) },
    }
  }
}

// ─── Handlers ──────────────────────────────────────────────────────

async function handleCreateMemory(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResultPayload> {
  const content_raw = String(input.content_raw ?? '').trim()
  const rationale = String(input.rationale ?? '')
  const occurred_at_fuzzy = input.occurred_at_fuzzy ? String(input.occurred_at_fuzzy) : null
  const time_precision = (input.time_precision as string) ?? 'unknown'

  if (!content_raw) {
    return {
      tool: 'create_memory',
      persisted: false,
      rationale,
      data: { error: 'content_raw is empty' },
    }
  }

  const { data: memory, error } = await ctx.supabase
    .from('memories')
    .insert({
      user_id: ctx.user_id,
      content_raw,
      occurred_at_fuzzy,
      time_precision,
      source: 'text_entry',
      confidence: 'certain',
      is_draft: true, // Orchestrator-created memories start as drafts.
      metadata: { created_by: 'orchestrator' },
    })
    .select('id')
    .single()

  if (error || !memory) {
    return {
      tool: 'create_memory',
      persisted: false,
      rationale,
      data: { error: error?.message ?? 'insert returned no row' },
    }
  }

  // Fan out to async sub-agents.
  try {
    await inngest.send({
      name: 'memory/ingested',
      data: { memory_id: memory.id, user_id: ctx.user_id },
    })
  } catch (sendErr) {
    console.warn('[orchestrator] memory/ingested send failed (memory still saved)', sendErr)
  }

  return {
    tool: 'create_memory',
    persisted: true,
    rationale,
    data: {
      memory_id: memory.id,
      content_raw,
      occurred_at_fuzzy,
      time_precision,
      is_draft: true,
    },
    confidence: 0.9,
  }
}

async function handleClassifyDimensions(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResultPayload> {
  const text = String(input.text ?? '')
  const memory_id = input.memory_id ? String(input.memory_id) : undefined
  const persist = input.persist === true
  const rationale = String(input.rationale ?? '')

  const result: TaggerResult = await runTagger({
    text,
    user_id: ctx.user_id,
    memory_id,
    persist,
    supabase: ctx.supabase,
  })

  return {
    tool: 'classify_dimensions',
    persisted: persist,
    rationale,
    data: {
      proposals: result.proposals,
      sensitive_detected: result.sensitive_detected,
    },
    confidence:
      result.proposals.length === 0
        ? 0
        : result.proposals.reduce((s, p) => s + p.weight, 0) / result.proposals.length,
  }
}

async function handleExtractEntities(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResultPayload> {
  const text = String(input.text ?? '')
  const memory_id = input.memory_id ? String(input.memory_id) : undefined
  const persist = input.persist === true
  const rationale = String(input.rationale ?? '')

  const result: EntityResult = await runEntity({
    text,
    user_id: ctx.user_id,
    memory_id,
    persist,
    supabase: ctx.supabase,
  })

  return {
    tool: 'extract_entities',
    persisted: persist,
    rationale,
    data: {
      proposals: result.proposals,
      new_entity_count: result.new_entity_count,
      merge_proposals_created: result.merge_proposals_created,
    },
  }
}

async function handleSearchChronicle(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResultPayload> {
  const query = String(input.query ?? '').trim()
  const kind = (input.kind as 'memory' | 'entity' | 'both') ?? 'both'
  const limit = Math.min(20, Math.max(1, Number(input.limit ?? 5)))

  const results: Record<string, unknown[]> = {}

  if (kind === 'memory' || kind === 'both') {
    // Step 6b uses a simple ilike fallback. pgvector similarity search wires in
    // during Step 14 (Search Agent). The orchestrator can be upgraded then.
    const { data } = await ctx.supabase
      .from('memories')
      .select('id, content_raw, occurred_at_fuzzy, time_precision, created_at')
      .eq('user_id', ctx.user_id)
      .ilike('content_raw', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit)
    results.memories = data ?? []
  }

  if (kind === 'entity' || kind === 'both') {
    const { data } = await ctx.supabase
      .from('entities')
      .select('id, type, canonical_name, aliases')
      .eq('user_id', ctx.user_id)
      .or(`canonical_name.ilike.%${query}%,aliases.cs.{${query}}`)
      .limit(limit)
    results.entities = data ?? []
  }

  return {
    tool: 'search_chronicle',
    persisted: false,
    rationale: `Searched chronicle for "${query}"`,
    data: results,
  }
}

function handleProposeInterview(input: Record<string, unknown>): ToolResultPayload {
  return {
    tool: 'propose_interview',
    persisted: false,
    rationale: String(input.rationale ?? ''),
    data: {
      topic: input.topic,
      opening_question: input.opening_question,
    },
  }
}

function handleFlagPrivateNotes(input: Record<string, unknown>): ToolResultPayload {
  return {
    tool: 'flag_for_private_notes',
    persisted: false,
    rationale: String(input.rationale ?? ''),
    data: {
      passage: input.passage,
      note: 'private_notes column not yet present in the schema; this is a proposal-only signal until substep 6d.',
    },
  }
}

function handleAddBacklog(input: Record<string, unknown>): ToolResultPayload {
  return {
    tool: 'add_to_backlog',
    persisted: false,
    rationale: String(input.rationale ?? ''),
    data: {
      text: input.text,
      note: 'memory_elaboration_needed item_type not yet present in review_queue; this is a proposal-only signal.',
    },
  }
}
