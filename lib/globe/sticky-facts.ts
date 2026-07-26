/**
 * sticky-facts — owner-edited pin facts are final.
 *
 * The four editable residence facts (residence_type, residence_detail,
 * household_composition, move_reason) are a save-time snapshot of the
 * recollection, refined by re-extraction. Once the OWNER edits a field it
 * becomes sticky: re-extraction must never overwrite it. Per-field provenance
 * lives in relationships.metadata.facts_owner_edited (a list of field names);
 * relationships.metadata is written MERGE-only, so the list survives a re-run.
 *
 * Pure — no I/O, no React. Proof: scripts/verify-sticky-facts.mjs.
 * Design: docs/plans/2026-07-10-pin-facts-editor-enhancement.md.
 */

export const STICKY_FACT_FIELDS = ['residence_type', 'residence_detail', 'household_composition', 'move_reason'] as const
export type StickyFactField = (typeof STICKY_FACT_FIELDS)[number]

export interface StickyFacts {
  residence_type: string | null
  residence_detail: string | null
  household_composition: string | null
  move_reason: string | null
}

const asStr = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)

/**
 * Read the current fact values from a relationship's metadata, wherever they
 * live: residence_type / move_reason sit at the top level (the period-summary
 * SQL reads them there), falling back to the globe_extraction payload; the
 * other two live only under globe_extraction. Missing → null.
 */
export function readCurrentFacts(metadata: Record<string, unknown> | null | undefined): StickyFacts {
  const m = (metadata ?? {}) as Record<string, unknown>
  const g = (m.globe_extraction ?? {}) as Record<string, unknown>
  return {
    residence_type: asStr(m.residence_type) ?? asStr(g.residence_type),
    residence_detail: asStr(g.residence_detail),
    household_composition: asStr(g.household_composition),
    move_reason: asStr(m.move_reason) ?? asStr(g.move_reason),
  }
}

/**
 * The field names the owner has explicitly edited
 * (metadata.facts_owner_edited), filtered to the known sticky fields in
 * canonical order. A bogus name never resolves, so it can never pin a value.
 */
export function readOwnerEditedFields(metadata: Record<string, unknown> | null | undefined): StickyFactField[] {
  const raw = ((metadata ?? {}) as Record<string, unknown>).facts_owner_edited
  if (!Array.isArray(raw)) return []
  return STICKY_FACT_FIELDS.filter((f) => raw.includes(f))
}

/**
 * Resolve facts for a re-extraction: owner-edited fields keep their current
 * value; every other field takes the freshly extracted value.
 */
export function resolveStickyFacts(args: {
  current: StickyFacts
  extracted: StickyFacts
  ownerEdited: readonly string[]
}): StickyFacts {
  const edited = new Set(args.ownerEdited)
  const pick = (f: StickyFactField): string | null => (edited.has(f) ? args.current[f] : args.extracted[f])
  return {
    residence_type: pick('residence_type'),
    residence_detail: pick('residence_detail'),
    household_composition: pick('household_composition'),
    move_reason: pick('move_reason'),
  }
}

/**
 * Write the resolved facts back into a relationship's metadata, producing the
 * canonical persisted shape: residence_type + move_reason at the top level
 * (the period-summary SQL reads them there), all four mirrored under
 * globe_extraction, and the owner-edited list alongside.
 *
 * MERGE-only in both directions — unrelated metadata keys and the extraction
 * audit trail inside globe_extraction (mentioned_people, confidence,
 * extracted_at…) are preserved untouched. Both writers of this shape call
 * this: runGlobeExtraction and the owner's facts editor. Kept apart they
 * drift, and a half-written shape means facts that save but never render.
 */
export function mergeFactsIntoMetadata(args: {
  metadata: Record<string, unknown> | null | undefined
  facts: StickyFacts
  ownerEdited: readonly StickyFactField[]
}): Record<string, unknown> & { globe_extraction: Record<string, unknown> } {
  const current = (args.metadata ?? {}) as Record<string, unknown>
  const extraction = (current.globe_extraction ?? {}) as Record<string, unknown>
  return {
    ...current,
    residence_type: args.facts.residence_type,
    move_reason: args.facts.move_reason,
    facts_owner_edited: [...args.ownerEdited],
    globe_extraction: {
      ...extraction,
      residence_type: args.facts.residence_type,
      residence_detail: args.facts.residence_detail,
      household_composition: args.facts.household_composition,
      move_reason: args.facts.move_reason,
    },
  }
}

/**
 * Apply an owner edit: set the provided fields (null is a valid value — the
 * owner clearing a field) and union them into the owner-edited list, in
 * canonical order. Used by the facts editor's write path.
 */
export function applyOwnerFactEdit(args: {
  current: StickyFacts
  edits: Partial<StickyFacts>
  ownerEdited: readonly string[]
}): { facts: StickyFacts; ownerEdited: StickyFactField[] } {
  const facts: StickyFacts = { ...args.current }
  const edited = new Set<StickyFactField>(STICKY_FACT_FIELDS.filter((f) => args.ownerEdited.includes(f)))
  for (const f of STICKY_FACT_FIELDS) {
    if (args.edits[f] !== undefined) {
      facts[f] = args.edits[f] ?? null
      edited.add(f)
    }
  }
  return { facts, ownerEdited: STICKY_FACT_FIELDS.filter((f) => edited.has(f)) }
}
