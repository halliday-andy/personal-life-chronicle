/**
 * The trips chip must open when the trips ARRIVE, not only if they beat the
 * card to the screen (`d9171d7`).
 *
 * Andy clicked Wendy's shared apartment from the Mt. Snow Chalet stop list
 * in Journey and landed on the globe with no trip arc, though hovering the
 * same pin drew it. `openChip` was seeded by a `useState` initialiser —
 * which runs once, at mount — from `autoOpen`, which derives from trips,
 * which load in their own fetch. The `?pin=` deep-link branch does not wait
 * for them, so the card mounted while `trips` was still empty, the seed read
 * false, and the chip never opened. Because that chip is what paints routes
 * (R18/F21), the trip stayed invisible.
 *
 * THIS IS THE TEST THAT MOTIVATED THE HARNESS. A pure test of the predicate
 * would have passed against the broken code: it computed the right answer,
 * one render too early. Only mount order shows it.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PinConnections from '@/components/globe/PinConnections'
import type { TripCardContext } from '@/components/globe/PinTrips'

const trip = {
  trip_id: 'fiat',
  trip_entity_id: 'fiat-entity',
  subtype: 'road_trip' as const,
  title: 'The epic solo road trip in the overloaded Fiat 128',
  when_text: 'October 1978',
  year_hint: 1978,
  return_to_origin: false,
  created_at: '1978-10-01T00:00:00Z',
  is_draft: false,
  origin_relationship_id: 'chalet',
  origin_name: 'My Mt. Snow Chalet',
  origin_lng: null,
  origin_lat: null,
  destination_relationship_id: 'ssv',
  destination_name: 'SSV Day Lodge Room',
  destination_lng: null,
  destination_lat: null,
  destination_type_code: 'lived_at',
  stops: [],
}

const tripCtx = (over: Partial<TripCardContext> = {}): TripCardContext => ({
  trips: [trip],
  originatedHere: 0,
  isHome: false,
  isHomeBase: false,
  isFuturePlace: false,
  autoOpen: false,
  onStartTripFromHere: vi.fn(),
  onFrame: vi.fn(),
  onRoute: vi.fn(),
  onUnframe: vi.fn(),
  onFrameAsTrip: vi.fn(),
  ...over,
})

const card = (ctx: TripCardContext) => (
  <PinConnections
    entityId="e1"
    placeName="Wendy's shared apartment"
    linked={[]}
    context={[]}
    anchored={[]}
    onSelectAnchored={vi.fn()}
    variant="card"
    relationshipId="wendys"
    tripCtx={ctx}
  />
)

const renderCard = (ctx: TripCardContext) => render(card(ctx))

/** The trip row only renders while the chip is open (PinTrips hides it). */
const tripRowVisible = () => screen.getByText(trip.title).closest('.hidden') === null

describe('the trips chip and late-arriving trips', () => {
  it('opens when trips are already loaded at mount', () => {
    renderCard(tripCtx({ autoOpen: true }))
    expect(tripRowVisible()).toBe(true)
  })

  it('stays shut when the pin genuinely has no reason to open', () => {
    renderCard(tripCtx({ autoOpen: false }))
    expect(tripRowVisible()).toBe(false)
  })

  it('OPENS when autoOpen flips true after mount — the deep-link bug', () => {
    const { rerender } = renderCard(tripCtx({ autoOpen: false }))
    expect(tripRowVisible()).toBe(false) // trips fetch still in flight

    // ...the fetch lands.
    rerender(card(tripCtx({ autoOpen: true })))
    expect(tripRowVisible()).toBe(true)
  })

  it('does not reopen over a chip the user deliberately closed', async () => {
    const user = userEvent.setup()
    const { rerender } = renderCard(tripCtx({ autoOpen: true }))
    expect(tripRowVisible()).toBe(true)

    // The chip toggles closed.
    await user.click(screen.getByRole('button', { name: /1 trip/i }))
    expect(tripRowVisible()).toBe(false)

    // Further renders with autoOpen STILL true must not fight the user —
    // the seed gets one chance, not a standing instruction. This is the
    // regression the fix could plausibly have introduced.
    rerender(card(tripCtx({ autoOpen: true })))
    expect(tripRowVisible()).toBe(false)
  })
})
