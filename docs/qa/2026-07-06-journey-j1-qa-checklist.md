# QA Walkthrough — Journey J1 (walking skeleton)

App: **http://localhost:3001/journey** (sign in first).

> J1 of the [Journey design](../plans/2026-07-05-journey-view-design.md): the
> residential strand as a readable, spine-ordered column. This is the
> skeleton — the ember-spine thread + transition narration land in J2, lazy
> expand-to-detail in J3, globe↔journey handoff in J4. Tree logic proven by
> `verify-journey-tree.mjs` (6/6, incl. nothing-ever-disappears guards).

## 1. The column
- [ ] **AppNav** now has **Journey** (between Globe and Memories); the page
      loads with your stop count.
- [ ] Your 11 primary stops render **in spine order** (Lockbourne first …
      Year 2 at Mt. Snow last) — same order as the globe, top to bottom.
- [ ] Each stop card shows the **name**, its **`when` phrase** chip (verbatim
      — no parsed years), and the **placard** in italics where you've set one.
- [ ] The **first stop** carries the ★ and "The beginning"; the **last** a
      small "now" badge. **[taste]** both treatments (J2 upgrades them).

## 2. Nesting
- [ ] Anchored markers sit **indented under their home** with a type-colored
      dot + label (workplace, vacation, Log…) and their own when phrase.
- [ ] A **Log anchored to a vacation** nests under the *vacation* (e.g. your
      Queenstown Logs), one level deeper — indent caps at two levels.
- [ ] Standalone/unanchored markers appear at the bottom under
      **"Elsewhere · not yet anchored"** with the hint about anchoring via
      the globe Edit panel. Nothing you placed is missing. **[taste]** the
      section name.

## 3. Mobile-first
- [ ] Narrow the window to phone width (~375px) → single readable column,
      no horizontal scroll, chips wrap cleanly.
- [ ] Desktop → the column stays a comfortable reading measure (max-w-2xl),
      not full-bleed.

## Known scope (J2–J4, not bugs)
- No vertical ember thread / origin star artwork / move-reason transitions
  yet (**J2**).
- Cards don't expand to recollections/photos yet (**J3**) and don't link to
  the globe yet (**J4**).
- The Hopper deliberately does not appear here (design decision 9).
