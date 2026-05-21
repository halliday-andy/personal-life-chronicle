/**
 * Entity Agent — Anthropic tool definition + handler.
 *
 * Synchronous inline path used by the Orchestrator (Step 6b). When the
 * orchestrator wants to know the named entities present in a piece of
 * text — and how each would resolve against the user's existing entity
 * graph — it calls this tool. The handler delegates to `runEntity`, the
 * same core function used by the Inngest listener.
 *
 * Default behaviour is persist=false. Use persist=true only when the user
 * has confirmed they want the entities written to the graph.
 */

import type Anthropic from '@anthropic-ai/sdk'
import { runEntity, type EntityResult } from './core'

export const ENTITY_TOOL_DEFINITION: Anthropic.Tool = {
  name: 'extract_entities',
  description:
    "Extract named entities (people, places, organizations, vehicles, event series) from a piece of memory text and resolve each against the user's existing entity graph. Returns proposals with resolution outcomes (linked to existing entity, created new, or flagged for merge review). By default does NOT persist — use persist=true only after user confirmation.",
  input_schema: {
    type: 'object' as const,
    properties: {
      text: { type: 'string', description: 'The memory text to extract entities from.' },
      memory_id: {
        type: 'string',
        description: 'Optional UUID of an existing memory. Required when persist=true.',
      },
      persist: {
        type: 'boolean',
        description:
          'When true, write entities, memory_entities, review_queue, and assumption_log rows. Default false.',
      },
    },
    required: ['text'],
  },
}

export interface EntityToolHandlerContext {
  user_id: string
}

export async function executeEntityTool(
  input: { text: string; memory_id?: string; persist?: boolean },
  context: EntityToolHandlerContext,
): Promise<EntityResult> {
  return runEntity({
    text: input.text,
    user_id: context.user_id,
    memory_id: input.memory_id,
    persist: input.persist === true,
  })
}
