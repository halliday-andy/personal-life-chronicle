/**
 * Anchor-picker candidates (2026-07-18).
 *
 * Origin: the picker listed SEQUENCED primaries only, so a workplace
 * couldn't anchor to a just-created "decide later" home (Andy's live
 * find during Phase-1 QA). The principle this file encodes:
 *
 *   HOME-NESS IS THE TYPE, NOT THE SPINE SLOT. U9 excludes unsequenced
 *   primaries from ORDER-derived logic (thread, origin star, reorder,
 *   nearest_residence) — never from being homes you can anchor to.
 *
 * Scoping (Andy delegated the call, 2026-07-18):
 * - A Log anchors to ANY pin (its designed role — the free-form
 *   association type; unchanged).
 * - Every other marker anchors to a HOME: primary residences (sequenced
 *   AND unsequenced), second residences, short-term stays. One commutes
 *   from a summer house or a sublet; one does not commute from a
 *   vacation — those cases are what the Log is for. The DB stays
 *   permissive (validate_pin_anchor accepts any own pin); this is the
 *   guided UI layer per the place-types design.
 */

export interface AnchorCandidate {
  relationship_id: string
  name: string
  type_code: string | null
  sort_order: number | null
}

const HOME_TYPES = new Set(['lived_at', 'owned_residence_at', 'lived_briefly_at'])

// Sequenced primaries lead (in spine order), then unplaced primaries,
// then second residences, then short stays.
function homeRank(p: AnchorCandidate): number {
  if (p.type_code === 'lived_at') return p.sort_order !== null ? 0 : 1
  return p.type_code === 'owned_residence_at' ? 2 : 3
}

export function anchorCandidates<T extends AnchorCandidate>(pins: T[], forTypeCode: string): T[] {
  if (forTypeCode === 'logged_at') return pins
  return pins
    .filter((p) => HOME_TYPES.has(p.type_code ?? ''))
    .sort((a, b) =>
      homeRank(a) - homeRank(b) ||
      (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) ||
      a.name.localeCompare(b.name),
    )
}

/** Drives the "· not yet placed" option suffix. */
export function isUnplacedHome(p: AnchorCandidate): boolean {
  return p.type_code === 'lived_at' && p.sort_order === null
}
