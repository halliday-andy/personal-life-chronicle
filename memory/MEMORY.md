# Memory Index — Life Chronicle

Consolidated 2026-05-10. Updated 2026-05-17 (capture assistant + residential globe specs approved; Phase 0 reframe to parallel strands). See `feedback_lc_memory_dual_write.md` for the dual-write protocol.

## Current state (read first)

- [Project: LC current state — PRD v1.1, schema v1.4](project_lc_prd_status.md) — Document versions, what's settled, critical invariants, open OQs
- [Project: LC build progress](project_lc_build_progress.md) — **refreshed 2026-06-17** (top "Session handoff" block = current state after the QA remediation pass); Steps 1–6 complete; **Step 7 Slices 1, 4a, 4b, and 2 shipped** (walking skeleton → edit/relocate/delete → sequence + proximity → detail card + pin image + Claude extraction); what's running; build decisions + bugs fixed. Read first when resuming build work.
- [Decision: Step 7 phased into build slices (2026-06-05)](decision_step7_slice_phasing_2026-06-05.md) — **Read first for Step 7.** Walking-skeleton phasing (Slices 1–5). **Slices 1 + 4a + 4b + 2 SHIPPED**; **Slice 3 (place types) is next** (then Slice 5+: sidekick, clustering, thresholds, mobile). Records the design calls (modal-first / globe projection / arc-drag-insert deleted / image in Slice 2 / Timeline separate), the self-entity decision, satellite-zoom enhancement, and the Raw-Vault/edit-capability gap.
- [Reference: LC Development Sequence](reference_lc_dev_sequence.md) — 15-step build plan with current step state; invariants summary; updated 2026-05-17 for parallel-strand Phase 0
- [User: Andy profile](user_andy_profile.md) — Background; working style; how to collaborate in build sessions

## Approved feature specs (canonical for upcoming builds)

- [Project: LC Capture Assistant + Orchestrator](project_lc_capture_assistant.md) — Summary memory; canonical spec at `documentation/feature_capture_assistant.md` v1.1. Step 6 build (substeps 6a–6i).
- Canonical: `documentation/feature_residential_globe_onboarding.md` v1.1 — Residential strand UX; Step 7 build. Now phased into slices — see [Step 7 slice phasing](decision_step7_slice_phasing_2026-06-05.md).
- [Project: LC future pin types (deferred)](project_lc_future_pin_types.md) — Aspirational bucket-list pin; multi-home concurrent-domicile display. Post-MVP globe enhancements.
- [Project: LC globe & entity UX brief (2026-06-22)](project_lc_globe_entity_ux_brief.md) — 7 enhancements (pin chips/hover, origin pin, line declutter+tray, Resume View, the Hopper, Person Entity page, Vertical Moments). **REVIEWED + resequenced by Claude Code 2026-06-22** → canonical roadmap `docs/plans/2026-06-22-globe-and-entity-ux-revised-roadmap.md` (Person page ≡ the 2026-06-14 context-layer Entity View, pulled forward; Hopper = new `memory_stubs`; items 1–3 fold into Slice 3 / 3.5). Brief = product intent: `docs/plans/2026-06-22-globe-and-entity-ux-enhancements-design.md`.

## Architecture & schema (durable design decisions)

