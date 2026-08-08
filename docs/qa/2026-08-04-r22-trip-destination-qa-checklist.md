# QA — the owner can change where a trip ended (R22, 2026-08-04)

App: **http://localhost:3001/globe** (sign in first).

Closes the gap R6 left: `retarget_trip` was applied and proven on
2026-08-03 but **nothing called it**, so a trip's destination was
changeable only by an agent running SQL. Spec:
`../plans/2026-08-03-r22-trip-destination-ui-design.md`.

Three add-ons shipped alongside, all agreed 2026-08-04: a **trip-kind
selector** (`frame_trip` has always taken `p_subtype` and no caller ever
sent one), the **"Relocation"** label, and **pinning a stop from inside
route mode**.

**The Fiat 128 trip was deliberately left uncorrected** as this feature's
end-to-end fixture (Andy, 2026-08-03) — §1 IS the acceptance test.

---

## 0. Read this before you start — one premise was wrong

The design doc and the session opening both described the Fiat trip as a
**"vacation"**. It is not, and never was:

|  | as it stands right now |
| --- | --- |
| subtype | **`road_trip`** |
| `return_to_origin` | **`false`** — already one-way |
| title | The epic solo road trip in the overloaded Fiat 128 |
| origin → destination | My Mt. Snow Chalet → **Wendy's shared apartment** |
| stops | none |

What *is* labelled "Vacation" is the **pin**: `Wendy's shared apartment`
is typed `vacationed_at`, because that is the pin code the road-trip
capture mints (`tripSubtypeDefaultPinCode.road_trip`). The word belongs to
the place, not the journey — which is its own small finding, and §6 is
where you fix it.

So the trip needs **one** change, not three: the destination.

---

## 1. The acceptance walk — the correction Andy could not make himself

- [x] Select **Wendy's shared apartment**. Its trips open on their own
      (destination pins auto-open).
- [x] The trip row reads **"Road trip · October 1978"**. *(Not
      "Relocation" — not yet. It ends at a vacation pin.)*
- [x] Click **Edit frame**.
- [x] The heading reads **"The epic solo road trip in the overloaded Fiat
      128"** — the title, as before.
- [x] **"Where did the trip start?"** is pre-selected to **My Mt. Snow
      Chalet**.
- [x] **"Where did it end?"** is there, below it, pre-selected to
      **Wendy's shared apartment**. *(This is the control that did not
      exist.)*
- [x] It has **no "Decide later"** and **no "＋ pin a new one"**. Both are
      deliberate: the column is `NOT NULL`, and origin capture only ever
      sets an origin.
- [x] Change it to **SSV Day Lodge Room**. *(It is a **primary residence**
      — it can only be offered at all because R6 part 1 removed the guard.)*
- [x] A checkbox appears: **"Keep Wendy's shared apartment as a stop along
      the way"**, already **ticked**.
- [x] "Returned to the origin (round trip)" is **unticked** already, and
      the line below now reads *"One-way — the journey ends at SSV Day
      Lodge Room; **ending at a home makes this a relocation**…"*
- [x] **Save the frame.**

Then check what landed:

- [ ] The notice names both ends: *"The trip now ends at SSV Day Lodge Room
      — Wendy's shared apartment is a stop along the way."*
- [x] The globe draws **chalet → Wendy's → SSV** as one outbound line,
      **with no return arc**.
- [x] **The title survived.** "The epic solo road trip in the overloaded
      Fiat 128" is Andy's sentence; `retarget_trip` protects it, but this
      is the UI path and it needed proving too.
- [x] Open **SSV Day Lodge Room** → the trip is on its card, now reading
      **"Relocation · October 1978"**.
- [x] Open **Wendy's shared apartment** → the same trip is still on its
      card, now as a **stop**.
- [x] `/journey?mode=travel` → the Travel Journal row also reads
      **"Relocation"**. *(If the two surfaces disagree, that is a finding —
      they share one definition on purpose.)*

