# QA — Frequent-traveler package (Trips & Travel U7)

**Date:** 2026-07-15
**Prereqs:** dev server on `localhost:3001`; several trips across
subtypes/years (fixtures fine).

## 1. Home Base (R16)

- [ ] `/journey?mode=travel`: the filter bar ends with a **Home Base**
      select listing your primary residences. Pick one.
- [ ] Capture a new trip on an **unanchored** destination ("Not sure /
      standalone" in the modal) → the framing panel's origin select
      suggests the Home Base first, silently — no extra confirmation.
- [ ] An **anchored** destination still suggests its anchor first
      (anchor beats Home Base — "home at the time" wins over default).
- [ ] Reload the journal → the Home Base selection persisted; on the
      globe, selecting that home's pin shows a "home base" chip in its
      trip summary strip.
- [ ] Set Home Base to **None** → next framing falls back to the
      anchor / plain list.

## 2. Reuse this destination (R17 / R2)

- [ ] Select a pin that already has a trip → the strip's last row:
      "Another trip here: Professional travel / Vacation / Road trip".
- [ ] Create one → a second, separate trip on the same pin (both rows
      in the strip; both in the journal; the place entity is reused,
      no duplicate pin).

## 3. Filters (R18)

- [ ] Subtype chips multi-toggle: with "Vacation" on, only vacations
      list; adding "Road trip" shows both; all off = everything.
- [ ] The decade select appears once hints span 2+ decades; picking
      "1980s" hides unhinted trips and other decades.
- [ ] Filters compose (subtype + decade); an impossible combination
      shows "No trips match these filters."

## 4. Residence summary (R19)

- [ ] On the globe, select a home with departures → a summary strip
      "N trips originated here · Travel Journal →" (no per-trip rows).
- [ ] The link lands in the Travel Journal.

## 5. Regression

- [ ] Trip strips on destinations, framing, unframing — unchanged.
- [ ] `node scripts/verify-trips-travel.mjs` still passes end to end
      (now includes the home-base RPC proofs).
