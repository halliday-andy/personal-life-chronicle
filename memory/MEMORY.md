# Memory Index — Life Chronicle

Consolidated 2026-05-10. Updated 2026-05-17 (capture assistant + residential globe specs approved; Phase 0 reframe to parallel strands). See `feedback_lc_memory_dual_write.md` for the dual-write protocol.

## Current state (read first)

- [Project: LC current state — PRD v1.1, schema v1.4](project_lc_prd_status.md) — Document versions, what's settled, critical invariants, open OQs
- [Project: LC build progress — May 2026](project_lc_build_progress.md) — Steps 1–5 complete; Step 6 (capture assistant + orchestrator) is next; what's running; build decisions not in the PRD
- [Reference: LC Development Sequence](reference_lc_dev_sequence.md) — 15-step build plan with current step state; invariants summary; updated 2026-05-17 for parallel-strand Phase 0
- [User: Andy profile](user_andy_profile.md) — Background; working style; how to collaborate in build sessions

## Approved feature specs (canonical for upcoming builds)

- [Project: LC Capture Assistant + Orchestrator](project_lc_capture_assistant.md) — Summary memory; canonical spec at `documentation/feature_capture_assistant.md` v1.1. Step 6 build (substeps 6a–6i).
- Canonical: `documentation/feature_residential_globe_onboarding.md` v1.1 — Residential strand UX; Step 7 build (substeps 7a–7j). Absorbs old Step 10.

## Architecture & schema (durable design decisions)

- [Project: LC DB architecture decisions](project_lc_db_architecture.md) — Postgres+pgvector platform; dual-layer Raw Vault + Synthesis; 10-axis dimension taxonomy; contradiction flagging
- [Project: LC location as three-layer design](project_lc_location_design.md) — Place = entity + environment dimension + relationship; never encode geography in dimension taxonomy
- [Project: LC temporal agent design](project_lc_temporal_agent.md) — Constraint graph; uncertainty envelope; relational questions only; residential spine as Phase 0 scaffold
- [Project: LC ontology bootstrap](project_lc_ontology_bootstrap.md) — Why ontology must precede memory collection; **three-strand Phase 0** (chapter naming removed 2026-04-30; sequential staging removed 2026-05-17 — strands run in parallel under capture assistant orchestration); ontology vs. memory-collection as distinct interview modes
- [Project: LC Access Cards framework](project_lc_access_cards.md) — Replaces 5-tier privacy_tier ENUM; cards + contacts + card_holders + record_card_grants
- [Project: LC The Stroll (reminiscence)](project_lc_stroll_feature.md) — Three response pathways (A: adjacent stub, B: wisdom reflection, C: non-destructive revision); sole input to wisdom_distillation synthesis
- [Project: LC five shareable artifacts](project_lc_shareable_artifacts.md) — Life Globe, Relationship Portrait, Period Narrative, Career Story, Wisdom Distillation; lens for synthesis prioritization
- [Project: LC Single Post Share](project_lc_single_post_share.md) — Token-in-URL share; shared view is an enrichment invitation, not passive display; comments route to review_queue

## Resolved-history (decisions and reviews, retained for the "why")

- [Project: LC pre-PRD decisions (resolved 2026-04-30)](project_lc_prd_readiness.md) — Seven decisions including video PRD retirement, marketing positioning, Phase 0 three-stage model, MVP synthesis pair
- [Project: LC architecture split — resolved](project_lc_architecture_split.md) — Voice/interview is primary; video deferred to Phase 2/3; schema-extensibility constraint
- [Project: LC April 2026 gap review (historical)](project_lc_gap_review_april2026.md) — All 14 gaps now closed; retained for the four MVP hypotheses and durable architectural lessons

## Reference & feedback

- [Reference: LC schema file locations](reference_lc_schema_files.md) — Where every design doc and early-planning file lives; what's read, what's pending
- [Project: LC document sources](project_lc_document_sources.md) — Google Drive vs. local folder; what's unique to each, what's redundant
- [Feedback: LC memory dual-write protocol](feedback_lc_memory_dual_write.md) — Every memory write must hit both auto-memory and the workspace mirror
- [Feedback: Use lowercase for folder and file names](feedback_folder_naming.md) — create-next-app and Unix tooling reject capitals
