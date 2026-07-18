# QA — Basemap regime: nocturne ↔ daylight detail (2026-07-18)

App: **http://localhost:3001/globe** (sign in first).

From your Sunshine Village comparison: dark nocturne stays the identity
view at world/regional zoom (map as canvas); past reading zoom the
basemap crosses to Mapbox **outdoors** (map as document — lifts, trails,
POIs, green space). Thresholds: in at zoom ≥ 13.2, back out at ≤ 12.6
(tunable — say the word if the crossover feels early or late). Part of
master-sequence Phase 1.

## 1. The crossing

- [ ] Zoom into any pin neighborhood (e.g. the SSV Staff Housing pin) →
      around town scale the basemap **dissolves into the detailed
      colored style** — buildings, POI icons, trails, lift lines appear.
- [ ] Zoom back out → the **nocturne globe returns** by regional scale;
      stars/atmosphere intact at world view.
- [ ] Sit near the boundary and nudge zoom up/down slightly → **no
      flapping** (the swap has a dead band).
- [ ] The swap reads as a deliberate dissolve, not a hard flash.
      `[taste]` the moment.

## 2. Chronicle layers survive the swap

- [ ] Spine arcs + chevrons are present immediately after each swap
      (both directions), not missing until the next interaction.
- [ ] With a spine pin **selected**, cross the threshold → its
      inbound/outbound **leg emphasis persists**.
- [ ] Hover-preview tethers, "Side lines in view", and class filters
      behave identically in both regimes.
- [ ] With the Trips toggle on, route arcs survive the swap.
- [ ] A **draft pin** mid-placement and a **route-building** session both
      survive a crossing untouched.

## 3. Legibility on the light basemap

- [ ] Pin name/when pills stay readable (they carry their own dark
      backgrounds). Flag any pin type whose dot/ring washes out on the
      light style — a `.globe-daylight` CSS hook exists for tuning.
- [ ] Spine/commute/tether/route line colors still read against the
      pale basemap. `[taste]` — deepened daylight variants are a small
      follow-up if not.
- [ ] The origin star ★ at detail zoom (if visible): still legible.

## 4. Edges

- [ ] A `?pin=` deep link whose cluster framing lands past zoom 13 →
      arrives already in daylight (the swap fires during the fly).
- [ ] Reduced motion (System Settings → Accessibility) → the swap is
      instant, no dissolve animation.
- [ ] Pin search → pick a pin → place a new pin at detail zoom: the full
      loop works in daylight.
