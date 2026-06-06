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

interface Pin {
  relationship_id: string
  place_entity_id: string
  name: string
  place_subtype: string | null
  lng: number
  lat: number
  when_text: string | null
  has_memory: boolean
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

function lineFeature(pins: Pin[]): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: pins.map((p) => [p.lng, p.lat]) },
  }
}

export default function GlobeView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const pinMarkersRef = useRef<mapboxgl.Marker[]>([])
  const draftMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const bloomIdRef = useRef<string | null>(null)

  const [ready, setReady] = useState(false)
  const [pins, setPins] = useState<Pin[]>([])
  const [draft, setDraft] = useState<RetrievedPlace | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasPins = pins.length > 0

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
      map.addSource('arcs', { type: 'geojson', data: lineFeature([]) })
      map.addLayer({
        id: 'arcs',
        type: 'line',
        source: 'arcs',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f4b14a', 'line-width': 1.6, 'line-opacity': 0.55, 'line-blur': 0.4 },
      })
      setReady(true)
      loadPins()
    })

    map.on('click', (e) => setDraftAt(e.lngLat.lng, e.lngLat.lat, ''))

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [loadPins, setDraftAt])

  // Re-render pin markers + arc whenever pins change.
  useEffect(() => {
    if (!ready) return
    const map = mapRef.current!
    pinMarkersRef.current.forEach((m) => m.remove())
    pinMarkersRef.current = []
    pins.forEach((p) => {
      const el = document.createElement('div')
      el.className = 'globe-pin' + (bloomIdRef.current === p.place_entity_id ? ' globe-pin-bloom' : '')
      el.title = p.name
      pinMarkersRef.current.push(new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map))
    })
    bloomIdRef.current = null
    const src = map.getSource('arcs') as mapboxgl.GeoJSONSource | undefined
    src?.setData(lineFeature(pins))
  }, [pins, ready])

  const handleRetrieve = useCallback((place: RetrievedPlace) => {
    const map = mapRef.current
    if (!map) return
    map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 9), speed: 0.9 })
    setDraftAt(place.lng, place.lat, place.label)
  }, [setDraftAt])

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
          whenText: data.whenText, body: data.body,
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail || b.error || `HTTP ${res.status}`)
      }
      const { pin } = await res.json()
      bloomIdRef.current = pin.place_entity_id
      setPins((prev) => [...prev, pin])
      clearDraft()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place the pin.')
    } finally {
      setSaving(false)
    }
  }, [draft, clearDraft])

  return (
    <div className="nocturne relative h-screen w-screen overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />

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

      {modalOpen && draft && (
        <PinModal
          placeLabel={draft.label || 'This place'}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
