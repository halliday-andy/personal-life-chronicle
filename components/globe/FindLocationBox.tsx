'use client'

/**
 * Find Location — forward geocoding search (Step 7 Slice 1).
 *
 * Search-first onboarding: the user types the next place they lived,
 * the globe flies there, and they drag a draft pin to the exact spot.
 * Wraps @mapbox/search-js-react's SearchBox; on retrieve it hands the
 * chosen point (lng/lat + display name) up to GlobeView.
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
      placeholder="Search for a place you lived…"
      options={{ language: 'en', types: 'country,region,place,locality,neighborhood,address' }}
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
