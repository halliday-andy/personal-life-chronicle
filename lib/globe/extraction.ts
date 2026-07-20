/**
 * Globe modal extraction (Step 7 Slice 2) — turns a residence pin's
 * free-text recollection into structured fields.
 *
 * Spec: documentation/feature_residential_globe_onboarding.md §6.3.
 * The verbatim text in memories.content_raw is never touched (Raw
 * Vault). Output lands in relationships.metadata — residence_type and
 * move_reason at the top level (the period-summary SQL in the initial
 * schema reads metadata->>'move_reason'), the full payload under
 * metadata.globe_extraction — and every run is recorded in
 * assumption_log (assumption_type='globe_modal_extraction').
 *
 * mentioned_people / mentioned_organisations stay in the payload as
 * stubs for now: globe memories don't yet flow through memory/ingested,
 * so Entity Agent resolution is a later slice.
 */

import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_AGENT_MODEL, getAnthropicClient } from '@/lib/agents/shared/anthropic'
import { readCurrentFacts, readOwnerEditedFields, resolveStickyFacts } from './sticky-facts'

export interface GlobeExtraction {
  residence_type: string | null
  residence_detail: string | null
  household_composition: string | null
  move_reason: string | null
  mentioned_people: string[]
  mentioned_organisations: string[]
  rough_temporal_range: string | null
  confidence: number
}

export type GlobeExtractionResult =
  | { status: 'extracted'; extraction: GlobeExtraction }
  | { status: 'skipped'; reason: string }

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: 'submit_residence_extraction',
  description:
    'Submit the structured fields you could confidently identify in the residence recollection. Use null for anything the text does not support — do not guess.',
  input_schema: {
    type: 'object' as const,
    properties: {
      residence_type: {
        type: ['string', 'null'],
        enum: ['apartment', 'house', 'dormitory', 'military_base', 'rental', 'family_home', 'other', null],
      },
      residence_detail: {
        type: ['string', 'null'],
        description: 'One short phrase describing the dwelling, if the text gives one (e.g. "small third-floor walk-up")',
      },
      household_composition: {
        type: ['string', 'null'],
        description: 'Who lived there with them, as a short phrase (e.g. "parents and two brothers")',
      },
      move_reason: {
        type: ['string', 'null'],
        // 'relationship' + 'seasonal_work' added 2026-07-09 (Andy's Alp Hof
        // Lodge QA): moving in with a partner short of marriage, and a
        // season's work, are real reasons the old vocabulary forced to
        // 'unknown' — which the Journey deliberately renders as silence.
        enum: [
          'career_relocation', 'military_posting', 'marriage', 'relationship',
          'divorce_separation', 'education', 'family_care', 'financial',
          'retirement', 'health', 'displacement', 'adventure', 'seasonal_work',
          'unknown', null,
        ],
      },
      mentioned_people: {
        type: 'array',
        items: { type: 'string' },
        description:
          'People in the text: names ("Lorraine"), AND first-person PRIMARY-relationship references kept verbatim — "my father", "my mother", "my wife", "my husband", "my partner", "my brother", "my sister", "my son", "my daughter", "my grandmother", "my grandfather". These core relations recur across a whole chronicle and resolve via the user\'s aliases. Do NOT include vague or non-primary references ("my friend", "a colleague", "my roommate", "the neighbor") or bare pronouns.',
      },
      mentioned_organisations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Named organisations — schools, employers, institutions',
      },
      rough_temporal_range: {
        type: ['string', 'null'],
        description: 'Any time clue, verbatim-ish ("right after college", "the year my father died")',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Overall confidence in this extraction',
      },
    },
    required: ['mentioned_people', 'mentioned_organisations', 'confidence'],
  },
}

const SYSTEM_PROMPT = `You are the residence-extraction sub-agent of the Life Chronicle system.

The user described a place where they lived, in their own words. Extract only what the text confidently supports and submit it via the submit_residence_extraction tool. Missing or uncertain fields are null. Do not infer beyond the text; do not invent people, dates, or reasons.`