## 2. The destination selector's own edges

- [x] Re-open **Edit frame** and save **without touching** the destination
      → no stop is added, nothing is duplicated. *(The client withholds the
      retarget when nothing moved; `retarget_trip` is idempotent too, but
      the client should not ask for work it knows is pointless.)*
- [x] Retarget a trip to a pin that is **already one of its stops** → the
      stop row disappears as the pin becomes the destination. It must never
      be both.
- [x] On some other trip, retarget with the **checkbox unticked** → the old
      destination drops off the trip entirely, **and its pin stays on the
      globe**. The warning line under the checkbox says exactly this.
- [x] Retarget an **untitled** trip → its name follows the new destination
      ("Trip to …"). A **titled** one keeps its title.

## 3. The trip-kind selector *(add-on)*

**Re-walk this after `79ac2bd`.** Your first pass found the kind selector
saving correctly and neither surface showing it: the derived "Relocation"
label was returned *instead of* the subtype, so a relocation could never
say what kind of journey it was. Fixed — the reading now rides alongside.

- [x] The framing panel has **"What kind of trip was it?"**, pre-selected
      to the trip's current kind.
- [x] Change one and save → the pin card and the Travel Journal both show
      the new kind. *(Before today this was unreachable: the parameter
      existed, the caller didn't.)*
- [x] Re-open the panel → the change **stuck** and pre-selects. *(Rule 19:
      a form reused for CREATE and EDIT must load current values.)*
- [x] The Fiat 128 trip reads **"Road trip"** with *"reads as a
      relocation"* beside it — italic, dimmer, unboxed — on **both** the pin
      card and the Travel Journal. **The two must never look like peers**:
      the kind is your claim, the relocation is the chronicle's reading of
      it (rule 15, the same distinction as "● yours").
- [x] Set it to **Professional travel** and back → both words change
      together and the relocation reading stays put. *This is the case that
      exposed the eviction.*
- [x] A chronology of road trips would now find it: four trips read "Road
      trip", the Fiat among them.

## 4. "Relocation" only where it is true *(add-on)*

- [x] A **round trip** to a home still reads its subtype, not
      "Relocation" — returning home from a visit is not moving house.
- [x] A **one-way** trip to a **non-home** (a ski hill, a convenience
      store) still reads its subtype.
- [x] Untick "returned to the origin" on a trip ending at a home, save →
      it becomes "Relocation". Re-tick → it reverts. **The label
      re-derives; nothing is frozen.**

## 5. Pinning a stop from route mode *(add-on — your "markers along the path")*

- [x] With the Fiat trip retargeted, open any of its three pins → **Route**.
- [x] The banner now reads *"…or click anywhere empty to pin a new place
      and add it in one go."*
- [ ] **Click empty globe somewhere between Vermont and Alberta** → the
      draft pin appears with its confirm bar, exactly as a normal pin does.
      **Re-walk after `4bd75d2`:** your first pass got the draft and no
      confirm bar — it was rendering *behind* the open pin card. The click
      now closes the card and drafts in one gesture, and the bar sits above
      the card regardless. **Do this with a pin card open**, which is the
      state that failed.
- [ ] **Re-walk after `dff4fa8`.** With the draft placed, the confirm bar
      now reads *"…it joins **The epic solo road trip in the overloaded Fiat
      128** as an outbound stop"* and its button says **"Add this stop"**,
      not "Add this place". **The route banner stands down** while a draft
      or its dialog is up, so "Done" is no longer offered as an alternative
      to finishing the stop you are placing.
- [ ] Click **Add this stop** → the dialog's own header is **visible**,
      reading **"A stop along the way"** and naming the trip. *(It was
      always there; the route banner was sitting on top of it — both z-40,
      banner later in the DOM. That header is the whole F4 contract.)*
- [ ] On a short window, the dialog **scrolls** rather than pushing its
      header off screen.
- [ ] With a draft pending, cancel it → the route banner returns, still in
      the same leg, with its outbound list intact.
- [ ] Place a draft, then confirm it after leaving route mode → it **still
      becomes a stop on that trip**, not an ordinary pin. *(The trip and leg
      are captured when the draft is placed; Done used to strand it.)*
- [ ] Confirm it → the dialog says **"A stop along the way"** and *"…on The
      epic solo road trip in the overloaded Fiat 128 — it joins the
      outbound leg…"*, and its button reads **"Add this stop"**. *(The
      route banner is covered while this is open, so the dialog has to
      carry the mode itself — the F4 lesson.)*
