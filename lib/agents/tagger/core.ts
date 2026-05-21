/**
 * Tagger Agent — core function.
 *
 * Classifies a memory's text against the dimensions taxonomy (10 axes:
 * life_stage, topic_domain, phenomenon_type, relationship_role,
 * event_category, environment, emotional_tone, expressive_form,
 * world_context, artifact_type).
 *
 * Used by:
 *   - lib/inngest/agents/tagger-agent.ts (Inngest listener on memory/ingested)
 *   - lib/agents/tagger/tool.ts          (Anthropic tool for the orchestrator)
 *
 * Reads `dimensions` + `dimension_types` to know what taxonomy is available
 * for this user. Writes to `memory_dimensions` and `assumption_log` when
 * persist=true. Returns the proposals either way.
 */

import type Anthropic from '@anthropic-ai/sdk'
import { DEFAULT_AGENT_MODEL, getAnthropicClient } from '@/lib/agents/shared/anthropic'
import { getAgentSupabase, logAssumption } from '@/lib/agents/shared/db'
import type { AgentCoreInput } from '@/lib/agents/shared/types'

export interface TaggerProposal {
  dimension_id: string
  dimension_code: string | null
  dimension_name: string
  dimension_type_code: string
  weight: number
  is_primary: boolean
  rationale: string
}

export interface TaggerResult {
  proposals: TaggerProposal[]
  sensitive_detected: boolean
  model_version: string
}

interface DimensionRow {
  id: string
  code: string | null
  name: string
  is_sensitive: boolean
  type_id: number
  parent_id: string | null
}

interface DimensionTypeRow {
  id: number
  code: string
  name: string
  description: string | null
}

// In-process cache of the dimensions taxonomy. Invalidated on agent process
// restart. Adequate for MVP; longer-term we'll add a versioned schema hash.
let _taxonomyCache: {
  fetchedAt: number
  types: DimensionTypeRow[]
  dimensions: DimensionRow[]
} | null = null
const TAXONOMY_CACHE_MS = 5 * 60 * 1000

async function loadTaxonomy(
  supabase: ReturnType<typeof getAgentSupabase>
): Promise<{ types: DimensionTypeRow[]; dimensions: DimensionRow[] }> {
  if (_taxonomyCache && Date.now() - _taxonomyCache.fetchedAt < TAXONOMY_CACHE_MS) {
    return { types: _taxonomyCache.types, dimensions: _taxonomyCache.dimensions }
  }
  const [typesRes, dimsRes] = await Promise.all([
    supabase.from('dimension_types').select('id, code, name, description').order('sort_order'),
    supabase.from('dimensions').select('id, code, name, is_sensitive, type_id, parent_id'),
  ])
  if (typesRes.error) throw typesRes.error
  if (dimsRes.error) throw dimsRes.error
  _taxonomyCache = {
    fetchedAt: Date.now(),
    types: typesRes.data as DimensionTypeRow[],
    dimensions: dimsRes.data as DimensionRow[],
  }
  return { types: _taxonomyCache.types, dimensions: _taxonomyCache.dimensions }
}

function buildClassifyTool(taxonomy: {
  types: DimensionTypeRow[]
  dimensions: DimensionRow[]
}): Anthropic.Tool {
  // The taxonomy is presented to Claude inline (codes + names) so the model
  // can return code references rather than full IDs. The handler maps codes
  // back to UUIDs against the loaded dimensions table.
  const dimensionsByType = taxonomy.types.map((t) => {
    const opts = taxonomy.dimensions
      .filter((d) => d.type_id === t.id)
      .map((d) => `      - ${d.code ?? d.name}: ${d.name}${d.is_sensitive ? ' (sensitive)' : ''}`)
      .join('\n')
    return `  ${t.code} — ${t.name}\n${opts}`
  })
  const taxonomyDoc = dimensionsByType.join('\n\n')

  return {
    name: 'submit_dimensions',
    description:
      'Submit the dimension classifications for the memory. Choose only dimensions that genuinely apply. Prefer 2–6 high-quality tags over many weak ones. Exactly one tag may be marked primary across all types.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tags: {
          type: 'array',
          description: `Each tag references a dimension by its code (or name when no code) and the dimension type code.\n\nAvailable taxonomy:\n\n${taxonomyDoc}`,
          items: {
            type: 'object',
            properties: {
              type_code: { type: 'string', description: 'The dimension_types.code value' },
              dimension_ref: {
                type: 'string',
                description: 'The dimension code or name within that type',
              },
              weight: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                description: 'Relevance 0–1; 1.0 means strongly central to the memory',
              },
              is_primary: {
                type: 'boolean',
                description: 'True for the single most defining tag across all types (optional)',
              },
              rationale: {
                type: 'string',
                description: 'One sentence on why this tag fits',
              },
            },
            required: ['type_code', 'dimension_ref', 'weight', 'rationale'],
          },
        },
      },
      required: ['tags'],
    },
  }
}

