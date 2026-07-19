# QA — "Start a trip from here" (origin-first trip entry, 2026-07-19)

App: **http://localhost:3001/globe** (sign in first).

From your Mt. Snow Chalet question: trips stay destination-first, but a
home pin's trip strip now offers **Start a trip from here** — arming
that home as the origin of the next trip you frame. Part of
master-sequence Phase 1 (rider batch).

## 1. Arm and place

- [ ] Select **My Mt. Snow Chalet** (or any primary residence, sequenced
      or not) → the trip strip under the search box shows **"Start a
      trip from here"** — even when no trips exist yet.
- [ ] Click it → the card closes and a top banner appears: *"Trip from
      My Mt. Snow Chalet — now pin where it went…"* with a ✕.
- [ ] Search or click the globe for the destination → the pin modal
      opens **already set to Trip** (subtype selectable; you can still
      change the type to something else).
- [ ] Save → the framing panel's origin dropdown is **pre-set to the
      chalet** (not its anchor, not Home Base). Save the frame → route
      arc draws chalet → destination.

## 2. The armed state behaves

- [ ] The banner's ✕ cancels — the next pin placed is a normal pin,
      modal defaults back to Primary residence.
- [ ] Arming, then using **"Frame as trip"** on an EXISTING marker pin
      instead → the framing panel also suggests the chalet as origin.
- [ ] A trip that **already has an origin** (Edit frame on it while
      armed) keeps its own origin — armed never overwrites.
- [ ] After one framing completes, the armed state is consumed — framing
      a second trip suggests anchor/Home Base as usual.

## 3. One-way trips (added same day — the chalet → Calgary drive)

- [ ] The framing panel has a **"Returned to the origin (round trip)"**
      checkbox, checked by default. Uncheck it → a one-way note appears.
- [ ] Frame the chalet → Calgary road trip one-way → the globe draws
      the **outbound arc only** — no dashed return arc.
- [ ] The Travel Journal card shows origin → destination with **no
      "and back"** line for a one-way trip.
- [ ] **Edit frame** on the one-way trip → the checkbox arrives
      **unchecked** (remembers); re-check + save → the dashed return
      arc appears.
- [ ] A round trip framed normally still draws its dashed return.

## 4. Strip regressions

- [ ] A home with existing departures still shows "N trips originated
      here", the home-base chip, and "Travel Journal →" alongside the
      new button.
- [ ] Marker pins (vacation/log/etc.) still show their "Frame it as a
      trip" / "Another trip here" strips — unchanged.
