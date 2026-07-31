'use client'

/**
 * Close-on-Escape for modal surfaces.
 *
 * Extracted rather than copied because both globe modals needed it at once
 * (finding F9a, 2026-07-30: `TripFramePanel` and `PinModal` were both
 * keyboard traps — no Escape, and the framing panel had no ✕ or backdrop
 * dismiss either).
 *
 * This is "free-with-the-build" accessibility under
 * `memory/feedback_lc_accessibility_deferral.md`: dedicated keyboard
 * surfaces are deferred, but a modal with no Escape is not deferred
 * keyboard work — it is a missing default, and the policy says to take the
 * accessible path whenever a feature makes it cheap.
 *
 * The handler is held in a ref so an inline arrow from the caller does not
 * resubscribe the listener on every render.
 *
 * `enabled` exists so callers can refuse dismissal mid-flight — a save in
 * progress should not be escapable, matching the backdrop's own guard.
 */

import { useEffect, useRef } from 'react'

export function useEscapeKey(onEscape: () => void, enabled = true): void {
  const handler = useRef(onEscape)

  useEffect(() => {
    handler.current = onEscape
  })

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
