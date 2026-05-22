/**
 * Shared types for the dual-mode agent pattern.
 *
 * Every sub-agent (Tagger, Entity, future Temporal, future Source Document)
 * has a `core` function that takes one of these inputs and returns its own
 * structured output. The core is wrapped in two modes:
 *
 *   1. Inngest function — listens to memory/ingested, runs with persist=true
 *   2. Synchronous tool — called by the orchestrator, may run with persist=false
 *      to preview before committing
 */

import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AgentName =
  | 'capture_agent'
  | 'tagger_agent'
  | 'entity_agent'
  | 'synthesis_agent'
  | 'planner_agent'
  | 'temporal_agent'
  | 'search_agent'

export type AssumptionType =
  | 'entity_disambiguation'
  | 'dimension_assignment'
  | 'temporal_inference'
  | 'entity_merge'
  | 'synthesis_source'
  | 'geocoding_resolution'
  | 'orchestrator_reasoning'
  | 'orchestrator_dispatch'
  | 'globe_modal_extraction'
  | 'other'

export interface AgentCoreInput {
  /** Verbatim memory text (or any text the agent should analyse). */
  text: string
  /** Owner of the memory. Required for assumption_log + scoping. */
  user_id: string
  /** Optional memory id. Required only when persist=true and writes need it. */
  memory_id?: string
  /**
   * When true, the core function writes results to the database
   * (memory_dimensions, memory_entities, entities, review_queue) and
   * to assumption_log. When false, it returns proposals only — used by
   * the orchestrator for inline preview before user approval.
   */
  persist?: boolean
  /** Pre-injected clients for testability and shared connections. */
  supabase?: SupabaseClient
  anthropic?: Anthropic
}

export interface AssumptionRecord {
  user_id: string
  agent: AgentName
  assumption_type: AssumptionType
  memory_id?: string | null
  entity_id?: string | null
  summary: string
  decision_json: {
    input: string
    decision: string
    confidence: number
    reasoning: string
    alternatives_considered?: unknown[]
    [key: string]: unknown
  }
  confidence?: number
  model_version?: string
  prompt_hash?: string
}
