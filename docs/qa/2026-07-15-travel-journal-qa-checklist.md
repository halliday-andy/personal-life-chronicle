# QA — Travel Journal mode in Journey (Trips & Travel U5)

**Date:** 2026-07-15
**Prereqs:** dev server on `localhost:3001`; a few trips with year hints,
one without a hint, and one draft (create via the U3/U4 flows).

## 1. Mode toggle (R12)

- [ ] `/journey` opens as before (Residential Journey), plus a segmented
      control: **Residential Journey | Travel Journal**. The header
      count reads "N stops · M trips".
- [ ] Switch to Travel Journal → trip cards; switch back → the
      residential column, **scrolled where you left it** (scroll one
      mode, flip, flip back — position held in both directions).
- [ ] The URL mirrors the mode (`?mode=travel`); a cold load of
      `/journey?mode=travel` opens the Travel Journal directly.

## 2. Chronology (KTD5)

- [ ] Trips group under year headings from the **typed year hint** —
      trips whose hint you never entered group last under **Sometime**,
      whatever their when-phrase says (nothing is parsed).
- [ ] Within a year, order is creation order.

## 3. Trip cards (R13)

- [ ] Header: ✈, title (or "Trip to X"), subtype chip, when chip,
      origin → destination line; drafts add a **needs framing** chip
      and the draft banner counts them at the top.
- [ ] Expanding shows the itinerary in travel order: From / via… /
      To (destination) / back via… / Returns. Single-open accordion.
- [ ] A draft's expansion shows the invitational framing copy with
      **Frame this trip on the globe →**.
- [ ] "Recollections from this trip →" opens `/memories?entity=<trip>`.

## 4. Cross-surface handoff

- [ ] "Show on globe →" lands on the globe with the trip's destination
      selected, the trip strip showing, and the route drawn (even with
      the Trips toggle off).
- [ ] From the globe, a selected pin's URL (`?pin=`) still round-trips
      into Journey's residential mode as before (J4 regression).
- [ ] A cold deep link `/journey?trip=<id>` opens the Travel Journal
      with that card expanded and scrolled into view.

## 5. Accessibility (J5 bar)

- [ ] Keyboard: tab reaches the mode control and every trip header;
      Enter toggles; focus ring visible.
- [ ] VoiceOver reads trip cards as headings with expanded/collapsed
      state; the itinerary reads as a list.
- [ ] Reduced motion: the deep-link arrival scroll is instant.

## 6. Empty state

- [ ] With zero trips, the Travel Journal shows the invitational empty
      state linking to the globe.