- [ ] Its type defaults to **Log**. Changeable, like every default here.
- [ ] **"Associated with which place?" is pre-set to the trip's
      destination** (`4c138a3`), not to the first home on your spine. The
      helper line reads *"Pre-set to where the trip was heading."* — worded
      for this case because a destination need not be a home.
- [ ] Save → the pin exists, it is **in the banner's outbound list**, the
      route redraws through it, and **route mode is still open** so the
      next click pins the next waypoint.
- [ ] Add two or three in travel order, then use the **‹ ›** nudges to
      reorder them.
- [ ] **Recollections on the markers:** select one of the new stop pins →
      **Edit** → write in the recollection field → save → it shows on the
      card. *(This is the whole point of a marker; a waypoint that cannot
      hold the memory of stopping there is half a marker.)*
- [ ] In that dialog, switch the type to **Trip** → the stop framing stands
      down and it behaves like an ordinary new pin. Deliberate: you have
      said this place is a journey of its own, not a waypoint on one.
- [ ] **Done** → route mode closes; the stops persist.

## 6. The pin type left over from capture

Retargeting does **not** retype anything, so Wendy's apartment is now a
**"Vacation"-typed pin serving as a waypoint on a relocation**.

- [ ] Select **Wendy's shared apartment** → **Edit** → change its type
      (**Short-term stay** or **Log** — Andy's call, this is his history).
- [ ] Save → the pin's colour changes on the globe and the trip is
      unaffected.

## 7. Deletion — the asymmetry that will surprise someone

`destination_relationship_id` is `ON DELETE **RESTRICT**`;
`trip_stops.relationship_id` is `ON DELETE **CASCADE**`. Retargeting
therefore **frees the old pin and locks the new one**:

- [ ] Try to delete **SSV Day Lodge Room** (now the destination) → it is
      **refused**, and the message should be legible rather than a raw FK
      error.
- [ ] **Wendy's apartment is now deletable** — and deleting it would
      **silently remove its stop** from the trip, with no warning. Don't
      actually delete it; just confirm the asymmetry is understood.
      *Flagged as a finding candidate: silent beats loud here in the wrong
      direction.*

## 8. Regressions — the paths R22 rewrote underneath

- [ ] **Origin selection is unchanged**: "Decide later" still saves a trip
      without an origin; "＋ Pin a new origin on the globe…" still hands off
      to origin capture and the placed pin becomes the origin.
- [ ] **A fresh trip still frames**: pin a new place → choose **Trip** →
      the framing panel opens with the destination **pre-selected to the
      pin you just placed**, and the origin suggestion intact.
- [ ] **Keep as a draft / Discard** still behave as they did (draft-only,
      two-step confirm, the pin survives a discard).
- [ ] **Escape** still closes the framing panel without writing, and still
      refuses mid-save.
- [ ] The **title placeholder** quotes the **destination's** name, never
      the trip's own title. *(F26's family — and the one-way sentence used
      to name the trip instead of the place. If any sentence about where
      the journey ends names a TRIP, that is a finding.)*

## 8b. Two findings your walk produced

