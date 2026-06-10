/**
 * Residence proximity classification (Step 7 Slice 4b).
 *
 * The DB function nearest_residence returns the nearest OTHER residence
 * and its distance in metres (PostGIS ST_Distance on geography). This
 * module turns that raw distance into a gentle, non-blocking hint:
 *
 *   - "returning"   — within ~1.5 km of a place lived before
 *   - "intra_metro" — a different home within ~25 km (a local move)
 *   - null          — far enough to be a genuinely new place
 *
 * Thresholds are heuristics, intentionally conservative; the hint never
 * blocks a save, it just helps the user notice a likely return or move.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ProximityHint {
  kind: 'returning' | 'intra_metro'
  name: string
  distanceKm: number
}

export const RETURNING_M = 1500
export const METRO_M = 25000

interface NearestRow {
  name: string
  distance_m: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function classifyProximity(nearest: NearestRow | null | undefined): ProximityHint | null {
  if (!nearest || typeof nearest.distance_m !== 'number') return null
  const d = nearest.distance_m
  if (d < RETURNING_M) return { kind: 'returning', name: nearest.name, distanceKm: round1(d / 1000) }
  if (d < METRO_M) return { kind: 'intra_metro', name: nearest.name, distanceKm: round1(d / 1000) }
  return null
}

/**
 * Probe the nearest other residence and classify it. `admin` is a
 * Supabase client with rpc(); excludeRel skips a pin from its own probe.
 */
export async function proximityHint(
  admin: SupabaseClient,
  userId: string,
  lng: number,
  lat: number,
  excludeRel: string | null,
): Promise<ProximityHint | null> {
  const { data } = await admin.rpc('nearest_residence', {
    p_user_id: userId, p_lng: lng, p_lat: lat, p_exclude_rel: excludeRel,
  })
  const row = (Array.isArray(data) ? data[0] : data) as NearestRow | undefined
  return classifyProximity(row)
}
