'use client'

/**
 * GlobeView — the residential globe surface (Step 7 Slice 1).
 *
 * Search-first loop: find a place → globe flies there → drag the draft
 * pin to the exact spot → "Add this place" opens the modal → save writes
 * the residence and the pin blooms onto the globe. Existing pins load on
 * mount and connect with a warm arc in placement order.
 *
 * Nocturne aesthetic: globe projection on a dark canvas, ember pins,
 * glass chrome. Heavier interactions (drag-to-refine after save, place
 * types, image, sidekick) are later slices.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import FindLocationBox, { RetrievedPlace } from './FindLocationBox'
import PinModal, { PinDraftData } from './PinModal'
import TripFramePanel, { TripFramingContext } from './TripFramePanel'
import { TRIP_SUBTYPE_LABELS, type TripLeg, type TripRow } from '@/lib/globe/trip-types'
import PinEditPanel from './PinEditPanel'
import PinDetailCard from './PinDetailCard'
import { useUiChrome } from '../UiChromeContext'
import { clusterFrame } from '@/lib/globe/cluster-frame'
import { nextRegime, styleForRegime, NOCTURNE_STYLE, type GlobeRegime } from '@/lib/globe/style-regime'
import { buildCreatePinPayload } from '@/lib/globe/create-pin-payload'
import { suggestTripOrigin } from '@/lib/globe/trip-origin'
import type { ProximityHint } from '@/lib/globe/proximity'
import { pinTypeMeta, PIN_TYPES } from '@/lib/globe/pin-types'
import { moveToIndex } from '@/lib/globe/reorder'

function hintText(h: ProximityHint): string {
  return h.kind === 'returning'
    ? `Near ${h.name}, where you’ve lived before — returning?`
    : `A local move — about ${h.distanceKm} km from ${h.name}.`
}

interface Pin {
  relationship_id: string
  place_entity_id: string
  name: string
  place_subtype: string | null
  description: string | null   // placard — short one-line description (item 1)
  lng: number
  lat: number
  when_text: string | null
  has_memory: boolean
  type_code: string | null         // 'lived_at' = spine; others are markers
  sort_order: number | null        // spine slot; NULL on markers AND on unsequenced primaries (U9)
  anchor_residence_id: string | null  // marker → its primary residence
  prior_anchor_residence_id: string | null  // last anchor before joining the spine (picker default on revert)
}

const SPINE_CODE = 'lived_at'

// The SPINE is the sequenced primaries only (U9, KTD10): an unsequenced
// residence (lived_at, sort_order NULL) is a home awaiting its slot —
// on the globe, but never on the thread or in spine-derived logic.
const isSequencedPrimary = (p: Pin) => p.type_code === SPINE_CODE && p.sort_order !== null

// "Side lines in view" only reveals once the user has zoomed past the
// whole-globe overview into a region, so the zoomed-out globe never clutters.
// (Globe starts at zoom 1.4; a continental/regional view is ~3+.) Tunable.
const LINES_IN_VIEW_MIN_ZOOM = 3

// Per-type pin CSS modifier (base .globe-pin = primary residence).
function pinTypeClass(typeCode: string | null): string {
  switch (typeCode) {
    case 'worked_at': return ' globe-pin--workplace'
    case 'owned_residence_at': return ' globe-pin--second'
    case 'lived_briefly_at': return ' globe-pin--short'
    case 'vacationed_at': return ' globe-pin--vacation'
    case 'traveled_for_work_to': return ' globe-pin--work-travel'
    case 'logged_at': return ' globe-pin--log'
    case 'wants_to_visit': return ' globe-pin--future'
    default: return '' // lived_at / unknown → base ember
  }
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

// Shared camera framing for "go to this pin" navigation (?pin= deep links
// and the find box's pin results). Cluster-aware (2026-07-10): a target
// with close neighbors (Queenstown: four pins in a few km) fits the whole
// local cluster, zoomed toward label separation; a lone target gets the
// plain regional fly. Either way the pin lands above the bottom card.
function framePinOnMap(map: mapboxgl.Map, target: Pin, pins: Pin[]) {
  const frame = clusterFrame(target, pins)
  if (frame) {
    map.fitBounds(frame.bounds, {
      padding: {
        top: 110,
        left: 110,
        right: 110,
        // Keep the cluster above the bottom-anchored card.
        bottom: 110 + Math.round(window.innerHeight * 0.2),
      },
      maxZoom: frame.maxZoom,
      speed: 0.9,
      essential: true,
    })
  } else {
    map.flyTo({
      center: [target.lng, target.lat],
      // Regional-to-local framing: with the card compact, the pin is
      // the subject (Andy's J4 QA, 2026-07-10; was 5).
      zoom: Math.max(map.getZoom(), 8),
      speed: 0.9,
      essential: true,
      // Land the pin above the bottom-anchored card, not behind it.
      offset: [0, -Math.round(window.innerHeight * 0.18)],
    })
  }
}

// Densified great-circle path between two pins. A bare 2-point segment
// breaks down on the globe projection: the line layer and the
// symbol-along-line placement disagree about where a long straight
// segment lies (chevrons float off the arc, zoom-dependent) and the
// segment cuts away from the pins instead of hugging the sphere.
// Interpolating along the great circle gives every layer the same
// geometry at every zoom — and renders as a true flight path.
function greatCirclePath(a: [number, number], b: [number, number]): [number, number][] {
  const toRad = Math.PI / 180
  const toDeg = 180 / Math.PI
  const toVec = ([lng, lat]: [number, number]) => {
    const φ = lat * toRad
    const λ = lng * toRad
    return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)]
  }
  const v1 = toVec(a)
  const v2 = toVec(b)
  const dot = Math.min(1, Math.max(-1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]))
  const ω = Math.acos(dot) // angular distance
  if (ω < 1e-9) return [a, b]
  // ~1 vertex per 0.75° of arc, capped — intra-metro legs stay light,
  // transatlantic legs get enough points to curve smoothly.
  const steps = Math.min(128, Math.max(8, Math.ceil(ω * toDeg / 0.75)))
  const sinω = Math.sin(ω)
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const c1 = Math.sin((1 - t) * ω) / sinω
    const c2 = Math.sin(t * ω) / sinω
    const x = c1 * v1[0] + c2 * v2[0]
    const y = c1 * v1[1] + c2 * v2[1]
    const z = c1 * v1[2] + c2 * v2[2]
    pts.push([Math.atan2(y, x) * toDeg, Math.atan2(z, Math.hypot(x, y)) * toDeg])
  }
  pts[0] = [...a]
  pts[steps] = [...b]
  // Unwrap longitudes so a path crossing the antimeridian stays
  // continuous for the renderer instead of jumping ±360.
  for (let i = 1; i < pts.length; i++) {
    const d = pts[i][0] - pts[i - 1][0]
    if (d > 180) pts[i][0] -= 360
    else if (d < -180) pts[i][0] += 360
  }
  return pts
}

// One feature per life-path leg (pin i → pin i+1), tagged with its
// sequence index so the selected pin's inbound/outbound legs can be
// styled independently. Chevrons render along each leg pointing from
// earlier residence to later one — the line's coordinate order IS the
// direction of the move.
function arcSegments(pins: Pin[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (let i = 0; i < pins.length - 1; i++) {
    features.push({
      type: 'Feature',
      properties: { seq: i },
      geometry: {
        type: 'LineString',
        coordinates: greatCirclePath(
          [pins[i].lng, pins[i].lat],
          [pins[i + 1].lng, pins[i + 1].lat],
        ),
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

// Filter that matches no segment (resting state for the active layers).
const NO_SEGMENT: mapboxgl.FilterSpecification = ['==', ['get', 'seq'], -999]

// A small filled ember chevron, baked as an icon so direction is shown by ONE
// marker per leg sitting on the line (symbol-placement: line-center), rotated to
// travel direction — instead of repeated text carets that drift off the curve
// and read as floating planes. Ember colour baked in; opacity varies per layer.
function makeArrowImage(): ImageData {
  const s = 32
  const c = document.createElement('canvas'); c.width = s; c.height = s
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#f4b14a'
  ctx.beginPath()                 // a chevron ❯ pointing +x (rotated to the line)
  ctx.moveTo(s * 0.30, s * 0.16)
  ctx.lineTo(s * 0.80, s * 0.50)
  ctx.lineTo(s * 0.30, s * 0.84)
  ctx.lineTo(s * 0.48, s * 0.50)
  ctx.closePath()
  ctx.fill()
  return ctx.getImageData(0, 0, s, s)
}

// Tethers: a marker's great-circle line back to the primary residence it
// anchors to. Workplace tethers are the "commute line" (tier 2); the rest
// are dashed trip tethers (tier 3). Markers with no anchor draw nothing.
function tetherFeatures(
  markers: Pin[],
  byId: Map<string, Pin>,
): { commute: GeoJSON.FeatureCollection; trip: GeoJSON.FeatureCollection } {
  const commute: GeoJSON.Feature[] = []
  const trip: GeoJSON.Feature[] = []
  for (const m of markers) {
    if (!m.anchor_residence_id) continue
    const anchor = byId.get(m.anchor_residence_id)
    if (!anchor) continue
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: { rel: m.relationship_id },
      geometry: {
        type: 'LineString',
        coordinates: greatCirclePath([m.lng, m.lat], [anchor.lng, anchor.lat]),
      },
    }
    ;(m.type_code === 'worked_at' ? commute : trip).push(feature)
  }
  return {
    commute: { type: 'FeatureCollection', features: commute },
    trip: { type: 'FeatureCollection', features: trip },
  }
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

// Trip route hue — rose, its own voice among ember (spine), cyan
// (commute), and slate (tethers). Tier 4, subordinate to the spine.
const TRIP_ROUTE_COLOR = '#e0709b'

// Trip routes (Trips & Travel U4): origin → outbound stops → destination
// → return stops → origin, one feature per consecutive pair, tagged by
// leg so the return renders dashed over the solid outbound ("and back").
// Drafts have no origin and draw NOTHING at rest (R6) — except the trip
// being route-built, whose partial stop chain → destination renders so
// the user sees the route grow under their clicks.
function tripRouteFeatures(trips: TripRow[], buildingTripId: string | null): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  const pair = (a: [number, number], b: [number, number], trip: string, kind: TripLeg): GeoJSON.Feature => ({
    type: 'Feature',
    properties: { trip, kind },
    geometry: { type: 'LineString', coordinates: greatCirclePath(a, b) },
  })
  for (const t of trips) {
    if (t.is_draft && t.trip_id !== buildingTripId) continue
    const out: [number, number][] = []
    if (t.origin_lng !== null && t.origin_lat !== null) out.push([t.origin_lng, t.origin_lat])
    for (const s of t.stops) {
      if (s.leg === 'outbound' && s.lng !== null && s.lat !== null) out.push([s.lng, s.lat])
    }
    if (t.destination_lng !== null && t.destination_lat !== null) out.push([t.destination_lng, t.destination_lat])
    for (let i = 0; i < out.length - 1; i++) features.push(pair(out[i], out[i + 1], t.trip_id, 'outbound'))

    const ret: [number, number][] = []
    if (t.destination_lng !== null && t.destination_lat !== null) ret.push([t.destination_lng, t.destination_lat])
    for (const s of t.stops) {
      if (s.leg === 'return' && s.lng !== null && s.lat !== null) ret.push([s.lng, s.lat])
    }
    if (t.return_to_origin && t.origin_lng !== null && t.origin_lat !== null) ret.push([t.origin_lng, t.origin_lat])
    // A return renders only when it says something: return stops exist, or
    // the trip returns to a known origin.
    if (ret.length >= 2 && (t.stops.some((s) => s.leg === 'return') || (t.return_to_origin && t.origin_relationship_id))) {
      for (let i = 0; i < ret.length - 1; i++) features.push(pair(ret[i], ret[i + 1], t.trip_id, 'return'))
    }
  }
  return { type: 'FeatureCollection', features }
}

export default function GlobeView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const pinMarkersRef = useRef<mapboxgl.Marker[]>([])
  const draftMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const bloomIdRef = useRef<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  // Mirrors `refining` for the once-bound map click handler (closures are stale).
  const refiningRef = useRef(false)

  const [ready, setReady] = useState(false)
  const [pins, setPins] = useState<Pin[]>([])
  const [draft, setDraft] = useState<RetrievedPlace | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  // Destination-first trip capture (U3): set right after a "Trip" pin
  // saves; renders the framing panel over the globe.
  const [framing, setFraming] = useState<TripFramingContext | null>(null)
  // Origin capture (U9/AE5): the framing panel asked for a NEW origin
  // pin — the next pin placed becomes this trip's origin (an
  // unsequenced home by default; the spine may not exist yet).
  const [originCapture, setOriginCapture] = useState<{ tripId: string; destinationName: string } | null>(null)
  // "Start a trip from here" (2026-07-19): a home pin armed as the origin
  // of the NEXT trip framed — origin-first entry into the destination-first
  // flow. Consumed when a framing panel closes; cancellable from its banner.
  const [tripFromHere, setTripFromHere] = useState<{ relationshipId: string; name: string } | null>(null)
  // Trip route layer (U4): loaded trips, the hidden-by-default toggle
  // (R10 — the spine stays visually dominant), and route-building mode.
  const [trips, setTrips] = useState<TripRow[]>([])
  const [tripsLoaded, setTripsLoaded] = useState(false)
  const [tripsVisible, setTripsVisible] = useState(false)
  // Home Base (U7/KTD8): the reusable default origin suggestion.
  const [homeBaseId, setHomeBaseId] = useState<string | null>(null)
  const [routeEdit, setRouteEdit] = useState<{ tripId: string; leg: TripLeg } | null>(null)
  // Refs mirror route-edit state for the once-bound map/marker handlers.
  const routeEditRef = useRef<{ tripId: string; leg: TripLeg } | null>(null)
  useEffect(() => { routeEditRef.current = routeEdit }, [routeEdit])
  const routeClickRef = useRef<((relationshipId: string) => void) | null>(null)

  // Basemap regime (style-regime, 2026-07-18): a setStyle swap wipes every
  // source/layer/image, so the latest line data + selected-leg emphasis live
  // in refs — the style.load installer re-creates everything from them
  // without waiting for (or re-running) the data effects.
  const regimeRef = useRef<GlobeRegime>('nocturne')
  const lineDataRef = useRef<{
    arcs?: GeoJSON.FeatureCollection
    commute?: GeoJSON.FeatureCollection
    tethers?: GeoJSON.FeatureCollection
    tripRoutes?: GeoJSON.FeatureCollection
  }>({})
  const activeArcRef = useRef<{ filter: mapboxgl.FilterSpecification; idx: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Pin click opens the read view (detail card); Edit escalates to the
  // edit panel, which is also what arms drag-to-relocate.
  const [editMode, setEditMode] = useState(false)
  // Lightweight "refine location" mode (Phase-5 finding 1): arms drag on the
  // selected pin straight from the detail card, without opening the full edit
  // panel — for nudging a marker to array close pins legibly.
  const [refining, setRefining] = useState(false)
  const [stagedCoords, setStagedCoords] = useState<{ lng: number; lat: number } | null>(null)
  const [savingPanel, setSavingPanel] = useState(false)
  const [hint, setHint] = useState<ProximityHint | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [legendOpen, setLegendOpen] = useState(false)
  // Hover card (item 1): name + placard at the pin's screen position.
  const [hovered, setHovered] = useState<{ name: string; description: string | null; x: number; y: number } | null>(null)
  // Line declutter (item 3 / Slice 3.5, reworked 2026-06-24): default view is
  // the bare spine. Lines are controlled GLOBALLY only — no per-pin tray.
  //  - hoverPreview: transient peek of a hovered pin's side lines.
  //  - typeFilters: per-class baseline ("show all Vacations").
  //  - linesInView: reveal side lines of pins in the current viewport, but only
  //    once zoomed past the whole-globe view (auto-gated) so the overview stays
  //    clean. viewVersion ticks on map move so the tether effect re-evaluates.
  const [hoverPreview, setHoverPreview] = useState<string | null>(null)
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set())
  const [linesInView, setLinesInView] = useState(false)
  const [viewVersion, setViewVersion] = useState(0)
  const { setAssistantSuppressed, assistantSeed, setViewingEntity } = useUiChrome()

  // Proximity hints are advisory — auto-dismiss after a few seconds.
  useEffect(() => {
    if (!hint) return
    const t = setTimeout(() => setHint(null), 7000)
    return () => clearTimeout(t)
  }, [hint])

  // Save confirmations auto-dismiss too.
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const hasPins = pins.length > 0

  useEffect(() => { refiningRef.current = refining }, [refining])

  // Suppress the global CaptureAssistant FAB only while the pin EDIT
  // panel is open — it's fixed z-50 and would overlap the panel (it was
  // hiding the Delete button). With just the detail card open (bottom
  // center) the FAB stays available, so a selected pin can be the
  // subject of a capture-assistant recollection.
  useEffect(() => {
    setAssistantSuppressed(selectedId !== null && editMode)
    return () => setAssistantSuppressed(false)
  }, [selectedId, editMode, setAssistantSuppressed])

  // Write-up hand-off (2026-07-09): clicking ✍ on a jot in the EDIT panel
  // needs the assistant, but the edit panel is exactly what suppresses it.
  // A seed arriving while editing means the user is switching tasks —
  // leave edit mode so the panel yields to the interview.
  useEffect(() => {
    if (assistantSeed && editMode) setEditMode(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantSeed])

  // Ambient context for the assistant (2026-07-09): the selected pin is
  // what "this place" means in a capture conversation.
  useEffect(() => {
    const p = pins.find((x) => x.relationship_id === selectedId)
    setViewingEntity(p ? { entity_id: p.place_entity_id, entity_name: p.name, entity_type: 'place' } : null)
    return () => setViewingEntity(null)
  }, [selectedId, pins, setViewingEntity])

  const loadPins = useCallback(async () => {
    try {
      const res = await fetch('/api/globe/residence')
      if (!res.ok) throw new Error()
      const { pins } = await res.json()
      setPins(pins ?? [])
    } catch {
      setError('Could not load your places.')
    }
  }, [])

  // Place or move the draggable draft pin.
  const setDraftAt = useCallback((lng: number, lat: number, label: string) => {
    setDraft((prev) => ({ lng, lat, label: label || prev?.label || '' }))
    const map = mapRef.current
    if (!map) return
    if (!draftMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'globe-pin-draft'
      const marker = new mapboxgl.Marker({ element: el, draggable: true })
      marker.on('dragend', () => {
        const ll = marker.getLngLat()
        setDraft((prev) => (prev ? { ...prev, lng: ll.lng, lat: ll.lat } : { lng: ll.lng, lat: ll.lat, label: '' }))
      })
      draftMarkerRef.current = marker
    }
    draftMarkerRef.current.setLngLat([lng, lat]).addTo(map)
  }, [])

  const clearDraft = useCallback(() => {
    draftMarkerRef.current?.remove()
    setDraft(null)
    setModalOpen(false)
  }, [])

  const deselect = useCallback(() => {
    selectedIdRef.current = null
    setSelectedId(null)
    setEditMode(false)
    setRefining(false)
    setStagedCoords(null)
    setHovered(null)
    setHoverPreview(null)
  }, [])

  // Compact detail card on J4 arrival (2026-07-10): geography first, the
  // full card one click away. Any ordinary selection path resets it.
  const [compactCard, setCompactCard] = useState(false)

  // Select an existing pin — opens the detail card (and clears any
  // in-progress new pin).
  const selectPin = useCallback((relId: string) => {
    draftMarkerRef.current?.remove()
    setDraft(null)
    setModalOpen(false)
    selectedIdRef.current = relId
    setSelectedId(relId)
    setEditMode(false)
    setRefining(false)
    setStagedCoords(null)
    setCompactCard(false)
    // Clear the hover card/preview so the floating name flag can't superimpose
    // over the detail card (and persist into Edit) for the just-clicked pin.
    setHovered(null)
    setHoverPreview(null)
  }, [])

  // ── ?pin= handoff (Journey J4) ────────────────────────────────────
  // Arriving with /globe?pin=<relationshipId> (from a Journey card or a
  // shared link) selects that pin and flies to it once the pins and map
  // are ready. One-shot; read via window.location to keep the map free
  // of router re-renders.
  //
  // Andy's J4 QA (2026-07-10): the arrival used to center the pin exactly
  // behind the detail card. Two mitigations: the camera aims the pin at
  // the upper half (offset above the bottom card), and the card arrives
  // COMPACT — geography first, full data one click away.
  const deepLinkDoneRef = useRef(false)
  useEffect(() => {
    if (deepLinkDoneRef.current || pins.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const wanted = params.get('pin')
    const wantedTrip = params.get('trip')
    if (!wanted && !wantedTrip) { deepLinkDoneRef.current = true; return }
    let target: Pin | undefined
    if (wanted) {
      target = pins.find((p) => p.relationship_id === wanted)
    } else {
      // ?trip= handoff (U5): arrive on the trip's destination pin —
      // selection reveals the trip strip and its complete route (U4).
      // Trips load in their own fetch; wait for it before resolving.
      if (!tripsLoaded) return
      const t = trips.find((x) => x.trip_id === wantedTrip)
      target = t ? pins.find((p) => p.relationship_id === t.destination_relationship_id) : undefined
    }
    deepLinkDoneRef.current = true
    if (!target) return
    selectPin(target.relationship_id)
    if (params.get('edit') === '1') {
      // "Edit on globe →" from a Journey stop (2026-07-10): straight into
      // the pin edit panel — no compact strip, no extra click.
      setEditMode(true)
    } else {
      setCompactCard(true) // after selectPin — selection paths reset it
    }
    // The map may still be initializing on a cold load — retry the fly
    // briefly rather than racing it.
    let tries = 0
    const fly = () => {
      const map = mapRef.current
      if (map) {
        framePinOnMap(map, target, pins)
        return
      }
      if (++tries < 15) setTimeout(fly, 200)
    }
    fly()
  }, [pins, trips, tripsLoaded, selectPin])

  // Mirror the current selection into ?pin= (replace, never push) so
  // switching to Journey — or copying the URL — lands on the same stop.
  useEffect(() => {
    if (!deepLinkDoneRef.current) return
    const url = selectedId ? `${window.location.pathname}?pin=${selectedId}` : window.location.pathname
    window.history.replaceState(null, '', url)
  }, [selectedId])

  // Step to the previous/next home along the residential spine and fly the
  // globe to it (QA feature request). Spine-only for MVP; significant
  // marker "children" (workplaces, second residences) are a deferred design
  // — see documentation/feature_residential_globe_onboarding.md.
  const navigateSpine = useCallback((dir: -1 | 1) => {
    const spine = pins.filter(isSequencedPrimary)
    const idx = spine.findIndex((p) => p.relationship_id === selectedId)
    if (idx < 0) return
    const next = spine[idx + dir]
    if (!next) return
    selectPin(next.relationship_id)
    // Preserve the user's zoom; flyTo arcs (zoom out → in) on long hops,
    // giving the requested smooth re-orientation.
    mapRef.current?.flyTo({ center: [next.lng, next.lat], speed: 0.8, curve: 1.6, essential: true })
  }, [pins, selectedId, selectPin])

  // Initialise the map once.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: NOCTURNE_STYLE,
      center: [0, 20],
      zoom: 1.4,
      attributionControl: false,
    })
    mapRef.current = map

    // Installs every chronicle source/layer/image into the CURRENT style,
    // seeded from lineDataRef so a basemap swap comes back fully drawn.
    // Idempotent (first source guards) — runs on every style.load.
    const installChronicleLayers = () => {
      if (map.getSource('trip-tethers')) return
      const data = lineDataRef.current
      // Tethers first, so the residential spine always draws on top of them.
      // Tier 3 — dashed, dim, no glow: trips that aren't a change of residence.
      map.addSource('trip-tethers', { type: 'geojson', data: data.tethers ?? EMPTY_FC })
      map.addLayer({
        id: 'trip-tethers',
        type: 'line',
        source: 'trip-tethers',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          // Cool, desaturated slate — deliberately NOT a dimmer ember so trip
          // tethers read as distinct from the glowing spine (item 3 note).
          'line-color': '#94a0c4',
          'line-width': 1.1,
          'line-opacity': 0.55,
          'line-dasharray': [2, 2.5],
        },
      })
      // Tier 4 — trip routes (Trips & Travel U4): rose journey arcs,
      // hidden by default behind the Trips toggle / selection (R10).
      // Solid outbound; dashed return reads as "and back".
      map.addSource('trip-routes', { type: 'geojson', data: data.tripRoutes ?? EMPTY_FC })
      map.addLayer({
        id: 'trip-routes-outbound',
        type: 'line',
        source: 'trip-routes',
        filter: ['==', ['get', 'kind'], 'outbound'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': TRIP_ROUTE_COLOR, 'line-width': 1.4, 'line-opacity': 0.75, 'line-blur': 0.2 },
      })
      map.addLayer({
        id: 'trip-routes-return',
        type: 'line',
        source: 'trip-routes',
        filter: ['==', ['get', 'kind'], 'return'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': TRIP_ROUTE_COLOR, 'line-width': 1.2, 'line-opacity': 0.6, 'line-dasharray': [1.6, 1.8] },
      })

      // Tier 2 — commute line (home → workplace): solid, weightier, cool,
      // a soft glow. Superior to trip tethers, subordinate to the spine.
      map.addSource('commute-lines', { type: 'geojson', data: data.commute ?? EMPTY_FC })
      map.addLayer({
        id: 'commute-lines',
        type: 'line',
        source: 'commute-lines',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#5fc6dc', 'line-width': 1.5, 'line-opacity': 0.7, 'line-blur': 0.3 },
      })

      // Tier 1 — the residential spine (lived_at), solid glowing chevron arcs.
      map.addSource('arcs', { type: 'geojson', data: data.arcs ?? arcSegments([]) })
      map.addLayer({
        id: 'arcs',
        type: 'line',
        source: 'arcs',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f4b14a', 'line-width': 1.6, 'line-opacity': 0.55, 'line-blur': 0.4 },
      })
      // Selected pin's legs: inbound ("approached from") brighter than
      // outbound ("egressed to"). Paint expressions are set on selection.
      map.addLayer({
        id: 'arcs-active',
        type: 'line',
        source: 'arcs',
        filter: NO_SEGMENT,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f4b14a', 'line-width': 2.4, 'line-opacity': 0.85 },
      })
      if (!map.hasImage('arc-arrow')) map.addImage('arc-arrow', makeArrowImage())
      // ONE chevron per leg, placed at the leg's centre ON the line
      // (line-center) and rotated to travel direction. Guaranteed on-line —
      // no drift, no floating-plane look (Andy 2026-06-24). A baked icon, not
      // a text caret, so the shape reads as directional flow.
      map.addLayer({
        id: 'arc-chevrons',
        type: 'symbol',
        source: 'arcs',
        layout: {
          'symbol-placement': 'line-center',
          'icon-image': 'arc-arrow',
          'icon-size': 0.7,
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-opacity': 0.6 },
      })
      map.addLayer({
        id: 'arc-chevrons-active',
        type: 'symbol',
        source: 'arcs',
        filter: NO_SEGMENT,
        layout: {
          'symbol-placement': 'line-center',
          'icon-image': 'arc-arrow',
          'icon-size': 0.95,
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-opacity': 0.95 },
      })
      // Re-arm the selected pin's leg emphasis (filters/paint died with
      // the old style; DOM markers survive on their own).
      const active = activeArcRef.current
      if (active) {
        const inOut = (inbound: number, outbound: number): mapboxgl.ExpressionSpecification =>
          ['case', ['==', ['get', 'seq'], active.idx - 1], inbound, outbound]
        map.setFilter('arcs-active', active.filter)
        map.setFilter('arc-chevrons-active', active.filter)
        map.setPaintProperty('arcs-active', 'line-opacity', inOut(0.95, 0.55))
        map.setPaintProperty('arcs-active', 'line-width', inOut(2.8, 2.2))
        map.setPaintProperty('arc-chevrons-active', 'icon-opacity', inOut(0.95, 0.6))
      }
    }

    map.on('style.load', () => {
      map.setProjection('globe')
      // The ember-space atmosphere belongs to nocturne; daylight keeps the
      // outdoors style's own sky (invisible at reading zoom anyway).
      if (regimeRef.current === 'nocturne') {
        map.setFog({
          color: 'rgb(13,20,38)',
          'high-color': 'rgb(36,52,102)',
          'horizon-blend': 0.2,
          'space-color': 'rgb(7,11,24)',
          'star-intensity': 0.5,
        })
      }
      installChronicleLayers()
    })

    map.on('load', () => {
      map.resize()
      setReady(true)
      loadPins()
    })

    // Zoom-gate the at-rest pin NAMES (2026-07-10): DOM markers get no
    // collision culling, so world-scale views with every name visible are
    // label soup. From regional zoom in, names join the when-chips; the
    // selected pin's name always shows (CSS handles both).
    const applyNameGate = () => {
      map.getContainer().classList.toggle('globe-names-on', map.getZoom() >= 4)
    }
    map.on('zoom', applyNameGate)
    map.on('load', applyNameGate)

    // Basemap regime (2026-07-18): nocturne is the identity view — the map
    // as CANVAS; past reading zoom the map is a DOCUMENT and crosses to the
    // detailed outdoors style (Andy's Sunshine Village comparison).
    // Hysteresis lives in lib/globe/style-regime; the fade class masks the
    // style reload as a deliberate dissolve.
    const applyRegime = () => {
      const next = nextRegime(map.getZoom(), regimeRef.current)
      if (next === regimeRef.current) return
      regimeRef.current = next
      const el = map.getContainer()
      el.classList.add('globe-basemap-fading')
      el.classList.toggle('globe-daylight', next === 'daylight')
      map.setStyle(styleForRegime(next))
      // 'idle' = new style fully rendered; the timeout is a fallback in
      // case continued interaction starves idle.
      map.once('idle', () => el.classList.remove('globe-basemap-fading'))
      window.setTimeout(() => el.classList.remove('globe-basemap-fading'), 1500)
    }
    map.on('zoom', applyRegime)

    // Tick on pan/zoom so the "side lines in view" reveal re-evaluates.
    map.on('moveend', () => setViewVersion((v) => v + 1))

    map.on('click', (e) => {
      // While refining a pin's location, ignore stray map clicks (e.g. a
      // drag-release) — the refine banner owns Save/Cancel.
      if (refiningRef.current) return
      // While building a trip route, the globe is a click target for
      // STOPS only (pins) — empty-globe clicks do nothing.
      if (routeEditRef.current) return
      // Clicking empty globe: deselect an open pin, else drop a new draft.
      if (selectedIdRef.current) { deselect(); return }
      setDraftAt(e.lngLat.lng, e.lngLat.lat, '')
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [loadPins, setDraftAt, deselect])

  // Re-render pin markers + arcs + tethers whenever pins change.
  useEffect(() => {
    if (!ready) return
    const map = mapRef.current!

    // The connected glowing spine is the primary-residence sequence only;
    // every other type is a marker that tethers to its anchor primary.
    const spine = pins.filter(isSequencedPrimary)
    // The origin pin (item 2): wherever the journey starts — sequence
    // position #1, not a semantic "birth" field. Calm "infancy" treatment.
    const originId = spine[0]?.relationship_id ?? null

    // Trip destination markers (R11) + draft "needs framing" flags (R6).
    const tripDest = new Map<string, boolean>() // relationship_id → any draft?
    for (const t of trips) {
      tripDest.set(t.destination_relationship_id,
        (tripDest.get(t.destination_relationship_id) ?? false) || t.is_draft)
    }

    pinMarkersRef.current.forEach((m) => m.remove())
    pinMarkersRef.current = []
    pins.forEach((p) => {
      const isSel = p.relationship_id === selectedId && (editMode || refining) // draggable while editing or refining
      const isTripDest = tripDest.has(p.relationship_id)
      const isTripDraft = tripDest.get(p.relationship_id) === true
      const isUnplaced = p.type_code === SPINE_CODE && p.sort_order === null
      const el = document.createElement('div')
      el.className =
        'globe-pin' +
        pinTypeClass(p.type_code) +
        (p.relationship_id === originId ? ' globe-pin-origin' : '') +
        (isTripDest ? ' globe-pin-trip-dest' : '') +
        (isTripDraft ? ' globe-pin-trip-draft' : '') +
        (isUnplaced ? ' globe-pin-unplaced' : '') +
        (bloomIdRef.current === p.place_entity_id ? ' globe-pin-bloom' : '') +
        (p.relationship_id === selectedId ? ' globe-pin-selected' : '')
      // Selection ring/glow read this var so they match the pin's type hue.
      el.style.setProperty('--pin-ring', pinTypeMeta(p.type_code).color)
      el.title = p.name
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        // Route-building mode (U4): a pin click is "add this stop", not a
        // selection. Ref-based so the once-bound handler never goes stale.
        if (routeEditRef.current) { routeClickRef.current?.(p.relationship_id); return }
        // A post-drag click on the pin currently being refined/edited must NOT
        // re-select it — selectPin resets refining, which was wiping the "Save
        // location" banner before you could click it (Refine location was broken).
        if (isSel) return
        selectPin(p.relationship_id)
      })
      // At-rest label (item 1 + Andy's 2026-07-10 call): the pin's NAME on
      // one line above its `when` phrase, glanceable without interaction.
      // Absolutely positioned below the dot so it never shifts the dot off
      // its coordinate (pins stay aligned with the arcs). Names are
      // zoom-gated via a container class (DOM markers get no collision
      // culling — world view would be label soup); the when line and the
      // selected pin's name always show.
      if (p.when_text || p.name) {
        const chip = document.createElement('span')
        chip.className = 'globe-pin-chip'
        if (p.name) {
          const nameLine = document.createElement('span')
          nameLine.className = 'globe-pin-name'
          nameLine.textContent = p.name
          chip.appendChild(nameLine)
        }
        if (p.when_text) {
          const whenLine = document.createElement('span')
          whenLine.className = 'globe-pin-when'
          whenLine.textContent = p.when_text
          chip.appendChild(whenLine)
        }
        if (isTripDraft) {
          const flag = document.createElement('span')
          flag.className = 'globe-pin-draft-flag'
          flag.textContent = 'trip to frame'
          chip.appendChild(flag)
        }
        if (isUnplaced) {
          const flag = document.createElement('span')
          flag.className = 'globe-pin-unplaced-flag'
          flag.textContent = 'not yet placed'
          chip.appendChild(flag)
        }
        el.appendChild(chip)
      }
      // Hover card (item 1): name + placard, to orient before clicking through.
      el.addEventListener('mouseenter', () => {
        const pt = map.project([p.lng, p.lat])
        setHovered({ name: p.name, description: p.description, x: pt.x, y: pt.y })
        setHoverPreview(p.relationship_id)
      })
      el.addEventListener('mouseleave', () => {
        setHovered((h) => (h?.name === p.name ? null : h))
        setHoverPreview((cur) => (cur === p.relationship_id ? null : cur))
      })
      const marker = new mapboxgl.Marker({ element: el, draggable: isSel }).setLngLat([p.lng, p.lat]).addTo(map)
      if (isSel) {
        marker.on('dragend', () => {
          const ll = marker.getLngLat()
          setStagedCoords({ lng: ll.lng, lat: ll.lat })
        })
      }
      pinMarkersRef.current.push(marker)
    })
    bloomIdRef.current = null

    const arcData = arcSegments(spine)
    lineDataRef.current.arcs = arcData
    const arcSrc = map.getSource('arcs') as mapboxgl.GeoJSONSource | undefined
    arcSrc?.setData(arcData)
    // Tether visibility (item 3) is driven by hover preview in its own effect
    // below — default view is the bare spine.

    // Directional emphasis for a selected SPINE pin: its inbound leg
    // (seq = idx-1, "approached from") renders brighter than its outbound
    // leg (seq = idx, "egressed to"). Markers have no spine legs.
    const idx = spine.findIndex((p) => p.relationship_id === selectedId)
    const activeFilter: mapboxgl.FilterSpecification =
      idx >= 0
        ? ['any', ['==', ['get', 'seq'], idx - 1], ['==', ['get', 'seq'], idx]]
        : NO_SEGMENT
    activeArcRef.current = idx >= 0 ? { filter: activeFilter, idx } : null
    const inOut = (inbound: number, outbound: number): mapboxgl.ExpressionSpecification =>
      ['case', ['==', ['get', 'seq'], idx - 1], inbound, outbound]
    for (const layer of ['arcs-active', 'arc-chevrons-active'] as const) {
      if (map.getLayer(layer)) map.setFilter(layer, activeFilter)
    }
    if (idx >= 0) {
      if (map.getLayer('arcs-active')) {
        map.setPaintProperty('arcs-active', 'line-opacity', inOut(0.95, 0.55))
        map.setPaintProperty('arcs-active', 'line-width', inOut(2.8, 2.2))
      }
      if (map.getLayer('arc-chevrons-active')) {
        map.setPaintProperty('arc-chevrons-active', 'icon-opacity', inOut(0.95, 0.6))
      }
    }
  }, [pins, trips, ready, selectedId, editMode, refining, selectPin])

  // Tether visibility (item 3): default = none (bare spine); a hovered pin
  // transiently reveals its associated side lines — a primary shows the
  // tethers of markers anchored to it; a marker shows its own. Kept in its
  // own effect so hovering only re-sets the two line sources, not every pin.
  useEffect(() => {
    if (!ready) return
    const map = mapRef.current!
    const markers = pins.filter((p) => p.type_code !== SPINE_CODE)
    const byId = new Map(pins.map((p) => [p.relationship_id, p]))
    // "In view" reveal is gated to regional zoom so the world view stays clean.
    const bounds = map.getBounds()
    const inViewActive = linesInView && map.getZoom() >= LINES_IN_VIEW_MIN_ZOOM && bounds !== null
    const within = (p: Pin | undefined) => !!p && !!bounds && bounds.contains([p.lng, p.lat])
    // A marker's tether shows if (baseline) its class is filter-enabled, OR
    // (in view) it or its anchor is on screen at regional zoom, OR (transient)
    // it/its anchor is the hovered pin.
    const visible = markers.filter((m) => {
      const inFilter = typeFilters.has(m.type_code ?? '')
      const inView = inViewActive &&
        (within(m) || (m.anchor_residence_id !== null && within(byId.get(m.anchor_residence_id))))
      const inHover = hoverPreview !== null &&
        (m.relationship_id === hoverPreview || m.anchor_residence_id === hoverPreview)
      return inFilter || inView || inHover
    })
    const { commute, trip } = tetherFeatures(visible, byId)
    lineDataRef.current.commute = commute
    lineDataRef.current.tethers = trip
    ;(map.getSource('commute-lines') as mapboxgl.GeoJSONSource | undefined)?.setData(commute)
    ;(map.getSource('trip-tethers') as mapboxgl.GeoJSONSource | undefined)?.setData(trip)
  }, [pins, ready, hoverPreview, typeFilters, linesInView, viewVersion])

  // ── Trips (U4): load, route visibility, route building ──────────────
  const loadTrips = useCallback(async () => {
    try {
      const res = await fetch('/api/trips')
      if (!res.ok) return
      const d = await res.json()
      setTrips(d.trips ?? [])
      setHomeBaseId(d.homeBaseRelationshipId ?? null)
    } catch { /* non-fatal — the globe works without routes */
    } finally {
      setTripsLoaded(true) // even on failure — deep links must not hang
    }
  }, [])
  useEffect(() => { if (ready) void loadTrips() }, [ready, loadTrips])

  // Which routes render: all framed trips when the toggle is on; always
  // the trips touching the selected pin (their complete route, R10) and
  // the trip being route-built.
  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    const touches = (t: TripRow) =>
      t.destination_relationship_id === selectedId ||
      t.origin_relationship_id === selectedId ||
      t.stops.some((s) => s.relationship_id === selectedId) ||
      t.trip_id === routeEdit?.tripId
    const visible = trips.filter((t) => tripsVisible || touches(t))
    const routeData = tripRouteFeatures(visible, routeEdit?.tripId ?? null)
    lineDataRef.current.tripRoutes = routeData // before the src guard — a mid-swap update must survive
    const src = map?.getSource('trip-routes') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    src.setData(routeData)
  }, [trips, tripsVisible, selectedId, routeEdit, ready])

  // Route building: a pin click appends a stop to the active leg. Kept in
  // a ref so the once-bound marker click handlers never go stale.
  routeClickRef.current = (relationshipId: string) => {
    const edit = routeEditRef.current
    if (!edit) return
    void (async () => {
      setError(null)
      try {
        const res = await fetch(`/api/trips/${edit.tripId}/stops`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ relationshipId, leg: edit.leg }),
        })
        if (!res.ok) {
          const b = await res.json().catch(() => ({}))
          throw new Error(b.detail || b.error || `HTTP ${res.status}`)
        }
        await loadTrips()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not add the stop.')
      }
    })()
  }

  const removeStop = useCallback(async (tripId: string, stopId: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/trips/${tripId}/stops/${stopId}`, { method: 'DELETE' })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail || b.error || `HTTP ${res.status}`)
      }
      await loadTrips()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the stop.')
    }
  }, [loadTrips])

  const nudgeStop = useCallback(async (trip: TripRow, leg: TripLeg, stopId: string, dir: -1 | 1) => {
    const legStops = trip.stops.filter((s) => s.leg === leg).sort((a, b) => a.position - b.position)
    const idx = legStops.findIndex((s) => s.stop_id === stopId)
    const to = idx + dir
    if (idx < 0 || to < 0 || to >= legStops.length) return
    const order = legStops.map((s) => s.stop_id)
    ;[order[idx], order[to]] = [order[to], order[idx]]
    setError(null)
    try {
      const res = await fetch(`/api/trips/${trip.trip_id}/stops`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leg, orderedStopIds: order }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail || b.error || `HTTP ${res.status}`)
      }
      await loadTrips()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reorder the stops.')
    }
  }, [loadTrips])

  // Retroactive framing (U6, R14): the selected pin becomes a trip's
  // destination — the pin row itself is untouched (proven in U1).
  const frameSelectedAsTrip = useCallback(async (subtype: string) => {
    const selPin = pins.find((p) => p.relationship_id === selectedId)
    if (!selPin) return
    setError(null)
    try {
      // Future-place promotion (U8, R20): "been there now" — the
      // aspiration becomes history: re-type the pin to the subtype's
      // historical code, then frame the visit as a trip.
      if (selPin.type_code === 'wants_to_visit') {
        const promoteTo = subtype === 'professional' ? 'traveled_for_work_to' : 'vacationed_at'
        const promoteRes = await fetch(`/api/globe/residence/${selPin.relationship_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: selPin.name,
            whenText: selPin.when_text ?? '',
            typeCode: promoteTo,
            anchorId: selPin.anchor_residence_id,
          }),
        })
        if (!promoteRes.ok) {
          const b = await promoteRes.json().catch(() => ({}))
          throw new Error(b.detail || b.error || `HTTP ${promoteRes.status}`)
        }
        await loadPins()
      }
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationRelationshipId: selPin.relationship_id,
          subtype,
          whenText: selPin.when_text || undefined,
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail || b.error || `HTTP ${res.status}`)
      }
      const { tripId } = await res.json()
      await loadTrips()
      setFraming({
        tripId,
        destinationName: selPin.name,
        suggestedOriginId: suggestTripOrigin({
          armedOriginId: tripFromHere?.relationshipId,
          anchorId: selPin.anchor_residence_id,
          homeBaseId,
        }),
        defaultWhen: selPin.when_text ?? '',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not frame the trip.')
    }
  }, [pins, selectedId, loadTrips, loadPins, homeBaseId, tripFromHere])

  // Un-framing (U6, R14): delete the trip, keep the pin. Two-step inline
  // confirm (the edit panel's delete pattern).
  const [confirmUnframe, setConfirmUnframe] = useState<string | null>(null)
  const unframeTrip = useCallback(async (tripId: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: 'DELETE' })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail || b.error || `HTTP ${res.status}`)
      }
      setConfirmUnframe(null)
      await loadTrips()
      setNotice('Trip removed — the pin and its recollections are untouched.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the trip.')
    }
  }, [loadTrips])

  const handleRetrieve = useCallback((place: RetrievedPlace) => {
    const map = mapRef.current
    if (!map) return
    deselect()
    map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 9), speed: 0.9 })
    setDraftAt(place.lng, place.lat, place.label)
  }, [setDraftAt, deselect])

  // Pin search (2026-07-18): a "Your pins" result navigates — fly to and
  // select the pin, arriving compact like a ?pin= deep link. During
  // route-building a pick means "add this stop", exactly what clicking
  // the pin itself would do (then fly, helpful for far-away stops).
  const handleSearchSelectPin = useCallback((relId: string) => {
    const target = pins.find((p) => p.relationship_id === relId)
    if (!target) return
    if (routeEditRef.current) {
      routeClickRef.current?.(relId)
    } else {
      selectPin(relId)
      setCompactCard(true) // after selectPin — selection paths reset it
    }
    const map = mapRef.current
    if (map) framePinOnMap(map, target, pins)
  }, [pins, selectPin])

  const handleSave = useCallback(async (data: PinDraftData) => {
    if (!draft) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/globe/residence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Assembled by the exhaustiveness-guarded builder — inline field
        // lists dropped U9's `unsequenced` (the 2026-07-18 decide-later bug).
        body: JSON.stringify(buildCreatePinPayload(draft, data)),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail || b.error || `HTTP ${res.status}`)
      }
      const { pin, proximity } = await res.json()
      // An insert shifts other pins' sort_order, so reload the whole chain
      // rather than appending; the bloom is keyed off the new place id.
      bloomIdRef.current = pin.place_entity_id
      await loadPins()
      clearDraft()
      setHint(proximity ?? null)

      // Origin capture (U9/AE5): this pin IS the awaited trip origin.
      if (originCapture) {
        const patch = await fetch(`/api/trips/${originCapture.tripId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ originRelationshipId: pin.relationship_id }),
        })
        if (!patch.ok) {
          const b = await patch.json().catch(() => ({}))
          throw new Error(`The pin is saved, but setting it as the trip origin failed: ${b.detail || b.error || `HTTP ${patch.status}`}`)
        }
        setOriginCapture(null)
        await loadTrips()
        setNotice(`Origin set — ${data.name?.trim() || 'the new pin'} starts the ${originCapture.destinationName} trip.`)
        return
      }

      // Destination-first trip capture (U3): the pin is the destination;
      // create the draft trip, then offer the optional framing step. The
      // pin's anchor doubles as the origin suggestion ("home at the time").
      if (data.trip) {
        const tripRes = await fetch('/api/trips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destinationRelationshipId: pin.relationship_id,
            subtype: data.trip.subtype,
            whenText: data.whenText || undefined,
          }),
        })
        if (!tripRes.ok) {
          const b = await tripRes.json().catch(() => ({}))
          throw new Error(`The pin is saved, but the trip draft failed: ${b.detail || b.error || `HTTP ${tripRes.status}`}`)
        }
        const { tripId } = await tripRes.json()
        await loadTrips()
        setFraming({
          tripId,
          destinationName: data.name?.trim() || draft.label || 'This place',
          // Armed "from here" origin first, then anchor ("home at the
          // time"), then Home Base when unanchored (R16).
          suggestedOriginId: suggestTripOrigin({
            armedOriginId: tripFromHere?.relationshipId,
            anchorId: data.anchorId,
            homeBaseId,
          }),
          defaultWhen: data.whenText,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place the pin.')
    } finally {
      setSaving(false)
    }
  }, [draft, clearDraft, loadPins, loadTrips, homeBaseId, originCapture, tripFromHere])

  const handlePanelSave = useCallback(async (fields: { name: string; whenText: string; body: string; typeCode: string; anchorId: string | null; description: string }) => {
    if (!selectedId) return
    setSavingPanel(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = { ...fields }
      if (stagedCoords) { payload.lng = stagedCoords.lng; payload.lat = stagedCoords.lat }
      const res = await fetch(`/api/globe/residence/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail || b.error || `HTTP ${res.status}`)
      }
      const body = await res.json().catch(() => ({}))
      await loadPins()
      // Land back on the (refreshed) detail card rather than vanishing —
      // seeing the updated recollection is the save confirmation.
      setEditMode(false)
      setStagedCoords(null)
      setNotice(`Saved — ${fields.name || 'your place'} is up to date.`)
      setHint(body.proximity ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the pin.')
    } finally {
      setSavingPanel(false)
    }
  }, [selectedId, stagedCoords, loadPins])

  // Persist a refine-mode relocation (coords only). Re-send the pin's
  // current name + when phrase so the PATCH doesn't clear them (a null
  // p_when_text deletes the chip; null p_body leaves the finalized memory
  // intact). Type/anchor are left untouched (typeCode omitted).
  const handleRefineSave = useCallback(async () => {
    if (!selectedId || !stagedCoords) return
    const sel = pins.find((p) => p.relationship_id === selectedId)
    if (!sel) return
    setSavingPanel(true)
    setError(null)
    try {
      const res = await fetch(`/api/globe/residence/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lng: stagedCoords.lng, lat: stagedCoords.lat,
          name: sel.name, whenText: sel.when_text ?? '',
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail || b.error || `HTTP ${res.status}`)
      }
      const body = await res.json().catch(() => ({}))
      await loadPins()
      setRefining(false)
      setStagedCoords(null)
      setNotice(`Moved — ${sel.name || 'your place'} repositioned.`)
      setHint(body.proximity ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move the pin.')
    } finally {
      setSavingPanel(false)
    }
  }, [selectedId, stagedCoords, pins, loadPins])

  const cancelRefine = useCallback(() => {
    setRefining(false)
    setStagedCoords(null) // toggling refining re-renders markers back to saved coords
  }, [])

  // Per-class type filters (Legend & filters).
  const toggleTypeFilter = useCallback((code: string) => {
    setTypeFilters((cur) => {
      const next = new Set(cur)
      if (next.has(code)) next.delete(code); else next.add(code)
      return next
    })
  }, [])

  // Persist a full spine ordering. Reorder operates on the residential spine
  // only (the RPC rejects marker ids and any list that doesn't cover exactly
  // the user's residences), so callers pass the complete ordered id list.
  const resequence = useCallback(async (order: string[]) => {
    setSavingPanel(true)
    setError(null)
    try {
      const res = await fetch('/api/globe/residence/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: order }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail || b.error || `HTTP ${res.status}`)
      }
      await loadPins()   // selection (selectedId) persists across the reload
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reorder.')
    } finally {
      setSavingPanel(false)
    }
  }, [loadPins])

  // Nudge the selected pin one slot earlier/later (adjacent swap).
  const handleMove = useCallback((dir: -1 | 1) => {
    if (!selectedId) return
    const spine = pins.filter(isSequencedPrimary)
    const idx = spine.findIndex((p) => p.relationship_id === selectedId)
    const to = idx + dir
    if (idx < 0 || to < 0 || to >= spine.length) return
    void resequence(moveToIndex(spine.map((p) => p.relationship_id), idx, to))
  }, [selectedId, pins, resequence])

  // Jump the selected pin directly to an arbitrary slot (edit-panel selector).
  const handleMoveTo = useCallback((toIndex: number) => {
    if (!selectedId) return
    const spine = pins.filter(isSequencedPrimary)
    const idx = spine.findIndex((p) => p.relationship_id === selectedId)
    if (idx < 0 || toIndex === idx) return
    void resequence(moveToIndex(spine.map((p) => p.relationship_id), idx, toIndex))
  }, [selectedId, pins, resequence])

  // Spine membership (U9): place an unsequenced home at a slot, or
  // demote a sequenced one back to "not yet placed".
  const handleSequence = useCallback(async (position: number | null) => {
    if (!selectedId) return
    setSavingPanel(true)
    setError(null)
    try {
      const res = await fetch(`/api/globe/residence/${selectedId}/sequence`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail || b.error || `HTTP ${res.status}`)
      }
      await loadPins()
      setNotice(position === null
        ? 'Set aside — not yet placed in your journey. Everything on the pin is kept.'
        : 'Placed — the home joined your journey.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the sequence.')
    } finally {
      setSavingPanel(false)
    }
  }, [selectedId, loadPins])

  const handlePanelDelete = useCallback(async () => {
    if (!selectedId) return
    setSavingPanel(true)
    setError(null)
    try {
      const res = await fetch(`/api/globe/residence/${selectedId}`, { method: 'DELETE' })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        const raw = String(b.detail || b.error || `HTTP ${res.status}`)
        // The trips FK blocks deleting a destination pin by design
        // (2026-07-15 decision) — translate the constraint into the action.
        throw new Error(
          /trips_destination_relationship_id_fkey|violates foreign key/.test(raw)
            ? 'This pin is a trip’s destination. Unframe or remove the trip first (select the pin and use its trip strip), then delete.'
            : raw,
        )
      }
      await loadPins()
      await loadTrips()
      deselect()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the pin.')
    } finally {
      setSavingPanel(false)
    }
  }, [selectedId, loadPins, loadTrips, deselect])

  return (
    <div className="nocturne relative h-screen w-screen overflow-hidden">
      {/* h-full (not absolute inset-0): mapbox-gl.css forces
          .mapboxgl-map { position: relative }, which overrides Tailwind's
          .absolute and collapses an inset-0 container to height 0. */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Find Location — search-first entry */}
      <div className="absolute left-1/2 top-6 z-20 w-[min(440px,90vw)] -translate-x-1/2">
        <FindLocationBox accessToken={TOKEN} pins={pins} onRetrieve={handleRetrieve} onSelectPin={handleSearchSelectPin} />
      </div>

      {/* Pin count */}
      {hasPins && (
        <div className="glass absolute left-6 top-6 z-20 rounded-xl px-3 py-2 text-sm text-[var(--ink-dim)]">
          <span className="nocturne-display mr-1 text-[var(--ink)]">{pins.length}</span>
          place{pins.length === 1 ? '' : 's'} on your globe
        </div>
      )}

      {/* Way home — the globe is full-screen chrome with no app shell */}
      <a
        href="/dashboard"
        className="glass absolute right-6 top-6 z-20 rounded-xl px-3 py-2 text-sm text-[var(--ink-dim)] hover:text-[var(--ink)]"
      >
        ← Dashboard
      </a>

      {/* Bottom-left Legend & filters — the sole control for line visibility:
          per-class baseline toggles + a "side lines in view" reveal. No tray;
          lines are global only (reworked 2026-06-24). */}
      {hasPins && (
        <div className="absolute bottom-6 left-6 z-20 flex flex-col items-start gap-2">
          <div className="glass rounded-xl text-xs text-[var(--ink-dim)]">
            <button
              onClick={() => setLegendOpen((o) => !o)}
              className="flex w-full items-center gap-2 px-3 py-2 text-[var(--ink)] hover:text-[var(--ember-soft)]"
            >
              <span className="text-[var(--ember-soft)]">{legendOpen ? '▾' : '▸'}</span>
              Legend &amp; filters
            </button>
            {legendOpen && (
              <div className="space-y-1 px-2 pb-2">
                {/* Primary residence is the spine — always shown, not a filter. */}
                <div className="flex items-center gap-2.5 px-1 py-0.5">
                  <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
                    <span className="globe-pin !cursor-default" style={{ position: 'static' }} />
                  </span>
                  <span>Primary residence</span>
                  <span className="ml-auto text-[10px] text-[var(--ink-dim)]/60">spine</span>
                </div>
                {PIN_TYPES.filter((t) => !t.isSpine).map((t) => {
                  const on = typeFilters.has(t.code)
                  return (
                    <button
                      key={t.code}
                      onClick={() => toggleTypeFilter(t.code)}
                      title={on ? `Hide all ${t.label}` : `Show all ${t.label}`}
                      className={
                        'flex w-full items-center gap-2.5 rounded-lg px-1 py-0.5 text-left hover:bg-white/5 ' +
                        (on ? 'text-[var(--ink)]' : 'text-[var(--ink-dim)]')
                      }
                    >
                      <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
                        <span className={`${pinTypeClass(t.code)} !cursor-default`} style={{ position: 'static' }} />
                      </span>
                      <span>{t.label}</span>
                      <span className={'ml-auto text-[10px] ' + (on ? 'text-[var(--ember-soft)]' : 'text-[var(--ink-dim)]/50')}>
                        {on ? '● shown' : '○ hidden'}
                      </span>
                    </button>
                  )
                })}
                {/* Side lines in view — reveal on-screen pins' side lines when
                    zoomed into a region (auto-gated; off at the world view). */}
                <button
                  onClick={() => setLinesInView((v) => !v)}
                  title="Show side lines for places currently on screen (when zoomed in)"
                  className={
                    'mt-1 flex w-full items-center gap-2.5 rounded-lg border-t border-[var(--glass-border)] px-1 pt-2 text-left hover:bg-white/5 ' +
                    (linesInView ? 'text-[var(--ink)]' : 'text-[var(--ink-dim)]')
                  }
                >
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[var(--ember-soft)]">⊙</span>
                  <span>Side lines in view</span>
                  <span className={'ml-auto text-[10px] ' + (linesInView ? 'text-[var(--ember-soft)]' : 'text-[var(--ink-dim)]/50')}>
                    {linesInView ? '● on' : '○ off'}
                  </span>
                </button>
                {/* Trip routes (U4) — hidden by default so the spine stays
                    visually dominant (R10); the selected trip always shows. */}
                <button
                  onClick={() => setTripsVisible((v) => !v)}
                  title="Show every framed trip's route arcs"
                  className={
                    'flex w-full items-center gap-2.5 rounded-lg px-1 py-0.5 text-left hover:bg-white/5 ' +
                    (tripsVisible ? 'text-[var(--ink)]' : 'text-[var(--ink-dim)]')
                  }
                >
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center" style={{ color: TRIP_ROUTE_COLOR }}>✈</span>
                  <span>Trip routes</span>
                  <span className={'ml-auto text-[10px] ' + (tripsVisible ? 'text-[var(--ember-soft)]' : 'text-[var(--ink-dim)]/50')}>
                    {tripsVisible ? '● on' : '○ off'}
                  </span>
                </button>
                <div className="mt-1 space-y-1.5 border-t border-[var(--glass-border)] px-1 pt-2">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-block h-0 w-6 border-t-2 border-[var(--ember)]" style={{ boxShadow: '0 0 6px var(--ember)' }} />
                    <span>Residential transit ›</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="inline-block h-0 w-6 border-t-2" style={{ borderColor: '#5fc6dc' }} />
                    <span>Commute (home → work)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="inline-block h-0 w-6 border-t border-dashed" style={{ borderColor: '#94a0c4' }} />
                    <span>Anchor tether</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="inline-block h-0 w-6 border-t-2" style={{ borderColor: TRIP_ROUTE_COLOR }} />
                    <span>Trip route (out / ⌁ back)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Opening prompt on an empty globe */}
      {ready && !hasPins && !draft && (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 flex flex-col items-center px-6 text-center">
          <h1 className="nocturne-display text-4xl font-medium text-[var(--ink)] drop-shadow-[0_2px_16px_rgba(0,0,0,0.6)]">
            Where did your life begin?
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--ink-dim)]">
            Search for the first place you lived, then drag the pin to the exact spot.
            Your globe fills as you go.
          </p>
        </div>
      )}

      {/* Draft confirm bar */}
      {draft && !modalOpen && (
        <div className="glass absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3">
          <span className="text-sm text-[var(--ink-dim)]">
            Drag the pin to the exact spot{draft.label ? ` — ${draft.label}` : ''}
          </span>
          <button
            onClick={clearDraft}
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--ink-dim)] hover:text-[var(--ink)]"
          >
            Cancel
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-[var(--ember)] px-4 py-1.5 text-sm font-medium text-[#241500] hover:bg-[var(--ember-soft)]"
          >
            Add this place
          </button>
        </div>
      )}

      {error && (
        <div className="absolute bottom-6 right-6 z-30 rounded-lg bg-rose-900/70 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      )}

      {notice && (
        <div className="glass absolute right-6 top-20 z-30 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-[var(--ink)]">
          <span className="text-[var(--ember-soft)]">✓</span>
          <span>{notice}</span>
        </div>
      )}

      {hint && (
        <div className="glass absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-[var(--ink)]">
          <span className="text-[var(--ember-soft)]">◍</span>
          <span>{hintText(hint)}</span>
          <button
            onClick={() => setHint(null)}
            className="ml-1 text-[var(--ink-dim)] hover:text-[var(--ink)]"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {modalOpen && draft && (
        <PinModal
          placeLabel={draft.label || 'This place'}
          saving={saving}
          primaries={pins
            .filter(isSequencedPrimary)
            .map((p) => ({ relationship_id: p.relationship_id, name: p.name }))}
          allPins={pins.map((p) => ({ relationship_id: p.relationship_id, name: p.name, type_code: p.type_code, sort_order: p.sort_order }))}
          onSave={handleSave}
          onCancel={() => setModalOpen(false)}
          originCapture={!!originCapture}
          defaultTypeCode={tripFromHere ? 'trip' : undefined}
        />
      )}

      {framing && (
        <TripFramePanel
          ctx={framing}
          pins={pins.map((p) => ({ relationship_id: p.relationship_id, name: p.name, type_code: p.type_code }))}
          onDone={(notice) => {
            setFraming(null)
            setTripFromHere(null) // the armed "from here" origin is consumed with its framing
            if (notice) setNotice(notice)
            void loadTrips()
          }}
          onAddOrigin={() => {
            setOriginCapture({ tripId: framing.tripId, destinationName: framing.destinationName })
            setFraming(null)
          }}
        />
      )}

      {/* Origin-capture banner (U9/AE5): the next pin becomes the origin. */}
      {originCapture && !modalOpen && (
        <div className="glass absolute left-1/2 top-6 z-40 flex max-w-[min(560px,92vw)] -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-[var(--ink)]">
          <span style={{ color: TRIP_ROUTE_COLOR }}>✈</span>
          <span>
            Pin where the <strong>{originCapture.destinationName}</strong> trip began — search or
            click the globe. It can stay “not yet placed” in your journey.
          </span>
          <button
            onClick={() => setOriginCapture(null)}
            className="ml-1 text-[var(--ink-dim)] hover:text-[var(--ink)]"
            aria-label="Cancel origin capture"
          >
            ✕
          </button>
        </div>
      )}

      {/* "Start a trip from here" banner: the armed origin awaits its
          destination — search or click the globe (mirrors origin capture). */}
      {tripFromHere && !modalOpen && !originCapture && !framing && (
        <div className="glass absolute left-1/2 top-6 z-40 flex max-w-[min(560px,92vw)] -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-[var(--ink)]">
          <span style={{ color: TRIP_ROUTE_COLOR }}>✈</span>
          <span>
            Trip from <strong>{tripFromHere.name}</strong> — now pin where it went
            (the place that marked the turn toward home).
          </span>
          <button
            onClick={() => setTripFromHere(null)}
            className="ml-1 text-[var(--ink-dim)] hover:text-[var(--ink)]"
            aria-label="Cancel trip from here"
          >
            ✕
          </button>
        </div>
      )}

      {/* Trips touching the selected pin (U4): frame drafts, build routes.
          U6 adds the other half: a non-primary pin with NO trip offers
          "frame as trip" (R14) — the Wallace Monument path. */}
      {selectedId && !editMode && !refining && !routeEdit && !framing && (() => {
        const mine = trips.filter((t) =>
          t.destination_relationship_id === selectedId ||
          t.origin_relationship_id === selectedId ||
          t.stops.some((s) => s.relationship_id === selectedId))
        const selPin = pins.find((p) => p.relationship_id === selectedId)
        // A residence summarizes rather than enumerates (U7, R19): homes
        // with many departures link to the Travel Journal instead of
        // stacking rows over the globe.
        if (selPin && (selPin.type_code === SPINE_CODE || selPin.type_code === null)) {
          const fromHere = trips.filter((t) => t.origin_relationship_id === selectedId).length
          return (
            <div className="glass absolute left-1/2 top-20 z-30 flex max-w-[min(560px,92vw)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs text-[var(--ink)]">
              <span style={{ color: TRIP_ROUTE_COLOR }}>✈</span>
              {fromHere > 0 && <span>{fromHere} trip{fromHere === 1 ? '' : 's'} originated here</span>}
              {homeBaseId === selectedId && (
                <span className="rounded-full border border-[var(--glass-border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--ember-soft)]">
                  home base
                </span>
              )}
              {/* Origin-first entry (2026-07-19, Andy's ask): arm this home
                  as the next trip's origin, then place the destination. */}
              <button
                onClick={() => {
                  setTripFromHere({ relationshipId: selPin.relationship_id, name: selPin.name })
                  deselect()
                }}
                className="rounded-lg border border-[var(--glass-border)] px-2 py-0.5 hover:text-[var(--ember-soft)]"
              >
                Start a trip from here
              </button>
              {fromHere > 0 && (
                <a href="/journey?mode=travel" className="ml-auto rounded-lg border border-[var(--glass-border)] px-2 py-0.5 hover:text-[var(--ember-soft)]">
                  Travel Journal →
                </a>
              )}
            </div>
          )
        }
        if (mine.length === 0) {
          if (!selPin || selPin.type_code === SPINE_CODE || selPin.type_code === null) return null
          return (
            <div className="glass absolute left-1/2 top-20 z-30 flex max-w-[min(560px,92vw)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs text-[var(--ink)]">
              <span style={{ color: TRIP_ROUTE_COLOR }}>✈</span>
              <span className="text-[var(--ink-dim)]">
                {selPin.type_code === 'wants_to_visit'
                  ? 'Been there now? It becomes a real place + trip:'
                  : 'This was a journey? Frame it as a trip:'}
              </span>
              {(Object.keys(TRIP_SUBTYPE_LABELS) as (keyof typeof TRIP_SUBTYPE_LABELS)[]).map((s) => (
                <button
                  key={s}
                  onClick={() => void frameSelectedAsTrip(s)}
                  className="rounded-lg border border-[var(--glass-border)] px-2 py-0.5 hover:text-[var(--ember-soft)]"
                >
                  {TRIP_SUBTYPE_LABELS[s]}
                </button>
              ))}
            </div>
          )
        }
        return (
          <div className="glass absolute left-1/2 top-20 z-30 flex max-w-[min(560px,92vw)] -translate-x-1/2 flex-col gap-1.5 rounded-xl px-3 py-2 text-xs text-[var(--ink)]">
            {mine.map((t) => (
              <div key={t.trip_id} className="flex flex-wrap items-center gap-2">
                <span style={{ color: TRIP_ROUTE_COLOR }}>✈</span>
                <span className="font-medium">{t.title || `Trip to ${t.destination_name}`}</span>
                <span className="text-[var(--ink-dim)]">{TRIP_SUBTYPE_LABELS[t.subtype]}{t.when_text ? ` · ${t.when_text}` : ''}</span>
                {t.is_draft && (
                  <span className="rounded-full border border-[var(--glass-border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide" style={{ color: TRIP_ROUTE_COLOR }}>
                    needs framing
                  </span>
                )}
                <span className="ml-auto flex gap-1.5">
                  <button
                    onClick={() => setFraming({
                      tripId: t.trip_id,
                      destinationName: t.title || t.destination_name,
                      suggestedOriginId: suggestTripOrigin({
                        existingOriginId: t.origin_relationship_id,
                        armedOriginId: tripFromHere?.relationshipId,
                        anchorId: selPin?.anchor_residence_id,
                      }),
                      defaultWhen: t.when_text ?? '',
                    })}
                    className="rounded-lg border border-[var(--glass-border)] px-2 py-0.5 hover:text-[var(--ember-soft)]"
                  >
                    {t.is_draft ? 'Frame' : 'Edit frame'}
                  </button>
                  <button
                    onClick={() => setRouteEdit({ tripId: t.trip_id, leg: 'outbound' })}
                    className="rounded-lg border border-[var(--glass-border)] px-2 py-0.5 hover:text-[var(--ember-soft)]"
                  >
                    Route
                  </button>
                  {confirmUnframe === t.trip_id ? (
                    <button
                      onClick={() => void unframeTrip(t.trip_id)}
                      className="rounded-lg border border-rose-400/50 px-2 py-0.5 text-rose-300 hover:bg-rose-500/10"
                    >
                      Really remove the trip? The pin stays.
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setConfirmUnframe(t.trip_id)
                        setTimeout(() => setConfirmUnframe((c) => (c === t.trip_id ? null : c)), 4000)
                      }}
                      className="rounded-lg border border-[var(--glass-border)] px-2 py-0.5 text-[var(--ink-dim)] hover:text-rose-300"
                      title="Delete the trip; the pin and its recollections are untouched"
                    >
                      Unframe
                    </button>
                  )}
                </span>
              </div>
            ))}
            {/* Reuse this destination (U7, R17): repeat visits stay
                distinct trips on the same pin (R2). */}
            {selPin && selPin.type_code !== SPINE_CODE && (
              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--glass-border)] pt-1.5 text-[var(--ink-dim)]">
                <span>Another trip here:</span>
                {(Object.keys(TRIP_SUBTYPE_LABELS) as (keyof typeof TRIP_SUBTYPE_LABELS)[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => void frameSelectedAsTrip(s)}
                    className="rounded-lg border border-[var(--glass-border)] px-2 py-0.5 hover:text-[var(--ember-soft)]"
                  >
                    {TRIP_SUBTYPE_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Route-building banner (U4): click pins in travel order. */}
      {routeEdit && (() => {
        const t = trips.find((x) => x.trip_id === routeEdit.tripId)
        if (!t) return null
        const legStops = (leg: TripLeg) => t.stops.filter((s) => s.leg === leg).sort((a, b) => a.position - b.position)
        return (
          <div className="glass absolute left-1/2 top-6 z-40 w-[min(600px,94vw)] -translate-x-1/2 rounded-xl px-4 py-3 text-xs text-[var(--ink)]">
            <div className="flex flex-wrap items-center gap-2">
              <span style={{ color: TRIP_ROUTE_COLOR }}>✈</span>
              <span className="font-medium">{t.title || `Trip to ${t.destination_name}`} — building the route</span>
              <span className="ml-auto flex items-center gap-1.5">
                {(['outbound', 'return'] as TripLeg[]).map((leg) => (
                  <button
                    key={leg}
                    onClick={() => setRouteEdit({ tripId: t.trip_id, leg })}
                    className={
                      'rounded-full px-2.5 py-0.5 ' +
                      (routeEdit.leg === leg
                        ? 'bg-[var(--ember)] font-medium text-[#241500]'
                        : 'border border-[var(--glass-border)] text-[var(--ink-dim)] hover:text-[var(--ink)]')
                    }
                  >
                    {leg === 'outbound' ? 'Outbound' : 'Return'}
                  </button>
                ))}
                <button
                  onClick={() => setRouteEdit(null)}
                  className="rounded-full bg-[var(--ember)] px-3 py-0.5 font-medium text-[#241500]"
                >
                  Done
                </button>
              </span>
            </div>
            <p className="mt-1.5 text-[var(--ink-dim)]">
              Click pins on the globe in travel order to add {routeEdit.leg} stops.
              New places: pin them first (a Log works well), then click them.
            </p>
            {(['outbound', 'return'] as TripLeg[]).map((leg) => {
              const stops = legStops(leg)
              if (stops.length === 0) return null
              return (
                <div key={leg} className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--ink-dim)]">{leg}:</span>
                  {stops.map((s, i) => (
                    <span key={s.stop_id} className="flex items-center gap-1 rounded-full border border-[var(--glass-border)] px-2 py-0.5">
                      <span>{s.name}</span>
                      <button onClick={() => void nudgeStop(t, leg, s.stop_id, -1)} disabled={i === 0} className="text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-30" aria-label="Move earlier">‹</button>
                      <button onClick={() => void nudgeStop(t, leg, s.stop_id, 1)} disabled={i === stops.length - 1} className="text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-30" aria-label="Move later">›</button>
                      <button onClick={() => void removeStop(t.trip_id, s.stop_id)} className="text-[var(--ink-dim)] hover:text-red-300" aria-label="Remove stop">✕</button>
                    </span>
                  ))}
                </div>
              )
            })}
          </div>
        )
      })()}

      {hovered && !selectedId && (
        <div
          className="glass pointer-events-none absolute z-40 max-w-[240px] -translate-x-1/2 -translate-y-full rounded-xl px-3 py-2"
          style={{ left: hovered.x, top: hovered.y - 18 }}
        >
          <p className="nocturne-display text-sm font-medium leading-tight text-[var(--ink)]">{hovered.name}</p>
          {hovered.description && (
            <p className="mt-0.5 text-xs leading-snug text-[var(--ink-dim)]">{hovered.description}</p>
          )}
        </div>
      )}

      {refining && !editMode && selectedId && (
        <div className="glass absolute left-1/2 top-6 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 text-sm text-[var(--ink)]">
          <span className="text-[var(--ink-dim)]">
            {stagedCoords ? 'New position set.' : 'Drag the pin to reposition it.'}
          </span>
          <button
            onClick={handleRefineSave}
            disabled={!stagedCoords || savingPanel}
            className="rounded-full bg-[var(--ember)] px-3 py-1 text-xs font-medium text-[#241500] disabled:opacity-40"
          >
            {savingPanel ? 'Saving…' : 'Save location'}
          </button>
          <button
            onClick={cancelRefine}
            disabled={savingPanel}
            className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      )}

      {selectedId && (() => {
        const sel = pins.find((p) => p.relationship_id === selectedId)
        if (!sel) return null
        // Position/total are SPINE-relative: a marker is off-spine (-1) and
        // shows no "stop N of M" or reorder controls.
        const spine = pins.filter(isSequencedPrimary)
        const spinePos = spine.findIndex((p) => p.relationship_id === selectedId)
        const primaries = spine.map((p) => ({ relationship_id: p.relationship_id, name: p.name }))
        const allPins = pins.map((p) => ({ relationship_id: p.relationship_id, name: p.name, type_code: p.type_code, sort_order: p.sort_order }))
        return editMode ? (
          <PinEditPanel
            pin={sel}
            relocated={stagedCoords !== null}
            saving={savingPanel}
            position={spinePos}
            total={spine.length}
            primaries={primaries}
            allPins={allPins}
            onMove={handleMove}
            onMoveTo={handleMoveTo}
            onPlace={(i) => void handleSequence(i)}
            onUnsequence={() => void handleSequence(null)}
            onSave={handlePanelSave}
            onDelete={handlePanelDelete}
            onClose={deselect}
          />
        ) : (
          <PinDetailCard
            pin={sel}
            position={spinePos}
            total={spine.length}
            refining={refining}
            compact={compactCard}
            onExpand={() => setCompactCard(false)}
            onNavigate={navigateSpine}
            onRefine={() => { setStagedCoords(null); setRefining(true) }}
            onEdit={() => { setRefining(false); setEditMode(true) }}
            onClose={deselect}
            onSelectAnchored={(relId) => { selectPin(relId); const t = pins.find((x) => x.relationship_id === relId); if (t) mapRef.current?.flyTo({ center: [t.lng, t.lat], speed: 0.7, essential: true }) }}
          />
        )
      })()}
    </div>
  )
}