**FIXED (`49450c5`) — every line on the globe could vanish until reload.**
You hit this right after saving the frame: no trip route, no spine arcs,
nothing. Crossing the reading-zoom threshold swaps the basemap via
`setStyle`, which wipes every source and layer the app added; the rebuild
hung on `style.load` alone, which does not fire on every swap path. Latent
since the 2026-07-18 style-regime feature — **not** caused by R22. The pins
stayed healthy throughout because DOM markers aren't part of the style,
which is exactly what made it look like a trip problem.

- [ ] Zoom **in** past the basemap threshold (the map turns to the detailed
      daylight style) and back **out** to nocturne, two or three times.
      **The spine arcs and the trip route must still be there** every time,
      with no reload. *(This is the whole fix; if any line disappears once,
      it is a blocker.)*
- [ ] Do the same while the ✈ chip is open on a trip pin — the rose route
      should survive the swap too.
- [ ] **No runtime crash while panning or zooming.** The first version of
      this fix rebuilt the layers from `styledata`, which fires mid-render,
      and that crashed mapbox's placement engine outright (*"Cannot read
      properties of undefined (reading 'get')"* at
      `Placement.continuePlacement`). Corrected in `1ed7577` — the rebuild
      now happens only at `style.load` and `idle`. If any such error
      appears while navigating, stop and report it.

**FIXED (`3ea57e9`) — a stop now auto-opens its trips, like a destination.**
R19/F23/F24 gave destinations auto-open; R18/F21 made that chip the thing
that paints routes. R22 made destinations movable, so Wendy's became a stop
and silently lost both. Your call, 2026-08-04: a stop is a place the journey
passed through, so the journey is still the point of the pin.

- [ ] Select **Wendy's shared apartment** → its trips open on their own
      again, and **the route paints on arrival** without touching the chip.
- [ ] Select **SSV Day Lodge Room** (the destination) → still auto-opens.
- [ ] Select **My Mt. Snow Chalet** (the origin) → **does NOT auto-open.**
      *(F21: a home with many departures buries the map. This exclusion is
      deliberate and proven — if it ever opens, that is a regression.)*

## 8c. A stop looks like a stop, and arrives drawing its route

Both from your Wendy's screenshots.

- [ ] From **Journey → My Mt. Snow Chalet → Wendy's shared apartment**, the
      globe now arrives with **the trip arc drawn**, no hover needed. *(The
      chip that gates route painting was seeded once at mount, before the
      trips fetch returned. `d9171d7`.)*
- [ ] **Wendy's now wears a thin rose collar** — the "stop along a trip"
      mark. Compare with **SSV Day Lodge Room**, which keeps the brighter,
      glowing destination halo. *A destination is where the journey was
      going; a stop is somewhere it went through, and the ring weights say
      which.*
- [ ] **Legend & filters** lists both marks now.
- [ ] **My Mt. Snow Chalet** (the origin) still wears **neither** — it is a
      home, and the spine already speaks for it (F21).
- [ ] Add a stop through **Route** mode → it gets the same collar. *(The
      mark is derived from trip membership, not from how the stop was
      made — so both paths agree by construction.)*
- [ ] Retarget a trip and watch the marks **swap** — the old destination
      drops to a collar, the new one picks up the halo, immediately.

**On the pin-type dropdown having no "stop on a trip":** deliberate, and I
would keep it that way. Stop-ness lives on the trip↔pin relationship
(`trip_stops`), not on the place — a pin can be a stop on one trip and a
destination on another, which a single `type_code` cannot express. **Log
remains the right answer to "what kind of place is this"**, which is why
route mode defaults to it; it just should not be how the app knows the
place is on a journey. What was missing was the drawing, not the word.

## 9. Pin occlusion — the Hanover cluster *(separate fix, same session)*

Not R22, but it lands in the same build and it is the one thing here I
could **not** verify myself: the proofs and a live-data ordering check
pass, but the globe needs your session, so this section is the only
evidence that the screenshots are actually fixed.

