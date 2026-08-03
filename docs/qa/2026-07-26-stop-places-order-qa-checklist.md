# QA — places at a stop: elevated + owner-ordered (2026-07-26)

*Built in three pieces from Andy's Mt. Snow Chalet finding — a four-month
short-term stay inside a twelve-month home was invisible until you scrolled to
the bottom of a long card and clicked a faint "2 related pins" chip.*

**The decisions behind it, so the QA reads against intent:**

- Chronological sorting is **not available** — `when_text` is free prose
  ("Summers 1970 and 1971") and invariant #5 keeps it that way. So the order
  is **yours**, dragged once. ("Instead of forcing the user to follow a
  convention in the assertion of time ranges, I'd prefer this be
  drag-and-drop orderable.")
- **Nesting is preserved.** Grandchildren (your Queenstown hotels under the
  ski school) follow their parent and are **not** independently draggable —
  your call: "grandchildren are likely to remain underneath their parents."
- **Pointer-only.** Keyboard reorder is deferred per
  `memory/feedback_lc_accessibility_deferral.md`; it is on the roadmap §5 list.
- "Chapter" now means the future publication object; this is a **stop**.

## 1. Journey — the stop's places

- [x] Expand a stop with **more than one** place (Loring AFB, My Mt. Snow
      Chalet, Year 2 Coronet Peak, 26th Street Santa Monica).
- [x] Drag one place above the other → it moves, and **stays** after a page
      reload. `[taste]` whether the drag affordance is discoverable enough
      without a handle.
- [x] A stop with **one** place isn't draggable (nothing to reorder).
- [x] Reorder in one stop → **no other stop changes**.
- [x] Grandchildren (Ramada / Trans Hotel under Coronet Peak Ski School) still
      sit under their parent and don't drag independently.
- [x] Stops you've never touched look **exactly as before** — nothing
      reshuffles until a first drag.

## 2. Globe — the same places, elevated

- [x] Open **My Mt. Snow Chalet** → the detail card shows **"Places at this
      stop"** near the top of the connections block, listing **SSV Staff
      Housing · Short-term stay · January 1978 to May 1978** and **Wendy's
      shared apartment · Vacation · October 1978**. *(This is the original
      finding: it used to be a "2 related pins" chip at the bottom.)*
- [x] There is **no longer** an "N related pins" chip — recollections,
      context and jots keep theirs.
- [x] The **edit panel** shows the same block, same order.
- [x] Drag to reorder there → persists, and matches Journey after a reload.
- [x] Open a **workplace** with Logs under it (Coronet Peak Ski School) → the
      heading reads **"Related places"**, not "Places at this stop" (a
      workplace isn't a stop).
- [x] A pin with no anchored places shows no block at all.

## 3. It can't lose anything

*The invariant that mattered most in the build: a chronicle must not drop what
you put in it.*

- [x] Reorder, then add a new place anchored to that stop → the newcomer
      appears at the **end**, and nothing you arranged moved.
- [x] Reorder in two browser tabs on the same stop → the second save wins and
      **no place disappears** from either.
- [x] With the dev server stopped, drag → an error appears and the order is
      **put back**, not left half-applied.

## 4. Regression

- [x] Clicking a place in the block still selects/opens that pin.
- [x] Spine order, stop numbers, the "… more" recollection expansion and the
      facts editor are all unaffected.
- [x] `node scripts/verify-stop-order.mjs` passes (19/19).

## Known gaps (deliberate)

- **No keyboard reorder** — pointer-only, deferred.
- **Grandchildren aren't reorderable** — the endpoint supports it (it keys off
  `anchor_residence_id`, and a marker can be an anchor); only the UI is unwired.
- **No drag handle** — the whole row is the drag target. Say if it wants one.
