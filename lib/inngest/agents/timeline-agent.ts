import { inngest } from '@/lib/inngest/client'

export const timelineAgent = inngest.createFunction(
  { id: 'timeline-agent', name: 'Timeline Agent', triggers: [{ event: 'memory/ingested' }] },
  async ({ event, step }) => {
    await step.run('log', async () => {
      console.log('[timeline-agent] stub invoked', event.data)
    })
    return { status: 'stub', agent: 'timeline-agent' }
  },
)
