#!/usr/bin/env node
/**
 * Proof for the trip-PATCH payload builder (lib/globe/trip-patch-payload.ts).
 * Pure-function test — no DB.
 *
 * Origin (R22, 2026-08-03): `retarget_trip` was applied and proven, but
 * nothing called it — a trip's destination was changeable only by an agent
 * running SQL. The framing panel now offers the change, and the decision
 * "is this a retarget?" is the one piece of logic worth isolating: sending
 * a retarget when the destination did NOT change would append the
 * destination to its own itinerary if the demote flag were ever mis-read,
 * and sending nothing when it DID change silently drops the edit.
 *
 * Same class as the 2026-07-18 `unsequenced` bug that produced
 * create-pin-payload: manual re-enumeration of a payload's fields at a
 * boundary silently drops newly added fields. Hence the same guard — the
 * `routed` object must satisfy Record<keyof TripFrameEdits, unknown>.
 *
 * Asserts:
 *   1. An unchanged destination sends NO destinationRelationshipId (so the
 *      API never calls retarget_trip needlessly).
 *   2. A changed destination sends it, with demoteOldToStop alongside.
 *   3. demoteOldToStop survives as BOTH true and false (the flag is the
 *      difference between keeping Wendy's apartment as a stop and losing it).
 *   4. An empty/whitespace destination selection is never sent —
 *      trips.destination_relationship_id is NOT NULL.
 *   5. subtype passes through (R22 add-on: frame_trip has always taken
 *      p_subtype, no caller ever sent it).
 *   6. Every editable field of the panel reaches the payload.
 *   7. The origin's "Decide later" empty string still means clearOrigin,
 *      unchanged from before R22.
 *
 * Run: node scripts/verify-trip-patch-payload.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { buildTripPatchPayload } from '${projectRoot}/lib/globe/trip-patch-payload'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

// Andy's Fiat 128 trip, as it stands in the chronicle on 2026-08-03.
const WENDYS = '0a061860-8a5c-484c-97a0-3aa074efbb93'
const SSV    = 'a21610cf-dfad-488b-a6ba-f48ffde2cb29'
const CHALET = 'e3800b58-e200-4a89-bb77-533c8ecb6513'

const edits = {
  originId: CHALET,
  destinationId: WENDYS,
  demoteOldToStop: true,
  title: 'The epic solo road trip in the overloaded Fiat 128',
  whenText: 'October 1978',
  yearHint: 1978,
  subtype: 'road_trip' as const,
  returnToOrigin: false,
}

// 1. Unchanged destination → no retarget
const same = buildTripPatchPayload(edits, WENDYS)
if (!('destinationRelationshipId' in same)) ok('unchanged destination sends no retarget')
else bad('retarget sent for an unchanged destination: ' + JSON.stringify(same))
if (!('demoteOldToStop' in same)) ok('demote flag withheld when there is no retarget')
else bad('demote flag sent without a retarget')

// 2 + 3. Changed destination → retarget, with the flag both ways
const moved = buildTripPatchPayload({ ...edits, destinationId: SSV }, WENDYS)
if (moved.destinationRelationshipId === SSV) ok('changed destination sends the retarget (Wendy\\u2019s \\u2192 SSV Day Lodge Room)')
else bad('retarget dropped: ' + JSON.stringify(moved))
if (moved.demoteOldToStop === true) ok('demoteOldToStop: true rides along (Wendy\\u2019s is kept as a stop)')
else bad('demote flag lost on the true path')
const dropped = buildTripPatchPayload({ ...edits, destinationId: SSV, demoteOldToStop: false }, WENDYS)
if (dropped.demoteOldToStop === false) ok('demoteOldToStop: false survives (false is not \\u201cabsent\\u201d)')
else bad('demote flag collapsed to the default on the false path: ' + JSON.stringify(dropped))

// 4. Never send an empty destination — the column is NOT NULL
for (const empty of ['', '   ']) {
  const p = buildTripPatchPayload({ ...edits, destinationId: empty }, WENDYS)
  if (!('destinationRelationshipId' in p)) ok('blank destination (' + JSON.stringify(empty) + ') is never sent')
  else bad('blank destination leaked into the payload: ' + JSON.stringify(p))
}

// 5. subtype passes through
if (moved.subtype === 'road_trip') ok('subtype reaches the payload (frame_trip\\u2019s p_subtype finally has a caller)')
else bad('subtype dropped: ' + JSON.stringify(moved))

// 6. Every editable field present
const expected = ['originRelationshipId', 'clearOrigin', 'title', 'whenText', 'yearHint', 'subtype', 'returnToOrigin']
const missing = expected.filter((k) => !(k in moved))
if (missing.length === 0) ok('all ' + expected.length + ' always-sent fields present')
else bad('missing fields: ' + JSON.stringify(missing))

// 7. Origin "Decide later" still clears
const noOrigin = buildTripPatchPayload({ ...edits, originId: '' }, WENDYS)
if (noOrigin.originRelationshipId === null) ok('\\u201cDecide later\\u201d origin sends null, unchanged by R22')
else bad('origin clearing broke: ' + JSON.stringify(noOrigin))

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.trip-patch-payload-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
