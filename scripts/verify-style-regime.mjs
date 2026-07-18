#!/usr/bin/env node
/**
 * Proof for the globe basemap regime switcher (lib/globe/style-regime.ts).
 * Pure-function test — no map, no DB.
 *
 * The globe runs two basemaps: nocturne (dark, the identity view) at
 * world/regional zoom, daylight (outdoors detail) at reading zoom.
 * Asserts the hysteresis contract:
 *   1. Nocturne holds until the IN threshold; crossing it flips to daylight.
 *   2. Daylight holds until the OUT threshold; crossing it flips back.
 *   3. The band between OUT and IN is sticky in BOTH directions (no
 *      flapping while hovering near the boundary).
 *   4. Thresholds are sane: OUT < IN.
 *
 * Run: node scripts/verify-style-regime.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { nextRegime, DAYLIGHT_IN_ZOOM, DAYLIGHT_OUT_ZOOM } from '${projectRoot}/lib/globe/style-regime'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

// 4. Sane thresholds first — everything else assumes them.
if (DAYLIGHT_OUT_ZOOM < DAYLIGHT_IN_ZOOM) ok('OUT threshold sits below IN (a real hysteresis band)')
else bad('thresholds inverted or equal')

// 1. Nocturne → daylight only at/past IN
if (nextRegime(1.4, 'nocturne') === 'nocturne') ok('world view stays nocturne')
else bad('world view flipped')
if (nextRegime(DAYLIGHT_IN_ZOOM - 0.01, 'nocturne') === 'nocturne') ok('just under IN stays nocturne')
else bad('flipped before IN')
if (nextRegime(DAYLIGHT_IN_ZOOM, 'nocturne') === 'daylight') ok('crossing IN flips to daylight')
else bad('did not flip at IN')

// 2. Daylight → nocturne only at/below OUT
if (nextRegime(20, 'daylight') === 'daylight') ok('deep zoom stays daylight')
else bad('deep zoom flipped')
if (nextRegime(DAYLIGHT_OUT_ZOOM + 0.01, 'daylight') === 'daylight') ok('just above OUT stays daylight')
else bad('flipped before OUT')
if (nextRegime(DAYLIGHT_OUT_ZOOM, 'daylight') === 'nocturne') ok('crossing OUT flips back to nocturne')
else bad('did not flip at OUT')

// 3. The band is sticky from both sides
const mid = (DAYLIGHT_IN_ZOOM + DAYLIGHT_OUT_ZOOM) / 2
if (nextRegime(mid, 'nocturne') === 'nocturne' && nextRegime(mid, 'daylight') === 'daylight')
  ok('mid-band holds whichever regime you arrived in (no flapping)')
else bad('mid-band is not sticky')

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.style-regime-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
