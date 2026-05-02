---
name: Life Chronicle — Five Candidate Shareable Artifacts
description: The pre-PRD framing of what the chronicle actually delivers to the user as user-facing outputs; should drive synthesis-type prioritization and roadmap sequencing
type: project
originSessionId: b2a30b2d-fc2f-4ca5-bfaf-2f6dc2a43ae1
---
April 2026 framing: separate from the *synthesis types* in the schema (which are internal categories), the *shareable artifacts* are the user-facing products the chronicle delivers. These are the things a user shows to family or colleagues, exports, prints, or returns to repeatedly. They are how the system's value becomes visible.

## The five candidates

1. **Life Globe view** — Interactive geographic traversal of the user's life. Residences and significant places weighted by memory density; chronological animation; hover/pause surfaces an entity_biography synthesis for each place. The first delight artifact (delivered after Phase 0 Stage 1). Backed by `life_journey_geojson()` + `entity_biography` synthesis type.

2. **Relationship Portrait** — A compiled narrative of a single significant relationship across the user's life. The role they played, formative memories together, recurring patterns, evolution over time. Most viscerally meaningful for family sharing. Backed by `relationship_portrait` synthesis type.

3. **Period Narrative** — A chapter-length narrative of a user-named life period ("the Philly years," "after my father died"). Anchored to a `user_period` and pulls memories within its date range and themes. The chronicle's answer to memoir chapters. Backed by `life_period_narrative` synthesis type and the proposed `user_periods` table.

4. **Career Story** — A structured arc of the user's professional life: roles, employers, mentors, key projects, lessons learned, transitions. The natural artifact for LinkedIn-adjacent sharing and for the secondary "professional legacy" market. Backed by `topic_synthesis` (Career & Professional Life domain) plus an entity-biography synthesis per significant employer.

5. **Wisdom Distillation** — Extracted lessons, recurring sayings, hard-won insights, personal philosophies the user carries. The compressed essence of what the person knows. The most differentiated artifact — nothing in the competitive set produces this. Backed by `wisdom_distillation` synthesis type and pulls from `expressive_form` dimension tags.

## Why this framing matters

The synthesis-type list in `schema_v1.sql` is internal taxonomy: nine types ranging from `life_period_narrative` to `persona_facet`. Most of those are infrastructural; only a subset map cleanly to artifacts the user will actually share. The five above are the ones with *outward* value.

The MVP currently scopes two synthesis types — `place_portrait` and `chapter_narrative`. Mapped to the artifact frame, that means MVP delivers Life Globe (with place-level entity biographies) and Period Narrative. Relationship Portrait, Career Story, and Wisdom Distillation come in Phase 2.

This frame should be revisited every time we pick which synthesis type to invest in next: the question is not "which synthesis type is technically interesting" but "which artifact does the user need to see next to validate the value of the system."

## Open question still pending

Phase 5 of MVP open decisions (gap review memo): is `place_portrait + chapter_narrative` the right MVP pair, or should we substitute Relationship Portrait or Wisdom Distillation? The artifact frame is the lens for that decision.

## How to apply

When prioritizing synthesis-related work, ask: which of the five artifacts does this advance? When designing the user's first session, ask: what artifact do they see at the end of it? When marketing, lead with the artifacts (concrete, sharable outputs) rather than the underlying taxonomy or schema.
