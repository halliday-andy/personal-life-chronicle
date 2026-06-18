'use client'

/**
 * Find Location — forward geocoding search (Step 7 Slice 1).
 *
 * Search-first onboarding: the user types the next place they lived,
 * the globe flies there, and they drag a draft pin to the exact spot.
 * Wraps @mapbox/search-js-react's SearchBox; on retrieve it hands the
 * chosen point (lng/lat + display name) up to GlobeView.
 *
 * Coordinate entry: `allowReverse` lets the user paste a raw "lat, lng"
 * pair (e.g. straight from Google Maps) and reverse-geocode it to a place;
 * `flipCoordinates` reads the pair as lat,lng (Google's order) rather than
 * Mapbox's native lng,lat. Without allowReverse the box force-fed coordinate
 * text to forward search, which Mapbox rejected with an UNHANDLED error that
 * crashed the page ("Query exceeded character limit of 200" — 2026-06-17 QA).
 * onSuggestError now swallows any suggest failure so a bad query degrades to
 * "no results" instead of an unhandled runtime error.
 */

import { SearchBox } from '@mapbox/search-js-react'

export interface RetrievedPlace {
  lng: number
  lat: number
  label: string
}

export default function FindLocationBox({
  accessToken,
  onRetrieve,
}: {
  accessToken: string
  onRetrieve: (place: RetrievedPlace) => void
}) {
  return (
    <SearchBox
      accessToken={accessToken}
      placeholder="Search a place, or paste lat, lng…"
      options={{ language: 'en', types: 'country,region,place,locality,neighborhood,address' }}
      componentOptions={{ allowReverse: true, flipCoordinates: true }}
      onSuggestError={(err) => {
        // Degrade gracefully — never let a Mapbox suggest failure surface as
        // an unhandled runtime error (it used to crash the whole page).
        console.warn('[find-location] suggest failed:', err)
      }}
      onRetrieve={(res) => {
        const feature = res?.features?.[0]
        if (!feature) return
        const [lng, lat] = feature.geometry.coordinates
        const label: string =
          feature.properties?.name_preferred ||
          feature.properties?.name ||
          feature.properties?.full_address ||
          'Unnamed place'
        onRetrieve({ lng, lat, label })
      }}
      theme={{
        variables: {
          colorBackground: 'rgba(15, 22, 42, 0.72)',
          colorText: '#eef2ff',
          colorBackgroundHover: 'rgba(36, 48, 82, 0.8)',
          borderRadius: '12px',
          boxShadow: '0 18px 60px rgba(0,0,0,0.5)',
          fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
        },
      }}
    />
  )
}
