---
name: feedback-lc-accessibility-deferral
description: Andy's standing call (2026-07-26) — defer dedicated keyboard-accessibility work toward MVP, but build it inline whenever a feature accommodates it efficiently. Deferred, never dropped.
metadata:
  type: feedback
---

**Andy's call, 2026-07-26:** defer keyboard-accessibility enhancements while
driving toward MVP — *"without eliminating them from ongoing feature
development when building a feature accommodates doing the accessibility
improvement at the same time efficiently."* The MVP is for testing, primarily
by Andy, so it does not need the full accessibility surface at launch.

**Why:** velocity toward a usable, testable MVP outranks completeness on a
surface no external user is on yet. This is a sequencing decision, not a
judgment that accessibility is optional — hence "defer," not "drop."

**How to apply:**

- **Still build, always:** the semantics that come free with correct markup —
  real `<button>`/`<a>` elements, `aria-expanded` / `aria-controls` on
  disclosures, `sr-only` text where a visual-only cue would otherwise be the
  sole carrier of meaning (e.g. the Journey stop ordinal, whose rail is
  `aria-hidden`), labels, focus-visible rings. These cost nothing at build time
  and are expensive to retrofit.
- **Defer:** anything needing its own UI surface or interaction model — chiefly
  **keyboard alternatives to drag-and-drop** (move up/down controls, roving
  tabindex, live-region announcements for reorder).
- **But take it when it's cheap:** if a feature's shape makes the accessible
  path nearly free at build time, build it then rather than booking a return
  trip. That is Andy's stated exception and the whole point of "defer, not
  eliminate."
- **Never silently skip.** Each deferral is named in the unit's commit and QA
  checklist so the debt is visible rather than discovered later.

**Running deferred list** (kept in `docs/plans/2026-07-17-spine-and-share-roadmap.md`
§5 so it survives session boundaries):

- Pin photo carousel reorder — drag is pointer-only (2026-07-20).
- Chapter "places within this chapter" reorder — drag is pointer-only
  (2026-07-26).

Revisit when the product moves from Andy-testing toward real users — the
shareable-collections track (Track B) is the natural trigger, since that is the
first surface other people touch. See [[project_lc_direction_2026-07-17]].
