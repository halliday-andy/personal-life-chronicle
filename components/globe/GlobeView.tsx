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
import PinEditPanel from './PinEditPanel'
import PinDetailCard from './PinDetailCard'
import { useUiChrome } from '../UiChromeContext'
import type { ProximityHint } from '@/lib/globe/proximity'
import { pinTypeMeta } from '@/lib/globe/pin-types'
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
  anchor_residence_id: string | null  // marker → its primary residence
  prior_anchor_residence_id: string | null  // last anchor before joining the spine (picker default on revert)
}

const SPINE_CODE = 'lived_at'

// Per-type pin CSS modifier (base .globe-pin = primary residence).
function pinTypeClass(typeCode: string | null): string {
  switch (typeCode) {
    case 'worked_at': return ' globe-pin--workplace'
    case 'owned_residence_at': return ' globe-pin--second'
    case 'lived_briefly_at': return ' globe-pin--short'
    case 'vacationed_at': return ' globe-pin--vacation'
    case 'traveled_for_work_to': return ' globe-pin--work-travel'
    default: return '' // lived_at / unknown → base ember
  }
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

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

export default function GlobeView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const pinMarkersRef = useRef<mapboxgl.Marker[]>([])
  const draftMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const bloomIdRef = useRef<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)

  const [ready, setReady] = useState(false)
  const [pins, setPins] = useState<Pin[]>([])
  const [draft, setDraft] = useState<RetrievedPlace | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
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
  // Line declutter (item 3): default view is the bare spine; hovering a pin
  // transiently previews its associated side lines. `hoverPreview` is the
  // hovered pin's relationship_id (a primary reveals its markers' tethers; a
  // marker reveals its own). Click-to-persist + type filters land in Slice 3.5.
  const [hoverPreview, setHoverPreview] = useState<string | null>(null)
  const { setAssistantSuppressed } = useUiChrome()

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

  // Suppress the global CaptureAssistant FAB only while the pin EDIT
  // panel is open — it's fixed z-50 and would overlap the panel (it was
  // hiding the Delete button). With just the detail card open (bottom
  // center) the FAB stays available, so a selected pin can be the
  // subject of a capture-assistant recollection.
  useEffect(() => {
    setAssistantSuppressed(selectedId !== null && editMode)
    return () => setAssistantSuppressed(false)
  }, [selectedId, editMode, setAssistantSuppressed])

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
  }, [])

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
  }, [])

  // Step to the previous/next home along the residential spine and fly the
  // globe to it (QA feature request). Spine-only for MVP; significant
  // marker "children" (workplaces, second residences) are a deferred design
  // — see documentation/feature_residential_globe_onboarding.md.
  const navigateSpine = useCallback((dir: -1 | 1) => {
    const spine = pins.filter((p) => p.type_code === SPINE_CODE)
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
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [0, 20],
      zoom: 1.4,
      attributionControl: false,
    })
    mapRef.current = map

    map.on('style.load', () => {
      map.setProjection('globe')
      map.setFog({
        color: 'rgb(13,20,38)',
        'high-color': 'rgb(36,52,102)',
        'horizon-blend': 0.2,
        'space-color': 'rgb(7,11,24)',
        'star-intensity': 0.5,
      })
    })

    map.on('load', () => {
      // Tethers first, so the residential spine always draws on top of them.
      // Tier 3 — dashed, dim, no glow: trips that aren't a change of residence.
      map.addSource('trip-tethers', { type: 'geojson', data: EMPTY_FC })
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
      // Tier 2 — commute line (home → workplace): solid, weightier, cool,
      // a soft glow. Superior to trip tethers, subordinate to the spine.
      map.addSource('commute-lines', { type: 'geojson', data: EMPTY_FC })
      map.addLayer({
        id: 'commute-lines',
        type: 'line',
        source: 'commute-lines',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#5fc6dc', 'line-width': 1.5, 'line-opacity': 0.7, 'line-blur': 0.3 },
      })

      // Tier 1 — the residential spine (lived_at), solid glowing chevron arcs.
      map.addSource('arcs', { type: 'geojson', data: arcSegments([]) })
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
      // Faint chevrons along every leg — direction at a glance without
      // arrowhead clutter on the resting globe.
      map.addLayer({
        id: 'arc-chevrons',
        type: 'symbol',
        source: 'arcs',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 95,
          'text-field': '›',
          'text-size': 18,
          'text-keep-upright': false,
          'text-rotation-alignment': 'map',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': '#f4b14a', 'text-opacity': 0.5 },
      })
      map.addLayer({
        id: 'arc-chevrons-active',
        type: 'symbol',
        source: 'arcs',
        filter: NO_SEGMENT,
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 72,
          'text-field': '›',
          'text-size': 22,
          'text-keep-upright': false,
          'text-rotation-alignment': 'map',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': '#f4b14a', 'text-opacity': 0.95 },
      })
      map.resize()
      setReady(true)
      loadPins()
    })

    map.on('click', (e) => {
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
    const spine = pins.filter((p) => p.type_code === SPINE_CODE)
    // The origin pin (item 2): wherever the journey starts — sequence
    // position #1, not a semantic "birth" field. Calm "infancy" treatment.
    const originId = spine[0]?.relationship_id ?? null

    pinMarkersRef.current.forEach((m) => m.remove())
    pinMarkersRef.current = []
    pins.forEach((p) => {
      const isSel = p.relationship_id === selectedId && (editMode || refining) // draggable while editing or refining
      const el = document.createElement('div')
      el.className =
        'globe-pin' +
        pinTypeClass(p.type_code) +
        (p.relationship_id === originId ? ' globe-pin-origin' : '') +
        (bloomIdRef.current === p.place_entity_id ? ' globe-pin-bloom' : '') +
        (p.relationship_id === selectedId ? ' globe-pin-selected' : '')
      // Selection ring/glow read this var so they match the pin's type hue.
      el.style.setProperty('--pin-ring', pinTypeMeta(p.type_code).color)
      el.title = p.name
      el.addEventListener('click', (ev) => { ev.stopPropagation(); selectPin(p.relationship_id) })
      // At-rest temporal chip (item 1): the pin's `when` phrase, glanceable
      // without interaction. Absolutely positioned below the dot so it never
      // shifts the dot off its coordinate (pins stay aligned with the arcs).
      if (p.when_text) {
        const chip = document.createElement('span')
        chip.className = 'globe-pin-chip'
        chip.textContent = p.when_text
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

    const arcSrc = map.getSource('arcs') as mapboxgl.GeoJSONSource | undefined
    arcSrc?.setData(arcSegments(spine))
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
        map.setPaintProperty('arc-chevrons-active', 'text-opacity', inOut(0.95, 0.6))
      }
    }
  }, [pins, ready, selectedId, editMode, refining, selectPin])

  // Tether visibility (item 3): default = none (bare spine); a hovered pin
  // transiently reveals its associated side lines — a primary shows the
  // tethers of markers anchored to it; a marker shows its own. Kept in its
  // own effect so hovering only re-sets the two line sources, not every pin.
  useEffect(() => {
    if (!ready) return
    const map = mapRef.current!
    const markers = pins.filter((p) => p.type_code !== SPINE_CODE)
    const byId = new Map(pins.map((p) => [p.relationship_id, p]))
    const visible = hoverPreview
      ? markers.filter((m) => m.relationship_id === hoverPreview || m.anchor_residence_id === hoverPreview)
      : []
    const { commute, trip } = tetherFeatures(visible, byId)
    ;(map.getSource('commute-lines') as mapboxgl.GeoJSONSource | undefined)?.setData(commute)
    ;(map.getSource('trip-tethers') as mapboxgl.GeoJSONSource | undefined)?.setData(trip)
  }, [pins, ready, hoverPreview])

  const handleRetrieve = useCallback((place: RetrievedPlace) => {
    const map = mapRef.current
    if (!map) return
    deselect()
    map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 9), speed: 0.9 })
    setDraftAt(place.lng, place.lat, place.label)
  }, [setDraftAt, deselect])

  const handleSave = useCallback(async (data: PinDraftData) => {
    if (!draft) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/globe/residence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lng: draft.lng, lat: draft.lat, label: draft.label,
          whenText: data.whenText, body: data.body, position: data.position,
          typeCode: data.typeCode, anchorId: data.anchorId, description: data.description,
        }),
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place the pin.')
    } finally {
      setSaving(false)
    }
  }, [draft, clearDraft, loadPins])

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
    const spine = pins.filter((p) => p.type_code === SPINE_CODE)
    const idx = spine.findIndex((p) => p.relationship_id === selectedId)
    const to = idx + dir
    if (idx < 0 || to < 0 || to >= spine.length) return
    void resequence(moveToIndex(spine.map((p) => p.relationship_id), idx, to))
  }, [selectedId, pins, resequence])

  // Jump the selected pin directly to an arbitrary slot (edit-panel selector).
  const handleMoveTo = useCallback((toIndex: number) => {
    if (!selectedId) return
    const spine = pins.filter((p) => p.type_code === SPINE_CODE)
    const idx = spine.findIndex((p) => p.relationship_id === selectedId)
    if (idx < 0 || toIndex === idx) return
    void resequence(moveToIndex(spine.map((p) => p.relationship_id), idx, toIndex))
  }, [selectedId, pins, resequence])

  const handlePanelDelete = useCallback(async () => {
    if (!selectedId) return
    setSavingPanel(true)
    setError(null)
    try {
      const res = await fetch(`/api/globe/residence/${selectedId}`, { method: 'DELETE' })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail || b.error || `HTTP ${res.status}`)
      }
      await loadPins()
      deselect()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the pin.')
    } finally {
      setSavingPanel(false)
    }
  }, [selectedId, loadPins, deselect])

  return (
    <div className="nocturne relative h-screen w-screen overflow-hidden">
      {/* h-full (not absolute inset-0): mapbox-gl.css forces
          .mapboxgl-map { position: relative }, which overrides Tailwind's
          .absolute and collapses an inset-0 container to height 0. */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Find Location — search-first entry */}
      <div className="absolute left-1/2 top-6 z-20 w-[min(440px,90vw)] -translate-x-1/2">
        <FindLocationBox accessToken={TOKEN} onRetrieve={handleRetrieve} />
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

      {/* Legend — keys the six pin types + three line tiers. Collapsed
          by default so it never competes with the globe. */}
      {hasPins && (
        <div className="glass absolute bottom-6 left-6 z-20 rounded-xl text-xs text-[var(--ink-dim)]">
          <button
            onClick={() => setLegendOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-3 py-2 text-[var(--ink)] hover:text-[var(--ember-soft)]"
          >
            <span className="text-[var(--ember-soft)]">{legendOpen ? '▾' : '▸'}</span>
            Legend
          </button>
          {legendOpen && (
            <div className="space-y-1.5 px-3 pb-3">
              {([
                ['globe-pin', 'Primary residence'],
                ['globe-pin globe-pin--workplace', 'Workplace'],
                ['globe-pin globe-pin--second', 'Second residence'],
                ['globe-pin globe-pin--short', 'Short-term stay'],
                ['globe-pin globe-pin--vacation', 'Vacation'],
                ['globe-pin globe-pin--work-travel', 'Professional travel'],
              ] as const).map(([cls, label]) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
                    <span className={`${cls} !cursor-default`} style={{ position: 'static' }} />
                  </span>
                  <span>{label}</span>
                </div>
              ))}
              <div className="mt-2 space-y-1.5 border-t border-[var(--glass-border)] pt-2">
                <div className="flex items-center gap-2.5">
                  <span className="inline-block h-0 w-6 border-t-2 border-[var(--ember)]" style={{ boxShadow: '0 0 6px var(--ember)' }} />
                  <span>Residential transit ›</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="inline-block h-0 w-6 border-t-2" style={{ borderColor: '#5fc6dc' }} />
                  <span>Commute (home → work)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="inline-block h-0 w-6 border-t border-dashed" style={{ borderColor: '#cdb78a' }} />
                  <span>Trip / temporary</span>
                </div>
              </div>
            </div>
          )}
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
            .filter((p) => p.type_code === SPINE_CODE)
            .map((p) => ({ relationship_id: p.relationship_id, name: p.name }))}
          onSave={handleSave}
          onCancel={() => setModalOpen(false)}
        />
      )}

      {hovered && (
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
        const spine = pins.filter((p) => p.type_code === SPINE_CODE)
        const spinePos = spine.findIndex((p) => p.relationship_id === selectedId)
        const primaries = spine.map((p) => ({ relationship_id: p.relationship_id, name: p.name }))
        return editMode ? (
          <PinEditPanel
            pin={sel}
            relocated={stagedCoords !== null}
            saving={savingPanel}
            position={spinePos}
            total={spine.length}
            primaries={primaries}
            onMove={handleMove}
            onMoveTo={handleMoveTo}
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
            onNavigate={navigateSpine}
            onRefine={() => { setStagedCoords(null); setRefining(true) }}
            onEdit={() => { setRefining(false); setEditMode(true) }}
            onClose={deselect}
          />
        )
      })()}
    </div>
  )
}
