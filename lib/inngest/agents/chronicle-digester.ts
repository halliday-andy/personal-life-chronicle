import { inngest } from '@/lib/inngest/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { markDigestStale, regenerateDigest } from '@/lib/agents/orchestrator/digest-cache'

/**
 * Chronicle Digester — Step 6c.
 *
 * Keeps user_chronicle_digests fresh by two mechanisms:
 *   1. Event-driven invalidation: when memory/ingested or entity/merged
 *      fires, flip is_stale=true on that user's row. The next orchestrator
 *      call regenerates lazily via getChronicleDigest.
 *   2. Periodic sweep (hourly cron): scan for stale rows and regenerate
 *      them proactively so they're warm before the user's next submission.
 *
 * "Planner Agent territory" in the spec; isolated here as a standalone
 * function for clarity. Can be folded into a Planner Agent module later
 * if Planner becomes a multi-purpose function.
 *
 * Reference: documentation/feature_capture_assistant.md §4.5.
 */

// Event listener — memory/ingested
export const chronicleDigesterOnMemoryIngested = inngest.createFunction(
  {
    id: 'chronicle-digester-on-memory-ingested',
    name: 'Chronicle Digester (memory/ingested)',
    triggers: [{ event: 'memory/ingested' }],
  },
  async ({ event, step }) => {
    const { user_id } = event.data as { user_id: string }
    await step.run('mark-stale', async () => {
      const supabase = createAdminClient()
      await markDigestStale(user_id, supabase)
    })
    return { status: 'marked_stale', user_id }
  },
)

// Event listener — entity/merged
export const chronicleDigesterOnEntityMerged = inngest.createFunction(
  {
    id: 'chronicle-digester-on-entity-merged',
    name: 'Chronicle Digester (entity/merged)',
    triggers: [{ event: 'entity/merged' }],
  },
  async ({ event, step }) => {
    const { user_id } = event.data as { user_id: string }
    await step.run('mark-stale', async () => {
      const supabase = createAdminClient()
      await markDigestStale(user_id, supabase)
    })
    return { status: 'marked_stale', user_id }
  },
)

// Periodic sweep — hourly cron
export const chronicleDigesterSweep = inngest.createFunction(
  {
    id: 'chronicle-digester-sweep',
    name: 'Chronicle Digester (hourly sweep)',
    triggers: [{ cron: '0 * * * *' }],
  },
  async ({ step }) => {
    const stalUserIds = await step.run('find-stale', async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from('user_chronicle_digests')
        .select('user_id')
        .eq('is_stale', true)
        .order('generated_at', { ascending: true })
        .limit(50)
      if (error) {
        console.error('[chronicle-digester] sweep query failed', error)
        return []
      }
      return (data ?? []).map((r) => r.user_id as string)
    })

    if (stalUserIds.length === 0) {
      return { status: 'no_stale_digests', regenerated: 0 }
    }

    // Regenerate sequentially in the sweep step. Digest build is just
    // SQL queries (no LLM) so this is cheap; sequential keeps DB load
    // predictable.
    const regenerated = await step.run('regenerate-batch', async () => {
      const supabase = createAdminClient()
      let count = 0
      for (const user_id of stalUserIds) {
        try {
          await regenerateDigest(user_id, supabase)
          count++
        } catch (err) {
          console.error(`[chronicle-digester] regenerate failed for ${user_id}`, err)
        }
      }
      return count
    })

    return { status: 'regenerated', regenerated, candidates: stalUserIds.length }
  },
)
