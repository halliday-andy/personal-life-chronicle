/**
 * Journey tree builder — J1 (docs/plans/2026-07-05-journey-view-design.md).
 *
 * Turns the flat get_residence_pins payload into the reading structure:
 * primary stops in SPINE ORDER (sort_order — never parsed dates, invariant
 * #5) with anchored markers nested beneath their actual anchor (a Log on a
 * vacation nests under the vacation). Depth is unrestricted here; the
 * renderer caps visual indent at two levels.
 *
 * Markers whose anchor is missing (standalone, or the anchor pin was
 * deleted) land in `unanchored`, as does any node left unreachable by a
 * pathological anchor cycle — nothing the user placed may ever silently
 * disappear from the reading surface.
 *
 * Pure function: provable without a DB (verify-journey-tree.mjs).
 */

import { SPINE_CODE } from '@/lib/globe/pin-types'

export interface JourneyPin {
  relationship_id: string
  place_entity_id: string
  name: string
  when_text: string | null
  sort_order: number | null
  type_code: string | null
  anchor_residence_id: string | null
  description: string | null
  /** Extraction's why-they-moved-here (J2 transition narration); null = render nothing. */
  move_reason: string | null
  created_at: string
}

/**
 * Quiet, human phrasing for the extraction's move_reason vocabulary —
 * rendered on the thread between stops. Unknown/unmapped values fall
 * back to the raw label with underscores spaced; null renders nothing
 * (never fabricate connective tissue — design §4).
 */
export function transitionPhrase(moveReason: string | null): string | null {
  if (!moveReason || moveReason === 'unknown') return null
  const phrases: Record<string, string> = {
    career_relocation: 'moved for work',
    military_posting: 'a new posting',
    marriage: 'marriage',
    relationship: 'for love',
    divorce_separation: 'a parting of ways',
    education: 'off to study',
    family_care: 'to care for family',
    financial: 'for financial reasons',
    retirement: 'into retirement',
    health: 'for health',
    displacement: 'displaced',
    adventure: 'chasing adventure',
    seasonal_work: "for a season's work",
  }
  return phrases[moveReason] ?? moveReason.replace(/_/g, ' ')
}

export interface JourneyNode extends JourneyPin {
  children: JourneyNode[]
}

export interface JourneyTree {
  /** SEQUENCED primary residences in spine order — the chapters. */
  stops: JourneyNode[]
  /** Unsequenced primaries (U9, KTD10): homes awaiting their spot on
   *  the thread — never rendered as spine stops. */
  unplaced: JourneyNode[]
  /** Markers with no resolvable anchor (standalone or orphaned). */
  unanchored: JourneyNode[]
}

function byTypeThenCreated(a: JourneyNode, b: JourneyNode): number {
  const t = (a.type_code ?? '').localeCompare(b.type_code ?? '')
  if (t !== 0) return t
  return a.created_at < b.created_at ? -1 : 1
}

export function buildJourneyTree(pins: JourneyPin[]): JourneyTree {
  const nodes = new Map<string, JourneyNode>()
  for (const p of pins) nodes.set(p.relationship_id, { ...p, children: [] })

  const stops: JourneyNode[] = []
  const unplaced: JourneyNode[] = []
  const unanchored: JourneyNode[] = []

  for (const node of Array.from(nodes.values())) {
    if (node.type_code === SPINE_CODE) {
      // The thread is the SEQUENCED primaries; an unsequenced home (U9)
      // reads separately until the user places it.
      ;(node.sort_order === null ? unplaced : stops).push(node)
      continue
    }
    const parent = node.anchor_residence_id ? nodes.get(node.anchor_residence_id) : undefined
    if (parent && parent.relationship_id !== node.relationship_id) parent.children.push(node)
    else unanchored.push(node)
  }

  // Spine order: sort_order asc, NULLs last, created_at tiebreak — the
  // same ordering get_residence_pins uses.
  stops.sort((a, b) => {
    const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER
    const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER
    if (sa !== sb) return sa - sb
    return a.created_at < b.created_at ? -1 : 1
  })

  for (const n of Array.from(nodes.values())) n.children.sort(byTypeThenCreated)
  unanchored.sort(byTypeThenCreated)
  unplaced.sort(byTypeThenCreated)

  // Reachability guard: a cycle of markers anchored to each other is
  // attached but unreachable from any root — surface such islands in
  // `unanchored` rather than losing them.
  const visited = new Set<string>()
  const walk = (n: JourneyNode) => {
    if (visited.has(n.relationship_id)) return
    visited.add(n.relationship_id)
    for (const c of n.children) walk(c)
  }
  for (const s of stops) walk(s)
  for (const u of unplaced) walk(u)
  for (const u of unanchored) walk(u)
  for (const n of Array.from(nodes.values())) {
    if (!visited.has(n.relationship_id)) {
      // Break the island: detach from its (cyclic) parent list and root it.
      unanchored.push(n)
      walk(n)
    }
  }

  return { stops, unplaced, unanchored }
}
