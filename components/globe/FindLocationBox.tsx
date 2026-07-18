'use client'

/**
 * Find Location — merged search over YOUR PINS + places (2026-07-18).
 *
 * Rebuilt headless (SearchBoxCore) from the original Slice-1 drop-in
 * <SearchBox>, whose dropdown couldn't host a second results group.
 * Search-as-navigation: a query often means "take me to MY pin", so the
 * user's own pins (all types — Andy's call, first Phase-1 QA finding)
 * rank above external places in one dropdown. Selecting a pin flies to
 * and selects it; selecting a place keeps the original behavior (fly +
 * draft pin). Pin matching is client-side over the loaded pins
 * (lib/globe/pin-search.ts) — instant, no API.
 *
 * Behaviors preserved from the drop-in era (both QA-hardened 2026-06-17):
 * - Coordinate entry: paste "lat, lng" (Google's order) → reverse
 *   geocode to a place, graceful label fallback to the raw pair.
 * - Suggest failures degrade to "no places" (console.warn), never an
 *   unhandled error — a bad query must not crash the page.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SearchBoxCore, SessionToken, type SearchBoxSuggestion } from '@mapbox/search-js-core'
import { searchPins, type PinSearchCandidate } from '@/lib/globe/pin-search'
import { pinTypeMeta } from '@/lib/globe/pin-types'

export interface RetrievedPlace {
  lng: number
  lat: number
  label: string
}

export interface SearchablePin extends PinSearchCandidate {
  when_text: string | null
}

type Item =
  | { kind: 'pin'; pin: SearchablePin }
  | { kind: 'coord'; lat: number; lng: number }
  | { kind: 'place'; sug: SearchBoxSuggestion }

// "lat, lng" (Google copy order). Ranges checked after parse.
const COORD_RE = /^\s*([+-]?\d{1,2}(?:\.\d+)?)\s*,\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/

const PLACE_LABEL = (p: { name_preferred?: string; name?: string; full_address?: string }) =>
  p.name_preferred || p.name || p.full_address || 'Unnamed place'

export default function FindLocationBox({
  accessToken,
  pins,
  onRetrieve,
  onSelectPin,
}: {
  accessToken: string
  pins: SearchablePin[]
  onRetrieve: (place: RetrievedPlace) => void
  onSelectPin: (relationshipId: string) => void
}) {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [placeSug, setPlaceSug] = useState<SearchBoxSuggestion[]>([])
  const [placesPending, setPlacesPending] = useState(false)

  const searchRef = useRef<SearchBoxCore | null>(null)
  const tokenRef = useRef<SessionToken>(new SessionToken())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queryIdRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const core = useCallback(() => {
    if (!searchRef.current) {
      searchRef.current = new SearchBoxCore({
        accessToken,
        language: 'en',
        types: 'country,region,place,locality,neighborhood,address',
      })
    }
    return searchRef.current
  }, [accessToken])

  const coord = useMemo(() => {
    const m = COORD_RE.exec(value)
    if (!m) return null
    const lat = parseFloat(m[1])
    const lng = parseFloat(m[2])
    return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
  }, [value])

  const pinMatches = useMemo(() => searchPins(pins, value), [pins, value])

  // Debounced place suggest — skipped entirely for coordinate input.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const id = ++queryIdRef.current
    if (coord || value.trim().length < 2) {
      setPlaceSug([])
      setPlacesPending(false)
      return
    }
    setPlacesPending(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await core().suggest(value, { sessionToken: tokenRef.current })
        if (queryIdRef.current !== id) return // stale response
        setPlaceSug((res.suggestions ?? []).slice(0, 5))
      } catch (err) {
        // Degrade gracefully — a suggest failure is "no places", never a crash.
        console.warn('[find-location] suggest failed:', err)
        if (queryIdRef.current === id) setPlaceSug([])
      } finally {
        if (queryIdRef.current === id) setPlacesPending(false)
      }
    }, 275)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value, coord, core])

  const items = useMemo<Item[]>(() => [
    ...pinMatches.map((pin): Item => ({ kind: 'pin', pin })),
    ...(coord ? [{ kind: 'coord' as const, ...coord }] : []),
    ...placeSug.map((sug): Item => ({ kind: 'place', sug })),
  ], [pinMatches, coord, placeSug])

  useEffect(() => { setActive(0) }, [value, items.length])

  const close = useCallback(() => { setOpen(false); setActive(0) }, [])

  const pick = useCallback(async (item: Item) => {
    if (item.kind === 'pin') {
      setValue(item.pin.name)
      close()
      onSelectPin(item.pin.relationship_id)
      return
    }
    if (item.kind === 'coord') {
      const { lat, lng } = item
      let label = `${lat}, ${lng}`
      try {
        const res = await core().reverse(`${lng},${lat}`, { limit: 1 })
        const f = res.features?.[0]
        if (f) label = PLACE_LABEL(f.properties ?? {})
      } catch (err) {
        console.warn('[find-location] reverse failed:', err)
      }
      setValue(label)
      close()
      onRetrieve({ lng, lat, label })
      return
    }
    try {
      const res = await core().retrieve(item.sug, { sessionToken: tokenRef.current })
      const f = res.features?.[0]
      if (!f) return
      tokenRef.current = new SessionToken() // retrieve ends the billing session
      const [lng, lat] = f.geometry.coordinates
      const label = PLACE_LABEL(f.properties ?? {})
      setValue(label)
      close()
      onRetrieve({ lng, lat, label })
    } catch (err) {
      console.warn('[find-location] retrieve failed:', err)
    }
  }, [close, core, onRetrieve, onSelectPin])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return }
    if (!open || items.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + items.length) % items.length) }
    else if (e.key === 'Enter') { e.preventDefault(); void pick(items[active]) }
  }, [open, items, active, pick, close])

  const showList = open && value.trim().length >= 2
  const firstPlaceIdx = pinMatches.length + (coord ? 1 : 0)

  const rowClass = (i: number) =>
    `flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#eef2ff] ${i === active ? 'bg-[rgba(36,48,82,0.8)]' : ''}`

  const header = (text: string) => (
    <div role="presentation" className="px-4 pb-1 pt-2 text-[11px] uppercase tracking-widest text-[#8fa0c4]">
      {text}
    </div>
  )

  return (
    <div className="relative">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={showList}
        aria-controls="findbox-listbox"
        aria-activedescendant={showList && items.length > 0 ? `findbox-opt-${active}` : undefined}
        aria-label="Search your pins or a place"
        placeholder="Search your pins or a place — or paste lat, lng…"
        value={value}
        onChange={(e) => { setValue(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(close, 120)}
        onKeyDown={onKeyDown}
        className="w-full rounded-xl border border-white/10 bg-[rgba(15,22,42,0.72)] px-4 py-2.5 pr-9 text-sm text-[#eef2ff] shadow-[0_18px_60px_rgba(0,0,0,0.5)] outline-none backdrop-blur placeholder:text-[#8fa0c4] focus-visible:ring-2 focus-visible:ring-amber-400/60"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setValue(''); setOpen(false); inputRef.current?.focus() }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[#8fa0c4] hover:text-[#eef2ff]"
        >
          ✕
        </button>
      )}

      {showList && (
        <div
          id="findbox-listbox"
          role="listbox"
          onMouseDown={(e) => e.preventDefault()} // keep input focus; click still fires
          className="absolute mt-2 max-h-[60vh] w-full overflow-y-auto rounded-xl border border-white/10 bg-[rgba(15,22,42,0.92)] py-1 shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur"
        >
          {pinMatches.length > 0 && header('Your pins')}
          {pinMatches.map((pin, i) => {
            const meta = pinTypeMeta(pin.type_code)
            return (
              <button
                key={pin.relationship_id}
                id={`findbox-opt-${i}`}
                role="option"
                aria-selected={i === active}
                type="button"
                onClick={() => void pick({ kind: 'pin', pin })}
                onMouseEnter={() => setActive(i)}
                className={rowClass(i)}
              >
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }} />
                <span className="truncate">{pin.name}</span>
                {pin.when_text && <span className="shrink-0 text-xs text-[#8fa0c4]">{pin.when_text}</span>}
                <span className="ml-auto shrink-0 text-xs text-[#8fa0c4]">{meta.label}</span>
              </button>
            )
          })}

          {coord && (
            <button
              id={`findbox-opt-${pinMatches.length}`}
              role="option"
              aria-selected={active === pinMatches.length}
              type="button"
              onClick={() => void pick({ kind: 'coord', ...coord })}
              onMouseEnter={() => setActive(pinMatches.length)}
              className={rowClass(pinMatches.length)}
            >
              <span aria-hidden>📍</span>
              <span>Go to {coord.lat}, {coord.lng}</span>
            </button>
          )}

          {(placeSug.length > 0 || placesPending) && !coord &&
            header(placesPending && placeSug.length === 0 ? 'Places · searching…' : 'Places')}
          {placeSug.map((sug, j) => {
            const i = firstPlaceIdx + j
            return (
              <button
                key={sug.mapbox_id}
                id={`findbox-opt-${i}`}
                role="option"
                aria-selected={i === active}
                type="button"
                onClick={() => void pick({ kind: 'place', sug })}
                onMouseEnter={() => setActive(i)}
                className={rowClass(i)}
              >
                <span className="truncate">{sug.name}</span>
                {sug.place_formatted && (
                  <span className="ml-auto shrink-0 truncate pl-3 text-xs text-[#8fa0c4]">{sug.place_formatted}</span>
                )}
              </button>
            )
          })}

          {items.length === 0 && !placesPending && (
            <div className="px-4 py-3 text-sm text-[#8fa0c4]">
              No matches for “{value.trim()}” — keep typing, or paste “lat, lng”.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
