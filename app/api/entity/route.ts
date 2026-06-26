/**
 * GET /api/entity — List the user's entities, optionally filtered.
 *
 * Query params
 *   type     optional — filter to a single entity type ('person', 'place', etc.)
 *   q        optional — case-insensitive substring match on canonical_name or aliases
 *   exclude  optional — single entity_id to omit from results (used by the merge
 *            target picker to avoid offering the source as its own target)
 *   limit    1..500, default 200
 *
 * Returns: { items: [{ id, type, canonical_name, aliases }, ...] }
 *
 * Used by the /review page's merge-target picker. Could also back
 * future entity-search UI. Sorted alphabetically by canonical_name for
 * predictable typeahead order.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500

type EntityRow = {
  id: string
  type: string
  canonical_name: string
  aliases: string[] | null
}

export async function GET(request: NextRequest) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const exclude = url.searchParams.get('exclude')
  const limitRaw = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT)
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), MAX_LIMIT)
    : DEFAULT_LIMIT

  const admin = createAdminClient()
  let query = admin
    .from('entities')
    .select('id, type, canonical_name, aliases')
    .eq('user_id', user.id)
    .order('canonical_name', { ascending: true })
    // When filtering by q, scan the full set (the substring + alias match is a
    // client-side JS filter below); applying `limit` to the DB fetch here would
    // only consider the first N alphabetically, so e.g. "zaragoza" never appears
    // behind a small typeahead limit. Without q, the requested limit is exact.
    .limit(q ? MAX_LIMIT : limit)

  if (type) query = query.eq('type', type)
  if (exclude) query = query.neq('id', exclude)

  const { data, error } = await query
  if (error) {
    return NextResponse.json(
      { error: 'Failed to list entities', detail: error.message },
      { status: 500 },
    )
  }

  let rows = (data ?? []) as unknown as EntityRow[]

  // Substring filter is client-side after the typed query because aliases
  // is a TEXT[] and a flexible match needs OR over canonical_name + each
  // alias. The full filter is cheap for our scale (<<1k entities/user).
  if (q) {
    rows = rows.filter((e) => {
      if (e.canonical_name.toLowerCase().includes(q)) return true
      if (e.aliases) {
        return e.aliases.some((a) => a.toLowerCase().includes(q))
      }
      return false
    })
  }

  // Apply the requested limit AFTER filtering, so q narrows the full set.
  return NextResponse.json({ items: rows.slice(0, limit) })
}
