import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import {
  captureAgent,
  taggerAgent,
  entityAgent,
  plannerAgent,
  synthesisAgentOnInvalidated,
  synthesisAgentOnPhase0,
  synthesisAgentCron,
  timelineAgent,
  searchAgent,
} from '@/lib/inngest'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    captureAgent,
    taggerAgent,
    entityAgent,
    plannerAgent,
    synthesisAgentOnInvalidated,
    synthesisAgentOnPhase0,
    synthesisAgentCron,
    timelineAgent,
    searchAgent,
  ],
})
