/**
 * /entities — Entity management view (Task #68).
 *
 * Surfaces every entity in the user's chronicle, grouped by type
 * (Person, Place, Organization, Artifact, Event Series), with the
 * actions needed to manage the entity graph without dropping to SQL:
 *   - Rename (and stash old name as alias)
 *   - Change type (e.g. Berkeley person → organization)
 *   - Merge into another same-type entity (calls merge_entities RPC)
 *   - Delete (CASCADE-aware)
 *   - View memories where this entity is mentioned
 *
 * Closes the gap that's been forcing manual SQL for entity hygiene
 * since Step 6g: rejected merge proposals leaving orphans, mis-typed
 * extractions (Berkeley/UC Berkeley), spurious extractions that
 * survived past review.
 *
 * Server component fetches + hydrates mention counts; the interactive
 * list lives in components/EntitiesList.tsx as a client component.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import EntitiesList, { type EntityRow } from '@/components/EntitiesList'
import { entityHasContent } from '@/lib/entity/content'
import { isInLifesCast } from '@/lib/entity/lifes-cast'

export const dynamic = 'force-dynamic'

type RawEntity = {
  id: string
  type: string
  canonical_name: string
  aliases: string[] | null
  description: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string | null
}

export default async function EntitiesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const admin = createAdminClient()

  // Pull every entity the user owns. Sorted at the DB layer for
  // predictability; the client re-sorts within type tabs as needed.
  const { data: entitiesRaw, error: entErr } = await admin
    .from('entities')
    .select('id, type, canonical_name, aliases, description, metadata, created_at, updated_at')
    .eq('user_id', user.id)
    .order('type', { ascending: true })
    .order('canonical_name', { ascending: true })

  // Mention counts via a single join query: memory_entities filtered
  // by memories owned by this user. Cheap enough for MVP scale; if
  // the per-user entity count climbs past a few thousand, swap to a
  // dedicated aggregate query or a denormalised counter column.
  const { data: linksRaw, error: linkErr } = await admin
    .from('memory_entities')
    .select('entity_id, memories!inner(user_id)')
    .eq('memories.user_id', user.id)

  const mentionCounts = new Map<string, number>()
  for (const l of (linksRaw ?? []) as { entity_id: string }[]) {
    mentionCounts.set(l.entity_id, (mentionCounts.get(l.entity_id) ?? 0) + 1)
  }

  // Content signals for the content-only filter (Slice 7.2): context notes
  // and open hopper stubs join mentions + description in deciding whether
  // an entity page is blank. Two cheap per-user scans at MVP scale.
  const { data: noteRows } = await admin
    .from('entity_context_notes')
    .select('entity_id')
    .eq('user_id', user.id)
  const noteCounts = new Map<string, number>()
  for (const n of (noteRows ?? []) as { entity_id: string }[]) {
    noteCounts.set(n.entity_id, (noteCounts.get(n.entity_id) ?? 0) + 1)
  }
  const { data: stubRows } = await admin
    .from('memory_stubs')
    .select('host_entity_id')
    .eq('user_id', user.id)
    .eq('status', 'open')
  const stubCounts = new Map<string, number>()
  for (const s of (stubRows ?? []) as { host_entity_id: string }[]) {
    stubCounts.set(s.host_entity_id, (stubCounts.get(s.host_entity_id) ?? 0) + 1)
  }

  const items: EntityRow[] = ((entitiesRaw ?? []) as RawEntity[]).map((e) => ({
    id: e.id,
    type: e.type,
    canonical_name: e.canonical_name,
    aliases: e.aliases ?? [],
    mention_count: mentionCounts.get(e.id) ?? 0,
    created_at: e.created_at,
    in_lifes_cast: isInLifesCast(e.metadata),
    has_content: entityHasContent({
      mention_count: mentionCounts.get(e.id) ?? 0,
      note_count: noteCounts.get(e.id) ?? 0,
      stub_count: stubCounts.get(e.id) ?? 0,
      description: e.description,
    }),
  }))

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto flex items-baseline justify-between px-4 sm:px-6 pt-6">
        <h1 className="text-lg font-semibold text-stone-900">Entities</h1>
        <span className="text-xs text-stone-400">{items.length} total</span>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {(entErr || linkErr) && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 mb-6 text-sm">
            Failed to load entities: {(entErr ?? linkErr)?.message}
          </div>
        )}
        <EntitiesList initialItems={items} />
      </main>
    </div>
  )
}
