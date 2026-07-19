#!/usr/bin/env node
/**
 * Proof for trip-origin suggestion precedence (lib/globe/trip-origin.ts).
 * Pure-function test — no DB.
 *
 * Origin (2026-07-19, Andy's request): "Start a trip from here" on a
 * residence card arms an origin-first entry into the destination-first
 * trip flow. The armed origin must beat the passive suggestions (anchor,
 * Home Base) but never overwrite an origin a trip ALREADY has.
 *
 * Asserts precedence: existing origin > armed origin > anchor > Home Base > null.
 *
 * Run: node scripts/verify-trip-origin.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { suggestTripOrigin } from '${projectRoot}/lib/globe/trip-origin'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

if (suggestTripOrigin({ existingOriginId: 'ex', armedOriginId: 'armed', anchorId: 'anc', homeBaseId: 'hb' }) === 'ex')
  ok('a trip\\u2019s existing origin is never overwritten by an armed one')
else bad('existing origin lost')

if (suggestTripOrigin({ armedOriginId: 'armed', anchorId: 'anc', homeBaseId: 'hb' }) === 'armed')
  ok('armed "start a trip from here" beats anchor and Home Base')
else bad('armed origin lost')

if (suggestTripOrigin({ anchorId: 'anc', homeBaseId: 'hb' }) === 'anc')
  ok('anchor residence beats Home Base (unchanged suggestion order)')
else bad('anchor lost to Home Base')

if (suggestTripOrigin({ homeBaseId: 'hb' }) === 'hb') ok('Home Base is the last suggestion')
else bad('Home Base lost')

if (suggestTripOrigin({}) === null && suggestTripOrigin({ armedOriginId: null, anchorId: null }) === null)
  ok('nothing to suggest yields null (framing panel shows "decide later")')
else bad('null case broken')

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.trip-origin-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
