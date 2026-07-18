/**
 * Globe basemap regime — nocturne vs daylight (2026-07-18).
 *
 * The globe serves two jobs that want different basemaps. At world and
 * regional zoom the map is a CANVAS: the nocturne dark style keeps the
 * ember spine and pins as the subject — the app's identity view. At
 * reading zoom the map is a DOCUMENT: the user is orienting against
 * buildings, lifts, trails, and POIs, which the dark style mutes or
 * drops — so we cross to the detailed outdoors style (Andy's call,
 * 2026-07-18, from the Sunshine Village QA comparison).
 *
 * Hysteresis: flip IN above OUT so hovering at the boundary never
 * flaps the style back and forth. Thresholds are tunable in QA.
 */

export type GlobeRegime = 'nocturne' | 'daylight'

export const DAYLIGHT_IN_ZOOM = 13.2
export const DAYLIGHT_OUT_ZOOM = 12.6

export const NOCTURNE_STYLE = 'mapbox://styles/mapbox/dark-v11'
export const DAYLIGHT_STYLE = 'mapbox://styles/mapbox/outdoors-v12'

export function nextRegime(zoom: number, current: GlobeRegime): GlobeRegime {
  if (current === 'nocturne') return zoom >= DAYLIGHT_IN_ZOOM ? 'daylight' : 'nocturne'
  return zoom <= DAYLIGHT_OUT_ZOOM ? 'nocturne' : 'daylight'
}

export function styleForRegime(regime: GlobeRegime): string {
  return regime === 'daylight' ? DAYLIGHT_STYLE : NOCTURNE_STYLE
}
