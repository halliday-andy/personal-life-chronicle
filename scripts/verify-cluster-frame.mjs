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
import { haversineMeters, separationZoom, clusterFrame, zoomToFit, planPinArrival } from '${projectRoot}/lib/globe/cluster-frame'

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

// ── 6. Andy's Hanover cluster: containment was burying the request ──
// Real coordinates, 2026-08-04. clusterFrame computed maxZoom 13.82 — the
// zoom that WOULD separate Dartmouth from Dick's House — but handed it to
// fitBounds as a CAP, and fitBounds fit the 35km cluster span instead,
// landing near z11.3. The cap never bound, so the 508m pair stayed merged
// and the pin Andy had searched for sat under a neighbour's label banner.
const dartmouth = P('dartmouth', -72.2887, 43.7044)
const dicksHouse = P('dicks', -72.2869, 43.7088)   // 508m
const flyingClub = P('flying', -72.3082, 43.6249)  // ~9km
const skiway = P('skiway', -72.0987, 43.7872)      // ~18km
const dunneFarm = P('farm', -72.3969, 43.5552)     // ~19km
const hanover = [dartmouth, dicksHouse, flyingClub, skiway, dunneFarm]
const viewport = { width: 1800, height: 1300, padTop: 110, padLeft: 110, padRight: 110, padBottom: 370 }

const hFrame = clusterFrame(dartmouth, hanover)
if (!hFrame) { bad('no frame for the Hanover cluster'); process.exit(1) }
if (Math.abs(hFrame.nearestNeighborMeters - 508) < 15)
  ok('nearest neighbour measured from the TARGET: ' + Math.round(hFrame.nearestNeighborMeters) + 'm (Dick\\u2019s House)')
else bad('nearest-neighbour distance wrong: ' + hFrame.nearestNeighborMeters)

const fitZ = zoomToFit(hFrame.bounds, viewport, dartmouth.lat)
if (fitZ < hFrame.separationZoom)
  ok('containment (z' + fitZ.toFixed(2) + ') really does land below separation (z' + hFrame.separationZoom.toFixed(2) + ') \\u2014 the bug, in numbers')
else bad('expected the fit to fall short of separation; got ' + fitZ + ' vs ' + hFrame.separationZoom)

const plan = planPinArrival(dartmouth, hanover, viewport)
if (plan.kind === 'focus')
  ok('the plan prefers FOCUS \\u2014 the pin asked for beats the neighbourhood around it')
else bad('plan was ' + plan.kind + ', expected focus')
if (plan.kind === 'focus' && plan.zoom >= hFrame.separationZoom - 0.01)
  ok('focus zoom separates the pair (z' + plan.zoom.toFixed(2) + ')')
else bad('focus zoom too shallow: ' + JSON.stringify(plan))

// And at that zoom the pair really is a label apart — the whole point.
if (plan.kind === 'focus') {
  const mpp2 = (78271.517 * Math.cos((dartmouth.lat * Math.PI) / 180)) / 2 ** plan.zoom
  const px = hFrame.nearestNeighborMeters / mpp2
  if (px >= 129.5) ok('Dartmouth and Dick\\u2019s House render ' + px.toFixed(0) + 'px apart (was ~23px)')
  else bad('still merged at ' + px.toFixed(0) + 'px')
}

// ── 7. Containment still wins when it does NOT cost legibility ──
// A tight cluster that fits comfortably must keep the old behaviour: the
// 2026-07-10 J4 finding (arriving at a fixed zoom stacked Queenstown's
// labels) is not being traded away for this fix.
const tight = clusterFrame(primary, [primary, hotelA, hotelB])
const tightPlan = planPinArrival(primary, [primary, hotelA, hotelB], viewport)
if (tight && zoomToFit(tight.bounds, viewport, primary.lat) >= tight.separationZoom) {
  if (tightPlan.kind === 'fit') ok('a cluster that fits AND separates still uses fitBounds (J4 preserved)')
  else bad('regressed the J4 containment case: ' + tightPlan.kind)
} else {
  if (tightPlan.kind === 'focus') ok('the tight Queenstown pair also needs focus (separation < fit)')
  else bad('unexpected plan for the tight cluster: ' + tightPlan.kind)
}

// A lone pin keeps the plain regional fly.
if (planPinArrival(farAway, [farAway], viewport).kind === 'fly')
  ok('a lone target still plans a plain fly')
else bad('lone target did not plan a fly')

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.cluster-frame-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
