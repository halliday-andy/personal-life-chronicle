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
}

/**
 * Frame the target's local cluster, or null when the target stands alone
 * (caller keeps its plain flyTo). Neighbors = pins within `radiusMeters`.
 */
export function clusterFrame(
  target: ClusterPin,
  pins: ClusterPin[],
  opts?: { radiusMeters?: number; labelSepPx?: number; minZoom?: number; maxZoom?: number },
): ClusterFrame | null {
  const radius = opts?.radiusMeters ?? 30000
  const sepPx = opts?.labelSepPx ?? 130
  const zMin = opts?.minZoom ?? 8
  const zMax = opts?.maxZoom ?? 14

  const cluster = pins.filter(
    (p) => p.relationship_id === target.relationship_id || haversineMeters(p, target) <= radius,
  )
  if (cluster.length <= 1) return null

  let minPair = Infinity
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
  for (let i = 0; i < cluster.length; i++) {
    const p = cluster[i]
    west = Math.min(west, p.lng); east = Math.max(east, p.lng)
    south = Math.min(south, p.lat); north = Math.max(north, p.lat)
    for (let j = i + 1; j < cluster.length; j++) {
      minPair = Math.min(minPair, haversineMeters(p, cluster[j]))
    }
  }

  const zoom = Math.min(zMax, Math.max(zMin, separationZoom(minPair, target.lat, sepPx)))
  return {
    bounds: [[west, south], [east, north]],
    maxZoom: zoom,
    neighborCount: cluster.length - 1,
  }
}
