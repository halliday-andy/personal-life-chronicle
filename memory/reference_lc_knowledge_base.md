---
name: Reference: LC user-facing knowledge base
description: documentation/knowledge-base/ — the permanent, user-voiced support KB that will back the capture assistant's guidance. Seeded 2026-07-19 from Phase-1 QA understanding. Update articles in the same PR as any capture-flow change.
type: reference
---

## What and where

`documentation/knowledge-base/` — five question-shaped, user-vocabulary
articles + a README with authoring rules, seeded 2026-07-19 at Andy's
request ("ensure this level of understanding is documented… a permanent
knowledge base that supports customer support interaction by the capture
assistant"):

- `kb-globe-pin-types.md` — the eight place types; the anchor question
  = home ERA, not return address; standalone; Log as the free-form type.
- `kb-residential-spine.md` — sequence = order not dates; decide-later
  full-citizenship; place/demote round-trips lose nothing.
- `kb-trips.md` — destination-first + the from-here entry; framing
  fields incl. one-way; anchor-vs-origin (the Calgary answer);
  trips-vs-moves.
- `kb-recollections-and-jots.md` — attachment table (pin/trip/stop/
  person); jots are a working list not contracts (check-off, outline
  use); ✍ write-up = guaranteed attachment; recollection vs context.
- `kb-navigating.md` — pin search, the two basemap looks, line tiers,
  cross-surface handoffs.

## How it relates to everything else

- **Distinct from `memory/`** (agent-facing build state) and from specs/
  plans (internal). KB carries only what a USER needs, quotable by the
  assistant.
- **Integration pending** — an orchestrator lookup tool so the assistant
  answers from articles, never improvisation. Recorded in the Spine &
  Share roadmap §5; rides the Loose-Ends / Step-8 orchestrated-strand
  design.

## How to apply

Any change to a captured flow (pin modal, sequencing, trips, jots,
search, basemap) updates the affected article IN THE SAME change — the
compound rule applied to support. When writing assistant prompt sections
about capture UX, source them from these articles.
