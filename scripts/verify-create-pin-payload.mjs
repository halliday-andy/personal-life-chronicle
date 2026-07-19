#!/usr/bin/env node
/**
 * Proof for the pin-create payload builder (lib/globe/create-pin-payload.ts).
 * Pure-function test — no DB.
 *
 * Origin (2026-07-18, Andy's live repro): GlobeView.handleSave re-typed the
 * PinDraftData field list into the POST body and silently dropped
 * `unsequenced` — every "Decide later — not yet placed" primary landed
 * SEQUENCED at the spine's end (arc from the prior last stop). The builder
 * centralizes assembly behind a compile-time exhaustiveness guard.
 *
 * Asserts:
 *   1. unsequenced survives into the payload (true AND false).
 *   2. Every API field is present (the omission class generally).
 *   3. Label falls back to the draft's geocoded label when name is blank.
 *   4. `trip` is NOT sent — it is deliberately client-side (U3 framing).
 *
 * Run: node scripts/verify-create-pin-payload.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { buildCreatePinPayload } from '${projectRoot}/lib/globe/create-pin-payload'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

const draft = { lng: -115.78, lat: 51.08, label: 'Sunshine Village' }
const data = {
  name: 'SSV Staff Housing',
  whenText: 'January 1978 to May 1978',
  description: 'Staff quarters above the day lodge',
  body: 'The winter I worked the lifts.',
  position: null,
  typeCode: 'lived_at',
  anchorId: null,
  entityId: null,
  trip: null,
  unsequenced: true,
}

const p = buildCreatePinPayload(draft, data)

// 1. The bug itself
if (p.unsequenced === true) ok('unsequenced: true survives into the payload (the 2026-07-18 bug)')
else bad('unsequenced dropped: ' + JSON.stringify(p))
const p2 = buildCreatePinPayload(draft, { ...data, unsequenced: false, position: 2 })
if (p2.unsequenced === false && p2.position === 2) ok('sequenced create unaffected (false + position pass through)')
else bad('sequenced path mangled: ' + JSON.stringify(p2))

// 2. Every API field present
const expected = ['lng', 'lat', 'label', 'whenText', 'body', 'position', 'typeCode', 'anchorId', 'description', 'entityId', 'unsequenced']
const missing = expected.filter((k) => !(k in p))
if (missing.length === 0) ok('all API fields present: ' + expected.length)
else bad('missing fields: ' + JSON.stringify(missing))

// 3. Label fallback
if (buildCreatePinPayload(draft, { ...data, name: '  ' }).label === 'Sunshine Village')
  ok('blank name falls back to the geocoded draft label')
else bad('label fallback broken')
if (p.label === 'SSV Staff Housing') ok('typed name wins over the draft label')
else bad('typed name lost')

// 4. trip stays client-side
if (!('trip' in p)) ok('trip is not sent (client-side U3 framing by design)')
else bad('trip leaked into the POST payload')

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.create-pin-payload-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
