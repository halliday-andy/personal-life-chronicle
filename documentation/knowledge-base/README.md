# Life Chronicle Knowledge Base

*Seeded 2026-07-19 from the Phase-1 QA sessions (Andy's request). This is
the permanent, user-facing knowledge layer that will back the capture
assistant's guidance and support interactions.*

## What this is

Canonical answers to "how do I…" and "what does this mean?" questions
about capturing a life in Life Chronicle. Every article is written to be
**quotable by the capture assistant** when a user is confused mid-capture
— and readable by a human browsing for help.

This is deliberately NOT:

- **`memory/`** — agent-facing build state and decisions (internal).
- **`docs/plans/`** — design intent and implementation plans (internal).
- **`documentation/feature_*.md`** — specs (internal, exhaustive).

The knowledge base carries only what a *user* needs, in the user's own
vocabulary, at the moment of use.

## Authoring rules

1. **Question-shaped headings** in the user's voice ("Which home do I
   pick?"), because that is how confusion arrives.
2. **One concept per article**; cross-link rather than repeat.
3. **User vocabulary only** — UI labels ("Decide later — not yet
   placed"), never internal terms (no table names, invariant numbers,
   commit hashes, slice numbers).
4. **The reasoning, not just the steps.** Users trust guidance that says
   *why* ("the anchor is an era, not a return address"), and the
   assistant needs the why to adapt the answer to a variant question.
5. **Update with the feature.** A PR that changes a captured flow updates
   the affected article in the same change (the compound rule applied to
   support).

## How the assistant will consume this (integration plan)

Not yet wired. The intended path (recorded in
`docs/plans/2026-07-17-spine-and-share-roadmap.md`): a lookup tool on the
orchestrator — the assistant retrieves the relevant article when a user
asks a how/why question, and answers *from* it (never from improvisation),
citing the surface to tap. Rides the Loose-Ends / orchestrated-strand
design, where the assistant becomes proactive about guidance. Until then,
these articles are the source of truth for any guidance copy or prompt
sections touching capture UX.

## Articles

| Article | Covers |
|---|---|
| [Pin types & the anchor question](kb-globe-pin-types.md) | The eight "kind of place" choices; what "which home were you living in then?" really asks; standalone; the Log |
| [The residential spine](kb-residential-spine.md) | Your sequence of homes; "Decide later — not yet placed"; placing, demoting, reordering |
| [Trips & travel](kb-trips.md) | Destination-first capture; starting from a home; framing; one-way trips; stops and routes; trips vs. moves |
| [Recollections, jots & write-ups](kb-recollections-and-jots.md) | Where a memory attaches (pin / trip / stop / person); jots as a working list; the ✍ write-up; recollections vs. context |
| [Finding your way around](kb-navigating.md) | Searching your own pins; why the map changes at close zoom; the line language; Journey ↔ globe ↔ memories |
