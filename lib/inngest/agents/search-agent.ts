import { inngest } from '@/lib/inngest/client'

export const searchAgent = inngest.createFunction(
  { id: 'search-agent', name: 'Search Agent', triggers: [{ event: 'search/query.submitted' }] },
  async ({ event, step }) => {
    await step.run('log', async () => {
      console.log('[search-agent] stub invoked', event.data)
    })
    return { status: 'stub', agent: 'search-agent' }
  },
)
