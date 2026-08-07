#!/usr/bin/env node
/**
 * Proof for the chronicle-layer re-installer (lib/globe/chronicle-layers.ts).
 * Pure — a stub map, no mapbox, no DOM.
 *
 * Origin (Andy, 2026-08-04, mid-QA): after retargeting his Fiat 128 trip he
 * could not get the globe to draw ANY line — not the trip route, not the
 * residential spine. The data was perfect (origin, one outbound stop,
 * destination, no return). A page reload brought every line back.
 *
 * Cause: the basemap regime swap calls `map.setStyle()` when you cross the
 * zoom threshold, and **a setStyle wipes every custom source and layer**.
 * Rebuilding them hung on ONE event — `style.load` — which does not fire on
 * every path setStyle can take. When it doesn't, our sources are gone (they
 * are absent from the incoming style, so the swap removes them) and nothing
 * ever puts them back. DOM markers are unaffected, which is why the pins
 * looked healthy while every line had vanished: the two live in different
 * worlds, and only one of them dies with the style.
 *
 * CLASS OF BUG: **rebuilding on one event when the thing you depend on can
 * be destroyed by several.** Losing state to a lifecycle you don't fully
 * control means re-asserting it on every settle point, not on the single
 * event that happened to work when it was written.
 *
 * Asserts:
 *   1. Installs when the style is loaded and the sentinel source is gone.
 *   2. Does NOT install while the style is still loading (addSource would
 *      throw), and does NOT install when the layers are already present.
 *   3. **Recovers from a style swap that never fires `style.load`** — the
 *      bug itself. `idle` alone must be enough.
 *   3b. But NEVER from `styledata`, which fires mid-render: mutating the
 *      style from there crashed mapbox's placement engine outright.
 *   4. Repeated events after a successful install do nothing (idempotent —
 *      these events fire constantly during interaction).
 *   5. Survives many swaps in a row (Andy crossed the threshold repeatedly).
 *   6. Detach stops listening — no leak across map re-creation.
 *
 * Run: node scripts/verify-chronicle-installer.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { attachChronicleInstaller, STYLE_REINSTALL_EVENTS } from '${projectRoot}/lib/globe/chronicle-layers'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

/** A map that behaves like mapbox around a style swap. */
function stubMap() {
  const listeners = new Map<string, (() => void)[]>()
  const state = { styleLoaded: true, hasSource: false, installs: 0 }
  return {
    state,
    map: {
      on(type: string, fn: () => void) { listeners.set(type, [...(listeners.get(type) ?? []), fn]) },
      off(type: string, fn: () => void) {
        listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn))
      },
      isStyleLoaded: () => state.styleLoaded,
      getSource: (_id: string) => (state.hasSource ? {} : undefined),
    },
    fire(type: string) { for (const fn of listeners.get(type) ?? []) fn() },
    listenerCount: () => [...listeners.values()].reduce((n, l) => n + l.length, 0),
    install: () => { state.installs++; state.hasSource = true },
  }
}

// 1. Loaded + missing → install
{
  const s = stubMap()
  attachChronicleInstaller(s.map, 'trip-tethers', s.install)
  s.fire('style.load')
  if (s.state.installs === 1) ok('installs when the style is loaded and the sources are gone')
  else bad('did not install: ' + s.state.installs)
}

// 2a. Still loading → do NOT touch the style (addSource would throw)
{
  const s = stubMap()
  s.state.styleLoaded = false
  attachChronicleInstaller(s.map, 'trip-tethers', s.install)
  for (const ev of STYLE_REINSTALL_EVENTS) s.fire(ev)
  if (s.state.installs === 0) ok('never installs into a style that is still loading')
  else bad('installed mid-load: ' + s.state.installs)
}

// 2b. Already present → no double install
{
  const s = stubMap()
  s.state.hasSource = true
  attachChronicleInstaller(s.map, 'trip-tethers', s.install)
  for (const ev of STYLE_REINSTALL_EVENTS) s.fire(ev)
  if (s.state.installs === 0) ok('never re-installs over layers that are already there')
  else bad('installed on top of existing layers: ' + s.state.installs)
}

// 3. THE BUG: a swap that never fires style.load must still recover.
{
  const s = stubMap()
  attachChronicleInstaller(s.map, 'trip-tethers', s.install)
  s.fire('style.load')                 // initial install
  s.state.hasSource = false            // setStyle wipes the custom sources
  s.fire('idle')                       // ...and style.load never comes
  if (s.state.installs === 2) ok('recovers from a swap announced only by "idle" (the bug)')
  else bad('lines stayed dead after an idle-only swap: ' + s.state.installs)
}

// 3b. ...but NOT from styledata, which fires mid-render.
// Adding sources and symbol layers from inside the render/placement cycle
// crashed mapbox outright: "Cannot read properties of undefined (reading
// 'get')" in Placement.continuePlacement (Andy, 2026-08-04). Recovery has
// to happen at a point that is safe to mutate from, not merely at the
// earliest point that would work.
{
  const s = stubMap()
  attachChronicleInstaller(s.map, 'trip-tethers', s.install)
  s.fire('style.load')
  s.state.hasSource = false
  s.fire('styledata')
  if (s.state.installs === 1)
    ok('styledata never triggers an install \\u2014 mutating mid-render crashes the placement engine')
  else bad('installed from styledata: ' + s.state.installs + ' (this crashed mapbox once)')
  // idle still follows and repairs it, so nothing is lost by ignoring styledata.
  s.fire('idle')
  if (s.state.installs === 2) ok('the following idle still repairs it \\u2014 recovery is only deferred, not dropped')
  else bad('idle failed to repair after a styledata: ' + s.state.installs)
}
if (!(STYLE_REINSTALL_EVENTS as readonly string[]).includes('styledata'))
  ok('styledata is absent from the event list by construction')
else bad('styledata is back in STYLE_REINSTALL_EVENTS')

// 4. Idempotent under event spam
{
  const s = stubMap()
  attachChronicleInstaller(s.map, 'trip-tethers', s.install)
  for (let i = 0; i < 50; i++) for (const ev of STYLE_REINSTALL_EVENTS) s.fire(ev)
  if (s.state.installs === 1) ok('100 events produce exactly one install')
  else bad('event spam caused ' + s.state.installs + ' installs')
}

// 5. Many swaps in a row — Andy crossed the regime threshold repeatedly
{
  const s = stubMap()
  attachChronicleInstaller(s.map, 'trip-tethers', s.install)
  s.fire('style.load')
  for (let i = 0; i < 5; i++) { s.state.hasSource = false; s.fire('idle') }
  if (s.state.installs === 6) ok('five further swaps rebuild five times')
  else bad('rebuild count wrong across repeated swaps: ' + s.state.installs)
}

// 6. Detach leaves nothing listening
{
  const s = stubMap()
  const detach = attachChronicleInstaller(s.map, 'trip-tethers', s.install)
  if (s.listenerCount() === STYLE_REINSTALL_EVENTS.length) ok('one listener per settle point')
  else bad('listener count: ' + s.listenerCount())
  detach()
  if (s.listenerCount() === 0) ok('detach removes every listener')
  else bad('leaked listeners: ' + s.listenerCount())
  s.state.hasSource = false
  s.fire('idle')
  if (s.state.installs === 0) ok('a detached installer stays silent')
  else bad('detached installer still fired')
}

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.chronicle-installer-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
