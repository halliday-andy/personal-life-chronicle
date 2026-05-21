import { inngest } from '@/lib/inngest/client'

export const plannerAgent = inngest.createFunction(
  { id: 'planner-agent', name: 'Planner Agent', triggers: [{ cron: '0 3 * * *' }] },
  async ({ step }) => {
    await step.run('log', async () => {
      console.log('[planner-agent] stub invoked (cron)')
    })
    return { status: 'stub', agent: 'planner-agent' }
  },
)