- [x] Zoom to the **Dartmouth / Hanover** area as in the first screenshot.
      **Dartmouth** (the primary residence) now paints **over** Dick's
      House, the Flying Club, the Skiway and the Dunne Farm — its dot and
      its "1974 to 1975" chip are both legible without zooming further.
- [x] Search **Dartmouth** in the find box → pick it under "Your pins".
      The camera should land at roughly **z13.8**, close enough that
      Dartmouth and Dick's House sit ~130 px apart. *(It used to settle
      near z10.8, fitting the whole 35 km neighbourhood — the Skiway and
      the farm will now be off-screen, which is the deliberate trade: you
      asked for the pin, not the neighbourhood.)*
- [x] Hover a marker near a primary → it lifts above its neighbours.
      **Hover a marker while a different pin is selected → the SELECTED
      pin stays on top.** A passing cursor must not displace your choice.
- [x] **Chrome still wins over pins** — this is the regression to hunt.
      With pins under the top banners, confirm the **route-building
      banner**, the **armed-trip banner**, the **draft confirm bar** and
      the **pin card** all still paint OVER the markers. If any pin now
      floats above a panel, the map container's `isolate` is not holding
      and that is a blocker.
- [x] Arriving at a pin with **no close neighbours** still flies the way
      it always did.
- [ ] A **tight** cluster still frames the whole cluster rather than diving
      onto one pin — but only where containment costs nothing. *(The
      2026-07-10 J4 behaviour survives ONLY in that case; where the two
      conflict, the named pin now wins. The proof asserts both branches.)*

      **Corrected 2026-08-04 — this bullet was wrong as first written.** It
      described the pre-change rule and told Andy to expect Queenstown to
      frame whole. It does not, and should not: with Ramada 164 m away and
      the Ski School 13 km away, containment (z10.98) falls far below
      separation (z14), so arrival takes the **focus** branch. His
      screenshot is the new behaviour working. What it also exposed is
      genuine and separate — see the anchor-family finding below.

- [ ] **Re-check Queenstown after the dive-ceiling fix (`8024267`).** Select
      **Year 2 Coronet Peak, Queenstown NZ** from the search dropdown. It
      should now land ~**z15.4** rather than z14, putting **Ramada
      Queenstown 130 px away** instead of 49 px — its banner clear of the
      residence's rather than touching it — with **Trans Hotel still on
      screen** at ~456 px. *(If the dive now feels too deep, the ceiling is
      the knob: `DIVE_CEILING` in `lib/globe/cluster-frame.ts`. Say so and
      I'll tune it against your eye rather than guess.)*

### Finding, recorded not fixed — the anchor family vs. the neighbourhood

Your Queenstown screenshot exposed something the framing gets wrong, and it
is **not** fixed by anything above. Arrival gathers "the cluster" as *every
pin within 30 km* — a geometric proxy for a relation the schema already
stores. For that residence:

| pin | anchored to | distance |
| --- | --- | --- |
| **Coronet Peak Ski School** (`worked_at`) | **← the selected residence** | 12,964 m |
| Ramada Queenstown | ← the Ski School | 164 m |
| Trans Hotel | ← the Ski School | 575 m |
| Motorcycle Trip to Sheep Station | ← *the other* Coronet Peak residence | 25,543 m |

So the frame showed the **grandchildren**, dropped the **child**, and
counted a **stranger**. Framing the anchor family instead lands at z12.12
(Ski School on screen at 1041 px) but collapses Ramada to 13 px and Trans
Hotel to 46 px — one occlusion traded for another. Neither is free, so
nothing was built: the coherent answer is family framing **plus** collapsing
colliding chips to bare dots, which is its own unit and needs a design pass
on what arriving at a pin should show you.

- [ ] Worth forming a view on while you walk this: **should selecting a
      residence bring its workplace into frame**, even at the cost of the
      close pins becoming a clump? Your call, and it is the whole question.

---

## Findings

| # | What | Where | Severity |
| --- | --- | --- | --- |
