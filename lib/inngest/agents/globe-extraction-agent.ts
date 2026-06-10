import { inngest } from '@/lib/inngest/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { runGlobeExtraction } from '@/lib/globe/extraction'

/**
 * Globe Extraction Agent — Step 7 Slice 2.
 *
 * Listens on globe/pin.saved (emitted when a residence pin's
 * recollection is created or edited) and runs the modal-text extraction
 * in lib/globe/extraction.ts. Async by design: pin save never waits on
 * Claude; the detail card just shows the facts on its next open.
 */
export const globeExtractionAgent = inngest.createFunction(
  {
    id: 'globe-extraction-agent',
    name: 'Globe Extraction Agent (globe/pin.saved)',
    triggers: [{ event: 'globe/pin.saved' }],
  },
  async ({ event, step }) => {
    const { user_id, relationship_id, memory_id } = event.data
    const result = await step.run('extract', async () =>
      runGlobeExtraction(createAdminClient(), {
        userId: user_id,
        relationshipId: relationship_id,
        memoryId: memory_id,
      }),
    )
    return { ...result, relationship_id }
  },
)
