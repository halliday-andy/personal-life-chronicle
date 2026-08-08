#!/usr/bin/env node
/**
 * Proof for trip-route visibility (lib/globe/trip-route-visibility.ts). Pure.
 *
 * Origin (Andy, 2026-08-04): "Show on globe →" on a Travel Journal trip
 * card landed him on the destination pin with **no sign of the trip at
 * all** — no route arc, no trip row — so getting back to the framing panel
 * meant opening the destination, finding the trip, and opening the frame by
 * hand. A link whose entire purpose is "show me this trip" showed no trip.
 *
 * Nothing about it was wrong when written. `?trip=`'s own comment still
 * says "selection reveals the trip strip and its complete route (U4)", and
 * that was true. Then two independently correct changes each removed one
 * leg of it:
 *
 *   - **F21/R18** made route painting depend on the trips CHIP being open,
 *     because selection alone had no off-switch and a busy home buried the
 *     map.
 *   - **J4** made deep-link arrivals render the COMPACT card — geography
 *     first — and the compact card never mounts the chip row at all.
 *
 * Neither touched the `?trip=` handoff; between them they emptied it. The
 * premise stayed in a comment, where nothing could notice it was false.
 *
 * CLASS OF BUG: **a feature whose premise is another feature's behaviour,
 * with nothing connecting them but a comment.** The fix is a `focusedTripId`
 * that states the intent directly — "this trip is why we are here" — rather
 * than hoping a chain of disclosures still ends where it used to.
 *
 * Asserts:
 *   1. The legend's "Trip routes" toggle still shows everything.
 *   2. Selection paints ONLY with the chip open (F21/R18 survives — this is
 *      the guard that must not be traded away to fix the deep link).
 *   3. Hover still peeks, independent of the chip.
 *   4. The trip being route-built always paints.
 *   5. **A focused trip paints with nothing selected and no chip open** —
 *      the bug.
 *   6. Focus is per-trip: it does not reveal the others.
 *   7. Selection and hover count a trip's origin and stops, not just its
 *      destination.
 *
 * Run: node scripts/verify-trip-route-visibility.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { tripRouteVisible } from '${projectRoot}/lib/globe/trip-route-visibility'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

const CHALET = 'chalet', WENDYS = 'wendys', SSV = 'ssv'
const fiat = {
  trip_id: 'fiat',
  origin_relationship_id: CHALET,
  destination_relationship_id: SSV,
  stops: [{ relationship_id: WENDYS }],
}
const other = {
  trip_id: 'other',
  origin_relationship_id: 'x',
  destination_relationship_id: 'y',
  stops: [],
}

const rest = {
  tripsVisible: false,
  selectedId: null,
  tripsPanelOpen: false,
  hoverPreview: null,
  routeEditTripId: null,
  focusedTripId: null,
}
const vis = (s: Partial<typeof rest> = {}) => tripRouteVisible(fiat, { ...rest, ...s })

// 0. Baseline: nothing going on, nothing drawn.
if (!vis()) ok('at rest a framed trip draws nothing (R10 — the spine stays dominant)')
else bad('a route painted with nothing selected')

// 1. Legend toggle
if (vis({ tripsVisible: true })) ok('the "Trip routes" toggle shows every trip')
else bad('the legend toggle did not show routes')

// 2. F21/R18 — the guard that must survive this fix
if (vis({ selectedId: SSV, tripsPanelOpen: true })) ok('selection + open chip paints')
else bad('selection with the chip open did not paint')
if (!vis({ selectedId: SSV, tripsPanelOpen: false }))
  ok('selection with the chip CLOSED does not paint (F21 survives)')
else bad('F21 regression: selection alone painted again')

// 3. Hover peeks regardless of the chip
if (vis({ hoverPreview: SSV })) ok('hover peeks a trip without the chip (F19)')
else bad('hover did not peek')

// 4. Route building
if (vis({ routeEditTripId: 'fiat' })) ok('the trip being route-built always paints')
else bad('route-build trip did not paint')

// 5. THE BUG — a focused trip, nothing selected, no chip
if (vis({ focusedTripId: 'fiat' }))
  ok('a FOCUSED trip paints with nothing selected and no chip open (the deep link)')
else bad('focused trip still invisible \\u2014 "Show on globe" shows no trip')

// 6. Focus is per-trip
if (!tripRouteVisible(other, { ...rest, focusedTripId: 'fiat' }))
  ok('focus reveals that trip only, not the whole globe')
else bad('focus leaked onto other trips')

// 7. Origin and stops count for selection and hover, not just the destination
for (const [label, id] of [['origin', CHALET], ['stop', WENDYS], ['destination', SSV]] as [string, string][]) {
  if (vis({ selectedId: id, tripsPanelOpen: true })) ok('selecting the ' + label + ' paints the trip')
  else bad('selecting the ' + label + ' did not paint')
  if (vis({ hoverPreview: id })) ok('hovering the ' + label + ' peeks the trip')
  else bad('hovering the ' + label + ' did not peek')
}

// An unrelated selection stays quiet.
if (!vis({ selectedId: 'unrelated', tripsPanelOpen: true }))
  ok('an unrelated selection paints nothing')
else bad('an unrelated pin painted the trip')

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.trip-route-visibility-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
