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
  /**
   * The capture_submissions row that triggered this orchestrator run.
   * Passed to create_memory so each draft links back to its submission;
   * also used by add_to_backlog so queued items have provenance.
   */
  source_submission_id?: string
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
      "Classify a piece of text against the chronicle's dimension taxonomy via the Tagger sub-agent. When called for a memory you just created (memory_id supplied), pass persist=true to write memory_dimensions rows immediately — the proposal card then renders editable tag chips. Without memory_id, the call is preview-only (no DB writes). The draft state of the memory means the work is provisional; the user can adjust on the card.",
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The text to classify.' },
        memory_id: {
          type: 'string',
          description: 'UUID of the memory being tagged. Required when persist=true.',
        },
        persist: {
          type: 'boolean',
          description: 'Default true when memory_id is supplied; false otherwise.',
        },
        rationale: { type: 'string', description: 'One sentence on why classification is useful here.' },
      },
      required: ['text', 'rationale'],
    },
  },
  {
    name: 'extract_entities',
    description:
      "Extract named entities (people, places, organizations, vehicles, event series) from a piece of text, with resolution against the user's existing entity graph via the Entity sub-agent. When called for a memory you just created (memory_id supplied), pass persist=true to write entities + memory_entities rows immediately — the proposal card renders editable entity chips that the user can rename or remove. Without memory_id, the call is preview-only.",
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The text to extract from.' },
        memory_id: {
          type: 'string',
          description: 'UUID of the memory being analysed. Required when persist=true.',
        },
        persist: {
          type: 'boolean',
          description: 'Default true when memory_id is supplied; false otherwise.',
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
      "Append a passage to a memory's private_notes layer (owner-only, never exposed via Access Cards or shares). Use when the submission contains honest commentary or social-context observations the user might not want shared even via the Family or Professional cards. When memory_id is supplied the passage is written immediately; without it, returns a proposal the orchestrator can apply once a draft exists.",
    input_schema: {
      type: 'object' as const,
      properties: {
        passage: { type: 'string', description: 'The passage to add to private_notes.' },
        rationale: { type: 'string', description: 'Why this seems more personal.' },
        memory_id: {
          type: 'string',
          description: 'UUID of the memory to append to. Omit to return proposal-only.',
        },
      },
      required: ['passage', 'rationale'],
    },
  },
  {
    name: 'add_to_backlog',
    description:
      "Queue a Things-to-come-back-to item — a thought the user wants to develop later. Use when the submission is intentionally incomplete (a stub) or when an interesting tangent comes up that the user hasn't asked you to develop now. Persists as a review_queue row with item_type='memory_elaboration_needed' linked to the current capture_submissions row.",
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
        return await handleFlagPrivateNotes(input, context)
      case 'add_to_backlog':
        return await handleAddBacklog(input, context)
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
      source_submission_id: ctx.source_submission_id ?? null,
      // skip_async_fanout: suppress the Tagger + Entity Inngest listeners
      // for this draft. The orchestrator's inline preview tools populate
      // the proposal cards; persistence waits until the user Accepts via
      // POST /api/memory/[id]/finalize, which removes this flag and
      // re-emits memory/ingested so the listeners run with persist=true.
      metadata: { created_by: 'orchestrator', skip_async_fanout: true },
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
  // Default persist=true when memory_id is supplied (the typical case for
  // tagging a draft memory). Without a memory_id we can't write anyway,
  // so this stays preview-only.
  const persist =
    input.persist === undefined ? Boolean(memory_id) : input.persist === true
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
  // Default persist=true when memory_id is supplied (typical case for
  // extracting entities from a draft memory). Mirrors classify_dimensions.
  const persist =
    input.persist === undefined ? Boolean(memory_id) : input.persist === true
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

async function handleFlagPrivateNotes(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResultPayload> {
  const passage = String(input.passage ?? '').trim()
  const rationale = String(input.rationale ?? '')
  const memory_id = input.memory_id ? String(input.memory_id) : undefined

  if (!passage) {
    return {
      tool: 'flag_for_private_notes',
      persisted: false,
      rationale,
      data: { error: 'passage is empty' },
    }
  }

  // No memory_id → proposal-only (orchestrator can apply to a draft later).
  if (!memory_id) {
    return {
      tool: 'flag_for_private_notes',
      persisted: false,
      rationale,
      data: {
        passage,
        note: 'No memory_id supplied; proposal-only. Provide memory_id to persist directly.',
      },
    }
  }

  // Append to private_notes (never overwrite — owner-only commentary is
  // additive). Read-modify-write because Postgres lacks a clean append
  // operator for TEXT in a single statement that we can use through
  // PostgREST without a function.
  const { data: current, error: readErr } = await ctx.supabase
    .from('memories')
    .select('private_notes')
    .eq('id', memory_id)
    .eq('user_id', ctx.user_id)
    .single()

  if (readErr || !current) {
    return {
      tool: 'flag_for_private_notes',
      persisted: false,
      rationale,
      data: { error: `memory ${memory_id} not found: ${readErr?.message ?? 'no row'}` },
    }
  }

  const existing = (current.private_notes as string | null) ?? ''
  const separator = existing.length > 0 ? '\n\n---\n\n' : ''
  const updated = existing + separator + passage

  const { error: writeErr } = await ctx.supabase
    .from('memories')
    .update({ private_notes: updated })
    .eq('id', memory_id)
    .eq('user_id', ctx.user_id)

  if (writeErr) {
    return {
      tool: 'flag_for_private_notes',
      persisted: false,
      rationale,
      data: { error: writeErr.message },
    }
  }

  return {
    tool: 'flag_for_private_notes',
    persisted: true,
    rationale,
    data: {
      memory_id,
      appended_length: passage.length,
      total_length: updated.length,
    },
  }
}

async function handleAddBacklog(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResultPayload> {
  const text = String(input.text ?? '').trim()
  const rationale = String(input.rationale ?? '')

  if (!text) {
    return {
      tool: 'add_to_backlog',
      persisted: false,
      rationale,
      data: { error: 'text is empty' },
    }
  }

  // review_queue.item_id is a polymorphic UUID. memory_elaboration_needed
  // entries don't reference a memory yet (they ARE the stub of an
  // unwritten memory), so we use the source_submission_id as the anchor
  // for traceability. If no submission context is available we fall back
  // to gen_random_uuid()-equivalent (a synthetic placeholder).
  const item_id = ctx.source_submission_id ?? crypto.randomUUID()

  const { data, error } = await ctx.supabase
    .from('review_queue')
    .insert({
      user_id: ctx.user_id,
      item_type: 'memory_elaboration_needed',
      item_id,
      context_json: {
        text,
        rationale,
        source_submission_id: ctx.source_submission_id ?? null,
        proposed_by: 'orchestrator',
      },
      priority: 3,
    })
    .select('id')
    .single()

  if (error) {
    return {
      tool: 'add_to_backlog',
      persisted: false,
      rationale,
      data: { error: error.message },
    }
  }

  return {
    tool: 'add_to_backlog',
    persisted: true,
    rationale,
    data: {
      review_queue_id: data?.id,
      text,
      item_type: 'memory_elaboration_needed',
    },
  }
}
