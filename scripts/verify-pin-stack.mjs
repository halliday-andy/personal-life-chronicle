#!/usr/bin/env node
/**
 * Proof for the pin stacking ladder (lib/globe/pin-stack.ts). Pure — no map.
 *
 * Origin (Andy's screenshots, 2026-08-04): searching for the **Dartmouth**
 * primary residence and selecting it from the dropdown still left it buried
 * under "Dick's House, Hitchcock Medical" — a `traveled_for_work_to` marker
 * 508 m away whose label banner landed squarely on the selected pin.
 *
 * The cause is not density. **Mapbox GL 3.24 sets no z-index on markers**,
 * so stacking is DOM insertion order, and insertion order is the `pins`
 * array — which arrives from `get_residence_pins` ordered
 * `sort_order ASC NULLS LAST, created_at ASC`. Sequenced primary
 * residences carry a `sort_order`, so they sort FIRST, are created FIRST,
 * and therefore paint at the BOTTOM. Every marker pin has a NULL
 * sort_order, sorts last, and paints over the spine. The most important
 * pin class in the app was underneath its neighbours by construction.
 *
 * Asserts:
 *   1. The selected pin outranks everything, including a spine primary.
 *   2. A spine primary outranks every marker type — Andy's actual case.
 *   3. Hover lifts a pin above the unselected field but never above the
 *      selection (a passing cursor must not displace the thing you chose).
 *   4. Home TYPES outrank markers, spine slot or not — home-ness is the
 *      TYPE, not the spine slot (the standing 2026-07-18 guard).
 *   5. Within a band, the SOUTHERN pin paints over the northern one —
 *      the cartographic convention that makes a cluster read as depth.
 *      Latitude never leaks across bands.
 *   6. Every value is a finite integer inside the declared ceiling, so it
 *      cannot escape the map's stacking context and outrank app chrome.
 *
 * Run: node scripts/verify-pin-stack.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { pinStackZ, PIN_STACK_CEILING } from '${projectRoot}/lib/globe/pin-stack'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

// Andy's Hanover cluster, real coordinates.
const dartmouth  = { type_code: 'lived_at', sort_order: 6, lat: 43.7044 }
const dicksHouse = { type_code: 'traveled_for_work_to', sort_order: null, lat: 43.7088 }

const z = (p: typeof dartmouth, s = {}) => pinStackZ(p, s)

// 1. Selection wins outright
if (z(dicksHouse, { selected: true }) > z(dartmouth))
  ok('a selected marker outranks an unselected spine primary')
else bad('selection did not win')
if (z(dartmouth, { selected: true }) > z(dicksHouse))
  ok('a selected spine primary outranks a marker \\u2014 Andy\\u2019s search case')
else bad('the searched primary stayed buried')

// 2. THE BUG: spine over markers, unselected
if (z(dartmouth) > z(dicksHouse))
  ok('an unselected spine primary outranks an unselected marker (the inverted order)')
else bad('spine still paints under markers: ' + z(dartmouth) + ' vs ' + z(dicksHouse))

// 3. Hover lifts, but never over the selection
if (z(dicksHouse, { hovered: true }) > z(dartmouth))
  ok('hover lifts a marker above the resting field')
else bad('hover did not lift')
if (z(dicksHouse, { hovered: true }) < z(dartmouth, { selected: true }))
  ok('hover never displaces the SELECTED pin \\u2014 a passing cursor is not a choice')
else bad('a hover outranked the selection')

// 4. Home-ness is the TYPE, not the spine slot
for (const code of ['lived_at', 'owned_residence_at', 'lived_briefly_at']) {
  if (z({ type_code: code, sort_order: null, lat: 43.7 }) > z(dicksHouse))
    ok('unsequenced "' + code + '" still outranks a marker')
  else bad('"' + code + '" fell into the marker band')
}
if (z(dartmouth) > z({ type_code: 'lived_briefly_at', sort_order: null, lat: 43.7 }))
  ok('the sequenced spine still leads the other home types')
else bad('the spine lost its lead over other homes')

// 5. Southern paints over northern, and only within a band
const north = { type_code: 'logged_at', sort_order: null, lat: 60 }
const south = { type_code: 'logged_at', sort_order: null, lat: -60 }
if (z(south) > z(north)) ok('within a band the SOUTHERN pin paints over the northern')
else bad('latitude tiebreak inverted: ' + z(south) + ' vs ' + z(north))
if (z({ ...north, type_code: 'lived_at' }) > z(south))
  ok('latitude never leaks across bands \\u2014 a far-north home still beats a far-south marker')
else bad('latitude leaked across bands')

// 6. Bounded integers — cannot escape the map's stacking context
const samples = [dartmouth, dicksHouse, north, south]
const states = [{}, { selected: true }, { hovered: true }]
let allSane = true
for (const p of samples) for (const s of states) {
  const v = pinStackZ(p, s)
  if (!Number.isInteger(v) || v < 0 || v > PIN_STACK_CEILING) allSane = false
}
if (allSane) ok('every value is an integer in [0, ' + PIN_STACK_CEILING + ']')
else bad('a z-index escaped its bounds')

// Extreme/absent latitudes must not produce NaN — a NaN z-index silently
// drops the marker back to auto stacking, which is the bug itself.
for (const lat of [90, -90, 0]) {
  const v = pinStackZ({ type_code: 'lived_at', sort_order: 1, lat }, {})
  if (Number.isInteger(v)) ok('latitude ' + lat + ' yields an integer (' + v + ')')
  else bad('latitude ' + lat + ' produced ' + v)
}

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.pin-stack-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
