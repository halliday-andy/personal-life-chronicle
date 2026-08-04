/**
 * Attach each trip's DESTINATION pin type (R22 add-on, 2026-08-03).
 *
 * `tripKindLabel` needs to know whether a trip ended somewhere the owner
 * lived, so a one-way arrival at a home can read "Relocation" instead of
 * "Road trip". `get_trips` returns the destination's id and name but not
 * its type.
 *
 * Why here and not in `get_trips`: adding a column to that function means
 * DROP + CREATE (its RETURNS TABLE changes), which is a destructive-gate
 * migration under CLAUDE.md and needs Andy's approval. This is the same
 * answer without the gate — and, importantly, ONE implementation for both
 * of `get_trips`' callers (the journey page and GET /api/trips) rather
 * than the same join re-typed at two boundaries, which is exactly how two
 * surfaces start disagreeing about what a journey was.
 *
 * When the next gated migration goes to Andy anyway, folding
 * `destination_type_code` into `get_trips` is the better home and this
 * helper should retire.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** The slice of a get_trips row this needs. */
interface TripLike {
  destination_relationship_id: string
}

type RelRow = {
  id: string
  relationship_types: { code: string } | { code: string }[] | null
}

export async function withDestinationTypes<T extends TripLike>(
  admin: SupabaseClient,
  trips: T[],
): Promise<(T & { destination_type_code: string | null })[]> {
  if (trips.length === 0) return []

  const ids = Array.from(new Set(trips.map((t) => t.destination_relationship_id).filter(Boolean)))
  const { data, error } = await admin
    .from('relationships')
    .select('id, relationship_types!inner(code)')
    .in('id', ids)

  // A failed lookup degrades to "unknown", never to a wrong label:
  // `tripKindLabel` falls back to the subtype when the type is null, so
  // the worst case is the pre-R22 rendering rather than a trip that
  // silently stops being a relocation... or wrongly becomes one.
  const byId = new Map<string, string>()
  if (!error) {
    for (const r of (data ?? []) as RelRow[]) {
      const rt = Array.isArray(r.relationship_types) ? r.relationship_types[0] : r.relationship_types
      if (rt?.code) byId.set(r.id, rt.code)
    }
  }

  return trips.map((t) => ({
    ...t,
    destination_type_code: byId.get(t.destination_relationship_id) ?? null,
  }))
}
