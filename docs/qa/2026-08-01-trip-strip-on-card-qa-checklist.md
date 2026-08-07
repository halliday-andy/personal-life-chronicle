# QA — the trip strip on the pin card (R4, 2026-08-01)

App: **http://localhost:3001/globe** (sign in first).

Retires **F1** (strip occluded the search dropdown), **F2** ("Start a trip
from here" was undiscoverable) and **F8** (a trip's jots were invisible from
its destination pin). Design:
`../plans/2026-07-30-trip-strip-into-pin-card-design.md` §3.

**Nothing renders in the `top-20` band any more.** If you see a floating strip
over the globe, that is a finding.

---

## 1. F1 — search is no longer occluded *(the blocker)*

- [x] Select **Wendy's shared apartment** (a pin WITH trips — this is the exact
      case that failed).
- [x] Type `chalet` into the find box → **"My Mt. Snow Chalet" is visible**
      under "Your pins". Previously the trip strip painted over it.
- [x] Try the same on two or three other trip-bearing pins.

## 2. F2 — the trip control is on the pin

- [x] Select **My Mt. Snow Chalet** → the chip row shows a **✈ trips** chip
      (with a count once trips exist).
- [x] Open it → **Start a trip from here** is there, plus "N trips originated
      here", the **home base** chip where it applies, and **Travel Journal →**.
- [x] The same chip is present on the **edit panel** (Edit), not just the card
      — one component, both surfaces.
- [x] Click **Start a trip from here** → the card closes and the armed banner
      appears at the top. *(The banner stays in chrome deliberately: it is a
      mode, and the whole globe is waiting on it.)*

## 3. F8 — a trip's jots are reachable from its pin

- [x] Select **Lake Winnipesaukee** → open **✈ trips** → the trip row has a
      **✎ jots** chip carrying its count.
- [x] Open it → the jot you added ("The hope and anticipation of connection…")
      is there.
- [x] **The pin's own "✎ jot" chip still reads the PLACE's jots only** — the
      counts are deliberately NOT merged. A place's jot count means the
      place's own jots on every pin, never a mixture.

## 4. The three variants all survived the move

- [x] **Home** (any primary residence): summary + Start a trip from here.
- [x] **Marker with no trip** (e.g. **Matapédia**, **Trans Hotel**): reads
      *"This was a journey? Frame it as a trip:"* with three subtype buttons.
- [x] **Future Place** (`wants_to_visit`): reads *"Been there now? It becomes
      a real place + trip:"*.
- [x] **Marker with trips**: each trip shows title · subtype · when ·
      **needs framing** badge where it applies, and Frame/Edit frame · Route ·
      Unframe · ✎ jots — plus **"Another trip here:"** beneath.

## 5. The actions still work

- [x] **Frame / Edit frame** → the framing panel opens with the right origin
      suggestion (armed origin wins, then the anchor, then Home Base).
- [x] **Route** → the route-building banner opens and drawing still works.
      *(Route editing stays a globe mode — it draws on the map.)*
- [x] **Unframe** → two-step confirm ("Really remove the trip? The pin
      stays."), then the trip goes and the pin remains.
- [x] Unframe's confirm **times out after \~4s** if you don't click it.

## 6. Behaviour changes to judge, not bugs

- [x] **Compact card:** the arrival strip (identity only) has no trips chip —
      one click expands the card and it is there. The old strip appeared even
      in compact mode. **[taste]** Is one click acceptable?
- [x] **During route editing** the card stays open behind the route banner,
      so the trips chip is reachable. The old strip hid itself in that mode.
      No overlap (the banner is `z-40`, `top-6`), but say if it feels busy.

## 7. Regressions to rule out

- [x] Navigating pins with ← → resets the open chip (the chip row is keyed by
      pin).
- [x] The place's own recollections / context / related-places / jot chips all
      behave as before.
- [x] Opening the trips chip **scrolls itself into view** on a long pin
      (R8 must still hold).
- [x] Jot counts on trips stay live without opening the panel.

## Proof scripts

`verify-jsx-sibling-keys` · `verify-anchor-options` · `verify-sticky-facts` ·
`verify-journey-tree` · `verify-pin-search` · `verify-derive-context-title` ·
`verify-rich-paste` · `verify-create-pin-payload` — **all PASS**, plus tsc and
next lint clean.
