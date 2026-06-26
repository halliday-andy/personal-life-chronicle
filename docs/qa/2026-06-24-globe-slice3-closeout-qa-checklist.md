# QA Walkthrough — Globe Slices 3 close-out, 3.5, 3.6 (2026-06-24)

Hands-on checklist for everything built in the globe-legibility track this round.
App: **http://localhost:3001** (sign in first). Suggested order top-to-bottom.

> Context: Slice 3 close-out (Phase-5 findings + items 1–3 static), Slice 3.5
> (active-lines tray + type filters), Slice 3.6 (the "Log" pin). All gated by
> tsc + eslint + 7 passing verify scripts; this is the human/visual proof.

> Taste calls flagged **[taste]** — there's no right answer, just tell me if the
> size/colour/intensity feels off and I'll tune it.

---

## 1. Pin legibility — at-rest chips + hover card (item 1)
- [x] Every pin shows its **`when` phrase** as a small chip **below the dot**, with no interaction (e.g. `June 1976 to September 1976`). **[taste]** chip position/legibility.
- [x] The chip text matches what you typed in "When" (it's the raw phrase, not a parsed year range — proportional/era encoding stays deferred to the Temporal Agent).
- [x] **Hover** a pin (don't click) → a compact card appears showing the pin **name** + its **placard** (if set). Mouse off → it disappears. **[taste]** hover-card placement.
- [x] Pins still sit exactly on their arcs/tethers (the chip must not have shifted the dot off its coordinate).

## 2. Placard — the one-line description (item 1)
- [x] Open a pin → **Edit** → there's a **Placard** field ("a one-line description, shown on hover"), prefilled if one exists. Type one (≤120 chars) → **Save**.
- [x] Hover that pin → the placard shows under the name.
- [x] Place a **new** pin → the create modal has a **Placard (optional)** field; what you enter shows on hover after saving.

## 3. Origin pin — "the beginning" (item 2) · STAR FIXED 2026-06-24
- [x] Your **first** stop in sequence (Lockbourne) renders as a distinct **bright star** in a **lighter/whiter gold** than the ember spine — and the whole star is **uniformly bright** (the earlier brown/incomplete lower half is gone — it was the year-chip being clipped by the star). **[taste]** star size + brightness.
- [x] Its **year chip** sits cleanly **below** the star (not overlapping/clipped).
- [x] It's clearly the start by **shape + colour**; every other pin is an ordinary dot. (Static — no twinkle, by your call.)

## 4. Chevrons + tether contrast (item 1 + item 3 note) · REWORKED 2026-06-24 (one icon per leg)
- [ ] Each spine **leg** now shows exactly **one** filled-chevron marker at its **midpoint, sitting on the line** (no more repeated carets drifting off the arc / looking like floating planes). Flag any that still sit off the line.
- [x] The chevron points in the **direction of travel** (earliest → latest) along each leg. **[taste]** the chevron shape + size.
- [x] Select a spine pin → its **inbound** leg's chevron brightens over the **outbound** leg. *(You already approved the inbound emphasis.)*
- [x] When a trip tether is visible (see §6), it's a **cool slate colour** — clearly *not* a dim copy of the ember spine. **[taste]** the hue.

## 5. Refine location — drag without the edit panel (Phase-5 finding 1) · BUG FIXED 2026-06-24 PM (`c15b118`)
> Was broken: releasing the drag removed the Save banner. Cause — the marker's
> click re-fired after the drag and reset refine mode. Now guarded.
- [x] Select a pin → the detail card has a **Refine location** button (next to Edit).
- [ ] Click it → a top-center banner says "Drag the pin to reposition it" (the full edit panel does **not** open).
- [ ] Drag the pin → banner changes to "New position set" → **Save location stays visible** → click it → the pin holds its new spot; recollection / when / type unchanged. *(This is the fix — re-test.)*
- [ ] Repeat, but click **Cancel** → the pin **snaps back**.
- [ ] Inspecting pins by clicking them never moves them (drag only arms after Refine location).

## 6. Line declutter — default spine + hover preview (item 3 static)
- [x] On load, the globe shows **only the primary spine** — no web of commute/trip tethers crossing it.
- [x] **Hover** a home that has trips/workplaces anchored to it → its side lines **preview** transiently; mouse off → they clear.
- [x] Hover a **marker** (e.g. a vacation) → its own tether previews.

## 7. Line visibility — global only (Slice 3.5, REWORKED 2026-06-24)
> The tray and the per-pin "Side lines on/off" toggle were **removed** — they
> caused the on/off conflict you found. Lines are now controlled globally:
> per-class filters + a "Side lines in view" toggle + transient hover.
- [x] There is **no tray** above the legend any more, and the detail card has **no "Side lines on/off"** button.
- [x] On load, the globe is the **bare spine** — no tethers.
- [x] **Hover** a pin → its side lines preview transiently; mouse off → they clear (unchanged).
- [x] Selecting a pin (opening its card) **no longer** auto-shows or "sticks" its lines — that's now the in-view toggle's job (§8).

## 8. Legend & filters — class toggles + "Side lines in view" (Slice 3.5)
- [x] Open the bottom-left **"Legend & filters"**. Expand it.
- [x] Each marker row (Workplace, Second residence, Short-term, Vacation, Professional travel, **Log**) is a **toggle** showing **● shown / ○ hidden** — turning one on shows **all** of that class's tethers as a baseline; off hides them.
- [x] **Primary residence** is labelled **"spine"** and is not a toggle.
- [x] A new **"Side lines in view"** toggle (○ off / ● on) sits below the class rows.
- [x] Turn **"Side lines in view" on** while zoomed **all the way out** (whole globe) → **nothing** appears (it's auto-gated so the overview stays clean).
- [x] Now **zoom into a region** (e.g. Queenstown, or New England) → the side lines of the pins **on screen** appear; **pan** to another region → those drop and the new region's appear. **[taste]** does the zoom threshold feel right (too eager / not eager enough)?
- [x] Turn it **off** → in-view lines clear (class filters, if any, remain).

## 9. The "Log" pin — new type (Slice 3.6)
For this you'll place a new pin and choose the **Log** type.
- [x] Search → drag a pin → in the type selector there's a **Log** option with the description "a place worth marking on the map — a memory to log…". **[taste]** the label "Log" (candidates were Waypoint / Relic / Capture — say the word if another fits better).
- [x] Choosing Log shows the anchor prompt **"Associated with which place?"** and the dropdown lists **all** your pins (homes *and* vacations etc.), with a `· <type>` hint on non-home options.
- [x] Save a Log anchored to a **home** → it renders as a small **soft-violet** dot with a **dashed** tether to that home.

## 10. Generalized anchoring — Log on a vacation (Slice 3.6)
- [x] Place another **Log** and anchor it to a **Vacation** pin (e.g. Coronet Peak) instead of a home → it saves and draws a dashed tether to the **vacation** (this is the "places around a vacation destination" case the old model rejected).
- [x] Edit an existing marker → its **Type** dropdown includes **Log**; re-typing to Log offers the all-pins anchor picker.

## 11. Recollection roll-up — "Anchored here" (Slice 3.6)
- [x] Give one of your Logs a recollection (Edit → write in the Recollection box → Save).
- [x] Open the **anchor's** detail card (the home or vacation that Log is attached to) → an **"Anchored here · N"** section lists the Log (violet dot + name + a short excerpt of its recollection).
- [x] **Click** an item under "Anchored here" → the globe **flies to that pin** and opens its card.
- [x] Confirm the recollection still lives on the Log's own pin (the anchor card only *links* to it — it doesn't host it).

## 12. Re-type round-trip — anchor/tether restore (Phase-5 finding 2) · INSERT-POSITION FIXED 2026-06-24 PM (`89c7266`)
> Was: re-typing a vacation to primary appended it at the END of the spine.
> Now it inserts right **after the home it was anchored to**.
- [ ] Open a **Vacation** anchored to a home → **Edit** → change Type to **Primary residence** → Save → it joins the spine **right after the home it was anchored to** (not at the end). *(This is the fix — re-test.)*
- [ ] Reopen it → change Type **back** to Vacation → the "Associated with which place?" picker **pre-selects the original home** (not "Not sure / standalone").
- [ ] Save → the **dashed tether returns** to that home.

## 14. New-pin naming + recollection markdown (QA round 3, 2026-06-24 PM)
- [ ] Place a pin **without** typing in the search box → the create modal now has an editable **"Name on the pin"** field (placeholder "Name this place"). Set a name → it shows on the pin. (`ac7c72a`)
- [ ] Search a place, then place it → the name field is **prefilled** with the search result and is **editable** (correct it if the search term isn't your preferred name).
- [ ] Open a pin's **Edit** panel with a markdown recollection → the recollection shows **rendered** (formatted), not raw `**`/`#`. Click **"Edit text"** → raw editor appears; edit → Save. (`44fa2a9`)

## Deferred this round
- **Chevron zoom-drift:** Andy approved the current chevrons; some still detach from the arc after a zoom action (screenshot). Approved for now — revisit if it recurs / worsens. (Possible future move: the deferred comet-flow along the spine.)

## 13. Orphan-on-retype (Phase-5 finding 4 — now testable)
- [ ] Re-type a **Primary that has markers anchored to it** → Second residence → those markers orphan to standalone (tethers drop).
- [ ] Re-associate an orphaned marker by editing it and picking an anchor again (or convert it to a **Log** and anchor it wherever fits).

---

## Notes / known deferrals (not bugs)
- **Auto-declutter of dense pin clusters** (spiderfy) is deferred to a later slice — "Refine location" is the manual way to array close markers for now.
- **Workplace icon overwhelming the primary at zoom-out** (your Queenstown screenshot) is parked for the dedicated pin-visual redesign.
- **"Log" label** is an MVP trial — easy to rename.
- **Comet-flow directionality** (animated pulse travelling along the arcs) is **deferred as a possible enhancement** — Andy's framing: best as an *opening flourish* running along the primary-residence spine on the zoomed-out globe view, fading once the user zooms in so it never clutters. The on-line chevrons (§4) are the shipped solution.
- The unsafe `verify-globe-slice4b` script (which once shifted your spine ordering) has a separate fix queued; your spine `sort_order` is confirmed intact at 0–9.

Anything that fails or feels off — note it against the item number and I'll pick it up.
