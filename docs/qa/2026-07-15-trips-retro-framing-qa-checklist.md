# QA — Retroactive framing, un-framing, trip jots (Trips & Travel U6)

**Date:** 2026-07-15
**Prereqs:** dev server on `localhost:3001`. Section 1 walks AE2 on your
real Wallace Monument pin — everything is reversible (un-framing keeps
the pin byte-identical; proven in the U1 data proof).

## 1. AE2 — the Scotland 1960 trip (real data)

- [ ] On the globe, select **Memorial Castle of Sir William Wallace**.
      Below the search box: "✈ This was a journey? Frame it as a trip:
      Professional travel / Vacation / Road trip".
- [ ] Choose **Vacation** → the framing panel opens with **RAF
      Mildenhall (home at the time)** already suggested as origin and
      "1960" prefilled as the when-phrase.
- [ ] Add title "Clan homelands trip", year 1960, **Save the frame** →
      trip strip now shows the framed trip; the route arc RAF
      Mildenhall → Wallace Monument draws while selected.
- [ ] **Route** → add the Moffat/lowlands visit: pin Moffat first (a
      Log anchored to the trip's destination or standalone), then in
      the builder click it on the **return** leg (the family headed
      south toward the lowlands after Stirling — or outbound, your
      memory rules). The arc reorders accordingly.
- [ ] The pin itself is unchanged: name, tether, "1960" chip,
      recollection, photos, jots all exactly as before framing.
- [ ] In `/journey?mode=travel`, the trip appears under **1960**.

## 2. Trip-level jots (R4)

- [ ] Expand the trip's card in the Travel Journal → a "Memories to
      write" hopper. Jot "the genealogy conversation with my sister" →
      it sticks; reload → still there.
- [ ] The jot is on the TRIP, not the place: the Wallace pin's own
      hopper (globe detail card) does not show it, and vice versa.
- [ ] A stop-level jot: open the Moffat pin's hopper on the globe —
      jots there stay with Moffat.

## 3. Log attachment (R15)

- [ ] Drop a Log anchored to the Wallace Monument pin ("the gift shop
      claymore") → it tethers to the destination like any Log; it nests
      under the destination in the residential Journey.

## 4. Un-framing (R14)

- [ ] On a THROWAWAY trip (create one on a fixture pin): trip strip →
      **Unframe** → confirm ("Really remove the trip? The pin stays.")
      → trip gone from strip and Travel Journal; pin intact.
- [ ] Unframe a trip whose backing entity carries a jot → the trip goes;
      the jotted entity survives (visible in /entities as the trip name).
- [ ] Deleting a pin that IS a destination now explains itself: the
      edit panel's Delete shows "This pin is a trip's destination.
      Unframe or remove the trip first…" instead of an SQL error.

## 5. Regression

- [ ] A primary residence pin never shows the "frame it as a trip" strip.
- [ ] The U3 capture flow still opens the framing panel after a Trip save.
