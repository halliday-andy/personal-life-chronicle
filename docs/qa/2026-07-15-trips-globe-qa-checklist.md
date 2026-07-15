# QA — Trip routes on the globe (Trips & Travel U4)

**Date:** 2026-07-15
**Prereqs:** dev server on `localhost:3001`; at least one framed trip and
one draft trip (create via the U3 capture flow if needed).

## 1. Spine dominance (AE4 / R10)

- [ ] Default view: the globe looks exactly as before — spine, markers,
      tethers; **no trip arcs**.
- [ ] Legend & filters gains **✈ Trip routes** (off) and a rose
      "Trip route (out / ⌁ back)" swatch line; the dashed slate row now
      reads "Anchor tether".
- [ ] Toggle Trip routes on → every **framed** trip draws rose arcs:
      solid outbound, dashed return. Draft trips draw nothing.
- [ ] Toggle off → arcs vanish.

## 2. Selection shows the complete route

- [ ] With the toggle **off**, click a trip's destination pin → that
      trip's complete route renders (origin → stops → destination →
      return); deselect → it disappears.
- [ ] Selecting the trip's **origin** pin (e.g. the home) also reveals it.

## 3. Destination marker & draft badge (R11 / R6)

- [ ] A trip destination pin wears a **rose halo ring** over its type
      styling — distinguishable from a plain vacation/professional pin
      at a glance (compare side by side).
- [ ] A draft destination adds a slowly turning dashed ring and a
      "trip to frame" line under its name chip. With reduced motion
      enabled (macOS setting), the ring is static.
- [ ] Selecting a destination pin shows the trip strip below the search
      box: title, subtype, when, "needs framing" chip on drafts, and
      **Frame** / **Route** actions.
- [ ] **Frame** on a draft opens the framing panel (origin suggested from
      the pin's anchor); saving removes the draft ring and the arc appears.

## 4. Route building

- [ ] **Route** opens the builder banner: leg toggle (Outbound/Return),
      instructions, Done.
- [ ] Click three pins in travel order (two on outbound, switch leg,
      one on return) → arcs re-draw after each click in
      origin → outbound → destination → return order.
- [ ] Clicking the trip's own destination pin shows an error ("the
      destination is the turnaround"), adds nothing.
- [ ] Stop chips: ‹ › reorder within the leg and the arc order updates;
      ✕ removes a stop.
- [ ] While the banner is up: empty-globe clicks do nothing (no draft
      pin, no deselect); **Done** restores normal behavior.

## 5. Regression sweep

- [ ] Hover tether preview, class filters, "Side lines in view",
      selection emphasis on spine legs — all unchanged.
- [ ] Pin placement (non-trip) unchanged end to end.
