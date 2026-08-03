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

/**
 * Line paint per regime — the chronicle's own lines, not the basemap's.
 *
 * The three line tiers were coloured for NOCTURNE: pale, low-opacity,
 * slightly blurred, so they glow against a dark canvas. When the basemap
 * crosses to daylight those same values sit on greens and beiges and all
 * but vanish — Andy could barely see a Log's dashed tether to its parent
 * at Queenstown (2026-08-01).
 *
 * The regime swap changed the canvas and nothing re-tuned what was drawn
 * on it. Blur is the worst offender: a soft edge reads as glow on dark and
 * as smudge on light, so daylight uses less of it, more opacity, and
 * darker hues that hold their own against saturated terrain.
 *
 * Identity is preserved across regimes — the tether stays cool slate and
 * dashed, the commute stays cyan-ish, the spine stays ember. Only the
 * VALUES change, never which colour means what.
 */
export interface ChronicleLinePaint {
  tether: { color: string; width: number; opacity: number }
  commute: { color: string; width: number; opacity: number; blur: number }
  spine: { color: string; width: number; opacity: number; blur: number }
}

export function chronicleLinePaint(regime: GlobeRegime): ChronicleLinePaint {
  if (regime === 'daylight') {
    return {
      tether: { color: '#3b4763', width: 1.7, opacity: 0.9 },
      commute: { color: '#0d6f86', width: 1.8, opacity: 0.9, blur: 0 },
      spine: { color: '#b4600d', width: 2.0, opacity: 0.85, blur: 0 },
    }
  }
  return {
    tether: { color: '#94a0c4', width: 1.1, opacity: 0.55 },
    commute: { color: '#5fc6dc', width: 1.5, opacity: 0.7, blur: 0.3 },
    spine: { color: '#f4b14a', width: 1.6, opacity: 0.55, blur: 0.4 },
  }
}

