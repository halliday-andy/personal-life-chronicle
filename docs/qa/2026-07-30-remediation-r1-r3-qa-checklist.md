# QA — Phase-1 remediation R1–R3 (2026-07-30)

App: **http://localhost:3001/globe** (sign in first).

Covers the first three units of
[`../plans/2026-07-30-phase1-remediation-plan.md`](../plans/2026-07-30-phase1-remediation-plan.md):
modal dismissal (R1/F9a), the framing panel's exits (R2/F9b), and pin search
(R3/F3). **R4–R6 are not built** — the trip strip is still in globe chrome, so
F1's occlusion is still live and expected.

---

## 1. Search finds pins by word *(R3 / F3)*

- [ ] Type **`Mount Snow Chalet`** into the find box → **My Mt. Snow Chalet**
      appears under "Your pins". *This is the exact query that returned
      nothing before.*
- [ ] Type **`chalet snow`** (words reversed) → still found.
- [ ] Type **`Mt Snow Chal`** (partial last word) → still found.
- [ ] Type **`Mount Snow Castle`** → **not** found. An unmatched word must
      reject the pin; this is stricter recall, not fuzzy search.
- [ ] A single-word query still behaves as before — `snow` lists the three
      Mt. Snow pins, `peak` lists the Coronet Peak ones.

**Watch for:** results that feel *too* loose. The rule is that every word you
type must match some word in the name. If unrelated pins start appearing,
that's a real finding.

## 2. Search says when it finds nothing *(R3 / F3)*

- [ ] Type a place you have **not** pinned (e.g. `Reykjavik`) → the **"Your
      pins"** group still appears, reading **"None of your pins match — this
      would be a new place."**
- [ ] Type something matching a pin → the message is replaced by the results.
- [ ] Confirm this reads as *useful* rather than noisy. It is deliberate: a
      silent empty group was indistinguishable from the occlusion bug and the
      query-append trap, and "none match" also warns you before creating a
      duplicate.

**[taste]** If the line is more noise than help on place searches, say so —
it can be shown only when the query has no Places results either.

## 3. Both modals can be dismissed *(R1 / F9a)*

- [ ] Open the **pin placement** modal (click the globe) → press **Escape** →
      it closes, nothing is created.
- [ ] Open it again → click the **backdrop** → closes. (This already worked;
      confirm it still does.)
- [ ] Open the **framing panel** (Edit frame on any trip) → press **Escape** →
      closes, **nothing saved**.
- [ ] Same panel → click the **backdrop** → closes.
- [ ] Same panel → click the new **✕** top-right → closes.
- [ ] Start a save and confirm Escape does **not** interrupt it mid-flight.

## 4. Dismissing keeps the armed origin *(R1 — the substantive half)*

- [ ] Select **My Mt. Snow Chalet** → **Start a trip from here** → banner
      appears.
- [ ] Place a destination → the framing panel opens → press **Escape**.
- [ ] **The banner is back and still armed.** *Before this change the armed
      origin was silently consumed, leaving a draft trip with no origin and no
      route back to the intent.*
- [ ] Frame a trip successfully instead → the banner is **gone** (a real frame
      still consumes the armed origin).
- [ ] The banner's ✕ still cancels arming deliberately.

## 5. The exits say what they do *(R2 / F9b)*

- [ ] **Edit frame** on an **already-framed** trip (e.g. the Fiat 128) → the
      buttons are **Cancel** and **Save the frame**. No "keep as a draft"
      language anywhere, including the intro line.
- [ ] Open the framing panel on a **draft** trip → buttons are **Discard this
      trip**, **Keep as a draft**, **Save the frame**.
- [ ] Click **Discard this trip** → it becomes **"Really discard? The place
      stays on your globe."** Click elsewhere / dismiss without confirming →
      nothing is deleted.
- [ ] Confirm the discard → the trip goes, **the pin remains**, and the notice
      reads "Trip removed — the pin and its recollections are untouched."
- [ ] After discarding, the armed banner is **gone** — discard abandons the
      whole attempt, unlike dismissal which pauses it.

**[decision for Andy]** Discard is **two-step**, deviating from the plan's
"one click" acceptance criterion. Reason: this panel is reachable for an
existing draft carrying a title and jots, and Unframe elsewhere already uses a
two-step confirm for the same deletion. Say if you want it one-click.

## 6. Nothing else moved

- [ ] Placing a normal pin still works end to end.
- [ ] Framing a trip still sets origin, when-text, year hint and the
      round-trip checkbox as before.
- [ ] The globe's route arcs are unchanged (R4–R6 untouched).

---

## Known and expected, NOT findings

- **F1 occlusion is still live.** Selecting a pin that has trips still paints
  the strip over the search dropdown — that dies with R4.
- **F6** — a trip's destination still cannot be changed; that is R6, and it
  carries a gated migration awaiting Andy at its turn.

## Proof scripts

`node scripts/verify-pin-search.mjs` — **15/15**, extended from 8 and proven
red/green (the new assertions fail against the old matcher).
`node scripts/verify-jsx-sibling-keys.mjs` — PASS.
