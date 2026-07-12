/**
 * Alias folding (2026-07-10, from Andy's stub-resolution QA).
 *
 * When a stub phrasing ("my father") resolves to an entity — created fresh
 * with a real name OR linked to an existing one — the phrasing must fold
 * into the entity's aliases so future mentions still resolve. The fold is
 * a pure merge: case-insensitive dedupe, never duplicates the canonical
 * name, never clobbers existing aliases (the original create-branch code
 * REPLACED the array wholesale — the same class as the metadata-clobber
 * rule).
 */

export function appendAlias(
  existing: string[] | null | undefined,
  alias: string,
  canonicalName: string,
): string[] | null {
  const trimmed = alias.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (lower === canonicalName.trim().toLowerCase()) return null
  const current = (existing ?? []).filter((a) => typeof a === 'string' && a.trim())
  if (current.some((a) => a.trim().toLowerCase() === lower)) return null
  return [...current, trimmed]
}
