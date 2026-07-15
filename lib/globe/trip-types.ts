/**
 * Trip subtypes and shared trip shapes (Trips & Travel, plan KTD4).
 *
 * The subtype lives on the TRIP, not the pin — a destination pin keeps
 * a normal pin type (see tripSubtypeDefaultPinCode for the mapping used
 * when the capture flow creates the destination pin itself).
 */

export const TRIP_SUBTYPES = ['professional', 'vacation', 'road_trip'] as const
export type TripSubtype = (typeof TRIP_SUBTYPES)[number]

export const TRIP_SUBTYPE_LABELS: Record<TripSubtype, string> = {
  professional: 'Professional travel',
  vacation: 'Vacation',
  road_trip: 'Road trip',
}

/** Pin type minted for a new destination pin, by trip subtype (KTD4). */
export const tripSubtypeDefaultPinCode: Record<TripSubtype, string> = {
  professional: 'traveled_for_work_to',
  vacation: 'vacationed_at',
  road_trip: 'vacationed_at',
}

export type TripLeg = 'outbound' | 'return'

export interface TripStop {
  stop_id: string
  relationship_id: string
  name: string
  lng: number | null
  lat: number | null
  leg: TripLeg
  position: number
}

/** Row shape returned by get_trips / GET /api/trips. */
export interface TripRow {
  trip_id: string
  trip_entity_id: string
  subtype: TripSubtype
  title: string | null
  when_text: string | null
  year_hint: number | null
  return_to_origin: boolean
  created_at: string
  is_draft: boolean
  origin_relationship_id: string | null
  origin_name: string | null
  origin_lng: number | null
  origin_lat: number | null
  destination_relationship_id: string
  destination_name: string
  destination_lng: number | null
  destination_lat: number | null
  stops: TripStop[]
}
