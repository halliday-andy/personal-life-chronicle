import { inngest } from '@/lib/inngest/client'

export const synthesisAgentOnInvalidated = inngest.createFunction(
  { id: 'synthesis-agent-on-invalidated', name: 'Synthesis Agent (invalidated)', triggers: [{ event: 'synthesis/invalidated' }] },
  async ({ event, step }) => {
    await step.run('log', async () => {
      console.log('[synthesis-agent] stub invoked (invalidated)', event.data)
    })
    return { status: 'stub', agent: 'synthesis-agent' }
  },
)

export const synthesisAgentOnPhase0 = inngest.createFunction(
  { id: 'synthesis-agent-on-phase0', name: 'Synthesis Agent (phase0)', triggers: [{ event: 'phase0/stage.completed' }] },
  async ({ event, step }) => {
    await step.run('log', async () => {
      console.log('[synthesis-agent] stub invoked (phase0)', event.data)
    })
    return { status: 'stub', agent: 'synthesis-agent' }
  },
)

export const synthesisAgentCron = inngest.createFunction(
  { id: 'synthesis-agent-cron', name: 'Synthesis Agent (cron)', triggers: [{ cron: '0 2 * * *' }] },
  async ({ step }) => {
    await step.run('log', async () => {
      console.log('[synthesis-agent] stub invoked (cron)')
    })
    return { status: 'stub', agent: 'synthesis-agent' }
  },
)
