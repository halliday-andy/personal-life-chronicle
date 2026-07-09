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
import { linkEntityToMemory } from '@/lib/memory/owner-edit'

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
    name: 'propose_context_note',
    description:
      "Propose attaching third-person background material — research, historical notes, an article, an obituary — as a context note on the entity it is ABOUT. Context is not a recollection: it never enters the Raw Vault and must not be captured via create_memory or parked via add_to_backlog. This tool persists NOTHING; it returns a proposal card the user accepts, adjusts, or declines. The system resolves entity_name against the user's existing entities server-side and auto-detects a source URL in the text.",
    input_schema: {
      type: 'object' as const,
      properties: {
        entity_name: {
          type: 'string',
          description:
            "The person, place, or organization the material is about — use the exact name from Layer B when it's an existing entity.",
        },
        body: {
          type: 'string',
          description:
            'The context text, verbatim (keep formatting, citations, markdown). Omit when use_full_submission=true.',
        },
        use_full_submission: {
          type: 'boolean',
          description:
            "Pass true when the ENTIRE submission is the context material — the system then attaches the user's submission text verbatim, which is safer than echoing it.",
        },
        visibility: {
          type: 'string',
          enum: ['shareable', 'private'],
          description:
            "Default 'shareable' for background research; use 'private' for sensitive personal commentary about a person.",
        },
        source_label: {
          type: 'string',
          description: 'Short label for the source when one is evident (e.g. "Wikipedia", "unit history").',
        },
        rationale: {
          type: 'string',
          description: 'One sentence on why this is context rather than a recollection.',
        },
      },
      required: ['entity_name', 'rationale'],
    },
  },
  {
    name: 'list_memory_stubs',
    description:
      "List the user's open hopper stubs — memories they jotted down to write up later. Pass entity_name to scope to one person/place (resolved against their existing entities); omit it to list open stubs across all hosts. Read-only. Use when the user wants to work on their jotted memories ('let's write up one of my jots about X') or asks what's waiting in the hopper.",
    input_schema: {
      type: 'object' as const,
      properties: {
        entity_name: {
          type: 'string',
          description: "Optional host entity to scope to — use the exact name from Layer B when it's an existing entity.",
        },
      },
      required: [],
    },
  },
  {
    name: 'add_memory_stub',
    description:
      "Jot a new stub into the hopper of a person or place — a memory to be written up later, anchored to the entity it's about. Use ONLY after the user has explicitly agreed in this conversation to jot it (offer first: 'shall I add that to your hopper for X?'). Never jot silently. Not for research/background (propose_context_note) and not for general loose ends (add_to_backlog) — a stub is a specific unwritten MEMORY with a clear host entity.",
    input_schema: {
      type: 'object' as const,
      properties: {
        entity_name: {
          type: 'string',
          description: 'The person or place the memory is about — the stub lives in their hopper.',
        },
        body: {
          type: 'string',
          description: "The jot, short and evocative, in the user's terms ('the ice-cream truck summer').",
        },
        rationale: { type: 'string', description: 'One sentence: why this is a stub for later, and that the user agreed.' },
      },
      required: ['entity_name', 'body', 'rationale'],
    },
  },
  {
    name: 'consume_memory_stub',
    description:
      'Mark a hopper stub as written, linking it to the recollection it became. Call this ONLY after create_memory has returned a real memory_id for the fleshed-out recollection — in the same later turn as classify_dimensions/extract_entities. The stub must belong to the user and still be open.',
    input_schema: {
      type: 'object' as const,
      properties: {
        stub_id: { type: 'string', description: 'UUID of the stub (from list_memory_stubs).' },
        memory_id: { type: 'string', description: 'UUID of the memory just created from it (from create_memory).' },
        rationale: { type: 'string', description: 'One sentence tying the stub to the recollection.' },
      },
      required: ['stub_id', 'memory_id', 'rationale'],
    },
  },
  {
    name: 'add_to_backlog',
    description:
      "Queue a Things-to-come-back-to item — a thought the user wants to develop later. Use when the submission is intentionally incomplete (a stub) or when an interesting tangent comes up that the user hasn't asked you to develop now. NOT for research or background material about an entity — that goes through propose_context_note. Persists as a review_queue row with item_type='memory_elaboration_needed' linked to the current capture_submissions row.",
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
      case 'propose_context_note':
        return await handleProposeContextNote(input, context)
      case 'list_memory_stubs':
        return await handleListMemoryStubs(input, context)
      case 'add_memory_stub':
        return await handleAddMemoryStub(input, context)
      case 'consume_memory_stub':
        return await handleConsumeMemoryStub(input, context)
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
      passage,             // Echo back so ProposalCard can surface what was routed.
      appended_length: passage.length,
      total_length: updated.length,
    },
  }
}

