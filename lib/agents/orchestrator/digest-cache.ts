/**
 * Layer B cache wrapper.
 *
 * In Step 6b the orchestrator regenerated the per-user chronicle digest
 * on every submission. Step 6c moves that to a durable cache: the
 * digest text + hash + stats are stored in user_chronicle_digests and
 * read on demand. Regeneration happens lazily when:
 *   - No row exists for the user (first call)
 *   - is_stale=true (event-driven invalidation by the chronicle-digester
 *     Inngest function listening on memory/ingested + entity/merged)
 *   - generated_at is older than MAX_AGE_MS (time-based safety net)
 *   - generation_version is below CURRENT_GENERATION_VERSION (forces
 *     re-render of all caches after a prompt-format change)
 *
 * The digest_hash field stays stable when the chronicle hasn't changed
 * meaningfully — which gives Anthropic prompt caching a stable key for
 * Layer B across consecutive submissions.
 *
 * Reference: documentation/feature_capture_assistant.md §4.5,
 *            supabase/migrations/20260521130453_user_chronicle_digests.sql
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { buildUserDigest, type ChronicleDigest } from './digest'

const MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes — matches Anthropic prompt cache TTL
const CURRENT_GENERATION_VERSION = 1

interface DigestRow {
  user_id: string
  digest_text: string
  digest_hash: string
  generated_at: string
  generation_version: number
  stats: ChronicleDigest['stats']
  is_stale: boolean
}

function isFresh(row: DigestRow): boolean {
  if (row.is_stale) return false
  if (row.generation_version < CURRENT_GENERATION_VERSION) return false
  const age = Date.now() - new Date(row.generated_at).getTime()
  return age < MAX_AGE_MS
}

/**
 * Returns the current chronicle digest for the user, reading the cache
 * if fresh and regenerating otherwise. Always returns a non-null result.
 */
export async function getChronicleDigest(
  user_id: string,
  supabase: SupabaseClient,
): Promise<ChronicleDigest> {
  const { data: row } = await supabase
    .from('user_chronicle_digests')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle()

  if (row && isFresh(row as DigestRow)) {
    const cached = row as DigestRow
    return {
      text: cached.digest_text,
      hash: cached.digest_hash,
      stats: cached.stats,
    }
  }

  // Stale, missing, or version-bumped — regenerate.
  return regenerateDigest(user_id, supabase)
}

/**
 * Force regeneration: builds a fresh digest and upserts it. Returns the
 * fresh digest. Called by getChronicleDigest on a cache miss/stale,
 * and by the chronicle-digester cron job for proactive refresh.
 */
export async function regenerateDigest(
  user_id: string,
  supabase: SupabaseClient,
): Promise<ChronicleDigest> {
  const digest = await buildUserDigest(user_id, supabase)

  const { error } = await supabase
    .from('user_chronicle_digests')
    .upsert({
      user_id,
      digest_text: digest.text,
      digest_hash: digest.hash,
      generated_at: new Date().toISOString(),
      generation_version: CURRENT_GENERATION_VERSION,
      stats: digest.stats,
      is_stale: false,
    })

  if (error) {
    // Persistence failure is non-fatal — return the freshly-built digest
    // so the caller (orchestrator) can proceed. Next call will retry.
    console.warn('[digest-cache] upsert failed (returning fresh digest anyway)', error.message)
  }

  return digest
}

/**
 * Mark the user's cached digest as stale so the next read regenerates.
 * Called by the chronicle-digester Inngest listener on chronicle-change
 * events. Safe no-op if no row exists yet (the next read will build
 * fresh from scratch anyway).
 */
export async function markDigestStale(
  user_id: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase
    .from('user_chronicle_digests')
    .update({ is_stale: true })
    .eq('user_id', user_id)

  if (error) {
    console.warn('[digest-cache] markDigestStale failed', error.message)
  }
}
