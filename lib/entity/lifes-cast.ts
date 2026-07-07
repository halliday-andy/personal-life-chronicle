/**
 * Life's Cast membership (Slice 7.2, roadmap M3 — metadata flag, no DDL).
 *
 * `entities.metadata.in_lifes_cast === true` marks a person as a member of
 * the user's Life's Cast. Promotion/demotion is always a deliberate owner
 * act — nothing auto-populates the Cast.
 *
 * The merge is a pure function because entities.metadata carries other
 * load-bearing keys (is_self, prior_anchor_residence_id, globe extraction
 * bookkeeping) that a careless whole-object write would destroy.
 */

export function applyLifesCast(
  metadata: Record<string, unknown> | null | undefined,
  inCast: boolean,
): Record<string, unknown> {
  const next = { ...(metadata ?? {}) }
  if (inCast) next.in_lifes_cast = true
  else delete next.in_lifes_cast
  return next
}

export function isInLifesCast(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.in_lifes_cast === true
}
