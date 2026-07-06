/**
 * Globe stub resolution (2026-07-06) — the deferred Slice-2 work, now due.
 *
 * Pin recollections never flow through the entity pipeline; the globe
 * extraction agent parks people/organisations as raw name strings inside
 * relationships.metadata.globe_extraction. This module resolves those
 * stubs against the user's entity graph:
 *
 *   - EXACT canonical/alias match (case-insensitive) → link directly via
 *     memory_entities (a confirmed identity needs no proposal).
 *   - Anything else → a review_queue 'entity_stub_proposal' row, with the
 *     best fuzzy candidate attached when one scores ≥ SUGGEST_THRESHOLD —
 *     the user Accepts (create + link), Links to an existing entity, or
 *     Dismisses on /review. Propose-and-confirm: finalized memories never
 *     silently mint entities.
 *
 * Bookkeeping lives in relationships.metadata.globe_stub_resolution
 * (keyed by type:name), so re-runs are idempotent and re-extraction can
 * add NEW names without re-proposing settled ones. The original
 * globe_extraction payload is never modified (audit trail).
 *
 * Short-variant guard: extraction often lists both "Mike" and
 * "Mike Paplow" for one text; a single-token stub whose token is the
 * first token of a longer stub in the same list is skipped.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { scoreNameMatch } from '@/lib/agents/entity/core'
import { linkEntityToMemory } from '@/lib/memory/owner-edit'

/** Fuzzy score at or above which a proposal carries a suggested match. */
const SUGGEST_THRESHOLD = 0.8

export interface StubResolutionState {
  status: 'linked' | 'proposed' | 'dismissed'
  entity_id?: string
  review_queue_id?: string
  at: string
}

export interface StubResolutionSummary {
  relationship_id: string
  linked: { name: string; entity_id: string; canonical_name: string }[]
  proposed: { name: string; review_queue_id: string; suggested: string | null }[]
  skipped_variants: string[]
  already_settled: number
}

interface CandidateRow {
  id: string
  type: string
  canonical_name: string
  aliases: string[] | null
}

function stubKey(type: string, name: string): string {
  return `${type}:${name.trim().toLowerCase()}`
}

/** Single-token stubs that are the first token of a longer sibling stub. */
function shortVariants(names: string[]): Set<string> {
  const out = new Set<string>()
  for (const a of names) {
    if (a.trim().includes(' ')) continue
    const tokenA = a.trim().toLowerCase()
    for (const b of names) {
      if (b === a) continue
      const tokensB = b.trim().toLowerCase().split(/\s+/)
      if (tokensB.length > 1 && tokensB[0] === tokenA) {
        out.add(a)
        break
      }
    }
  }
  return out
}

