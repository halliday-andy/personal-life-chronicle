/**
 * Pin search — the "Your pins" half of the globe's find box (2026-07-18).
 *
 * Search-as-navigation: a query into the find box may mean "take me to MY
 * pin", not "geocode a place". This matcher runs client-side over the
 * already-loaded pins (no API), so its results can sit above the Mapbox
 * place suggestions in one merged dropdown.
 *
 * Deliberately dumb: name matching only (no semantic search — that is
 * Step 14 territory). Tolerant of case and diacritics because pin names
 * carry both user spellings and geocoder spellings ("Zaragóza" vs
 * "Zaragoza").
 */

export interface PinSearchCandidate {
  relationship_id: string
  name: string
  type_code: string | null
  sort_order: number | null
}

const SPINE_CODE = 'lived_at'

// Lowercase, strip combining diacritics, collapse whitespace.
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Rank tier: lower is better. -1 = no match.
function tier(name: string, q: string): number {
  if (name === q) return 0
  if (name.startsWith(q)) return 1
  if (name.includes(' ' + q)) return 2 // word-boundary start
  if (name.includes(q)) return 3
  return -1
}

// Within a tier: sequenced primaries first (in spine order), then
// unsequenced primaries, then markers; name as the final deterministic key.
function group(p: PinSearchCandidate): number {
  if (p.type_code === SPINE_CODE) return p.sort_order !== null ? 0 : 1
  return 2
}

export function searchPins<T extends PinSearchCandidate>(
  pins: T[],
  query: string,
  limit = 5,
): T[] {
  const q = fold(query)
  if (q.length < 2) return []
  return pins
    .map((pin) => ({ pin, tier: tier(fold(pin.name), q) }))
    .filter((m) => m.tier >= 0)
    .sort((a, b) =>
      a.tier - b.tier ||
      group(a.pin) - group(b.pin) ||
      (a.pin.sort_order ?? Infinity) - (b.pin.sort_order ?? Infinity) ||
      a.pin.name.localeCompare(b.pin.name),
    )
    .slice(0, limit)
    .map((m) => m.pin)
}
