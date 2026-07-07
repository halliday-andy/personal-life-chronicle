/**
 * Entity content signals (Slice 7.2 — the content-only filter).
 *
 * "Blank" entity pages (nothing but a name) clutter listing surfaces and
 * make poor destinations. An entity has content when anything would render
 * on its Entity View beyond the identity row: a mention, a context note, an
 * open hopper stub, or a description.
 *
 * Shared by the /entities list (filter) and anything else that needs to
 * decide whether an entity page is worth linking to.
 */

export interface EntityContentSignals {
  mention_count: number
  note_count: number
  stub_count: number
  description: string | null
}

export function entityHasContent(s: EntityContentSignals): boolean {
  return (
    s.mention_count > 0 ||
    s.note_count > 0 ||
    s.stub_count > 0 ||
    Boolean(s.description && s.description.trim())
  )
}
