import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The "self" entity — the person entity that represents the chronicle
 * owner. It is the SUBJECT of all of the user's first-person
 * relationships: residences ("lived_at" a place), and later
 * "married_to / parent_of / worked_at" person/org links. The deployed
 * schema is built around this: `residency_timeline.subject_id` is read
 * AS `person_entity_id`.
 *
 * Conceptual inception is REGISTRATION, not first pin placement — the
 * self entity is created when the account is created (see the
 * on-user-created edge function), using the name captured at sign-up.
 * This helper is the single source of truth for that creation, reused
 * by: the registration hook, the dev backfill script, and the globe
 * API as an idempotent safety net.
 *
 * Identified by `type='person'` + `metadata.is_self = true`.
 */

export interface SelfEntity {
  id: string
  canonical_name: string
}

/** Find the user's self entity, or create it if missing. Idempotent. */
export async function ensureSelfEntity(
  admin: SupabaseClient,
  userId: string,
  displayName: string,
): Promise<SelfEntity> {
  const existing = await findSelfEntity(admin, userId)
  if (existing) return existing

  const { data, error } = await admin
    .from('entities')
    .insert({
      user_id: userId,
      type: 'person',
      canonical_name: displayName,
      metadata: { is_self: true },
    })
    .select('id, canonical_name')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create self entity: ${error?.message ?? 'unknown'}`)
  }
  return data
}

/** Look up the user's self entity. Returns null if none exists yet. */
export async function findSelfEntity(
  admin: SupabaseClient,
  userId: string,
): Promise<SelfEntity | null> {
  const { data, error } = await admin
    .from('entities')
    .select('id, canonical_name')
    .eq('user_id', userId)
    .eq('type', 'person')
    .eq('metadata->>is_self', 'true')
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to look up self entity: ${error.message}`)
  return data ?? null
}
