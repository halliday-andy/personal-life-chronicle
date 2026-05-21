import { inngest } from '@/lib/inngest/client'
import { runEntity } from '@/lib/agents/entity/core'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Entity Agent — Inngest listener.
 *
 * Listens to `memory/ingested`. Loads the memory's content_raw and user_id,
 * then calls the shared core function with persist=true.
 *
 * Shares its core with `lib/agents/entity/tool.ts` (used inline by the
 * Orchestrator in Step 6b). Dual-mode pattern: one core, two callers.
 */
export const entityAgent = inngest.createFunction(
  { id: 'entity-agent', name: 'Entity Agent', triggers: [{ event: 'memory/ingested' }] },
  async ({ event, step }) => {
    const { memory_id, user_id } = event.data as { memory_id: string; user_id: string }

    const text = await step.run('load-memory', async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from('memories')
        .select('content_raw')
        .eq('id', memory_id)
        .single()
      if (error || !data) {
        throw new Error(`memory ${memory_id} not found: ${error?.message ?? 'no row'}`)
      }
      return data.content_raw as string
    })

    const result = await step.run('extract-and-resolve', async () =>
      runEntity({ text, user_id, memory_id, persist: true }),
    )

    return {
      status: 'processed',
      memory_id,
      entity_count: result.proposals.length,
      new_entities: result.new_entity_count,
      merge_proposals: result.merge_proposals_created,
    }
  },
)
