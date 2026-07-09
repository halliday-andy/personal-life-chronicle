/**
 * Layer B — per-user chronicle context digest.
 *
 * Returns a compact text block summarising a user's chronicle state.
 * Used as the second prompt layer for the Orchestrator Agent. Target
 * size: 1–3k tokens. The same user with the same chronicle state should
 * yield byte-identical output so Anthropic's prompt cache can hit
 * across successive submissions.
 *
 * In Step 6b: regenerated per call via live queries. No durable storage.
 * Step 6c will introduce user_chronicle_digests as a materialised table
 * with hash-keyed invalidation. The interface here stays the same.
 *
 * Reference: documentation/feature_capture_assistant.md §4.1 (table row B).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ChronicleDigest {
  /** The text block to feed to Claude as Layer B. */
  text: string
  /** Stable hash of the input data — used later to detect when the digest is stale. */
  hash: string
  /** Diagnostics for logging. */
  stats: {
    memories: number
    entities_by_type: Record<string, number>
    residential_pins: number
    open_review_items: number
    recent_session_count: number
    open_stubs: number
  }
}

const MAX_RECENT_ENTITIES = 30
const MAX_RECENT_MEMORY_SNIPPETS = 5
const SNIPPET_LEN = 140

function trim(s: string | null | undefined, n: number): string {
  if (!s) return ''
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length <= n ? t : t.slice(0, n) + '…'
}

async function quickHash(input: string): Promise<string> {
  // Lightweight non-cryptographic hash; the goal is cache-key stability,
  // not collision resistance. SubtleCrypto is available in Node 18+.
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return Array.from(new Uint8Array(buf))
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  // Fallback: deterministic string slice
  let h = 0
  for (let i = 0; i < input.length; i++) h = ((h << 5) - h + input.charCodeAt(i)) | 0
  return Math.abs(h).toString(16)
}

