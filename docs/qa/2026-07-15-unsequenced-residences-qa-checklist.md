# QA — Unsequenced residences (Trips & Travel U9)

**Date:** 2026-07-15
**Prereqs:** dev server on `localhost:3001`. This is the feature from
your Canmore screenshot — the "Before/After X" dropdown gains a TBD
option in both the creation modal and the edit panel.

## 1. Decide later at creation (R21)

- [x] Drop a pin, keep **Primary residence**: the "Where does this fall
      in your life?" dropdown now ends with **Decide later — not yet
      placed** (helper copy appears when chosen).
- [x] Save with it → the pin lands with a slowly turning dashed **ember**
      ring and a "not yet placed" line under its chip; the spine thread
      and every other home's position are untouched.
- [x] The pin is fully embellishable now: recollection, photos, placard,
      jots, facts — all work as on any home.

## 2. Excluded from spine logic

- [x] The thread doesn't route through it; no chevron leg touches it.
- [x] The origin star and the "now" endpoint are unchanged.
- [x] Journey (residential mode): it appears under **Not yet placed ·
      homes awaiting their spot** with a "Place it in sequence →" link —
      never as a stop on the thread. A Log anchored to it nests beneath
      it there.

## 3. Place in sequence

- [x] Its Edit panel shows the dashed "Not yet placed in your journey"
      block. Choose a slot (e.g. between Mt. Snow and Alp Hof) → the
      thread re-routes through it at that position; "stop N of M"
      appears; the dashed ring is gone.

## 4. Demote from the edit panel (your screenshot's dropdown)

- [x] On a SEQUENCED home, the same dropdown now ends with **Decide
      later — not yet placed**. Choose it → the home leaves the thread,
      the remaining spine closes up in order, and the pin keeps its
      recollection, photos, jots, and tethered markers.
- [x] Re-place it → back exactly where you chose.

## 5. Trip origin before the spine (R22 / AE5)

- [ ] Frame any trip; in the origin select choose **＋ Pin a new origin
      on the globe…** → the framing panel closes and a banner asks for
      the origin's location.
- [ ] Search or click a spot; the modal opens with Primary residence
      preselected and the sequence dropdown already on **Decide later**.
      Save → notice confirms the origin is set; the trip is framed; the
      new home is unplaced; the spine untouched.
- [ ] Cancel path: ✕ on the banner returns the globe to normal.

## 6. Data proof

- [ ] `node scripts/verify-trips-travel.mjs` and
      `node scripts/verify-journey-tree.mjs` both pass.
