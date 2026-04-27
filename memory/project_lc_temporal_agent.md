---
name: Life Chronicle — Temporal Architecture and Temporal Agent Design
description: How temporal uncertainty is modeled, how the constraint graph works, and the Temporal Agent's proactive Q&A behavior
type: project
originSessionId: focused-eloquent-thompson
---

**Core principle:** Temporal knowledge exists on a spectrum. The schema stores it at whatever precision is available and refines it over time. Demanding precision the user cannot provide is a design failure.

**Two distinct temporal concepts:**
- `occurred_at_start` / `occurred_at_end`: event duration (when the experience spanned)
- `time_earliest` / `time_latest` / `time_estimate` / `time_precision` / `time_confidence`: uncertainty envelope (how well we know when it happened)

**time_precision enum:** unknown → decade → year → season → month → day. Auto-updated by propagation when envelope narrows. Never claims more than is warranted. Display logic shows "1973" not "Jan 1, 1973" when precision is 'year'.

**Constraint graph:** `temporal_constraints` table stores typed relative ordering between memories and anchors (before/after/concurrent/during/soon_before/soon_after/same_day/same_year/same_trip). Anchors can be: another memory, dated media (EXIF), entity event (birth/move/marriage), world event. Constraints have provenance: user_explicit, user_confirmed, agent_inferred, exif_data, document_date, transitive.

**Constraint propagation:** `propagate_temporal_constraints(user_id)` runs forward/backward inference, tightens time_earliest/time_latest, updates time_precision. Loops to fixed point. Conflict detection: `detect_temporal_conflicts()` surfaces impossible constraints (earliest > latest) as contradiction_flag syntheses.

**Temporal resolution queue:** `temporal_resolution_queue` table — the Temporal Agent's work queue. Priority scored by: uncertainty_days (width of envelope), cascade_benefit (how many other memories would tighten if this resolves), anchor_count. Keystone memories (deeply embedded in constraint graph) are prioritized over merely fuzzy ones.

**Temporal Agent work cycle:**
1. Inventory: query queue for highest-priority pending memories
2. Anchor discovery: find dated media, entity events, world events that share entities with the fuzzy memory
3. Question generation: compose relational question ("before or after the move to Austin?") — never ask for a year directly
4. Constraint ingestion: parse user response → new temporal_constraint row → run propagation
5. Cascade: memories that resolve propagate to neighbors automatically

**Proactive modes:**
- Scheduled Q&A sessions (interleaved with capture interviews by Planner Agent)
- Opportunistic content mining: scans content_raw for temporal language ("three years after", "just before we left") → inferred constraints at lower confidence, confirmed by user before propagating
- Media correlation: dated photos/documents → immediate constraint proposals for memories sharing those entities

**Conversational UX principles:**
- Ask for orderings, not years. People know orderings far better.
- Present concrete anchors ("the move to Austin in 1979"), not abstract questions ("when did this happen?")
- Always offer "I'm not sure" — unanswered questions don't corrupt the record
- Agent-inferred constraints require user confirmation before propagating (never auto-modify the record)
- Show the user the timeline improving (band narrowing) as positive feedback

**Residential history as Phase 0 (keystone insight, April 2026):** The sequence of homes a person has lived in is the single most powerful temporal scaffold because of strict sequential non-overlap — one primary home at a time. Each confirmed move date generates TWO constraints simultaneously: upper bound on the previous home period, lower bound on the next. The residential spine is built FIRST before any other temporal resolution work. Interview elicits: place, household composition, move_reason, and approximate dates. `generate_residency_constraints()` auto-fires when a lived_at relationship is added/updated.

**Move reason vocabulary:** career_relocation, military_posting, marriage, divorce_separation, education, family_care, financial, retirement, health, displacement, adventure, unknown. Each connects to adjacent timelines — a career_relocation implies a job-start date; a military_posting implies an orders date. The Temporal Agent searches these corroborating anchors automatically.

**Gap detection:** residency_timeline view computes gap_days_to_next (positive = transition period, negative = data error/overlap). Gaps surfaced as prompts ("were you somewhere else during that 8-month gap?"). Overlaps escalated as contradiction flags.

**World event anchors:** A reference list of historical events should be seeded as potential anchors for people who have no personal event available — elections, moon landings, cultural moments.

**How to apply:** When designing Temporal Agent prompts or UI, prioritize relational questions over date questions. Build residential spine first. The constraint graph is the mechanism for progressive refinement. Never treat a fuzzy date as an error — it is valid temporal knowledge at a different precision level.
