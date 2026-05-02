---
name: Project: LC The Stroll — Reminiscence Feature
description: The Stroll is a re-engagement mode that presents curated memories as short narratives, listens for response, and routes to three pathways: adjacent memory stub (A), wisdom reflection (B), memory revision (C). New tables: stroll_sessions, reflections, memory_revisions. Reflections are the sole input to wisdom_distillation synthesis.
type: project
---

## What It Is

The Stroll is a non-interview, non-synthesis feature that surfaces a single existing memory as a compact narrative and listens for the user's response. It is a re-engagement mechanism (a reason to return on days with nothing new to add) and a memory rehearsal mode (revisiting a memory reinforces its structure and validates its significance).

It is distinct from the interview pipeline (no probing questions, no completion pressure) and the synthesis layer (no pre-built narratives). Its outputs feed both.

**Why:** Reflections and memory_revisions are entry types that cannot be elicited through interviewing. They emerge specifically from the act of being presented with your own story from the outside.

**How to apply:** When reasoning about synthesis inputs, The Stroll is the only source of `reflection` entries. The `wisdom_distillation` synthesis type has no other feeder. When rendering any memory for a user, always check `memory_revisions` for a non-retracted correction before displaying.

---

## Three Response Pathways

**Pathway A — Adjacent Memory Expansion**
User recalls a related event triggered by the presentation. Captured as a memory stub: `memories` row with `is_draft = true`, `capture_mode = 'stroll'`, `triggered_by_memory_id` set to origin. Enters interview intake queue for development.

**Pathway B — Wisdom Distillation**
User articulates a present-tense insight from the memory. Captured in `reflections` table. Agent asks one follow-up: "at the time, or in hindsight?" → populates `temporality` field. Reflections with `synthesis_ready = true` are the input for `wisdom_distillation` synthesis records.

**Pathway C — Correction / Revision (Self-Distancing Effect)**
Hearing one's memory narrated in a different voice creates cognitive distance enabling more accurate self-evaluation. User may correct the record. Captured in `memory_revisions` table. Original `memories` record is NEVER modified — revisions are a non-destructive layer. Four revision types: `factual_correction`, `emotional_reframe`, `context_update`, `narrative_revision`.

Compound responses (A+B, B+C, A+B+C) are common and all parts are captured as linked records.

---

## Schema Additions (April 2026)

Three new tables in `schema_v1.sql`:
- `stroll_sessions` — session trace, adjacency walk, engagement signals
- `reflections` — Pathway B entries with reflection_type and temporality
- `memory_revisions` — Pathway C non-destructive corrections

Three new columns on `memories`:
- `triggered_by_memory_id UUID REFERENCES memories(id)`
- `triggered_in_stroll_session UUID REFERENCES stroll_sessions(id)`
- `capture_mode TEXT` ('stroll' | 'interview' | 'freeform')

Architecture documented in `DB_Architecture_Design_v1.md` Part XI.
Feature spec at `documentation/feature_reminiscence_mode.md`.

---

## Key Design Decisions

- Agent goes silent after presenting the memory — no immediate question
- Fallback prompt only fires if no spontaneous response: *"What does thinking about this past event make you recall or think about now as we're talking about it?"*
- Voice delivery in own voice (future Phase 3): voice samples from recordings, TTS synthesis, consent via Access Cards framework
- Adjacency navigation has breadcrumb trail; agent suggests return after 3+ steps from origin
- Wisdom Distillation shareable artifact now has a defined input source (reflections); previously the synthesis type existed with no feeder

## Open Questions (tracked in feature spec)

OQ-1: Surface incomplete/uncertain memories in curation? (blurs rehearsal/interview)
OQ-2: Voice delivery opt-in vs. default?
OQ-3: Full narrative vs. lighter card for adjacent memories?
OQ-4: Mirror Pathway B responses back as paraphrase? (high value, high variance)
OQ-5: Flag downstream entries affected by a Pathway C revision?
OQ-6: Surface patterns of narrative_revision on the same event over years?
