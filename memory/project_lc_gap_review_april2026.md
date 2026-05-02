---
name: Life Chronicle — April 2026 gap review and MVP recommendation
description: Opus 4.7 review of Sonnet 4.6's design + schema; identified gaps, recommended refinements, proposed MVP scope; basis for forthcoming PRD dialogue
type: project
originSessionId: b2a30b2d-fc2f-4ca5-bfaf-2f6dc2a43ae1
---
April 2026 review pass over schema_v1.sql + DB_Architecture_Design_v1.md + memory files.

## Key gaps identified (priority order)

1. **Assumption log** repeatedly named (Part IX, Next Steps 16) but not in schema — required to make provenance/trust promises real.
2. **No agent orchestration layer** — concurrent-write claim is true but no event/queue/dispatch model documented.
3. **No user review inbox** — pending merges, contradictions, temporal Q's, sensitive-promotion requests have no unified surface.
4. **`user_periods` missing** — chapter naming (Phase 0 Stage 2) elicits user vocabulary but has no first-class schema home; `life_stage` is universal, not personal.
5. **No soft-delete/redaction** — append-only Raw Vault conflicts with right-to-erasure and reconsidered memories.
6. **ENUM extensibility tension** — schema claims migration-free but several ENUMs (memory_source, entity_type, synthesis_type, media_type) require migration to extend.
7. **Second-person memory unmodeled** — relevant for family-to-elder capture as growth wedge.
8. **Forward-looking content unmodeled** — schema is retrospective only; product brief says progressive too.
9. **No training-consent layer** — distinct from privacy_tier; required to make "AI legacy" mission claim real.
10. **Synthesis cost model undefined** — real-time cascade regeneration is expensive; needs pull-based/batched policy.
11. **No eval framework** — no synthesis quality scoring, prompt versioning beyond hash, golden tests.
12. **Coverage scoring algorithm undefined** — Planner Agent depends on it (Next Steps 6).
13. **Video/Thread-2 split unresolved on disk** — local PRD.docx still active; needs explicit retirement.
14. **No subscription/billing/tenancy model** — fine for prototype, but connection-group sharing implies multi-user which implies tenancy + billing; sketch before connection groups land.

## Refinements recommended (not yet decided with Andy)

- Promote assumption_log to first-class now, not Phase 2.
- Add review_queue table as unified user touch point.
- Add user_periods + memory_periods for chapter naming.
- Convert ENUMs → controlled-vocabulary tables where extension foreseeable.
- Add redaction model alongside append-only memories.
- Add training_consent layer (scopes: personal_use_only, anonymized_research, identified_research, posthumous_research, posthumous_public).
- Synthesis Agent pull-based + batched, not real-time cascade.
- Restructure Phase 0 with mid-flight value: globe after Stage 1, entity portrait after Stage 3, chapter narrative after Stage 4.
- Add second-person memory mode (subject_user_id distinct from owner).
- Eval scaffold from day one (thumbs on syntheses, prompt versions, weekly low-rated review).
- Retire video PRD.docx as separate document; reposition as Phase 3 input modality.
- Enforce raw vault sanctity as a Postgres role, not just documented intent: Capture Agent's DB role is INSERT-only on `memories`, no UPDATE privilege at all. Makes "AI never edits raw memories" a permissions fact, not application discipline.
- Treat cost guardrails as architectural, not ops: rate-limited synthesis regeneration, batched generation policy, per-user monthly $ ceilings. Items 26–27 in design doc Next Steps frame these as deployment concerns; they are first-class architecture and must be designed, not deferred.

## Proposed MVP (3–4 month build, single product)

**In:** Phase 0 four-stage bootstrap with mid-flight artifacts; voice + text capture (web/mobile-web/SMS); Raw Vault with temporal envelope (no propagation engine, no autonomous Temporal Agent); Tagger and Entity Agents (single-pass, propose into review queue, no autonomous merges); 5-tier privacy with sensitive auto-lock and self-only RLS; consent fields present though dormant; two synthesis types only — place_portrait + chapter_narrative, pull-based; Mapbox life globe; timeline-with-uncertainty view; faceted browser; unified review inbox; assumption log writing silently; basic JSON export; thumbs eval loop.

**Phase 2:** Temporal Agent + propagation; connection groups + actual multi-user sharing; custom dimensions + merges; CEF v1 export; multi-language; review inbox visible features.

**Phase 3:** Training-consent surfaces + public profile + voice clone; video atomization + face recognition; enterprise/institutional.

## Hypotheses MVP must test

H1: Non-technical adults complete Phase 0 if value emerges mid-flight.
H2: Users return weekly under prompt cadence.
H3: AI synthesis feels accurate enough to share.
H4: Users trust the privacy model with one genuinely sensitive memory.

## Open decisions Andy must weigh in on before PRD

1. Retire video PRD as separate doc? (Recommendation: yes, reposition as Phase 3 input modality.)
2. Lead with "AI legacy" as marketing pillar, or earn it later? (Data model present either way.)
3. Phase 0 multi-session with mid-flight artifacts vs. single onboarding interview? (Recommendation: multi-session.)
4. MVP synthesis types — place_portrait + chapter_narrative the right pair, or substitute relationship_portrait or wisdom_distillation?
5. MVP channel scope — web + mobile-web + SMS sufficient, or include voice-only phone? (Recommendation: yes, defer phone.)

## How to apply

When Andy returns to this work, this file holds the gap analysis and MVP shape that the PRD should crystallize. Update with his answers to the five open decisions; the PRD draft follows from there.
