/**
 * Pin search — the "Your pins" half of the globe's find box (2026-07-18).
 *
 * Search-as-navigation: a query into the find box may mean "take me to MY
 * pin", not "geocode a place". This matcher runs client-side over the
 * already-loaded pins (no API), so its results can sit above the Mapbox
 * place suggestions in one merged dropdown.
 *
 * Deliberately dumb: name matching only (no semantic search — that is
 * Step 14 territory, and it waits for Access Cards so the privacy filter
 * can run BEFORE similarity). Tolerant of case and diacritics because pin
 * names carry both user spellings and geocoder spellings ("Zaragóza" vs
 * "Zaragoza").
 *
 * Matching runs in two stages. First the substring tiers (exact →
 * starts-with → word-start → contains), which rank strongest. Then, only
 * if none of those hit, a TOKEN pass: every word of the query must match
 * some word of the name, canonically or by prefix.
 *
 * The token pass exists because the substring test failed silently whenever
 * the query carried an extra or differently-abbreviated word — searching
 * "Mount Snow Chalet" returned NOTHING for a pin named "My Mt. Snow Chalet"
 * (finding F3, 2026-07-30). Recall of one's own places is approximate:
 * people remember a name loosely and type it in a different order, with
 * different abbreviations, than the one they saved.
 *
 * ALL query tokens must match — this is a stricter recall, not a fuzzy one.
 * A query with an unmatched word rejects the pin, so "Mount Snow Castle"
 * does not find the chalet.
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

// Variants that mean the same word. Every variant maps to one canonical
// form, which makes the equivalence bidirectional for free: "mount" and
// "mt." both canonicalise to "mt", so either query finds either spelling.
// "st" deliberately absorbs both Saint and Street — over-matching slightly
// is far cheaper here than the silent miss this table exists to prevent.
const ABBREVIATIONS: Record<string, string> = {
  mount: 'mt', mt: 'mt',
  mountain: 'mtn', mtn: 'mtn',
  saint: 'st', st: 'st', street: 'st',
  road: 'rd', rd: 'rd',
  avenue: 'ave', ave: 'ave', av: 'ave',
  drive: 'dr', dr: 'dr',
  fort: 'ft', ft: 'ft',
}

const canon = (t: string): string => ABBREVIATIONS[t] ?? t

// Split a folded string into words, dropping punctuation ("Mt." → "mt").
const words = (s: string): string[] => s.split(/[^a-z0-9]+/).filter(Boolean)

// Every query word must find a name word — canonically equal, or a name
// word it prefixes (so incremental typing keeps matching mid-word).
function everyWordMatches(nameWords: string[], queryWords: string[]): boolean {
  return queryWords.every((qw) =>
    nameWords.some((nw) => canon(nw) === canon(qw) || nw.startsWith(qw)),
  )
}

// Rank tier: lower is better. -1 = no match. Tier 4 (token match) is the
// last resort, so a substring hit always outranks a reordered-word hit.
function tier(name: string, q: string, nameWords: string[], queryWords: string[]): number {
  if (name === q) return 0
  if (name.startsWith(q)) return 1
  if (name.includes(' ' + q)) return 2 // word-boundary start
  if (name.includes(q)) return 3
  if (queryWords.length > 0 && everyWordMatches(nameWords, queryWords)) return 4
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
  const queryWords = words(q)
  return pins
    .map((pin) => {
      const name = fold(pin.name)
      return { pin, tier: tier(name, q, words(name), queryWords) }
    })
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
