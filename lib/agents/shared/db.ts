import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AssumptionRecord } from './types'

/**
 * Lazily-constructed shared admin client for agent runs that don't supply one.
 * Created per invocation since Supabase clients are lightweight.
 */
export function getAgentSupabase(injected?: SupabaseClient): SupabaseClient {
  return injected ?? createAdminClient()
}

/**
 * Write a single assumption_log row. Every inference an agent makes —
 * dimension assignment, entity match, new entity creation, merge proposal —
 * must produce one of these. This is the audit trail backing the chronicle's
 * trust promises.
 */
export async function logAssumption(
  supabase: SupabaseClient,
  record: AssumptionRecord
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('assumption_log')
    .insert({
      user_id: record.user_id,
      agent: record.agent,
      assumption_type: record.assumption_type,
      memory_id: record.memory_id ?? null,
      entity_id: record.entity_id ?? null,
      summary: record.summary,
      decision_json: record.decision_json,
      confidence: record.confidence ?? record.decision_json.confidence ?? 1.0,
      model_version: record.model_version ?? null,
      prompt_hash: record.prompt_hash ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[agents] assumption_log insert failed', error, record.summary)
    return null
  }
  return data
}
