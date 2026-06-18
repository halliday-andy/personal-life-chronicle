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

  /** When resolution_action='created_with_merge_proposal': the existing
   *  entity this one may duplicate, so the UI can offer link-vs-create
   *  in-flow (task #39), and the review_queue row backing the proposal. */
  merge_candidate?: { entity_id: string; canonical_name: string } | null
  review_queue_id?: string | null
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

// Common institutional/geographic abbreviations, expanded at token level
// before comparison. Conservative set: every entry is unambiguous in a
// place/organization name. (Task #38; the live failure was AFB ↔
// "Air Force Base" silently duplicating Lockbourne, 2026-06-12.)
const TOKEN_EXPANSIONS: Record<string, string[]> = {
  afb: ['air', 'force', 'base'],
  raf: ['royal', 'air', 'force'],
  st: ['saint'],
  mt: ['mount'],
  ft: ['fort'],
  univ: ['university'],
  intl: ['international'],
  natl: ['national'],
}

function expandedTokens(name: string): string[] {
  return normaliseName(name)
    .replace(/[.,'()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((t) => TOKEN_EXPANSIONS[t] ?? [t])
}

// Jaro-Winkler similarity (0..1) — catches single-name typos like
// "Lapidus" vs "Lapides" that containment can never see.
function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1
  const len1 = s1.length
  const len2 = s2.length
  if (!len1 || !len2) return 0
  const matchWindow = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1)
  const m1: boolean[] = new Array(len1).fill(false)
  const m2: boolean[] = new Array(len2).fill(false)
  let matches = 0
  for (let i = 0; i < len1; i++) {
    const lo = Math.max(0, i - matchWindow)
    const hi = Math.min(len2 - 1, i + matchWindow)
    for (let j = lo; j <= hi; j++) {
      if (!m2[j] && s1[i] === s2[j]) {
        m1[i] = true
        m2[j] = true
        matches++
        break
      }
    }
  }
  if (matches === 0) return 0
  let transpositions = 0
  let k = 0
  for (let i = 0; i < len1; i++) {
    if (!m1[i]) continue
    while (!m2[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }
  const jaro =
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
  // Winkler prefix boost (max 4 chars)
  let prefix = 0
  for (let i = 0; i < Math.min(4, len1, len2) && s1[i] === s2[i]; i++) prefix++
  return jaro + prefix * 0.1 * (1 - jaro)
}

/**
 * Name-match score between an extracted name and a candidate, 0..1.
 * Bands consumed by resolution: ≥0.95 auto-link; 0.7–0.95 create with a
 * merge proposal (owner confirms); <0.7 treated as no match.
 *
 * Exported for direct verification (scripts/verify-entity-matching.mjs).
 */
export function scoreNameMatch(a: string, b: string): number {
  const na = normaliseName(a)
  const nb = normaliseName(b)
  if (na === nb) return 1.0

  let score = 0

  // Abbreviation-expanded equality: "Lockbourne AFB" ≡ "Lockbourne Air
  // Force Base". Just below the auto-link band stays for safety until
  // the expansion table has more mileage — lands as a merge proposal.
  const ta = expandedTokens(a)
  const tb = expandedTokens(b)
  if (ta.length && ta.join(' ') === tb.join(' ')) return 0.97

  // Containment ("Nancy" ⊂ "Nancy Halliday"), guarded so micro-names
  // can't false-positive ("Leo" ⊂ "Leola Lapidus" must NOT match):
  // the contained name needs ≥4 chars and a word boundary.
  if (na.length >= 4 || nb.length >= 4) {
    const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na]
    const boundary = new RegExp(`(^| )${shorter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`)
    if (shorter.length >= 4 && boundary.test(longer)) {
      score = Math.max(score, 0.7 + 0.2 * (shorter.length / longer.length))
    }
  }

  // Token-subset on expanded tokens: every token of one name appears in
  // the other ("lockbourne air force base" ⊂ "lockbourne air force base
  // columbus ohio"). Needs ≥2 tokens on the smaller side so a lone
  // common word can't bridge unrelated names.
  const [small, large] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  if (small.length >= 2 && small.every((t) => large.includes(t))) {
    score = Math.max(score, 0.75 + 0.15 * (small.length / large.length))
  }

  // Whole-string edit similarity for typos ("leola lapidus" vs "leola
  // lapides"). High bar; scales into the merge-proposal band only.
  const jw = jaroWinkler(na, nb)
  if (jw >= 0.92) {
    score = Math.max(score, 0.7 + ((jw - 0.92) / 0.08) * 0.2)
  }

  return score
}

// Institutions blur the place/organization line — the extraction prompt
// itself types military bases either way ("Loring Air Force Base →
// organization … also a place"), and a 2026-06-12 replay showed the same
// Lockbourne text extracting as 'place' one run and 'organization' the
// next. Resolution must search both types or the type roll of the dice
// silently duplicates the entity.
//
// KEEP IN SYNC with merge_entities() (supabase/migrations/
// 20260617130000_merge_entities_place_org.sql): the set of types treated as
// mergeable peers here must match the set that function is willing to merge
// across, or resolution will queue merge proposals the DB then refuses to
// execute. Today both define that set as {place, organization}.
function candidateTypes(type: EntityType): EntityType[] {
  return type === 'place' || type === 'organization' ? ['place', 'organization'] : [type]
}

// Exported for direct verification with fixture entities (task #38).
export async function resolveAgainstExisting(
  supabase: ReturnType<typeof getAgentSupabase>,
  user_id: string,
  type: EntityType,
  extracted_name: string,
): Promise<{ match: ExistingEntity | null; confidence: number; rationale: string }> {
  const { data, error } = await supabase
    .from('entities')
    .select('id, type, canonical_name, aliases')
    .eq('user_id', user_id)
    .in('type', candidateTypes(type))
  if (error) {
    return { match: null, confidence: 0, rationale: `lookup error: ${error.message}` }
  }
  const candidates = (data ?? []) as ExistingEntity[]
  let best: { entity: ExistingEntity; confidence: number; via: string } | null = null
  for (const e of candidates) {
    const canonScore = scoreNameMatch(extracted_name, e.canonical_name)
    if (canonScore > 0 && (!best || canonScore > best.confidence)) {
      best = { entity: e, confidence: canonScore, via: `canonical_name "${e.canonical_name}"` }
    }
    for (const alias of e.aliases ?? []) {
      const aliasScore = scoreNameMatch(extracted_name, alias)
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
    let merge_candidate: { entity_id: string; canonical_name: string } | null = null
    let review_queue_id: string | null = null

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
            const rqRes = await supabase.from('review_queue').insert({
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
            }).select('id').single()
            review_queue_id = rqRes.data?.id ?? null
            action = 'created_with_merge_proposal'
            match_confidence = confidence
            match_details = `${rationale}; queued for merge review`
            merge_candidate = { entity_id: match.id, canonical_name: match.canonical_name }
          }
        } else {
          // Preview mode: don't write anything, just describe what we'd do.
          action = 'created_with_merge_proposal'
          match_confidence = confidence
          match_details = `${rationale}; would queue merge review with ${match.canonical_name}`
          merge_candidate = { entity_id: match.id, canonical_name: match.canonical_name }
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
      merge_candidate,
      review_queue_id,
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
