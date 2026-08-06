/**
 * Cluster-aware arrival framing (Andy's J4 QA, 2026-07-10).
 *
 * Landing on a pin with close neighbors (Queenstown: four pins within a
 * few km) at a fixed zoom stacks their labels illegibly. This computes a
 * frame that CONTAINS the local cluster and aims for the zoom at which
 * the two closest pins sit a label-width apart on screen.
 *
 * Pure math — no I/O, no map: callers feed it into fitBounds, whose own
 * fitting logic resolves the inherent compromise (a wide cluster with one
 * tight pair fits the cluster first; the tight pair may need one more
 * manual zoom — containment beats separation).
 */

export interface ClusterPin {
  relationship_id: string
  lng: number
  lat: number
}

/** Great-circle distance in meters (haversine — plenty at city scales). */
export function haversineMeters(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/**
 * Zoom at which two points `distMeters` apart at latitude `lat` render
 * `sepPx` apart. Mapbox GL zoom (512px world at z0):
 * metersPerPixel(z) = 78271.517 * cos(lat) / 2^z.
 */
export function separationZoom(distMeters: number, lat: number, sepPx: number): number {
  const d = Math.max(distMeters, 1) // duplicate coords: don't zoom to infinity
  return Math.log2((78271.517 * Math.cos((lat * Math.PI) / 180) * sepPx) / d)
}

export interface ClusterFrame {
  /** [[west, south], [east, north]] — feed to fitBounds. */
  bounds: [[number, number], [number, number]]
  /** Cap for fitBounds so tiny clusters don't over-zoom past legibility. */
  maxZoom: number
  neighborCount: number
  /** Distance from the TARGET to its closest neighbour — not the closest
   *  pair anywhere in the cluster, which is what `maxZoom` uses. The
   *  target's own crowding is what decides whether the pin the user asked
   *  for will be legible when the camera stops. */
  nearestNeighborMeters: number
  /** Zoom at which the target clears its nearest neighbour by `labelSepPx`. */
  separationZoom: number
}

/**
 * Frame the target's local cluster, or null when the target stands alone
 * (caller keeps its plain flyTo). Neighbors = pins within `radiusMeters`.
 */
/**
 * How deep the camera may DIVE to separate the pin the user named.
 *
 * Deliberately not the same number as `maxZoom` (2026-08-04). They answer
 * different questions: `maxZoom` asks "how far may fitBounds over-zoom a
 * tiny cluster before containment stops being useful", while this asks
 * "how far may the camera go to make the requested pin legible". Sharing
 * one clamp meant the focus branch computed the zoom it needed — z15.4 for
 * Andy's Year 2 Coronet Peak, 164 m from the Ramada — and then silently
 * settled for 14, rendering the pair 49 px apart with the banners still
 * touching.
 *
 * The ceiling still exists because below roughly 70 m two pins are the
 * same place as far as a camera is concerned. Separating THOSE is a
 * displacement problem (see the deferred pin-separation design), and no
 * amount of zoom is the right answer to it.
 */
const DIVE_CEILING = 16.5

export function clusterFrame(
  target: ClusterPin,
  pins: ClusterPin[],
  opts?: {
    radiusMeters?: number
    labelSepPx?: number
    minZoom?: number
    maxZoom?: number
    separationMaxZoom?: number
  },
): ClusterFrame | null {
  const radius = opts?.radiusMeters ?? 30000
  const sepPx = opts?.labelSepPx ?? 130
  const zMin = opts?.minZoom ?? 8
  const zMax = opts?.maxZoom ?? 14
  const zDive = opts?.separationMaxZoom ?? DIVE_CEILING

  const cluster = pins.filter(
    (p) => p.relationship_id === target.relationship_id || haversineMeters(p, target) <= radius,
  )
  if (cluster.length <= 1) return null

  let minPair = Infinity
  let nearestToTarget = Infinity
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
  for (let i = 0; i < cluster.length; i++) {
    const p = cluster[i]
    west = Math.min(west, p.lng); east = Math.max(east, p.lng)
    south = Math.min(south, p.lat); north = Math.max(north, p.lat)
    if (p.relationship_id !== target.relationship_id) {
      nearestToTarget = Math.min(nearestToTarget, haversineMeters(p, target))
    }
    for (let j = i + 1; j < cluster.length; j++) {
      minPair = Math.min(minPair, haversineMeters(p, cluster[j]))
    }
  }

  return {
    bounds: [[west, south], [east, north]],
    maxZoom: Math.min(zMax, Math.max(zMin, separationZoom(minPair, target.lat, sepPx))),
    neighborCount: cluster.length - 1,
    nearestNeighborMeters: nearestToTarget,
    separationZoom: Math.min(zDive, Math.max(zMin, separationZoom(nearestToTarget, target.lat, sepPx))),
  }
}

export interface Viewport {
  width: number
  height: number
  padTop: number
  padLeft: number
  padRight: number
  padBottom: number
}

/**
 * The zoom `fitBounds` will actually settle on for these bounds in this
 * viewport. Needed because `maxZoom` is only a CAP: handing fitBounds a
 * separation zoom does nothing whenever the cluster's own span forces a
 * shallower one, and nothing in the call site revealed that.
 */
export function zoomToFit(
  bounds: [[number, number], [number, number]],
  view: Viewport,
  lat: number,
): number {
  const [[w, s], [e, n]] = bounds
  const spanX = haversineMeters({ lng: w, lat }, { lng: e, lat })
  const spanY = haversineMeters({ lng: w, lat: s }, { lng: w, lat: n })
  const usableW = Math.max(1, view.width - view.padLeft - view.padRight)
  const usableH = Math.max(1, view.height - view.padTop - view.padBottom)
  const mpp = Math.max(spanX / usableW, spanY / usableH)
  if (!(mpp > 0)) return Infinity // degenerate bounds: nothing constrains the zoom
  return Math.log2((78271.517 * Math.cos((lat * Math.PI) / 180)) / mpp)
}

export type ArrivalPlan =
  /** Nothing nearby — the plain regional fly. */
  | { kind: 'fly' }
  /** The neighbourhood fits AND the target stays legible inside it. */
  | { kind: 'fit'; bounds: [[number, number], [number, number]]; maxZoom: number }
  /** Containment would bury the target: centre on it and separate instead. */
  | { kind: 'focus'; zoom: number }

/**
 * How to land on a pin the user explicitly asked for (search result, ?pin=
 * deep link).
 *
 * The 2026-07-10 J4 rule was "containment beats separation" — fit the local
 * cluster, and accept that a tight pair inside a wide cluster may need one
 * more manual zoom. Andy's 2026-08-04 screenshots are that compromise
 * coming due: his Dartmouth primary residence sat 508 m from a work-travel
 * marker inside a 35 km cluster, so fitBounds settled around z11.3 while
 * separation needed z13.8, and the pin he had just searched for arrived
 * underneath a neighbour's label.
 *
 * So the rule is now conditional, and the condition is who asked. **When
 * the user named ONE pin, that pin's legibility outranks the tour of its
 * neighbourhood** — the neighbours are context, the pin is the request.
 * Containment still wins wherever it costs nothing, which is most of the
 * time and includes the Queenstown case J4 was written for.
 */
export function planPinArrival(
  target: ClusterPin,
  pins: ClusterPin[],
  view: Viewport,
  opts?: Parameters<typeof clusterFrame>[2],
): ArrivalPlan {
  const frame = clusterFrame(target, pins, opts)
  if (!frame) return { kind: 'fly' }
  if (zoomToFit(frame.bounds, view, target.lat) < frame.separationZoom) {
    return { kind: 'focus', zoom: frame.separationZoom }
  }
  return { kind: 'fit', bounds: frame.bounds, maxZoom: frame.maxZoom }
}
