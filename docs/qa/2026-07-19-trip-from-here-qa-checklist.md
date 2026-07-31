# QA — "Start a trip from here" (origin-first trip entry, 2026-07-19)

App: **http://localhost:3001/globe** (sign in first).

From your Mt. Snow Chalet question: trips stay destination-first, but a
home pin's trip strip now offers **Start a trip from here** — arming
that home as the origin of the next trip you frame. Part of
master-sequence Phase 1 (rider batch).

## 1. Arm and place

- [x] Select **My Mt. Snow Chalet** (or any primary residence, sequenced
      or not) → the trip strip under the search box shows **"Start a
      trip from here"** — even when no trips exist yet.
- [x] Click it → the card closes and a top banner appears: *"Trip from
      My Mt. Snow Chalet — now pin where it went…"* with a ✕.
- [x] Search or click the globe for the destination → the pin modal
      opens **already set to Trip** (subtype selectable; you can still
      change the type to something else).
- [x] Save → the framing panel's origin dropdown is **pre-set to the
      chalet** (not its anchor, not Home Base). Save the frame → route
      arc draws chalet → destination.

## 2. The armed state behaves

- [x] The banner's ✕ cancels — the next pin placed is a normal pin,
      modal defaults back to Primary residence.
- [x] Arming, then using **"Frame as trip"** on an EXISTING marker pin
      instead → the framing panel also suggests the chalet as origin.
- [x] A trip that **already has an origin** (Edit frame on it while
      armed) keeps its own origin — armed never overwrites.
- [x] After one framing completes, the armed state is consumed — framing
      a second trip suggests anchor/Home Base as usual.

## 3. One-way trips (added same day — the chalet → Calgary drive)

- [x] The framing panel has a **"Returned to the origin (round trip)"**
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
| --- | --- | --- |
| Search box **and dropdown** | `left-1/2 top-6` | **`z-20`** (`GlobeView.tsx:1401`) |
| Selected-pin trip strips | `left-1/2 top-20` | **`z-30`** (`:1671`, `:1701`, `:1721`) |

Same centre axis; the dropdown expands down into the `top-20` band and the
strip sits above it. `pin-search`'s "Your pins" group renders at the **top**
of the merged dropdown — exactly the occluded region. Reproduced with
"Wendy's shared apartment" selected and "My Mt. Snow Chale" typed: Mapbox
suggestions (Malaysia, Malta, Montana…) visible below, the matching pin
hidden behind the trip panel.

Fixed as a side effect by the redesign in
`../plans/2026-07-30-trip-strip-into-pin-card-design.md`;
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

### F4 — The armed placement modal doesn't say what it's asking for *(Andy, design finding)*

Arming "Start a trip from here" and then picking a destination opens the
**generic pin-placement modal**. It is preset to Trip (`defaultTypeCode`) and
the armed pin is preset as the anchor (`defaultAnchorId`), but nothing in the
dialog states that **this pin is the trip's destination**. Andy: the intent
"can be discerned from studying the UI" — the question the modal appears to
ask is *"how did I end up placing a new pin?"*, and its primary action reads
**"Add this place"** (`PinModal.tsx:338`), not *set the destination*.

**Root cause — the context is deliberately hidden at the moment it's needed.**
The armed banner ("Trip from X — now pin where it went") renders
`{tripFromHere && !modalOpen && …}` (`GlobeView.tsx:1639`), so it is
suppressed as soon as the modal opens. The only cue explaining the placement
disappears precisely when the user is asked to act on it.

### F5 — Anchor and trip origin look like one field, and aren't *(found while checking F4)*

For trip pin types `anchorPrompt` reads **"Which home were you living in
then?"** (`lib/globe/pin-types.ts:32`, `:34`). That is the **anchor** — which
home the pin hangs off in the spine. The **trip origin** is a different thing,
set later in the framing panel.

In the armed flow both are pre-set to the same pin, so they present as one
field. But `suggestTripOrigin` prefers `armedOriginId` over `anchorId`, so
**changing the anchor in the modal would not change the trip's origin** — the
edit silently fails to do the thing it looks like it does.

Not user-reported; latent. Worth resolving in the same pass as F4, since both
are about the armed modal saying what it means.

### F6 — A trip's destination cannot be changed, at any layer *(Andy; capability gap, blocking)*

Andy's goal (corrected 2026-07-30): take the existing trip *"The epic solo
road trip in the overloaded Fiat 128"* (`594fa9aa`, Oct 1978), currently
terminating at **Wendy's shared apartment**, and remodel it as:

> **My Mt. Snow Chalet** → *stop:* **Wendy's shared apartment** (which is in
> Calgary) → **SSV Day Lodge Room** (Sunshine Village, Banff) as the
> destination.

**Calgary is not a separate waypoint** — it is where Wendy's apartment is, and
the two names refer to the same pin. This is also why §3 above calls this "the
chalet → Calgary drive": same journey, named by city rather than by pin. No
Calgary pin is needed or wanted.

**Not urgent (Andy, 2026-07-30):** he is in no rush to repair this trip. The
capability gap below is a real finding on its own terms; the live-data fix can
wait for whenever the work happens.

There is no affordance for this, because there is no capability.

**Live state of that trip:** origin already My Mt. Snow Chalet;
`return_to_origin` already **false** (one-way); `subtype` `road_trip`;
**zero `trip_stops`**. So origin and one-way-ness are already correct — the
destination is the only wrong field, and it is the only unchangeable one.

**Prerequisite beyond the retarget itself:**

- **SSV Day Lodge Room is `lived_at`, spine `sort_order` 13**, i.e. a primary
  residence, so it is refused as a destination by the same guard. This is the
  only true prerequisite.

**Spine note worth keeping:** My Mt. Snow Chalet is `sort_order` **12** and
SSV Day Lodge Room is **13** — consecutive stops. This relocation journey
therefore belongs in the interstice between them, which is a live instance of
`../plans/2026-07-30-loose-ends-surface-design.md` §3.5 (trips in the seam),
written from a general remark rather than from this case.

`frame_trip` (`20260715130000_trips_travel.sql:138`) accepts origin, title,
when_text, year_hint, subtype, return_to_origin, clear_origin — **no
destination**. No other function changes one; the full set is `validate_trip_pin
/ create_trip / frame_trip / add_trip_stop / reorder_trip_stops /
remove_trip_stop / delete_trip / get_trips`. **A trip's destination is
immutable from creation.**

This is severe *because* capture is destination-first (R5): the destination is
the first thing chosen, when the user knows least about the journey's shape. A
trip that turns out to have been a relocation, or whose real endpoint was
further on, can never be corrected.

**Blocked twice over in Andy's case:**

1. No function repoints a destination.
2. **SSV Day Lodge Room is a primary residence**, which `validate_trip_pin`
   refuses as a destination — the guard whose relaxation is designed in
   `../plans/2026-07-30-loose-ends-surface-design.md` §7, **approved in
   principle, gated, unapplied**.

**Ordering constraint for any fix:** `add_trip_stop` raises *"the destination
is the turnaround, not an itinerary stop"* (`:204`), so the old destination
cannot become a stop until it has stopped being the destination. Retarget
first, demote second.

**Do not delete-and-recreate as a workaround.** `delete_trip` drops the trip
and its stops — losing the title, the framing, and any jots on the trip
entity — and `create_trip` runs the same guard, so it would fail anyway.

Design sketch in
[`../plans/2026-07-30-trip-strip-into-pin-card-design.md`](../plans/2026-07-30-trip-strip-into-pin-card-design.md) §5.