async function handleProposeContextNote(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResultPayload> {
  const entity_name = String(input.entity_name ?? '').trim()
  const rationale = String(input.rationale ?? '')
  const visibility = input.visibility === 'private' ? 'private' : 'shareable'
  const source_label = input.source_label ? String(input.source_label).trim() : null

  // Verbatim-fidelity guard: when the whole submission is the context
  // material, read it back from capture_submissions rather than trusting
  // the model to echo thousands of characters unchanged (the Zaragoza
  // backlog card once carried a 753-char summary of a 6,911-char paste).
  let body = String(input.body ?? '').trim()
  let used_full_submission = false
  if (input.use_full_submission === true && ctx.source_submission_id) {
    const { data: sub, error: subErr } = await ctx.supabase
      .from('capture_submissions')
      .select('input_text')
      .eq('id', ctx.source_submission_id)
      .single()
    if (!subErr && sub?.input_text) {
      body = String(sub.input_text)
      used_full_submission = true
    }
  }

  if (!entity_name) {
    return {
      tool: 'propose_context_note',
      persisted: false,
      rationale,
      data: { error: 'entity_name is empty' },
    }
  }
  if (!body) {
    return {
      tool: 'propose_context_note',
      persisted: false,
      rationale,
      data: { error: 'no context text (body empty and full submission unavailable)' },
    }
  }

  // Resolve the named entity against the user's graph. Layer B lists
  // names, not ids, so resolution happens here: an exact case-insensitive
  // canonical/alias match wins; a single substring candidate is proposed;
  // anything else ships the candidates for the card's picker.
  const { data: rows } = await ctx.supabase
    .from('entities')
    .select('id, type, canonical_name, aliases')
    .eq('user_id', ctx.user_id)
    .or(`canonical_name.ilike.%${entity_name}%,aliases.cs.{${entity_name}}`)
    .limit(6)

  const lower = entity_name.toLowerCase()
  const candidates = (rows ?? []) as Array<{
    id: string
    type: string
    canonical_name: string
    aliases: string[] | null
  }>
  const exact = candidates.find(
    (e) =>
      e.canonical_name.toLowerCase() === lower ||
      (e.aliases ?? []).some((a) => a.toLowerCase() === lower),
  )
  const resolved = exact ?? (candidates.length === 1 ? candidates[0] : null)

  const source_url = (body.match(/https?:\/\/[^\s)]+/) ?? [null])[0]

  return {
    tool: 'propose_context_note',
    persisted: false,
    rationale,
    data: {
      body,
      entity: resolved
        ? { id: resolved.id, type: resolved.type, canonical_name: resolved.canonical_name }
        : null,
      suggested_entity_name: entity_name,
      candidates: candidates.map((e) => ({
        id: e.id,
        type: e.type,
        canonical_name: e.canonical_name,
      })),
      visibility,
      source_label,
      source_url,
      used_full_submission,
    },
    confidence: resolved ? (exact ? 0.95 : 0.7) : 0.4,
  }
}

// ─── Hopper 5b (Slice 7.4) ─────────────────────────────────────────

