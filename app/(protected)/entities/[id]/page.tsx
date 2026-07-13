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
import { mapMentionsToPins, nameCenteredExcerpt, PIN_TYPE_CODES, type LocationLinkRow } from '@/lib/entity/mention-pins'
import { isInLifesCast } from '@/lib/entity/lifes-cast'

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
    .select('id, type, canonical_name, aliases, description, user_id, metadata')
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
    .select('memory_id, memories!inner(id, content_raw, occurred_at_fuzzy, created_at, user_id)')
    .eq('entity_id', entity.id)
    .eq('memories.user_id', user.id)
    .limit(50)
  // Name-centered excerpts (2026-07-10): the window around where this
  // entity appears in the text, not blindly the first 200 chars —
  // "We had known each other superficially…" never says WHO.
  const entityNames = [entity.canonical_name, ...(entity.aliases ?? [])]
  type MemRow = { id: string; content_raw: string | null; occurred_at_fuzzy: string | null; created_at: string }
  const seen = new Set<string>()
  const recollections: MentionRecollection[] = []
  for (const row of (linkRows ?? []) as { memories: MemRow | MemRow[] | null }[]) {
    const m = Array.isArray(row.memories) ? row.memories[0] : row.memories
    if (!m || seen.has(m.id)) continue
    seen.add(m.id)
    const snip = nameCenteredExcerpt(m.content_raw ?? '', entityNames)
    recollections.push({
      id: m.id,
      excerpt: (snip.leading ? '…' : '') + snip.excerpt,
      occurred_at_fuzzy: m.occurred_at_fuzzy,
      created_at: m.created_at,
    })
  }

  // Home pins (Slice 7.1, reworked 2026-07-10 from Andy's Leola QA):
  // each mention's role='location' pin gives it a provenance header
  // (name + verbatim when-phrase → the Journey) AND its place in the
  // THREAD — mentions sort by the home pin's spine position (markers
  // inherit their anchor's), so a person's story reads forward from
  // where it began. Unlocated mentions follow, in capture order.
  if (recollections.length > 0) {
    const { data: locLinks } = await admin
      .from('memory_entities')
      .select('memory_id, entity_id')
      .in('memory_id', recollections.map((r) => r.id))
      .eq('role', 'location')
    const locationLinks = (locLinks ?? []) as LocationLinkRow[]
    if (locationLinks.length > 0) {
      // ALL the user's globe pins — needed to walk marker anchor chains
      // to a spine position, and to name the home pin.
      const { data: relRows } = await admin
        .from('relationships')
        .select('id, object_id, anchor_residence_id, sort_order, metadata, relationship_types!inner(code)')
        .eq('user_id', user.id)
      type RelRow = {
        id: string; object_id: string; anchor_residence_id: string | null
        sort_order: number | null; metadata: Record<string, unknown> | null
        relationship_types: { code: string } | { code: string }[] | null
      }
      const pinRows = ((relRows ?? []) as RelRow[]).filter((r) => {
        const rt = Array.isArray(r.relationship_types) ? r.relationship_types[0] : r.relationship_types
        return rt && PIN_TYPE_CODES.has(rt.code)
      })
      const byRelId = new Map(pinRows.map((r) => [r.id, r]))
      const spineOrder = (r: RelRow): number => {
        // Walk markers up their anchor chain to a spine sort_order; a
        // marker sits just after its ancestor stop. Cycle-guarded.
        let cur: RelRow | undefined = r
        const seenIds = new Set<string>()
        while (cur && cur.sort_order == null && cur.anchor_residence_id && !seenIds.has(cur.id)) {
          seenIds.add(cur.id)
          cur = byRelId.get(cur.anchor_residence_id)
        }
        return cur?.sort_order != null ? cur.sort_order + 0.5 * Number(cur.id !== r.id) : Number.MAX_SAFE_INTEGER - 1
      }
      const pins = pinRows.map((r) => ({ relationship_id: r.id, place_entity_id: r.object_id }))
      const pinByMemory = mapMentionsToPins(locationLinks, pins)
      const nameByPlace = new Map<string, string>()
      {
        const placeIds = Array.from(new Set(pinRows.map((r) => r.object_id)))
        if (placeIds.length > 0) {
          const { data: ents } = await admin.from('entities').select('id, canonical_name').in('id', placeIds)
          for (const e of ents ?? []) nameByPlace.set(e.id, e.canonical_name)
        }
      }
      for (const r of recollections) {
        const relId = pinByMemory.get(r.id)
        const rel = relId ? byRelId.get(relId) : undefined
        if (rel) {
          r.home = {
            relationship_id: rel.id,
            name: nameByPlace.get(rel.object_id) ?? 'Untitled place',
            when_text: (rel.metadata?.when_text as string | undefined) ?? null,
          }
          r.threadOrder = spineOrder(rel)
        }
      }
    }
  }
  // The thread: spine position first (unlocated last), capture order within.
  recollections.sort((a, b) => {
    const ao = a.threadOrder ?? Number.MAX_SAFE_INTEGER
    const bo = b.threadOrder ?? Number.MAX_SAFE_INTEGER
    if (ao !== bo) return ao - bo
    return a.created_at < b.created_at ? -1 : 1
  })

  return (
    <EntityView
      entity={{
        id: entity.id,
        type: entity.type,
        canonical_name: entity.canonical_name,
        aliases: entity.aliases ?? [],
        description: entity.description ?? null,
        in_lifes_cast: isInLifesCast(entity.metadata as Record<string, unknown> | null),
      }}
      notes={notes}
      recollections={recollections}
    />
  )
}
