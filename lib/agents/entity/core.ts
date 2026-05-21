/**
 * Entity Agent — core function.
 *
 * Two passes:
 *   1. Extraction. Claude reads the memory text and returns named entities
 *      it identified (people, places, organizations, vehicles, event_series).
 *   2. Resolution. For each extracted entity, look up existing user-scoped
 *      entities by canonical_name + aliases (case-insensitive). Decide:
 *
 *      - High-confidence match  → link via memory_entities
 *      - Medium-confidence (70–95%) → create new entity AND queue an
 *        `entity_merge_proposal` for the user to confirm or reject
 *      - No match → create new entity, link via memory_entities
 *
 * Used by:
 *   - lib/inngest/agents/entity-agent.ts (Inngest listener on memory/ingested)
 *   - lib/agents/entity/tool.ts          (Anthropic tool for the orchestrator)
 *
 * Writes (when persist=true): entities, memory_entities, review_queue,
 * assumption_log. Returns proposals either way.
 */

import type Anthropic from '@anthropic-ai/sdk'
import { DEFAULT_AGENT_MODEL, getAnthropicClient } from '@/lib/agents/shared/anthropic'
import { getAgentSupabase, logAssumption } from '@/lib/agents/shared/db'
import type { AgentCoreInput } from '@/lib/agents/shared/types'

type EntityType = 'person' | 'place' | 'organization' | 'vehicle' | 'event_series' | 'concept' | 'artifact'

const ROLE_DEFAULT = 'participant'

export type EntityResolutionAction =
  | 'linked_existing'
  | 'created_new'
  | 'created_with_merge_proposal'
  | 'skipped'

export interface EntityProposal {
  /** What Claude extracted from the text. */
  extracted_name: string
  type: EntityType
  role: string // 'subject' | 'participant' | 'witness' | 'location' | 'object' | 'antagonist'
  context: string // one-line context: what this entity is doing in this memory
  extraction_confidence: number // 0–1, how certain Claude was

  /** Resolution outcome (set after pass 2). */
  resolved_entity_id: string | null
  resolution_action: EntityResolutionAction
  match_confidence: number // 0–1
  match_details: string
}

export interface EntityResult {
  proposals: EntityProposal[]
  new_entity_count: number
  merge_proposals_created: number
  model_version: string
}

interface ExistingEntity {
  id: string
  type: string
  canonical_name: string
  aliases: string[] | null
}

const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'submit_entities',
  description:
    'Submit the named entities you identified in the memory. Include people by name, named places (cities, addresses, schools, etc.), named organizations (employers, schools, etc.), and named vehicles or event series if present. Skip pronouns, generic references ("my mother" without a name), and vague locations ("the city").',
  input_schema: {
    type: 'object' as const,
    properties: {
      entities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The name as it appears in the memory' },
            type: {
              type: 'string',
              enum: ['person', 'place', 'organization', 'vehicle', 'event_series', 'concept', 'artifact'],
            },
            role: {
              type: 'string',
              enum: ['subject', 'participant', 'witness', 'location', 'object', 'antagonist'],
              description:
                "How this entity figures in the memory. 'participant' is the default; use 'location' for places, 'subject' for the memory's central figure, 'witness' for observers.",
            },
            context: {
              type: 'string',
              description: 'One sentence on how the entity appears in this memory',
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'How certain you are this is a real named entity worth recording',
            },
          },
          required: ['name', 'type', 'role', 'context', 'confidence'],
        },
      },
    },
    required: ['entities'],
  },
}

const SYSTEM_PROMPT = `You are the Entity sub-agent of the Life Chronicle system.

Your job: extract the named entities that appear in a single memory and submit them via the submit_entities tool.

Guidelines:
- Extract only named entities. Skip pronouns, common nouns, and vague references.
  - "My sister Nancy" → extract Nancy (person)
  - "My sister" alone → skip (no name)
  - "Madrid" → extract (place)
  - "the city" → skip
  - "Loring Air Force Base" → extract (organization, since it's a named institution; also a place)
- For ambiguous role (person who is the central figure vs. mentioned in passing), use 'subject' for the memory's main figure and 'participant' for others.
- Set confidence below 0.8 only when the name is genuinely uncertain (e.g. "I think his name was John?").
- If the memory contains no named entities, return an empty array.
- Do not invent entities. Do not extrapolate.`

function normaliseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function nameMatch(a: string, b: string): number {
  const na = normaliseName(a)
  const nb = normaliseName(b)
  if (na === nb) return 1.0
  // Containment: "Nancy" inside "Nancy Halliday" or vice versa
  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length)
    const longer = Math.max(na.length, nb.length)
    return 0.7 + 0.2 * (shorter / longer) // 0.7–0.9 range
  }
  return 0
}

async function resolveAgainstExisting(
  supabase: ReturnType<typeof getAgentSupabase>,
  user_id: string,
  type: EntityType,
  extracted_name: string,
): Promise<{ match: ExistingEntity | null; confidence: number; rationale: string }> {
  const { data, error } = await supabase
    .from('entities')
    .select('id, type, canonical_name, aliases')
    .eq('user_id', user_id)
    .eq('type', type)
  if (error) {
    return { match: null, confidence: 0, rationale: `lookup error: ${error.message}` }
  }
  const candidates = (data ?? []) as ExistingEntity[]
  let best: { entity: ExistingEntity; confidence: number; via: string } | null = null
  for (const e of candidates) {
    const canonScore = nameMatch(extracted_name, e.canonical_name)
    if (canonScore > 0 && (!best || canonScore > best.confidence)) {
      best = { entity: e, confidence: canonScore, via: `canonical_name "${e.canonical_name}"` }
    }
    for (const alias of e.aliases ?? []) {
      const aliasScore = nameMatch(extracted_name, alias)
      if (aliasScore > 0 && (!best || aliasScore > best.confidence)) {
        best = { entity: e, confidence: aliasScore, via: `alias "${alias}"` }
      }
    }
  }
  if (!best) {
    return { match: null, confidence: 0, rationale: 'no candidates matched' }
  }
  return { match: best.entity, confidence: best.confidence, rationale: `matched on ${best.via}` }
}

