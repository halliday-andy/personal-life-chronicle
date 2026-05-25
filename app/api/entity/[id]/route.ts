/**
 * PATCH /api/entity/[id] — Rename an entity and/or manage aliases.
 *
 * Body: { canonical_name?: string, aliases?: string[] }
 *
 * When canonical_name changes, the previous canonical_name is appended to
 * aliases (deduplicated, case-insensitive). This preserves backward
 * resolvability — past memory_entities references and Layer B context
 * snippets that used the old name continue to match against the entity.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: entity, error: loadErr } = await admin
    .from('entities')
    .select('id, user_id, canonical_name, aliases')
    .eq('id', params.id)
    .single()
  if (loadErr || !entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
  }
  if (entity.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as { canonical_name?: string; aliases?: string[] }
  const updates: Record<string, unknown> = {}

  const existingAliases: string[] = Array.isArray(entity.aliases) ? entity.aliases : []
  let nextAliases = existingAliases.slice()

  if (typeof body.canonical_name === 'string') {
    const newName = body.canonical_name.trim()
    if (!newName) {
      return NextResponse.json({ error: 'canonical_name cannot be empty' }, { status: 400 })
    }
    if (newName !== entity.canonical_name) {
      updates.canonical_name = newName
      // Stash the old name as an alias (case-insensitive de-dupe).
      const lower = entity.canonical_name.toLowerCase()
      if (!nextAliases.some((a) => a.toLowerCase() === lower)) {
        nextAliases = [...nextAliases, entity.canonical_name]
      }
    }
  }

  if (Array.isArray(body.aliases)) {
    // Replace aliases wholesale, dedupe case-insensitively.
    const seen = new Set<string>()
    nextAliases = []
    for (const a of body.aliases) {
      const trimmed = a.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      nextAliases.push(trimmed)
    }
  }

  if (nextAliases.length !== existingAliases.length ||
      nextAliases.some((a, i) => a !== existingAliases[i])) {
    updates.aliases = nextAliases.length > 0 ? nextAliases : null
  }

  updates.updated_at = new Date().toISOString()

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'No fields supplied or no changes' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('entities')
    .update(updates)
    .eq('id', params.id)
    .select('id, type, canonical_name, aliases')
    .single()
  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update', detail: error?.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