const SYSTEM_PROMPT = `You are the Tagger sub-agent of the Life Chronicle system.

Your job: classify a single memory across the chronicle's dimension taxonomy. You will be shown the taxonomy as a reference. Use the submit_dimensions tool to return your classifications.

Guidelines:
- Choose only dimensions that genuinely apply. Quality over quantity.
- Aim for 2–6 well-fitting tags total across all types.
- Use weight conservatively. 1.0 = unmistakably central. 0.5 = clearly present but not the focus.
- Set is_primary=true for at most ONE tag across all types — the single most defining dimension of this memory. May be omitted entirely if no single dimension dominates.
- A short reflective sentence is preferred over speculation. If the memory text is too vague to classify, return zero or one tags.
- Never invent dimensions. Use only what is in the taxonomy.`

function resolveDimensionRef(
  taxonomy: { types: DimensionTypeRow[]; dimensions: DimensionRow[] },
  type_code: string,
  dimension_ref: string
): DimensionRow | null {
  const type = taxonomy.types.find((t) => t.code === type_code)
  if (!type) return null
  const refLower = dimension_ref.toLowerCase().trim()
  const inType = taxonomy.dimensions.filter((d) => d.type_id === type.id)
  return (
    inType.find((d) => d.code?.toLowerCase() === refLower) ??
    inType.find((d) => d.name.toLowerCase() === refLower) ??
    null
  )
}

export async function runTagger(input: AgentCoreInput): Promise<TaggerResult> {
  const supabase = getAgentSupabase(input.supabase)
  const anthropic = input.anthropic ?? getAnthropicClient()
  const persist = input.persist ?? false

  const taxonomy = await loadTaxonomy(supabase)
  const tool = buildClassifyTool(taxonomy)

  const message = await anthropic.messages.create({
    model: DEFAULT_AGENT_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'submit_dimensions' },
    messages: [{ role: 'user', content: `Memory to classify:\n\n"""\n${input.text}\n"""` }],
  })

  const toolBlock = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_dimensions'
  )

  const rawTags: Array<{
    type_code: string
    dimension_ref: string
    weight: number
    is_primary?: boolean
    rationale: string
  }> = toolBlock ? ((toolBlock.input as { tags?: typeof rawTags }).tags ?? []) : []

  // Map back to dimension UUIDs and drop any we can't resolve.
  const proposals: TaggerProposal[] = []
  let primaryAlreadyAssigned = false
  for (const tag of rawTags) {
    const dim = resolveDimensionRef(taxonomy, tag.type_code, tag.dimension_ref)
    if (!dim) continue
    const type = taxonomy.types.find((t) => t.id === dim.type_id)!
    const is_primary = !!tag.is_primary && !primaryAlreadyAssigned
    if (is_primary) primaryAlreadyAssigned = true
    proposals.push({
      dimension_id: dim.id,
      dimension_code: dim.code,
      dimension_name: dim.name,
      dimension_type_code: type.code,
      weight: Math.max(0, Math.min(1, tag.weight)),
      is_primary,
      rationale: tag.rationale,
    })
  }

  const sensitive_detected = proposals.some((p) => {
    const dim = taxonomy.dimensions.find((d) => d.id === p.dimension_id)
    return dim?.is_sensitive ?? false
  })

  // Persistence — only when memory_id is present.
  if (persist && input.memory_id && proposals.length > 0) {
    const rows = proposals.map((p) => ({
      memory_id: input.memory_id!,
      dimension_id: p.dimension_id,
      weight: p.weight,
      is_primary: p.is_primary,
      tagged_by: 'agent:tagger',
    }))
    const { error: dimErr } = await supabase
      .from('memory_dimensions')
      .upsert(rows, { onConflict: 'memory_id,dimension_id' })
    if (dimErr) {
      console.error('[tagger] memory_dimensions upsert failed', dimErr)
    }

    // One assumption_log row summarising the whole run.
    await logAssumption(supabase, {
      user_id: input.user_id,
      agent: 'tagger_agent',
      assumption_type: 'dimension_assignment',
      memory_id: input.memory_id,
      summary: `Tagged with ${proposals.length} dimensions: ${proposals
        .map((p) => p.dimension_name)
        .join(', ')}`,
      decision_json: {
        input: input.text.slice(0, 500),
        decision: `Assigned dimensions: ${proposals.map((p) => p.dimension_code ?? p.dimension_name).join(', ')}`,
        confidence:
          proposals.length === 0 ? 0 : proposals.reduce((s, p) => s + p.weight, 0) / proposals.length,
        reasoning: proposals.map((p) => `${p.dimension_name}: ${p.rationale}`).join('\n'),
        proposals,
        sensitive_detected,
      },
      confidence:
        proposals.length === 0 ? 0 : proposals.reduce((s, p) => s + p.weight, 0) / proposals.length,
      model_version: DEFAULT_AGENT_MODEL,
    })
  }

  return {
    proposals,
    sensitive_detected,
    model_version: DEFAULT_AGENT_MODEL,
  }
}
