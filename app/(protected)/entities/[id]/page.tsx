/**
 * /entities/[id] — the Entity View (Slice 6.2).
 *
 * The home for an entity's CONTEXT — third-person background notes about it
 * (distinct from first-person recollections, which live in the Raw Vault).
 * Shows: the entity's identity, its context notes (shareable + a visually
 * separate owner-only private section), and the recollections that mention it
 * (as links out — the recollection lives with its memory/pin, never here).
 *
 * Reachable from /entities (every entity) and from a globe pin (places).
 * Add-context lands in 6.3; entity chips from /memories in 6.4.
 */

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import EntityView, { type ContextNote, type MentionRecollection } from '@/components/EntityView'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function EntityViewPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  if (!UUID_RE.test(params.id)) notFound()

  const admin = createAdminClient()

  const { data: entity } = await admin
    .from('entities')
    .select('id, type, canonical_name, aliases, description, user_id')
    .eq('id', params.id)
    .maybeSingle()
  if (!entity || entity.user_id !== user.id) notFound()

  // Context notes (newest first). Ownership scoped here at the app layer;
  // RLS arrives with Step 13 Access Cards.
  const { data: notesRaw } = await admin
    .from('entity_context_notes')
    .select('id, body, source_label, source_url, created_by, visibility, created_at')
    .eq('entity_id', entity.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  const notes = (notesRaw ?? []) as ContextNote[]

  // Recollections that mention this entity (links out; never hosted here).
  const { data: linkRows } = await admin
    .from('memory_entities')
    .select('memory_id, memories!inner(id, content_raw, created_at, user_id)')
    .eq('entity_id', entity.id)
    .eq('memories.user_id', user.id)
    .limit(50)
  type MemRow = { id: string; content_raw: string | null; created_at: string }
  const seen = new Set<string>()
  const recollections: MentionRecollection[] = []
  for (const row of (linkRows ?? []) as { memories: MemRow | MemRow[] | null }[]) {
    const m = Array.isArray(row.memories) ? row.memories[0] : row.memories
    if (!m || seen.has(m.id)) continue
    seen.add(m.id)
    recollections.push({ id: m.id, excerpt: (m.content_raw ?? '').slice(0, 200), created_at: m.created_at })
  }
  recollections.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  return (
    <EntityView
      entity={{ id: entity.id, type: entity.type, canonical_name: entity.canonical_name, aliases: entity.aliases ?? [], description: entity.description ?? null }}
      notes={notes}
      recollections={recollections}
    />
  )
}
