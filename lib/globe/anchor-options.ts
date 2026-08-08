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

/**
 * Is this pin type a place the user LIVED? Primaries (placed or not), second
 * residences, short-term stays — the same family that can anchor a marker.
 * Home-ness is the TYPE, not the spine slot (2026-07-18). One definition, so
 * the anchor picker and the residence-facts editor can't disagree about it.
 */
export function isHomeType(typeCode: string | null | undefined): boolean {
  return HOME_TYPES.has(typeCode ?? '')
}

// Sequenced primaries lead (in spine order), then unplaced primaries,
// then second residences, then short stays.
function homeRank(p: AnchorCandidate): number {
  if (p.type_code === 'lived_at') return p.sort_order !== null ? 0 : 1
  return p.type_code === 'owned_residence_at' ? 2 : 3
}

/** Homes among themselves: spine order, then unplaced, second, short stay. */
const byHomeOrder = (a: AnchorCandidate, b: AnchorCandidate) =>
  homeRank(a) - homeRank(b) ||
  (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) ||
  a.name.localeCompare(b.name)

export function anchorCandidates<T extends AnchorCandidate>(pins: T[], forTypeCode: string): T[] {
  // A Log can anchor to ANY place, so this branch is the long one — and it
  // used to return the raw array, the only branch that did not sort. Log is
  // also what route mode mints for a trip stop, so the one unordered list
  // was the one the newest flow put in front of people: at 48 pins Andy was
  // scanning past the bottom of the screen for a place the app already knew
  // (2026-08-04). Homes lead, since an anchor usually IS a home and they
  // must appear in the same order as everywhere else; the long tail is
  // alphabetical, which is the only order that helps when scanning.
  //
  // Copied before sorting: `pins` is React state at every call site.
  if (forTypeCode === 'logged_at') {
    return [...pins].sort((a, b) => {
      const aHome = HOME_TYPES.has(a.type_code ?? '')
      const bHome = HOME_TYPES.has(b.type_code ?? '')
      if (aHome !== bHome) return aHome ? -1 : 1
      return aHome ? byHomeOrder(a, b) : a.name.localeCompare(b.name)
    })
  }
  return pins.filter((p) => HOME_TYPES.has(p.type_code ?? '')).sort(byHomeOrder)
}

/** Drives the "· not yet placed" option suffix. */
export function isUnplacedHome(p: AnchorCandidate): boolean {
  return p.type_code === 'lived_at' && p.sort_order === null
}