/**
 * Resolve a name against the user's entity graph — the same semantics as
 * propose_context_note's inline resolution (exact ci canonical/alias match
 * wins; a single substring candidate resolves; otherwise candidates ship
 * back for the model to disambiguate with the user).
 */
async function resolveEntityByName(ctx: ToolContext, name: string) {
  const { data: rows } = await ctx.supabase
    .from('entities')
    .select('id, type, canonical_name, aliases')
    .eq('user_id', ctx.user_id)
    .or(`canonical_name.ilike.%${name}%,aliases.cs.{${name}}`)
    .limit(6)
  const lower = name.toLowerCase()
  const candidates = (rows ?? []) as Array<{
    id: string; type: string; canonical_name: string; aliases: string[] | null
  }>
  const exact = candidates.find(
    (e) =>
      e.canonical_name.toLowerCase() === lower ||
      (e.aliases ?? []).some((a) => a.toLowerCase() === lower),
  )
  return { resolved: exact ?? (candidates.length === 1 ? candidates[0] : null), candidates }
}

async function handleListMemoryStubs(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResultPayload> {
  const entity_name = input.entity_name ? String(input.entity_name).trim() : null

  let hostId: string | null = null
  let hostName: string | null = null
  if (entity_name) {
    const { resolved, candidates } = await resolveEntityByName(ctx, entity_name)
    if (!resolved) {
      return {
        tool: 'list_memory_stubs',
        persisted: false,
        rationale: `Could not resolve "${entity_name}" to a single entity`,
        data: {
          error: 'entity not resolved',
          candidates: candidates.map((e) => ({ id: e.id, type: e.type, canonical_name: e.canonical_name })),
        },
      }
    }
    hostId = resolved.id
    hostName = resolved.canonical_name
  }

  let query = ctx.supabase
    .from('memory_stubs')
    .select('id, body, created_at, host_entity_id, entities!memory_stubs_host_entity_id_fkey(canonical_name)')
    .eq('user_id', ctx.user_id)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(20)
  if (hostId) query = query.eq('host_entity_id', hostId)
  const { data: stubRows, error } = await query
  if (error) {
    return {
      tool: 'list_memory_stubs',
      persisted: false,
      rationale: 'Stub lookup failed',
      data: { error: error.message },
    }
  }

  type StubRow = {
    id: string; body: string; created_at: string; host_entity_id: string
    entities: { canonical_name: string } | { canonical_name: string }[] | null
  }
  const stubs = ((stubRows ?? []) as StubRow[]).map((s) => {
    const host = Array.isArray(s.entities) ? s.entities[0] : s.entities
    return {
      stub_id: s.id,
      body: s.body,
      created_at: s.created_at,
      host_entity_id: s.host_entity_id,
      host_name: host?.canonical_name ?? null,
    }
  })

  return {
    tool: 'list_memory_stubs',
    persisted: false,
    rationale: hostName
      ? `${stubs.length} open jot(s) in ${hostName}'s hopper`
      : `${stubs.length} open jot(s) across the hopper`,
    data: { stubs, host: hostName ? { id: hostId, canonical_name: hostName } : null },
  }
}

async function handleAddMemoryStub(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResultPayload> {
  const entity_name = String(input.entity_name ?? '').trim()
  const body = String(input.body ?? '').trim()
  const rationale = String(input.rationale ?? '')

  if (!entity_name || !body) {
    return {
      tool: 'add_memory_stub',
      persisted: false,
      rationale,
      data: { error: 'entity_name and body are both required' },
    }
  }

  // Resolution only — a stub must never mint an entity. An unresolved
  // name returns candidates so the model can ask the user, not guess.
  const { resolved, candidates } = await resolveEntityByName(ctx, entity_name)
  if (!resolved) {
    return {
      tool: 'add_memory_stub',
      persisted: false,
      rationale,
      data: {
        error: `"${entity_name}" did not resolve to a single existing entity — ask the user which one they mean`,
        candidates: candidates.map((e) => ({ id: e.id, type: e.type, canonical_name: e.canonical_name })),
      },
    }
  }

  const { data: stub, error } = await ctx.supabase
    .from('memory_stubs')
    .insert({ user_id: ctx.user_id, host_entity_id: resolved.id, body, created_by: 'assistant' })
    .select('id, body, status, created_at')
    .single()
  if (error || !stub) {
    return {
      tool: 'add_memory_stub',
      persisted: false,
      rationale,
      data: { error: error?.message ?? 'insert returned no row' },
    }
  }

  return {
    tool: 'add_memory_stub',
    persisted: true,
    rationale,
    data: {
      stub_id: stub.id,
      body: stub.body,
      host: { id: resolved.id, canonical_name: resolved.canonical_name, type: resolved.type },
    },
  }
}

async function handleConsumeMemoryStub(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResultPayload> {
  const stub_id = String(input.stub_id ?? '').trim()
  const memory_id = String(input.memory_id ?? '').trim()
  const rationale = String(input.rationale ?? '')

  if (!stub_id || !memory_id) {
    return {
      tool: 'consume_memory_stub',
      persisted: false,
      rationale,
      data: { error: 'stub_id and memory_id are both required' },
    }
  }

  // Words-are-not-actions backing: consumption requires a REAL recollection.
  // The memory must exist and belong to this user before the stub flips.
  const { data: memory } = await ctx.supabase
    .from('memories')
    .select('id, user_id')
    .eq('id', memory_id)
    .maybeSingle()
  if (!memory || memory.user_id !== ctx.user_id) {
    return {
      tool: 'consume_memory_stub',
      persisted: false,
      rationale,
      data: { error: 'memory_id does not exist for this user — create the recollection first' },
    }
  }

  const { data: stub, error } = await ctx.supabase
    .from('memory_stubs')
    .update({
      status: 'consumed',
      consumed_at: new Date().toISOString(),
      consumed_by_memory_id: memory_id,
    })
    .eq('id', stub_id)
    .eq('user_id', ctx.user_id)
    .eq('status', 'open')
    .select('id, body, status, consumed_at, consumed_by_memory_id, host_entity_id')
    .maybeSingle()
  if (error) {
    return {
      tool: 'consume_memory_stub',
      persisted: false,
      rationale,
      data: { error: error.message },
    }
  }
  if (!stub) {
    return {
      tool: 'consume_memory_stub',
      persisted: false,
      rationale,
      data: { error: 'stub not found, not yours, or already consumed' },
    }
  }

  // Host-link guarantee (2026-07-09 incident): a consumed jot's recollection
  // MUST be linked to the jot's host entity, or it goes invisible from the
  // host's surfaces. Extraction once minted a near-duplicate ("Commaruga")
  // and the write-up vanished from the "Playa Coma Ruga" pin despite a
  // correct consume. Deterministic and idempotent here — this handler is
  // the one gate all three consume paths (seeded, conversational, backstop)
  // pass through. Role via defaultRoleForType: place→'mentioned' (NEVER the
  // load-bearing 'location'), person→'participant'. A link failure must not
  // unwind the consume — it's reported, not thrown.
  let host_link: Record<string, unknown> = { linked: false }
  try {
    const link = await linkEntityToMemory(ctx.supabase, ctx.user_id, memory_id, stub.host_entity_id)
    host_link = {
      linked: true,
      already_linked: link.already_linked,
      role: link.role,
      entity: link.entity.canonical_name,
    }
  } catch (e) {
    host_link = { linked: false, error: e instanceof Error ? e.message : String(e) }
  }

  return {
    tool: 'consume_memory_stub',
    persisted: true,
    rationale,
    data: {
      stub_id: stub.id,
      body: stub.body,
      status: stub.status,
      consumed_by_memory_id: stub.consumed_by_memory_id,
      host_link,
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
