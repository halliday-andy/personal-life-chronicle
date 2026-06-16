'use client'

/**
 * PhotoLightbox — full-screen enlarged view of a pin photo.
 *
 * Opened by double-clicking a thumbnail (detail card or edit-panel
 * gallery). Click the backdrop, the ✕, or press Escape to close. Sits
 * above all globe chrome (z-[60]).
 */

import { useEffect } from 'react'

export default function PhotoLightbox({
  url,
  alt,
  onClose,
}: {
  url: string
  alt?: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL */}
      <img
        src={url}
        alt={alt ?? 'Photo'}
        className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-5 text-2xl leading-none text-white/80 hover:text-white"
      >
        ✕
      </button>
    </div>
  )
}