export async function runEntity(input: AgentCoreInput): Promise<EntityResult> {
  const supabase = getAgentSupabase(input.supabase)
  const anthropic = input.anthropic ?? getAnthropicClient()
  const persist = input.persist ?? false

  // Pass 1: extraction
  const message = await anthropic.messages.create({
    model: DEFAULT_AGENT_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'submit_entities' },
    messages: [{ role: 'user', content: `Memory:\n\n"""\n${input.text}\n"""` }],
  })

  const toolBlock = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_entities',
  )
  const extracted: Array<{
    name: string
    type: EntityType
    role: string
    context: string
    confidence: number
  }> = toolBlock ? ((toolBlock.input as { entities?: typeof extracted }).entities ?? []) : []

  // Pass 2: resolution. Run sequentially to avoid duplicate inserts when the
  // same name appears twice in the same memory.
  const proposals: EntityProposal[] = []
  const justInsertedThisRun = new Map<string, string>() // normalised "type:name" → entity_id

  for (const ent of extracted) {
    const key = `${ent.type}:${normaliseName(ent.name)}`
    let resolved_entity_id: string | null = null
    let action: EntityResolutionAction = 'skipped'
    let match_confidence = 0
    let match_details = ''

    // First check entities created earlier in this same run.
    const seenId = justInsertedThisRun.get(key)
    if (seenId) {
      resolved_entity_id = seenId
      action = 'linked_existing'
      match_confidence = 1.0
      match_details = 'matched entity created earlier in this run'
    } else {
      const { match, confidence, rationale } = await resolveAgainstExisting(
        supabase,
        input.user_id,
        ent.type,
        ent.name,
      )

      if (match && confidence >= 0.95) {
        resolved_entity_id = match.id
        action = 'linked_existing'
        match_confidence = confidence
        match_details = rationale
      } else if (match && confidence >= 0.7) {
        // Ambiguous — create a new entity AND propose a merge for the owner.
        if (persist) {
          const insertRes = await supabase
            .from('entities')
            .insert({
              user_id: input.user_id,
              type: ent.type,
              canonical_name: ent.name.trim(),
            })
            .select('id')
            .single()
          if (insertRes.error || !insertRes.data) {
            console.error('[entity] insert failed', insertRes.error)
          } else {
            const newId: string = insertRes.data.id
            resolved_entity_id = newId
            justInsertedThisRun.set(key, newId)
            await supabase.from('review_queue').insert({
              user_id: input.user_id,
              item_type: 'entity_merge_proposal',
              item_id: newId,
              context_json: {
                proposed_primary: match.id,
                proposed_primary_name: match.canonical_name,
                duplicate_id: newId,
                duplicate_name: ent.name.trim(),
                type: ent.type,
                match_confidence: confidence,
                rationale,
              },
              priority: 3,
            })
            action = 'created_with_merge_proposal'
            match_confidence = confidence
            match_details = `${rationale}; queued for merge review`
          }
        } else {
          // Preview mode: don't write anything, just describe what we'd do.
          action = 'created_with_merge_proposal'
          match_confidence = confidence
          match_details = `${rationale}; would queue merge review with ${match.canonical_name}`
        }
      } else {
        // No meaningful match — create new.
        if (persist) {
          const insertRes = await supabase
            .from('entities')
            .insert({
              user_id: input.user_id,
              type: ent.type,
              canonical_name: ent.name.trim(),
            })
            .select('id')
            .single()
          if (insertRes.error || !insertRes.data) {
            console.error('[entity] insert failed', insertRes.error)
          } else {
            const newId: string = insertRes.data.id
            resolved_entity_id = newId
            justInsertedThisRun.set(key, newId)
            action = 'created_new'
            match_confidence = 0
            match_details = 'no existing match'

            // Tap-to-confirm pattern (parallel to face recognition's "Is this
            // Alice?"). For new person entities, queue a confirmation card
            // for the owner so they can verify the captured name, edit
            // spelling, add aliases, or soft-delete a spurious extraction.
            // Surfaced in the Review Queue UI (Step 6g).
            if (ent.type === 'person') {
              const { error: confErr } = await supabase.from('review_queue').insert({
                user_id: input.user_id,
                item_type: 'entity_confirmation_needed',
                item_id: newId,
                context_json: {
                  extracted_name: ent.name.trim(),
                  type: ent.type,
                  role: ent.role,
                  source_memory_id: input.memory_id ?? null,
                  context_quote: ent.context,
                  extraction_confidence: ent.confidence,
                },
                priority: 3,
              })
              if (confErr) {
                console.warn('[entity] confirmation queue insert failed', confErr)
              }
            }
          }
        } else {
          action = 'created_new'
          match_confidence = 0
          match_details = 'would create new entity (no existing match)'
        }
      }
    }

    // Link via memory_entities when we have a memory_id and an entity_id.
    if (persist && input.memory_id && resolved_entity_id) {
      const { error: linkErr } = await supabase
        .from('memory_entities')
        .upsert(
          {
            memory_id: input.memory_id,
            entity_id: resolved_entity_id,
            role: ent.role || ROLE_DEFAULT,
            is_primary: ent.role === 'subject',
            confidence: ent.confidence,
          },
          { onConflict: 'memory_id,entity_id,role' },
        )
      if (linkErr) {
        console.error('[entity] memory_entities upsert failed', linkErr)
      }
    }

    // One assumption_log row per extraction decision.
    if (persist) {
      await logAssumption(supabase, {
        user_id: input.user_id,
        agent: 'entity_agent',
        assumption_type:
          action === 'linked_existing' ? 'entity_disambiguation' : 'other',
        memory_id: input.memory_id ?? null,
        entity_id: resolved_entity_id,
        summary: `${ent.type}: ${ent.name.trim()} — ${action.replace(/_/g, ' ')} (${(match_confidence * 100).toFixed(0)}%)`,
        decision_json: {
          input: ent.name,
          decision: action,
          confidence: match_confidence,
          reasoning: match_details,
          extraction_context: ent.context,
          extraction_confidence: ent.confidence,
          role: ent.role,
          type: ent.type,
        },
        confidence: match_confidence,
        model_version: DEFAULT_AGENT_MODEL,
      })
    }

    proposals.push({
      extracted_name: ent.name.trim(),
      type: ent.type,
      role: ent.role || ROLE_DEFAULT,
      context: ent.context,
      extraction_confidence: ent.confidence,
      resolved_entity_id,
      resolution_action: action,
      match_confidence,
      match_details,
    })
  }

  return {
    proposals,
    new_entity_count: proposals.filter(
      (p) => p.resolution_action === 'created_new' || p.resolution_action === 'created_with_merge_proposal',
    ).length,
    merge_proposals_created: proposals.filter(
      (p) => p.resolution_action === 'created_with_merge_proposal',
    ).length,
    model_version: DEFAULT_AGENT_MODEL,
  }
}
