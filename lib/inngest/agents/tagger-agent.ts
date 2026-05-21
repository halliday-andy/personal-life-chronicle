import { inngest } from '@/lib/inngest/client'
import { runTagger } from '@/lib/agents/tagger/core'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Tagger Agent — Inngest listener.
 *
 * Listens to `memory/ingested`. Loads the memory's content_raw and user_id
 * from the database, then calls the shared core function with persist=true.
 *
 * The same core function is also exported as an Anthropic tool from
 * `lib/agents/tagger/tool.ts` for synchronous use by the Orchestrator
 * (Step 6b). This is the dual-mode pattern: one core, two callers.
 */
export const taggerAgent = inngest.createFunction(
  { id: 'tagger-agent', name: 'Tagger Agent', triggers: [{ event: 'memory/ingested' }] },
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

    const result = await step.run('classify', async () =>
      runTagger({ text, user_id, memory_id, persist: true }),
    )

    return {
      status: 'classified',
      memory_id,
      tag_count: result.proposals.length,
      sensitive_detected: result.sensitive_detected,
    }
  },
)
