#!/usr/bin/env node
/**
 * Proof for the trip auto-open rule (lib/globe/trip-auto-open.ts). Pure.
 *
 * The rule has one inclusion and one deliberate exception, and both were
 * learned the hard way:
 *
 *  - **Destinations auto-open** (R19/F23/F24, 2026-08-01): landing on the
 *    place a trip went TO, the trip IS the point of the pin.
 *  - **Origins do NOT** (F21, same walk): a home with many departures
 *    opened a stack of trips that buried the map. Selection alone stopped
 *    painting routes for the same reason — opening the chip is the "show
 *    me these" gesture.
 *  - **Stops auto-open too** (Andy, 2026-08-04). R22 made destinations
 *    movable, and the first thing he did was move one: Wendy's shared
 *    apartment went from destination to stop on the Fiat 128 trip, and
 *    silently stopped auto-opening — so selecting it no longer drew the
 *    route it had drawn ten minutes earlier. A stop is a place the journey
 *    passed THROUGH; the journey is still the point of the pin.
 *
 * The exception is what this file exists to protect. "Destination or stop
 * but not origin" looks arbitrary next to "any trip touching this pin",
 * and the tidier version is the bug F21 already cost a QA walk.
 *
 * Asserts:
 *   1. A destination auto-opens.
 *   2. A stop auto-opens — either leg (the R22 case).
 *   3. An origin does NOT, even with many departures (F21).
 *   4. A pin that is BOTH origin and stop still auto-opens — being an
 *      origin is not a veto, it just isn't a reason on its own.
 *   5. An untouched pin does not.
 *   6. Drafts count: a destination with an unframed trip is exactly the
 *      pin whose "needs framing" badge you want to see.
 *
 * Run: node scripts/verify-trip-auto-open.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { tripAutoOpensFor } from '${projectRoot}/lib/globe/trip-auto-open'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

const WENDYS = 'wendys'
const SSV = 'ssv'
const CHALET = 'chalet'

type Stop = { relationship_id: string; leg: 'outbound' | 'return' }
const trip = (o: string | null, d: string, stops: Stop[] = [], is_draft = false) =>
  ({ origin_relationship_id: o, destination_relationship_id: d, stops, is_draft })

// The Fiat 128 as it stands after Andy's retarget.
const fiat = trip(CHALET, SSV, [{ relationship_id: WENDYS, leg: 'outbound' }])

// 1
if (tripAutoOpensFor([fiat], SSV)) ok('a destination auto-opens (R19/F23/F24)')
else bad('destination did not auto-open')

// 2 — the R22 case, both legs
if (tripAutoOpensFor([fiat], WENDYS)) ok('an OUTBOUND stop auto-opens (Wendy\\u2019s, after the retarget)')
else bad('outbound stop did not auto-open')
const withReturn = trip(CHALET, SSV, [{ relationship_id: WENDYS, leg: 'return' }])
if (tripAutoOpensFor([withReturn], WENDYS)) ok('a RETURN stop auto-opens too')
else bad('return stop did not auto-open')

// 3 — F21, the exception this file protects
if (!tripAutoOpensFor([fiat], CHALET)) ok('an ORIGIN does not auto-open (F21)')
else bad('origin auto-opened \\u2014 F21 regression, a busy home will bury the map')
const busyHome = [trip(CHALET, 'a'), trip(CHALET, 'b'), trip(CHALET, 'c'), trip(CHALET, 'd')]
if (!tripAutoOpensFor(busyHome, CHALET)) ok('four departures from one home still do not auto-open')
else bad('a busy home auto-opened its whole stack')

// 4 — origin-ness is not a veto
const loop = trip(CHALET, SSV, [{ relationship_id: CHALET, leg: 'return' }])
if (tripAutoOpensFor([loop], CHALET))
  ok('a pin that is both origin AND stop auto-opens \\u2014 origin is not a veto')
else bad('being an origin vetoed a legitimate stop')

// 5
if (!tripAutoOpensFor([fiat], 'unrelated')) ok('an untouched pin does not auto-open')
else bad('an unrelated pin auto-opened')

// 6 — drafts
if (tripAutoOpensFor([trip(null, SSV, [], true)], SSV))
  ok('a draft\\u2019s destination auto-opens \\u2014 that is the \\u201cneeds framing\\u201d pin')
else bad('draft destination did not auto-open')

// Degenerate input must not throw: stops can be absent on a hand-built row.
if (!tripAutoOpensFor([], SSV)) ok('no trips, no auto-open')
else bad('empty trip list auto-opened')

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.trip-auto-open-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