export async function buildUserDigest(
  user_id: string,
  supabase: SupabaseClient,
): Promise<ChronicleDigest> {
  // Fetch in parallel — each is a small query against an indexed column.
  const [
    { count: memCount },
    { data: entityRows },
    { data: recentMems },
    { count: reviewCount },
    { count: sessionCount },
    { data: dimSummary },
  ] = await Promise.all([
    supabase.from('memories').select('*', { count: 'exact', head: true }).eq('user_id', user_id),
    supabase
      .from('entities')
      .select('id, type, canonical_name, aliases, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(MAX_RECENT_ENTITIES),
    supabase
      .from('memories')
      .select('id, content_raw, occurred_at_fuzzy, time_precision, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(MAX_RECENT_MEMORY_SNIPPETS),
    supabase
      .from('review_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id),
    supabase
      .from('interview_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id),
    supabase
      .from('memory_dimensions')
      .select('dimension_id, dimensions!inner(name, type_id, dimension_types!inner(code))')
      .eq('dimensions.dimension_types.code', 'topic_domain'),
  ])

  // Open hopper jots, grouped per host entity (R2, 2026-07-09) — ambient
  // awareness so the orchestrator can NOMINATE a write-up at openings and
  // lulls without a tool call. Staleness up to the digest cache TTL
  // (~5 min) is fine for nomination purposes.
  const { data: stubRows } = await supabase
    .from('memory_stubs')
    .select('body, created_at, entities!memory_stubs_host_entity_id_fkey(canonical_name, type)')
    .eq('user_id', user_id)
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(60)

  const entities = entityRows ?? []
  const byType: Record<string, number> = {}
  for (const e of entities) {
    byType[e.type] = (byType[e.type] ?? 0) + 1
  }

  // Count residential pins: relationships where the user is the subject and
  // the relationship type is 'lived_at' or 'lived_briefly_at'. We don't yet
  // have a place-pin count at the entity level; this is a stand-in.
  const { count: residentialCount } = await supabase
    .from('relationships')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user_id)

  // Compose the digest text. Stable ordering everywhere for cache keys.
  const lines: string[] = []
  lines.push('# This user\'s chronicle — context for the orchestrator')
  lines.push('')
  lines.push(`Total memories recorded: ${memCount ?? 0}`)
  lines.push(`Interview sessions to date: ${sessionCount ?? 0}`)
  lines.push(`Open review queue items: ${reviewCount ?? 0}`)
  lines.push(`Residential / relationship rows: ${residentialCount ?? 0}`)
  lines.push('')

  if (Object.keys(byType).length > 0) {
    lines.push('## Entities by type')
    for (const [t, n] of Object.entries(byType).sort()) {
      lines.push(`- ${t}: ${n}`)
    }
    lines.push('')
  }

  // Person entities are the most useful for the orchestrator to know about
  // (so it can recognise when a submission references a known person).
  const persons = entities.filter((e) => e.type === 'person').slice(0, 20)
  if (persons.length > 0) {
    lines.push('## Recent person entities (most recent first)')
    for (const p of persons) {
      const aliasPart = p.aliases && p.aliases.length > 0 ? ` (also: ${p.aliases.join(', ')})` : ''
      lines.push(`- ${p.canonical_name}${aliasPart}`)
    }
    lines.push('')
  }

  const places = entities.filter((e) => e.type === 'place').slice(0, 15)
  if (places.length > 0) {
    lines.push('## Known places')
    for (const p of places) lines.push(`- ${p.canonical_name}`)
    lines.push('')
  }

  const orgs = entities.filter((e) => e.type === 'organization').slice(0, 10)
  if (orgs.length > 0) {
    lines.push('## Known organizations')
    for (const o of orgs) lines.push(`- ${o.canonical_name}`)
    lines.push('')
  }

  if ((recentMems ?? []).length > 0) {
    lines.push('## Last few memories captured (most recent first)')
    for (const m of recentMems ?? []) {
      const when = m.occurred_at_fuzzy ? ` [${m.occurred_at_fuzzy}]` : ''
      lines.push(`- ${trim(m.content_raw, SNIPPET_LEN)}${when}`)
    }
    lines.push('')
  }

  // Open jots per host — alphabetical hosts, oldest-first jots, both for
  // cache-key stability. Up to three jot texts per host keep nominations
  // specific ("the ice-cream truck summer") without bloating Layer B.
  type StubRow = {
    body: string
    entities: { canonical_name: string; type: string } | { canonical_name: string; type: string }[] | null
  }
  const stubsByHost = new Map<string, { type: string; bodies: string[] }>()
  for (const s of (stubRows ?? []) as StubRow[]) {
    const host = Array.isArray(s.entities) ? s.entities[0] : s.entities
    if (!host) continue
    const cur = stubsByHost.get(host.canonical_name) ?? { type: host.type, bodies: [] }
    cur.bodies.push(s.body)
    stubsByHost.set(host.canonical_name, cur)
  }
  const openStubCount = (stubRows ?? []).length
  if (stubsByHost.size > 0) {
    lines.push('## Open jots in the hopper (memories waiting to be written up)')
    for (const [name, h] of Array.from(stubsByHost.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      const examples = h.bodies.slice(0, 3).map((b) => `"${trim(b, 60)}"`).join(', ')
      const more = h.bodies.length > 3 ? `, +${h.bodies.length - 3} more` : ''
      lines.push(`- ${name} (${h.type}): ${h.bodies.length} jot(s) — ${examples}${more}`)
    }
    lines.push('')
  }

  // Topic-domain coverage (which life dimensions have any tagging at all).
  const topicNames = new Set<string>()
  for (const md of (dimSummary as unknown as Array<{ dimensions: { name: string } }>) ?? []) {
    if (md.dimensions?.name) topicNames.add(md.dimensions.name)
  }
  if (topicNames.size > 0) {
    lines.push('## Topic domains touched so far')
    for (const n of Array.from(topicNames).sort()) lines.push(`- ${n}`)
    lines.push('')
  }

  if ((memCount ?? 0) === 0) {
    lines.push(
      '## Note',
      'This user has no memories recorded yet. They are likely beginning their chronicle. Be especially welcoming and unhurried.',
      '',
    )
  }

  const text = lines.join('\n')
  const hash = await quickHash(text)

  return {
    text,
    hash,
    stats: {
      memories: memCount ?? 0,
      entities_by_type: byType,
      residential_pins: residentialCount ?? 0,
      open_review_items: reviewCount ?? 0,
      recent_session_count: sessionCount ?? 0,
      open_stubs: openStubCount,
    },
  }
}
