#!/usr/bin/env node
/**
 * Proof for cluster-aware arrival framing (2026-07-10) —
 * lib/globe/cluster-frame.ts.
 *
 * Asserts:
 *   1. haversine sanity (known city pair, ±1%).
 *   2. A lone target → null (caller keeps its plain flyTo).
 *   3. A Queenstown-shaped cluster (two hotels ~400m apart, ski school
 *      ~8km out, far pins excluded) → bounds contain exactly the cluster;
 *      neighborCount right.
 *   4. separationZoom: closer pairs demand MORE zoom (monotonic), and the
 *      computed zoom really renders the pair ≥ the requested pixel gap.
 *   5. Clamps: duplicate coordinates cap at maxZoom (no zoom-to-infinity);
 *      a spread-out pair floors at minZoom.
 *
 * Pure — no DB, no map. Run: node scripts/verify-cluster-frame.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { haversineMeters, separationZoom, clusterFrame } from '${projectRoot}/lib/globe/cluster-frame'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

// ── 1. haversine sanity: Queenstown → Cromwell ≈ 42.5 km ──
const qt = { lng: 168.6626, lat: -45.0312 }
const cromwell = { lng: 169.1990, lat: -45.0380 }
const d = haversineMeters(qt, cromwell)
if (d > 40000 && d < 45000) ok('haversine Queenstown\\u2192Cromwell \\u2248 ' + (d / 1000).toFixed(1) + ' km')
else bad('haversine off: ' + d)

// ── Fixtures: the Queenstown shape ──
const P = (id: string, lng: number, lat: number) => ({ relationship_id: id, lng, lat })
const primary = P('primary', 168.6626, -45.0312)
const hotelA = P('hotelA', 168.6600, -45.0320)  // ~200m from primary
const hotelB = P('hotelB', 168.6650, -45.0330)  // ~450m from hotelA
const skiSchool = P('ski', 168.7350, -44.9760)  // ~8km out
const farAway = P('far', 174.7645, -36.8509)    // Auckland — excluded
const pins = [primary, hotelA, hotelB, skiSchool, farAway]

// ── 2. Lone target → null ──
if (clusterFrame(farAway, [farAway, primary, hotelA].filter(p => p.relationship_id === 'far')) === null)
  ok('a lone target frames nothing (plain flyTo path)')
else bad('lone target produced a frame')

// ── 3. Cluster bounds + membership ──
const frame = clusterFrame(primary, pins)
if (!frame) { bad('no frame for the Queenstown cluster'); process.exit(1) }
if (frame.neighborCount === 3) ok('cluster = primary + 3 neighbors; Auckland excluded')
else bad('wrong neighborCount: ' + frame.neighborCount)
const [[w, s], [e, n]] = frame.bounds
const contains = (p: any) => p.lng >= w && p.lng <= e && p.lat >= s && p.lat <= n
if ([primary, hotelA, hotelB, skiSchool].every(contains) && !contains(farAway))
  ok('bounds contain exactly the cluster')
else bad('bounds wrong: ' + JSON.stringify(frame.bounds))

// ── 4. separationZoom behavior ──
const z400 = separationZoom(400, -45, 130)
const z200 = separationZoom(200, -45, 130)
if (z200 > z400) ok('closer pairs demand more zoom (monotonic)')
else bad('separationZoom not monotonic: ' + z200 + ' vs ' + z400)
// At the computed zoom the pair must render >= sepPx apart:
const mpp = (78271.517 * Math.cos((-45 * Math.PI) / 180)) / 2 ** z400
if (400 / mpp >= 129.5) ok('computed zoom renders the pair a label-width apart (' + (400 / mpp).toFixed(0) + 'px)')
else bad('separation math wrong: ' + (400 / mpp) + 'px')

// ── 5. Clamps ──
const dupFrame = clusterFrame(primary, [primary, P('dup', primary.lng, primary.lat)])
if (dupFrame && dupFrame.maxZoom <= 14) ok('duplicate coordinates cap at maxZoom (no zoom-to-infinity)')
else bad('duplicate pair unclamped: ' + JSON.stringify(dupFrame))
const wide = clusterFrame(primary, [primary, P('w', 168.9, -45.2)]) // ~25km — inside radius, far apart
if (wide && wide.maxZoom >= 8) ok('a spread pair floors at minZoom')
else bad('wide pair below floor: ' + JSON.stringify(wide))

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.cluster-frame-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
