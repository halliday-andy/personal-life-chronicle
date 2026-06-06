'use client'

/**
 * Client boundary for the globe. Mapbox GL touches `window` at module
 * scope, so GlobeView is loaded with ssr:false to keep it out of the
 * server render.
 */

import dynamic from 'next/dynamic'

const GlobeView = dynamic(() => import('./GlobeView'), {
  ssr: false,
  loading: () => (
    <div className="nocturne flex h-screen w-screen items-center justify-center">
      <p className="nocturne-display text-2xl text-[var(--ink-dim)]">Spinning up your globe…</p>
    </div>
  ),
})

export default function GlobeClient() {
  return <GlobeView />
}
