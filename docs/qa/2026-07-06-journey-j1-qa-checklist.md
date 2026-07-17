# QA Walkthrough — Journey J1–J5 (complete arc)

App: **http://localhost:3001/journey** (sign in first).

> J1 of the [Journey design](../plans/2026-07-05-journey-view-design.md): the
> residential strand as a readable, spine-ordered column. This is the
> skeleton — the ember-spine thread + transition narration land in J2, lazy
> expand-to-detail in J3, globe↔journey handoff in J4. Tree logic proven by
> `verify-journey-tree.mjs` (6/6, incl. nothing-ever-disappears guards).

## 1. The column
- [x] **AppNav** now has **Journey** (between Globe and Memories); the page
      loads with your stop count.
- [x] Your 11 primary stops render **in spine order** (Lockbourne first …
      Year 2 at Mt. Snow last) — same order as the globe, top to bottom.
- [x] Each stop card shows the **name**, its **`when` phrase** chip (verbatim
      — no parsed years), and the **placard** in italics where you've set one.
- [x] The **first stop** carries the ★ and "The beginning"; the **last** a
      small "now" badge. **[taste]** both treatments (J2 upgrades them).

## 2. Nesting
- [x] Anchored markers sit **indented under their home** with a type-colored
      dot + label (workplace, vacation, Log…) and their own when phrase.
- [x] A **marker anchored to another marker** nests one level deeper —
      indent caps at two levels. *(Corrected 2026-07-09: your Queenstown
      Logs are all anchored directly to the primary, so live data has no
      grandchild to show — the flat display there is correct. To exercise
      this visually: globe → Ramada Queenstown → Edit → re-anchor to
      Coronet Peak Ski School → check the Journey → revert. Tree logic
      itself is proven by `verify-journey-tree.mjs` nested fixtures.)*
- [x] Standalone/unanchored markers appear at the bottom under
      **"Elsewhere · not yet anchored"** with the hint about anchoring via
      the globe Edit panel. Nothing you placed is missing. **[taste]** the
      section name.

## 3. Mobile-first
- [x] Narrow the window to phone width (~375px) → single readable column,
      no horizontal scroll, chips wrap cleanly.
- [x] Desktop → the column stays a comfortable reading measure (max-w-2xl),
      not full-bleed.

## 4. J2 — the ember thread (built same session)
- [x] A **continuous warm thread** runs down the left of the column,
      connecting every stop — segments meet cleanly whatever the card
      heights; it **ends at "now"** (nothing dangles past the last stop).
      **[taste]** thread weight/colour.
- [x] The thread is **topped by a glowing ★** at Lockbourne (the globe's
      origin star, rotated into the column). **[taste]** star size/glow.
- [x] The "now" stop's marker is slightly larger with a pale ring.
- [x] **Transition phrases** appear on the thread between stops — quiet
      italic amber: five "↓ a new posting" through the childhood bases,
      "↓ moved for work" into Tokyo and the ski years. **[taste]** the
      phrase vocabulary (career_relocation → "moved for work",
      military_posting → "a new posting", education → "off to study" …).
- [x] Where extraction found no reason (into Dartmouth, into NZ year 2),
      **nothing** is written — no fabricated connective tissue. (Dartmouth's
      pin has no recollection yet; write one and the extraction + phrase
      will appear after the next save.)
- [x] Nothing on the page animates (reduced-motion safe by construction).

## 5. J3 — tap a stop to open it (built after Andy's "flat listing" QA note)
- [x] Stop headers are now buttons (hover tint, ▸/▾). **Tap Mount Snow** →
      the card expands in place with its **recollection rendered as
      markdown**, the **photo** (when one exists), and **fact chips**
      (residence type, move reason, household).
- [x] While it loads (~instant) a skeleton shimmer shows, never a blank.
- [x] **Recollections from this time** lists linked recollection excerpts →
      clicking goes to /memories filtered to the place. **Context** lists
      note titles (🔒 on private) → the place's Entity View. Footer links:
      **Open place page ↗** and **All recollections →**.
- [x] With the stop open, its **children gain their excerpts** (the Logs/
      vacations show a line of their own recollection under their name).
- [x] Opening a second stop **closes the first** (single-open — the column
      stays a column). Reopening a stop is instant (cached, no refetch).
- [x] Initial page load still makes **zero** detail requests (open DevTools
      Network: /api/globe/residence/<id> fires only on tap).
- [x] A stop with no recollection (Dartmouth) says so and points at the
      globe — no empty void.

## 6. J4 — the globe↔journey handoff
- [x] Open a stop in Journey → its expanded footer has **Show on globe →**;
      clicking it lands on /globe with that pin **selected (card open) and
      flown to**.
- [x] On the globe, a pin's detail card now has **Read in journey →** (next
      to "Open place page") → lands on /journey with that stop **expanded
      and scrolled into view**.
- [x] **Child names in Journey are now links** — clicking a Log/vacation/
      workplace name flies the globe to *that marker* and opens its card;
      arriving back in Journey with that child's link scrolls to it under
      its expanded parent.
- [x] Expanding/collapsing stops in Journey keeps the URL in sync
      (`?pin=…`) without polluting Back-button history; selecting pins on
      the globe does the same. **Copy either URL into a fresh tab** → cold
      deep link lands oriented (sign-in first if needed).
- [x] The globe still opts out of AppNav (full-screen nocturne unchanged).

## 7. J5 — keyboard + screen-reader pass (the accessible globe)
> Journey is deliberately the screen-reader-accessible representation of the
> globe (design §4) — worth a real check, not a checkbox.
- [x] **Keyboard only** (put the mouse down): Tab reaches each stop header in
      order → a visible **amber focus ring** wraps the focused header →
      Enter/Space expands and collapses it; Tab continues into the expanded
      panel's links (Show on globe / place page / recollections), then to the
      child-name links.
- [x] **VoiceOver** (⌘F5, then VO-U → Headings): the rotor lists *Journey*
      (level 1) and every **stop name as a level-2 heading** — the whole
      spine is walkable by headings; expanded stops expose *Recollections
      from this time* / *Context* as level-3.
- [x] A collapsed header announces "collapsed", expanded "expanded"
      (aria-expanded); the opened panel is announced as a region named by
      its stop.
- [x] While a detail loads, VO announces "Loading this stop's detail…" (the
      skeleton is a status region; the shimmer bars themselves are hidden).
- [x] Decorations stay silent: the rail (star/dots/thread), the ▸/▾ chevron,
      and the ↓ arrow before transition phrases are all aria-hidden — but the
      transition *phrases* themselves ARE read (they're content).
- [x] Browser tab title reads **"Journey — Life Chronicle"**.
- [x] With **Reduce Motion** on (System Settings → Accessibility → Display),
      deep-link arrival jumps instantly instead of smooth-scrolling; nothing
      on the page animates regardless.

## Known scope (not bugs)
- Child rows still show excerpt-only in Journey; their full detail lives on
  their globe pin (one tap away via their name link).
- The Hopper deliberately does not appear here (design decision 9).
- Origin stop's own move_reason never renders — there is no transition INTO
  the beginning.
