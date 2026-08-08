/**
 * Rule 11: a generic surface reused in a specific mode must state the mode
 * in its own title and primary action.
 *
 * PinModal is the most reused surface in the app — an ordinary new place, a
 * trip destination arriving from an armed origin (F4), and now a stop being
 * placed on a route. Each mode has to announce itself, because the banner
 * that would otherwise carry the context is covered or hidden while the
 * dialog is open. F4 was raised precisely because that banner vanished and
 * took the only cue with it.
 *
 * These assert the CONTRACT, not the layout. `dff4fa8` — the route banner
 * sitting on top of this dialog's header — is invisible from here, and that
 * is the documented boundary: jsdom has no geometry. What this can hold is
 * that the words exist and change with the mode.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PinModal from '@/components/globe/PinModal'

const props = {
  placeLabel: 'This place',
  saving: false,
  primaries: [{ relationship_id: 'chalet', name: 'My Mt. Snow Chalet' }],
  allPins: [
    { relationship_id: 'chalet', name: 'My Mt. Snow Chalet', type_code: 'lived_at', sort_order: 0 },
    { relationship_id: 'ssv', name: 'SSV Day Lodge Room', type_code: 'lived_at', sort_order: 1 },
  ],
  onSave: vi.fn(),
  onCancel: vi.fn(),
}

const fiat = { tripName: 'The epic solo road trip in the overloaded Fiat 128', leg: 'outbound' as const }

describe('PinModal states which mode it is in', () => {
  it('is a plain place dialog with no mode set', () => {
    render(<PinModal {...props} />)
    expect(screen.getByText(/a place in your life/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add this place' })).toBeInTheDocument()
    expect(screen.queryByText(/a stop along the way/i)).not.toBeInTheDocument()
  })

  it('announces stop capture in its eyebrow, its explanation and its action', () => {
    render(<PinModal {...props} stopCaptureFor={fiat} defaultTypeCode="logged_at" />)
    expect(screen.getByText(/a stop along the way/i)).toBeInTheDocument()
    // The TRIP must be named. "A stop along the way" alone does not say
    // which journey you are adding to, and the banner that would have said
    // so is not visible behind this dialog.
    expect(screen.getByText(fiat.tripName)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add this stop' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add this place' })).not.toBeInTheDocument()
  })

  it('stands the stop framing down when the user chooses Trip instead', async () => {
    const user = userEvent.setup()
    render(<PinModal {...props} stopCaptureFor={fiat} defaultTypeCode="logged_at" />)
    expect(screen.getByText(/a stop along the way/i)).toBeInTheDocument()

    // Choosing "Trip" says this place is a journey of its own, not a
    // waypoint on one — the mode is stated only while it is TRUE.
    await user.selectOptions(screen.getByLabelText(/what kind of place/i), 'trip')
    expect(screen.queryByText(/a stop along the way/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add this stop' })).not.toBeInTheDocument()
  })

  it('anchors a stop to the trip destination it was given', () => {
    render(<PinModal {...props} stopCaptureFor={fiat} defaultTypeCode="logged_at" defaultAnchorId="ssv" />)
    // The whole point of 4c138a3: not primaries[0], which is the first home
    // on the spine and was never right for any particular reason.
    expect(screen.getByLabelText(/associated with which place/i)).toHaveValue('ssv')
    expect(screen.getByText(/pre-set to where the trip was heading/i)).toBeInTheDocument()
  })
})
