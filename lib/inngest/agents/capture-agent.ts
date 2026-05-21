import { inngest } from '@/lib/inngest/client'

// The Capture Agent listens to memory/ingested, which is emitted by the
// interview API after a successful INSERT to memories. Its role in Step 5
// is to log the event and serve as the fan-out point for Step 6 agents
// (Tagger + Entity). The INSERT itself happens synchronously in the API
// route; in a production multi-tenant deployment this would move here,
// running under a restricted DB role with INSERT-only on memories.
export const captureAgent = inngest.createFunction(
  {
    id: 'capture-agent',
    name: 'Capture Agent',
    triggers: [{ event: 'memory/ingested' }],
  },
  async ({ event, step }) => {
    await step.run('log-ingestion', async () => {
      console.log('[capture-agent] memory ingested', {
        memory_id: event.data.memory_id,
        user_id: event.data.user_id,
      })
    })

    // Step 6: Tagger and Entity agents listen to memory/ingested directly.
    // Inngest delivers the event to all registered listeners in parallel.

    return {
      status: 'received',
      agent: 'capture-agent',
      memory_id: event.data.memory_id,
    }
  },
)
