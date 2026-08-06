/**
 * Pin stacking order (Andy's occlusion screenshots, 2026-08-04).
 *
 * **Mapbox GL 3.24 sets no z-index on Markers.** Stacking is therefore
 * pure DOM insertion order, and insertion order is whatever order the
 * `pins` array happens to be in — which comes from `get_residence_pins`:
 *
 *     ORDER BY r.sort_order ASC NULLS LAST, r.created_at ASC
 *
 * Sequenced primary residences carry a `sort_order`, so they sort FIRST,
 * are created FIRST, and paint at the BOTTOM. Every marker pin has a NULL
 * sort_order, sorts last, and paints OVER the spine. The most important
 * pin class in the app was underneath its neighbours **by construction**,
 * and selecting one changed nothing, because `.globe-pin-selected` carried
 * no z-index either. Andy searched for his Dartmouth primary residence,
 * selected it from the dropdown, and still could not see it under the
 * banner of a work-travel marker 508 m away.
 *
 * CLASS OF BUG: **DOM insertion order is a z-order.** Any list rendered in
 * a query's order inherits that order as a painting policy — and an
 * `ORDER BY` written to read "most important first" paints the most
 * important thing at the bottom. The two orderings want opposite things,
 * and nothing in the code says so.
 *
 * The ladder below states it. Bands are deliberately coarse: they encode
 * what the app believes matters, not a per-pin fudge.
 *
 * NOTE ON CONTAINMENT: these values only behave because the map container
 * carries `isolation: isolate` (globals.css). Without a stacking context
 * around the map, a marker could out-rank the app chrome above it.
 */

import { isHomeType } from './anchor-options'
import { SPINE_CODE } from './pin-types'

/** Coarse priority bands, low paints under high. */
const BAND = {
  MARKER: 0,
  /** Any place lived — second residences and short stays included. */
  HOME: 1,
  /** A sequenced primary residence: the spine. */
  SPINE: 2,
  /** Transient — a cursor passing over. */
  HOVERED: 3,
  /** What the user actually asked for. Always on top. */
  SELECTED: 4,
} as const

/** Latitude resolution inside a band. 0..LAT_STEPS-1, south = higher. */
const LAT_STEPS = 1000
export const PIN_STACK_CEILING = BAND.SELECTED * LAT_STEPS + (LAT_STEPS - 1)

export interface StackablePin {
  type_code: string | null
  sort_order: number | null
  lat: number
}

export interface StackState {
  selected?: boolean
  hovered?: boolean
}

function band(pin: StackablePin, state: StackState): number {
  // Selection beats hover: a cursor merely passing over a neighbour must
  // never displace the pin the user chose.
  if (state.selected) return BAND.SELECTED
  if (state.hovered) return BAND.HOVERED
  if (pin.type_code === SPINE_CODE && pin.sort_order !== null) return BAND.SPINE
  // `isHomeType` is the standing single definition — home-ness is the TYPE,
  // not the spine slot (2026-07-18). An unplaced primary is still a home.
  if (isHomeType(pin.type_code)) return BAND.HOME
  return BAND.MARKER
}

/**
 * Ties inside a band break by latitude, southern over northern — the
 * cartographic convention that makes an overlapping cluster read as depth
 * rather than as noise, because the nearer-to-viewer pin is the lower one
 * on screen. Confined within the band so latitude can never promote a
 * marker over a home.
 */
function latitudeRank(lat: number): number {
  const clamped = Math.min(90, Math.max(-90, Number.isFinite(lat) ? lat : 0))
  return Math.round(((90 - clamped) / 180) * (LAT_STEPS - 1))
}

export function pinStackZ(pin: StackablePin, state: StackState = {}): number {
  return band(pin, state) * LAT_STEPS + latitudeRank(pin.lat)
}
