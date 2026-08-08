#!/usr/bin/env node
/**
 * Proof for the trip roles a pin plays (lib/globe/trip-pin-roles.ts). Pure.
 *
 * Origin (Andy, 2026-08-04): a trip's DESTINATION wears a rose halo on the
 * globe; a STOP wore nothing at all. So a place a journey passed through
 * was visually indistinguishable from a pin with no journey near it — and
 * he asked, reasonably, whether "stop on a trip" should become a pin TYPE.
 *
 * It should not. Stop-ness belongs to the trip↔pin relationship
 * (`trip_stops`), not to the place: a pin can be a stop on one trip and a
 * destination on another, so a single type field cannot hold it, and
 * encoding it there would duplicate a fact the schema already stores
 * (rule 24) while adding a second definition of a controlled vocabulary.
 * The gap was never taxonomic — it was that nothing DREW the relation.
 *
 * So the roles are derived, here, from the trips themselves.
 *
 * Asserts:
 *   1. A destination is a destination; a stop is a stop, either leg.
 *   2. A pin can be BOTH at once — the case a pin type could never hold,
 *      and the reason this returns a role set rather than one label.
 *   3. An origin is neither. It gets no trip styling: origins are homes,
 *      the spine already speaks for them, and F21 established that a busy
 *      home must not shout about its departures.
 *   4. Draft-ness rides with the DESTINATION only — "trip to frame" is a
 *      call to action about the trip's missing origin, not about a stop.
 *   5. Untouched pins get no role, and the map holds no empty entries.
 *   6. Two trips sharing one stop produce one entry, not two.
 *
 * Run: node scripts/verify-trip-pin-roles.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { tripPinRoles, isTripDestination } from '${projectRoot}/lib/globe/trip-pin-roles'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

type Stop = { relationship_id: string; leg: 'outbound' | 'return' }
const trip = (o: string | null, d: string, stops: Stop[] = [], is_draft = false) =>
  ({ origin_relationship_id: o, destination_relationship_id: d, stops, is_draft })

const CHALET = 'chalet', WENDYS = 'wendys', SSV = 'ssv'

// The Fiat 128 as it stands after Andy's retarget.
const roles = tripPinRoles([trip(CHALET, SSV, [{ relationship_id: WENDYS, leg: 'outbound' }])])

// 1
if (roles.get(SSV)?.isDestination) ok('the destination is marked a destination')
else bad('destination unmarked')
if (roles.get(WENDYS)?.isStop) ok('the outbound stop is marked a stop (Wendy\\u2019s, the reported gap)')
else bad('stop unmarked')
if (!roles.get(WENDYS)?.isDestination) ok('a stop is not also reported as a destination')
else bad('stop leaked into the destination role')
const ret = tripPinRoles([trip(CHALET, SSV, [{ relationship_id: WENDYS, leg: 'return' }])])
if (ret.get(WENDYS)?.isStop) ok('a RETURN-leg stop counts too')
else bad('return stop unmarked')

// 2 — the case a pin TYPE could never hold
const both = tripPinRoles([
  trip(CHALET, WENDYS),                                            // Wendy's as a destination
  trip(CHALET, SSV, [{ relationship_id: WENDYS, leg: 'outbound' }]), // ...and as a stop
])
if (both.get(WENDYS)?.isDestination && both.get(WENDYS)?.isStop)
  ok('one pin is BOTH destination and stop \\u2014 why this is a role set, not a type')
else bad('a pin could not hold both roles: ' + JSON.stringify(both.get(WENDYS)))

// 3 — origins get nothing
if (!roles.has(CHALET)) ok('an origin gets no trip role (the spine speaks for homes; F21)')
else bad('origin picked up a role: ' + JSON.stringify(roles.get(CHALET)))

// 4 — draft-ness is the DESTINATION's, not the stop's
const draft = tripPinRoles([trip(null, SSV, [{ relationship_id: WENDYS, leg: 'outbound' }], true)])
if (draft.get(SSV)?.isDraftDestination) ok('a draft\\u2019s destination carries the draft flag')
else bad('draft destination not flagged')
if (!draft.get(WENDYS)?.isDraftDestination) ok('its stop does NOT \\u2014 "trip to frame" is about the trip\\u2019s missing origin')
else bad('draft flag leaked onto a stop')
if (draft.get(WENDYS)?.isStop) ok('a draft\\u2019s stop is still a stop')
else bad('draft stop unmarked')

// A framed trip's destination must not be flagged as a draft.
if (roles.get(SSV)?.isDraftDestination === false) ok('a framed trip\\u2019s destination is not a draft')
else bad('framed destination flagged draft')

// 5 — nothing invented
if (!roles.has('unrelated')) ok('an untouched pin has no entry')
else bad('an unrelated pin got a role')
if (tripPinRoles([]).size === 0) ok('no trips, no roles')
else bad('empty trip list produced roles')

// 6 — shared stop collapses
const shared = tripPinRoles([
  trip(CHALET, SSV, [{ relationship_id: WENDYS, leg: 'outbound' }]),
  trip(SSV, CHALET, [{ relationship_id: WENDYS, leg: 'return' }]),
])
if (shared.get(WENDYS)?.isStop && shared.size === 3)
  ok('a stop on two trips is one entry, not two')
else bad('shared stop mishandled: size ' + shared.size)

// 7 — the deletion block, which is the DESTINATION fk and nothing else.
// trips.destination_relationship_id is ON DELETE RESTRICT; origins are SET
// NULL and stops are CASCADE, so neither blocks. Getting this wrong in
// either direction is bad: too broad and the app refuses a delete the
// database would allow, too narrow and the user meets a raw refusal after
// accepting a "can't be undone" confirm.
const fiatTrip = [trip(CHALET, SSV, [{ relationship_id: WENDYS, leg: 'outbound' }])]
if (isTripDestination(fiatTrip, SSV)) ok('a destination blocks deletion (RESTRICT)')
else bad('destination did not block deletion')
if (!isTripDestination(fiatTrip, CHALET)) ok('an origin does NOT block \\u2014 that fk is SET NULL')
else bad('origin wrongly blocked deletion')
if (!isTripDestination(fiatTrip, WENDYS)) ok('a stop does NOT block \\u2014 that fk is CASCADE')
else bad('stop wrongly blocked deletion')
if (!isTripDestination([], SSV)) ok('with no trips, nothing blocks')
else bad('blocked with no trips at all')
// Destination of ANY trip blocks, not just the first.
if (isTripDestination([trip(CHALET, 'other'), ...fiatTrip], SSV))
  ok('being any trip\\u2019s destination is enough')
else bad('only the first trip was checked')

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.trip-pin-roles-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
