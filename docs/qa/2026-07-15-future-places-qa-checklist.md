# QA — Future Places pin (Trips & Travel U8)

**Date:** 2026-07-15
**Prereqs:** dev server on `localhost:3001`.

## 1. Capture

- [ ] Drop a pin somewhere you dream of going. The type selector offers
      **Future place** ("Somewhere you want to go — or maybe live one
      day…"); the anchor prompt reads "Dreaming from which home?
      (optional)" and "Not sure / standalone" works.
- [ ] The pin renders as a **hollow mint ring** — visibly "not yet
      filled in", distinct from every historical pin and from a rose
      trip-draft ring.
- [ ] The legend lists Future place with its own filter toggle.

## 2. Boundaries (R20)

- [ ] The spine is untouched: no thread reroute, no sequence position
      asked.
- [ ] The Travel Journal does NOT list it (aspiration ≠ unframed trip).
- [ ] The residential Journey shows it only as a marker ("Elsewhere"
      when standalone).

## 3. Promotion

- [ ] Re-type path: edit panel → change type to Vacation → the pin
      keeps its entity, name, recollection; styling flips to rose.
- [ ] Trip path: select a Future place → strip reads "Been there now?
      It becomes a real place + trip:" → pick Vacation → the pin
      re-types to Vacation AND the framing panel opens; after saving,
      the trip exists and the pin is historical.
- [ ] The when-phrase and placard survive both paths.

## 4. Data proof

- [ ] `node scripts/verify-trips-travel.mjs` passes (now includes the
      future-place scenarios).
