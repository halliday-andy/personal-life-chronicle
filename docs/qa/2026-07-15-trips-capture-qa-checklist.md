# QA — Destination-first trip capture (Trips & Travel U3)

**Date:** 2026-07-15
**Prereqs:** dev server on `localhost:3001`, signed in as Andy. The globe
has your real spine; fixtures below are disposable (delete when done).

## 1. Draft capture (AE1 — the Winnipeg case)

- [ ] Drop a pin on a city you once traveled to. In the modal, open
      "What kind of place?" — a **Trip — somewhere I traveled** option
      appears after the six pin types.
- [ ] Choosing it swaps the description to the trip explainer ("Begin
      with the destination — the place that marked the turn toward
      home…") and reveals **What kind of trip?** (Professional travel /
      Vacation / Road trip).
- [ ] The "Which home were you living in then?" picker still appears
      and defaults to a home; "Not sure / standalone" works.
- [ ] Save. The pin appears (typed Professional travel or Vacation per
      subtype). The **Frame the trip** panel opens over the globe.
- [ ] Choose **Keep as a draft**. Panel closes; no error. (The trip is
      a destination-only draft — visible in the Travel Journal once U5
      lands; its route arc stays absent per R6.)

## 2. Immediate framing (R8/R9)

- [ ] Repeat the capture with a different city; this time in the frame
      panel: the origin select's first option is the home you anchored
      to, suffixed "(home at the time)"; the list offers every other
      pin and **Decide later**.
- [ ] Enter a title and a year (e.g. 1984). **Save the frame** → the
      confirmation notice names the trip.
- [ ] Enter a junk year ("84x") → inline error, nothing saved.

## 3. Adoption still works

- [ ] Name the destination pin exactly like an existing unpinned entity
      → the "pin it instead of creating a duplicate?" strip still
      appears and works with the Trip option selected.

## 4. Cancel safety

- [ ] Cancel the pin modal with Trip selected → nothing is created
      (no pin, no trip).
- [ ] After a successful save + "Keep as a draft", reload the globe →
      the destination pin is present, unchanged.

## Cleanup

- [ ] Delete the fixture pins. Deleting a pin that is a trip
      destination is **blocked** with an error (expected — U6 adds the
      unframe prompt; for now delete the trip first via
      `DELETE /api/trips/<id>` or keep the fixtures until U6).
