/**
 * fact-vocabulary — the ONE list of controlled fact values.
 *
 * residence_type and move_reason are closed vocabularies. Two consumers must
 * agree on them exactly: the extraction tool schema (what the model is allowed
 * to return, lib/globe/extraction.ts) and the owner's facts editor (what the
 * selects offer, components/globe/PinFactsEditor.tsx). Kept apart they drift —
 * a code the model can emit but the owner can't pick renders as a value the
 * editor silently rewrites on save.
 *
 * Pure — no I/O, no React, no SDK imports, so a client component can import it.
 * Proof: scripts/verify-sticky-facts.mjs.
 * Design: docs/plans/2026-07-10-pin-facts-editor-enhancement.md.
 */

export const RESIDENCE_TYPES = [
  'apartment', 'house', 'dormitory', 'military_base', 'rental', 'family_home', 'other',
] as const
export type ResidenceType = (typeof RESIDENCE_TYPES)[number]

/**
 * 'relationship' + 'seasonal_work' were added 2026-07-09 (Andy's Alp Hof Lodge
 * QA): moving in with a partner short of marriage, and a season's work, are
 * real reasons the original vocabulary forced to 'unknown' — which the Journey
 * deliberately renders as silence.
 */
export const MOVE_REASONS = [
  'career_relocation', 'military_posting', 'marriage', 'relationship',
  'divorce_separation', 'education', 'family_care', 'financial',
  'retirement', 'health', 'displacement', 'adventure', 'seasonal_work',
  'unknown',
] as const
export type MoveReason = (typeof MOVE_REASONS)[number]

const LABELS: Record<string, string> = {
  // residence_type
  apartment: 'Apartment',
  house: 'House',
  dormitory: 'Dormitory',
  military_base: 'Military base',
  rental: 'Rental',
  family_home: 'Family home',
  other: 'Other',
  // move_reason
  career_relocation: 'Career relocation',
  military_posting: 'Military posting',
  marriage: 'Marriage',
  relationship: 'A relationship',
  divorce_separation: 'Divorce or separation',
  education: 'Education',
  family_care: 'Caring for family',
  financial: 'Financial',
  retirement: 'Retirement',
  health: 'Health',
  displacement: 'Displacement',
  adventure: 'Adventure',
  seasonal_work: 'Seasonal work',
  unknown: "Not sure / didn't say",
}

/** Human label for a vocabulary code; falls back to the raw code. */
export function factOptionLabel(code: string): string {
  return LABELS[code] ?? code
}