export async function runGlobeExtraction(
  admin: SupabaseClient,
  args: { userId: string; relationshipId: string; memoryId: string },
  anthropic?: Anthropic,
): Promise<GlobeExtractionResult> {
  const { userId, relationshipId, memoryId } = args

  const { data: rel, error: relErr } = await admin
    .from('relationships')
    .select('id, user_id, metadata')
    .eq('id', relationshipId)
    .maybeSingle()
  if (relErr || !rel) return { status: 'skipped', reason: 'relationship not found' }
  if (rel.user_id !== userId) return { status: 'skipped', reason: 'ownership mismatch' }

  const { data: mem } = await admin
    .from('memories')
    .select('id, content_raw')
    .eq('id', memoryId)
    .eq('user_id', userId)
    .maybeSingle()
  const text = mem?.content_raw?.trim()
  if (!text) return { status: 'skipped', reason: 'no recollection text' }

  const client = anthropic ?? getAnthropicClient()
  const message = await client.messages.create({
    model: DEFAULT_AGENT_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: 'tool', name: 'submit_residence_extraction' },
    messages: [{ role: 'user', content: `Residence recollection:\n\n"""\n${text}\n"""` }],
  })

  const toolBlock = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_residence_extraction',
  )
  if (!toolBlock) return { status: 'skipped', reason: 'model returned no extraction' }
  const raw = toolBlock.input as Partial<GlobeExtraction>

  // The model occasionally returns a phrase field as a stringified JSON
  // array ('["Lorraine Barber"]', seen 2026-07-09) — the fact chips would
  // render the brackets. Coerce to a human phrase: comma-separated with a
  // final "and", stripping any leading "and " the model tucked into items
  // (the 2026-07-10 Mt. Snow re-run produced "… and and roommates …").
  const asPhrase = (v: string | null | undefined): string | null => {
    const s = (v ?? '').trim()
    if (!s) return null
    if (s.startsWith('[') && s.endsWith(']')) {
      try {
        const arr = JSON.parse(s)
        if (Array.isArray(arr)) {
          const items = arr
            .filter((x): x is string => typeof x === 'string')
            .map((x) => x.trim().replace(/^and\s+/i, ''))
            .filter(Boolean)
          if (items.length === 0) return null
          if (items.length === 1) return items[0]
          return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
        }
      } catch { /* fall through to the raw string */ }
    }
    return s
  }

  const extraction: GlobeExtraction = {
    residence_type: raw.residence_type ?? null,
    residence_detail: asPhrase(raw.residence_detail),
    household_composition: asPhrase(raw.household_composition),
    move_reason: raw.move_reason ?? null,
    mentioned_people: raw.mentioned_people ?? [],
    mentioned_organisations: raw.mentioned_organisations ?? [],
    rough_temporal_range: raw.rough_temporal_range ?? null,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.5,
  }

  // Re-running refines the previous extraction — but OWNER-EDITED facts are
  // final: resolveStickyFacts keeps any field the owner has touched
  // (metadata.facts_owner_edited) and takes the fresh extraction for the rest.
  // relationships.metadata stays MERGE-only, so facts_owner_edited survives.
  // The raw model output is still what we log below (an honest audit of the run).
  const currentMeta = (rel.metadata ?? {}) as Record<string, unknown>
  const sticky = resolveStickyFacts({
    current: readCurrentFacts(currentMeta),
    extracted: {
      residence_type: extraction.residence_type,
      residence_detail: extraction.residence_detail,
      household_composition: extraction.household_composition,
      move_reason: extraction.move_reason,
    },
    ownerEdited: readOwnerEditedFields(currentMeta),
  })
  const mergedMetadata = {
    ...currentMeta,
    residence_type: sticky.residence_type,
    move_reason: sticky.move_reason,
    globe_extraction: {
      ...extraction,
      // Owner-edited facts win over the fresh extraction in the payload too.
      residence_type: sticky.residence_type,
      residence_detail: sticky.residence_detail,
      household_composition: sticky.household_composition,
      move_reason: sticky.move_reason,
      memory_id: memoryId,
      model: DEFAULT_AGENT_MODEL,
      extracted_at: new Date().toISOString(),
    },
  }
  const { error: updErr } = await admin
    .from('relationships')
    .update({ metadata: mergedMetadata })
    .eq('id', relationshipId)
  if (updErr) throw new Error(`relationship metadata update failed: ${updErr.message}`)

  const { error: logErr } = await admin.from('assumption_log').insert({
    user_id: userId,
    agent: 'capture_agent', // extraction runs as a capture-class agent
    assumption_type: 'globe_modal_extraction',
    memory_id: memoryId,
    decision_json: { relationship_id: relationshipId, extraction },
    summary: `Globe modal extraction for residence ${relationshipId.slice(0, 8)}: type=${extraction.residence_type ?? '–'}, move=${extraction.move_reason ?? '–'}`,
    confidence: extraction.confidence,
  })
  if (logErr) throw new Error(`assumption_log insert failed: ${logErr.message}`)

  return { status: 'extracted', extraction }
}