- [Project: LC DB architecture decisions](project_lc_db_architecture.md) — Postgres+pgvector platform; dual-layer Raw Vault + Synthesis; 10-axis dimension taxonomy; contradiction flagging
- [Project: LC location as three-layer design](project_lc_location_design.md) — Place = entity + environment dimension + relationship; never encode geography in dimension taxonomy
- [Project: LC temporal agent design](project_lc_temporal_agent.md) — Constraint graph; uncertainty envelope; relational questions only; residential spine as Phase 0 scaffold
- [Project: LC ontology bootstrap](project_lc_ontology_bootstrap.md) — Why ontology must precede memory collection; **three-strand Phase 0** (chapter naming removed 2026-04-30; sequential staging removed 2026-05-17 — strands run in parallel under capture assistant orchestration); ontology vs. memory-collection as distinct interview modes
- [Project: LC Access Cards framework](project_lc_access_cards.md) — Replaces 5-tier privacy_tier ENUM; cards + contacts + card_holders + record_card_grants
- [Project: LC The Stroll (reminiscence)](project_lc_stroll_feature.md) — Three response pathways (A: adjacent stub, B: wisdom reflection, C: non-destructive revision); sole input to wisdom_distillation synthesis
- [Project: LC five shareable artifacts](project_lc_shareable_artifacts.md) — Life Globe, Relationship Portrait, Period Narrative, Career Story, Wisdom Distillation; lens for synthesis prioritization
- [Project: LC Single Post Share](project_lc_single_post_share.md) — Token-in-URL share; shared view is an enrichment invitation, not passive display; comments route to review_queue
- [Project: LC extraction reliability & context-layer boundary](project_lc_extraction_reliability.md) — Orchestrator memories only extract entities if the model does its 2nd turn; finalize now backfills (commit 7ef6b96) + `backfill-memory-extraction.mjs`. Research/3rd-person "context" yields no personal entities by design — associating it needs the context-layer feature, not extraction

## Resolved-history (decisions and reviews, retained for the "why")

- [Decision: Phase 0 reframing (2026-05-31)](decision_phase0_reframing_2026-05-31.md) — Three-surfaces familiarisation model replaces three-stage sequential protocol; Life's Cast / Significant Relationships as MVP Timelines lead dimension; PRD v1.1; canonical spec at `documentation/feature_navigation_surfaces.md`

- [Project: LC pre-PRD decisions (resolved 2026-04-30)](project_lc_prd_readiness.md) — Seven decisions including video PRD retirement, marketing positioning, Phase 0 three-stage model, MVP synthesis pair
- [Project: LC architecture split — resolved](project_lc_architecture_split.md) — Voice/interview is primary; video deferred to Phase 2/3; schema-extensibility constraint
- [Project: LC April 2026 gap review (historical)](project_lc_gap_review_april2026.md) — All 14 gaps now closed; retained for the four MVP hypotheses and durable architectural lessons

## Reference & feedback

- [Reference: LC migration apply](reference_lc_migration_apply.md) — Claude applies Supabase DDL directly via `scripts/db-apply.mjs` (no dashboard paste / no CLI); needs `SUPABASE_DB_URL` + raw `SUPABASE_DB_PASSWORD` in `.env.local`
- [Reference: LC schema file locations](reference_lc_schema_files.md) — Where every design doc and early-planning file lives; what's read, what's pending
- [Reference: LC designer skills](reference_lc_designer_skills.md) — 48 UX/UI skills vendored into `.claude/skills/` (Owl-Listener subset) for Claude Code; source audit PDF in `documentation/research/`; TypeUI preset recommendation (Andy's brand call)
- [Project: LC document sources](project_lc_document_sources.md) — Google Drive vs. local folder; what's unique to each, what's redundant
- [Feedback: LC memory dual-write protocol](feedback_lc_memory_dual_write.md) — Every memory write must hit both auto-memory and the workspace mirror
- [Feedback: Use lowercase for folder and file names](feedback_folder_naming.md) — create-next-app and Unix tooling reject capitals
- [Feedback: never `npm run build` while `next dev` is live](feedback_lc_no_build_during_dev.md) — shared `.next` dir; building mid-dev clobbers the dev server (500s every route). Verify with tsc/eslint; recover via kill + `rm -rf .next` + restart
- [Feedback: origin/main backup auto-push](feedback_lc_origin_backup_autopush.md) — origin is a continuous backup; PostToolUse hook pushes after every commit. The global "don't push" rule is carved out here. Fixed a 122-commit/13-day drift found 2026-06-18
