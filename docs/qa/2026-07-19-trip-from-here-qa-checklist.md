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

## 4. Trip jots on the globe strip (added same day)

- [ ] Select the Calgary destination pin → the trip's strip row has a
      **✎ jots** chip (with a live count once jots exist).
- [ ] Tap it → the trip's hopper opens inline in the strip: add a few
      highlight jots ("the night in Winnipeg", "the pass in a
      whiteout"). Multi-line paste still splits into separate jots.
- [ ] The SAME jots appear on the trip's card in the **Travel Journal**
      (one hopper, two hosts' views) — with ✍ write available there.
- [ ] Checking a jot off manually works from either surface — for when
      one big recollection covers several highlights.
- [ ] The chip's count updates after adding/consuming; opening another
      trip's jots closes the first.

## 5. Strip regressions

- [ ] A home with existing departures still shows "N trips originated
      here", the home-base chip, and "Travel Journal →" alongside the
      new button.
- [ ] Marker pins (vacation/log/etc.) still show their "Frame it as a
      trip" / "Another trip here" strips — unchanged.

---

## Findings — Andy's live walk, 2026-07-30

Three findings, all confirmed in code. **None fixed yet** — Andy's call was
to record and design the proper fix rather than take an intermediate patch,
since he can navigate around the blocker in the meantime.

### F1 — The trip strip occludes the search dropdown *(blocker, confirmed)*

Searching for a pin while a pin with trips is selected returns **nothing
visible**, because the strip is painted over the results:

| Element | Position | z-index |
|---|---|---|
| Search box **and dropdown** | `left-1/2 top-6` | **`z-20`** (`GlobeView.tsx:1401`) |
| Selected-pin trip strips | `left-1/2 top-20` | **`z-30`** (`:1671`, `:1701`, `:1721`) |

Same centre axis; the dropdown expands down into the `top-20` band and the
strip sits above it. `pin-search`'s "Your pins" group renders at the **top**
of the merged dropdown — exactly the occluded region. Reproduced with
"Wendy's shared apartment" selected and "My Mt. Snow Chale" typed: Mapbox
suggestions (Malaysia, Malta, Montana…) visible below, the matching pin
hidden behind the trip panel.

Fixed as a side effect by the redesign in
[`../plans/2026-07-30-trip-strip-into-pin-card-design.md`](../plans/2026-07-30-trip-strip-into-pin-card-design.md);
nothing will render in that band afterwards.

### F2 — "Start a trip from here" is in the wrong surface *(design finding)*

Andy hunted for it in the detail card and the edit panel and did not find
it; it lives in globe chrome beneath the search box. Every other pin-scoped
action (`PinFactsEditor`, `PinConnections`, `PinHopper`) already lives on the
pin's own surfaces — this one control opted out of the convention.

His reasoning, which generalizes: **search means *acquire a place I don't
have*; pin actions mean *elaborate a place I do***. Proximity assigns a
control to its neighbour's intention. See F1 — the placement problem and the
occlusion bug have the same root cause.

### F3 — Pin search fails silently on abbreviations *(matcher)*

`searchPins` tests whether the **whole query** appears inside the name
(`name.includes(q)`, `lib/globe/pin-search.ts:39`). There is no token-wise
matching, so extra or differently-spelled words in the *query* kill the
match while extra words in the *name* are harmless.

Live case: the pin is **"My Mt. Snow Chalet"**; querying `Mount Snow Chalet`
returns nothing, because `mount` ≠ `mt.`. This will recur with St./Saint,
Rd./Road, and any name typed one way and recalled another.

Token-wise matching would have found it — query `mount / snow / chalet`
against name `my / mt. / snow / chalet` is 2 of 3.

**Compounding issue:** this failure is indistinguishable from F1's occlusion
*and* from the known append trap (typing appends to an existing query), all
three presenting as "no results, no reason". **"No pins matched" should be
stated explicitly** rather than rendering nothing.

Reopens a corner of `2026-07-18-globe-pin-search-qa-checklist.md`, which was
checked off complete: the behavior matches its spec, but the spec was too
literal.
