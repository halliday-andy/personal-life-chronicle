# QA Walkthrough — Journey J1 + J2

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

## 4. J2 — the ember thread (built same session)
- [ ] A **continuous warm thread** runs down the left of the column,
      connecting every stop — segments meet cleanly whatever the card
      heights; it **ends at "now"** (nothing dangles past the last stop).
      **[taste]** thread weight/colour.
- [ ] The thread is **topped by a glowing ★** at Lockbourne (the globe's
      origin star, rotated into the column). **[taste]** star size/glow.
- [ ] The "now" stop's marker is slightly larger with a pale ring.
- [ ] **Transition phrases** appear on the thread between stops — quiet
      italic amber: five "↓ a new posting" through the childhood bases,
      "↓ moved for work" into Tokyo and the ski years. **[taste]** the
      phrase vocabulary (career_relocation → "moved for work",
      military_posting → "a new posting", education → "off to study" …).
- [ ] Where extraction found no reason (into Dartmouth, into NZ year 2),
      **nothing** is written — no fabricated connective tissue. (Dartmouth's
      pin has no recollection yet; write one and the extraction + phrase
      will appear after the next save.)
- [ ] Nothing on the page animates (reduced-motion safe by construction).

## Known scope (J3–J4, not bugs)
- Cards don't expand to recollections/photos yet (**J3**) and don't link to
  the globe yet (**J4**).
- The Hopper deliberately does not appear here (design decision 9).
- Origin stop's own move_reason never renders — there is no transition INTO
  the beginning.
