/**
 * Tagger Agent — Anthropic tool definition + handler.
 *
 * This is the synchronous, inline path used by the Orchestrator Agent
 * (Step 6b). When the orchestrator wants to know the dimensions for a
 * piece of text it's about to ingest, it calls this tool. The handler
 * delegates to the same `runTagger` core function used by the Inngest
 * listener — they share one implementation.
 *
 * Default behaviour is persist=false (return proposals only, don't write).
 * The orchestrator decides whether the user has confirmed the result before
 * triggering a persistence run.
 */

import type Anthropic from '@anthropic-ai/sdk'
import { runTagger, type TaggerResult } from './core'

export const TAGGER_TOOL_DEFINITION: Anthropic.Tool = {
  name: 'classify_dimensions',
  description:
    "Classify a piece of memory text against the chronicle's dimension taxonomy. Returns proposed dimension tags with weights and reasoning. By default does NOT persist — use persist=true only when the user has confirmed the classification.",
  input_schema: {
    type: 'object' as const,
    properties: {
      text: {
        type: 'string',
        description: 'The memory text to classify.',
      },
      memory_id: {
        type: 'string',
        description: 'Optional UUID of an existing memory. Required when persist=true.',
      },
      persist: {
        type: 'boolean',
        description:
          'When true, write the resulting memory_dimensions and assumption_log rows. Default false.',
      },
    },
    required: ['text'],
  },
}

export interface TaggerToolHandlerContext {
  user_id: string
}

/**
 * Execute the tool call. Returns a JSON-serialisable result that the
 * orchestrator can include in its follow-up Anthropic call as a tool_result.
 */
export async function executeTaggerTool(
  input: { text: string; memory_id?: string; persist?: boolean },
  context: TaggerToolHandlerContext,
): Promise<TaggerResult> {
  return runTagger({
    text: input.text,
    user_id: context.user_id,
    memory_id: input.memory_id,
    persist: input.persist === true,
  })
}
