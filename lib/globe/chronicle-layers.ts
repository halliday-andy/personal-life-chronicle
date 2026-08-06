/**
 * Keeping the chronicle's lines alive across basemap swaps
 * (Andy's live QA, 2026-08-04).
 *
 * The globe swaps basemap style when you cross the reading-zoom threshold
 * (`nocturne` ⇄ `daylight`, the style-regime hysteresis). **A `setStyle`
 * wipes every source and layer the app added** — the residential spine, the
 * commute lines, the trip tethers, the trip routes, the chevron images.
 *
 * Rebuilding them used to hang on a single event, `style.load`. That event
 * does not fire on every path `setStyle` can take, and when it doesn't, the
 * custom sources are already gone — they are absent from the incoming style,
 * so the swap removes them — and nothing ever puts them back. Andy zoomed in
 * past the threshold and back out during QA and lost every line on the
 * globe, permanently, until a page reload. The pins looked perfectly healthy
 * throughout, because DOM markers are not part of the style and do not die
 * with it. That asymmetry is what made it read as "the trip won't draw"
 * rather than "the style was rebuilt without us".
 *
 * CLASS OF BUG: **rebuilding on one event when the thing you depend on can
 * be destroyed by several.** State owned by a lifecycle you do not control
 * has to be re-asserted at every settle point, not at the one event that
 * happened to fire the day it was written.
 *
 * So: re-assert on every settle point, guarded by "is it actually missing?"
 * rather than by "did the event I trust fire?".
 */

/**
 * Every point at which the style may have just been rebuilt without us.
 *
 * `style.load` is the announced path. `styledata` covers the swap paths
 * that never announce one. `idle` is the backstop — whatever happened, the
 * map has finished doing it, so if the layers are missing now they are
 * missing for good.
 */
export const STYLE_REINSTALL_EVENTS = ['style.load', 'styledata', 'idle'] as const

/** The slice of mapbox's Map this needs — kept tiny so it can be stubbed. */
export interface StyleSwapMap {
  on(type: string, listener: () => void): unknown
  off(type: string, listener: () => void): unknown
  isStyleLoaded(): boolean
  getSource(id: string): unknown
}

/**
 * Re-run `install` whenever the style has been rebuilt without our layers.
 *
 * @param sentinelSourceId a source the installer always adds — its absence
 *        is the tell that the style was replaced. One sentinel rather than
 *        checking all of them: they are added together in one function, so
 *        they are present or absent together, and a partial state would be
 *        a bug in the installer rather than something to paper over here.
 * @returns detach, for the map's own teardown.
 */
export function attachChronicleInstaller(
  map: StyleSwapMap,
  sentinelSourceId: string,
  install: () => void,
): () => void {
  const ensure = () => {
    // addSource/addLayer throw while a style is still loading, and these
    // events fire during that window too.
    if (!map.isStyleLoaded()) return
    if (map.getSource(sentinelSourceId)) return
    install()
  }
  for (const type of STYLE_REINSTALL_EVENTS) map.on(type, ensure)
  return () => {
    for (const type of STYLE_REINSTALL_EVENTS) map.off(type, ensure)
  }
}