export async function resolveGlobePinStubs(
  admin: SupabaseClient,
  { userId, relationshipId, memoryId }: { userId: string; relationshipId: string; memoryId: string },
): Promise<StubResolutionSummary> {
  const summary: StubResolutionSummary = {
    relationship_id: relationshipId,
    linked: [],
    proposed: [],
    skipped_variants: [],
    already_settled: 0,
  }

  const { data: rel, error: relErr } = await admin
    .from('relationships')
    .select('id, user_id, object_id, metadata')
    .eq('id', relationshipId)
    .single()
  if (relErr || !rel) throw new Error(`relationship not found: ${relErr?.message ?? relationshipId}`)
  if (rel.user_id !== userId) throw new Error('relationship does not belong to user')

  const meta = (rel.metadata ?? {}) as Record<string, unknown>
  const extraction = (meta.globe_extraction ?? {}) as {
    mentioned_people?: string[]
    mentioned_organisations?: string[]
  }
  const state = { ...((meta.globe_stub_resolution ?? {}) as Record<string, StubResolutionState>) }

  const { data: mem } = await admin
    .from('memories')
    .select('id, user_id, content_raw')
    .eq('id', memoryId)
    .single()
  if (!mem || mem.user_id !== userId) throw new Error('memory not found or not owned')
  const excerpt = String(mem.content_raw ?? '').slice(0, 160)

  // Pin name for the proposal card headline.
  const { data: pinEnt } = await admin
    .from('entities')
    .select('canonical_name')
    .eq('id', rel.object_id)
    .maybeSingle()
  const pinName = pinEnt?.canonical_name ?? 'this pin'

  const groups: { type: 'person' | 'organization'; names: string[] }[] = [
    { type: 'person', names: extraction.mentioned_people ?? [] },
    { type: 'organization', names: extraction.mentioned_organisations ?? [] },
  ]

  for (const group of groups) {
    const variants = shortVariants(group.names)
    // Candidate pool per group: people match people; institutions blur
    // place/organization (the #38 rule — a base can live as a place pin).
    const candidateTypes = group.type === 'person' ? ['person'] : ['organization', 'place']
    const { data: candRows } = await admin
      .from('entities')
      .select('id, type, canonical_name, aliases')
      .eq('user_id', userId)
      .in('type', candidateTypes)
    const candidates = (candRows ?? []) as CandidateRow[]

    for (const rawName of group.names) {
      const name = rawName.trim()
      if (!name) continue
      const key = stubKey(group.type, name)
      if (state[key]) {
        summary.already_settled++
        continue
      }
      if (variants.has(rawName)) {
        summary.skipped_variants.push(name)
        continue
      }

      // Exact ci match on canonical or alias → confirmed identity.
      const lower = name.toLowerCase()
      const exact = candidates.find(
        (c) =>
          c.canonical_name.toLowerCase() === lower ||
          (c.aliases ?? []).some((a) => a.toLowerCase() === lower),
      )
      if (exact) {
        await linkEntityToMemory(admin, userId, memoryId, exact.id)
        state[key] = { status: 'linked', entity_id: exact.id, at: new Date().toISOString() }
        summary.linked.push({ name, entity_id: exact.id, canonical_name: exact.canonical_name })
        continue
      }

      // Fuzzy best candidate → suggestion on the proposal, never auto-link.
      let best: { c: CandidateRow; score: number } | null = null
      for (const c of candidates) {
        let s = scoreNameMatch(name, c.canonical_name)
        for (const a of c.aliases ?? []) s = Math.max(s, scoreNameMatch(name, a))
        if (!best || s > best.score) best = { c, score: s }
      }
      const suggested =
        best && best.score >= SUGGEST_THRESHOLD
          ? { entity_id: best.c.id, canonical_name: best.c.canonical_name, score: Number(best.score.toFixed(2)) }
          : null

      const { data: queueRow, error: qErr } = await admin
        .from('review_queue')
        .insert({
          user_id: userId,
          item_type: 'entity_stub_proposal',
          item_id: memoryId,
          context_json: {
            name,
            entity_type: group.type,
            relationship_id: relationshipId,
            memory_id: memoryId,
            pin_entity_id: rel.object_id,
            pin_name: pinName,
            excerpt,
            suggested,
            source: 'globe_stub_resolution',
          },
          priority: 3,
        })
        .select('id')
        .single()
      if (qErr || !queueRow) throw new Error(`queue insert failed for "${name}": ${qErr?.message}`)

      state[key] = { status: 'proposed', review_queue_id: queueRow.id, at: new Date().toISOString() }
      summary.proposed.push({ name, review_queue_id: queueRow.id, suggested: suggested?.canonical_name ?? null })
    }
  }

  // Persist bookkeeping (merge — never touch globe_extraction itself).
  const { error: updErr } = await admin
    .from('relationships')
    .update({ metadata: { ...meta, globe_stub_resolution: state } })
    .eq('id', relationshipId)
  if (updErr) throw new Error(`state write failed: ${updErr.message}`)

  return summary
}

/**
 * Mark a stub settled after the user acts on its proposal (the resolve-stub
 * route calls this so re-sweeps don't re-propose).
 */
export async function settleStubState(
  admin: SupabaseClient,
  {
    relationshipId,
    entityType,
    name,
    status,
    entityId,
  }: { relationshipId: string; entityType: string; name: string; status: 'linked' | 'dismissed'; entityId?: string },
): Promise<void> {
  const { data: rel } = await admin
    .from('relationships')
    .select('id, metadata')
    .eq('id', relationshipId)
    .maybeSingle()
  if (!rel) return // pin deleted since — nothing to settle
  const meta = (rel.metadata ?? {}) as Record<string, unknown>
  const state = { ...((meta.globe_stub_resolution ?? {}) as Record<string, StubResolutionState>) }
  state[stubKey(entityType, name)] = {
    status,
    ...(entityId ? { entity_id: entityId } : {}),
    at: new Date().toISOString(),
  }
  await admin
    .from('relationships')
    .update({ metadata: { ...meta, globe_stub_resolution: state } })
    .eq('id', rel.id)
}
