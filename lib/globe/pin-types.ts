/**
 * Globe pin types — the six place categories and their display metadata.
 * Single source of truth shared by PinModal, PinEditPanel, PinDetailCard,
 * and the legend so labels/colors never drift apart (Step 7 Slice 3).
 *
 * `code` is the relationship_types.code; the pin's type IS its
 * relationship type. `isSpine` marks the connected residential backbone
 * (only Primary residence). Colors match the per-type CSS in globals.css.
 */

export interface PinTypeMeta {
  code: string
  label: string
  color: string      // chip dot / swatch, matching the on-globe pin hue
  isSpine: boolean
  /** Phrasing for the "which home?" anchor picker, per type. */
  anchorPrompt: string
}

export const PIN_TYPES: PinTypeMeta[] = [
  { code: 'lived_at',             label: 'Primary residence',   color: '#f4b14a', isSpine: true,  anchorPrompt: '' },
  { code: 'worked_at',            label: 'Workplace',           color: '#5fc6dc', isSpine: false, anchorPrompt: 'Which home did you commute from?' },
  { code: 'owned_residence_at',   label: 'Second residence',    color: '#f4b14a', isSpine: false, anchorPrompt: 'Which home was this alongside?' },
  { code: 'lived_briefly_at',     label: 'Short-term stay',     color: '#d99b46', isSpine: false, anchorPrompt: 'Which home was this between?' },
  { code: 'vacationed_at',        label: 'Vacation',            color: '#ef8aa6', isSpine: false, anchorPrompt: 'Which home were you living in then?' },
  { code: 'traveled_for_work_to', label: 'Professional travel', color: '#8a9bc0', isSpine: false, anchorPrompt: 'Which home were you living in then?' },
]

export const SPINE_CODE = 'lived_at'

export function pinTypeMeta(code: string | null | undefined): PinTypeMeta {
  return PIN_TYPES.find((t) => t.code === code) ?? PIN_TYPES[0]
}

export function pinTypeLabel(code: string | null | undefined): string {
  return pinTypeMeta(code).label
}
