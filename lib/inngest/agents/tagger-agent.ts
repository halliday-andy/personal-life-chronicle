import { inngest } from '@/lib/inngest/client'
import { runTagger } from '@/lib/agents/tagger/core'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Tagger Agent — Inngest listener.
 *
 * Listens to `memory/ingested`. Loads the memory's content_raw, user_id,
 * and metadata; if metadata.skip_async_fanout is true (set by the
 * orchestrator on draft memories), this run is a no-op — the orchestrator
 * already populated proposal cards in its inline preview, and persistence
 * waits for the user's Accept in 6f's /finalize endpoint, which re-emits
 * memory/ingested without the skip flag.
 *
 * The shared core function is also exported as an Anthropic tool from
 * `lib/agents/tagger/tool.ts` for synchronous use by the Orchestrator.
 * Dual-mode pattern: one core, two callers.
 */
export const taggerAgent = inngest.createFunction(
  { id: 'tagger-agent', name: 'Tagger Agent', triggers: [{ event: 'memory/ingested' }] },
  async ({ event, step }) => {
    const { memory_id, user_id } = event.data as { memory_id: string; user_id: string }

    const loaded = await step.run('load-memory', async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from('memories')
        .select('content_raw, metadata, is_draft')
        .eq('id', memory_id)
        .single()
      if (error || !data) {
        throw new Error(`memory ${memory_id} not found: ${error?.message ?? 'no row'}`)
      }
      return data
    })

    // Dedupe gate: orchestrator-created drafts carry skip_async_fanout=true.
    // The orchestrator's inline preview already produced tag proposals for
    // the user; nothing to persist until they Accept.
    const skip =
      (loaded.metadata as { skip_async_fanout?: boolean } | null)?.skip_async_fanout === true
    if (skip) {
      return { status: 'skipped_async_fanout', memory_id }
    }

    const result = await step.run('classify', async () =>
      runTagger({ text: loaded.content_raw as string, user_id, memory_id, persist: true }),
    )

    return {
      status: 'classified',
      memory_id,
      tag_count: result.proposals.length,
      sensitive_detected: result.sensitive_detected,
    }
  },
)
