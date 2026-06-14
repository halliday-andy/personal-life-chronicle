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
  /** One-line description shown under the type selector so the choice is
   *  self-explanatory (added after a real-use ambiguity, 2026-06-14). */
  description: string
}

export const PIN_TYPES: PinTypeMeta[] = [
  { code: 'lived_at',             label: 'Primary residence',   color: '#f4b14a', isSpine: true,  anchorPrompt: '',
    description: 'A home you lived in. These form the main line of your life’s journey.' },
  { code: 'worked_at',            label: 'Workplace',           color: '#5fc6dc', isSpine: false, anchorPrompt: 'Which home did you commute from?',
    description: 'An office or employer you worked at — draws a commute line to the home you lived in then.' },
  { code: 'owned_residence_at',   label: 'Second residence',    color: '#f4b14a', isSpine: false, anchorPrompt: 'Which home was this alongside?',
    description: 'A second home you returned to alongside your main one — owned, rented, shared, or a recurring seasonal place.' },
  { code: 'lived_briefly_at',     label: 'Short-term stay',     color: '#d99b46', isSpine: false, anchorPrompt: 'Which home was this between?',
    description: 'Somewhere you lived briefly — a summer, a sublet, a short posting.' },
  { code: 'vacationed_at',        label: 'Vacation',            color: '#ef8aa6', isSpine: false, anchorPrompt: 'Which home were you living in then?',
    description: 'A place you traveled to for leisure — a trip, not a home.' },
  { code: 'traveled_for_work_to', label: 'Professional travel', color: '#8a9bc0', isSpine: false, anchorPrompt: 'Which home were you living in then?',
    description: 'A work trip to a place you didn’t live.' },
]

export const SPINE_CODE = 'lived_at'

export function pinTypeMeta(code: string | null | undefined): PinTypeMeta {
  return PIN_TYPES.find((t) => t.code === code) ?? PIN_TYPES[0]
}

export function pinTypeLabel(code: string | null | undefined): string {
  return pinTypeMeta(code).label
}
