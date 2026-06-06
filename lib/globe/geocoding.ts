/**
 * Thin wrappers over the Mapbox Geocoding v6 API.
 *
 * Slice 1 uses reverse geocoding only: given the lng/lat where the user
 * dropped/dragged a pin, derive the place_subtype (mapped to our
 * place_type enum) and the ISO country code. The display NAME is taken
 * from what the user confirmed in the UI (the search label), not forced
 * from the reverse result — so user intent wins over the geocoder.
 *
 * Forward geocoding (search → fly-to) is handled client-side by
 * @mapbox/search-js-react, so it isn't duplicated here.
 */

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// Mapbox v6 feature_type → our place_type enum value.
const FEATURE_TYPE_TO_SUBTYPE: Record<string, string> = {
  country: 'country',
  region: 'region',
  district: 'region',
  postcode: 'city',
  place: 'city',
  locality: 'city',
  neighborhood: 'neighborhood',
  street: 'address',
  address: 'address',
  poi: 'landmark',
}

export interface ReverseGeocodeResult {
  /** Best-effort place name from the geocoder (fallback for the UI label). */
  name: string | null
  /** A valid place_type enum value; defaults to 'city' when unknown. */
  placeSubtype: string
  /** Uppercase ISO 3166-1 alpha-2, or null. */
  countryCode: string | null
}

export async function reverseGeocode(
  lng: number,
  lat: number,
): Promise<ReverseGeocodeResult> {
  if (!TOKEN) throw new Error('NEXT_PUBLIC_MAPBOX_TOKEN is not set')

  const url =
    `https://api.mapbox.com/search/geocode/v6/reverse` +
    `?longitude=${encodeURIComponent(lng)}&latitude=${encodeURIComponent(lat)}` +
    `&access_token=${TOKEN}`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Mapbox reverse geocode failed: HTTP ${res.status}`)
  }
  const data = await res.json()
  const feature = data?.features?.[0]
  if (!feature) {
    return { name: null, placeSubtype: 'city', countryCode: null }
  }

  const props = feature.properties ?? {}
  const featureType: string = props.feature_type ?? ''
  const name: string | null = props.name ?? props.full_address ?? null
  const countryCode: string | null =
    props.context?.country?.country_code?.toUpperCase?.() ?? null

  return {
    name,
    placeSubtype: FEATURE_TYPE_TO_SUBTYPE[featureType] ?? 'city',
    countryCode,
  }
}
