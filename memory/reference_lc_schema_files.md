---
name: Life Chronicle — Schema File Locations and Document Inventory
description: Where schema/design files live and what each source document contains. Updated 2026-05-10 to reflect resolved next-steps and the deployed-schema state.
type: reference
originSessionId: focused-eloquent-thompson
---

## Schema & Design Files (workspace, current)

- `/Personal-Life-Chronicle/documentation/schema_v1.sql` — Full PostgreSQL schema (v1.3). Tables, indexes, PostGIS geospatial layer, temporal uncertainty model, residential scaffolding, semantic search functions. **Canonical source of truth for the data model.** Deployed via `supabase/migrations/20260505000000_initial_schema.sql`.
- `/Personal-Life-Chronicle/documentation/DB_Architecture_Design_v1.md` — Architecture rationale through April 2026: taxonomy, dual-layer Raw Vault + Synthesis design, platform selection, multi-agent architecture, geospatial globe vision, temporal agent, residential scaffold. Parts I–XVI complete; Part XVI is the Inngest orchestration decision.
- `/Personal-Life-Chronicle/documentation/Life_Chronicle_PRD_v1.docx` — PRD v1.1. Authoritative product spec.
- `/Personal-Life-Chronicle/documentation/access_cards_requirements.md` — Privacy model canonical spec.
- `/Personal-Life-Chronicle/documentation/feature_reminiscence_mode.md` — The Stroll feature spec.
- `/Personal-Life-Chronicle/documentation/LC_Development_Sequence.md` — 15-step ordered build plan. Steps 1–5 complete (see project_lc_build_progress.md).

## Local Project Root Files

- **`Personal-Life-Chronicle-PRD.docx`** (Feb 2026, video-first) — ARCHIVED to `documentation/archive/Personal-Life-Chronicle-PRD-video-first-Feb2026.docx` (resolved per prd_readiness Decision 1).
- **`README.md`** — Project overview; project is git-tracked (`main` branch).
- **`CLAUDE.md`** — Standing instructions and architectural invariants for every Claude session. Note: still says "four-stage Phase 0" — stale; canonical count is three (see project_lc_ontology_bootstrap).

## Local Early-Planning Documents (read April 2026, retained for reference)

Folder: `/Personal-Life-Chronicle/documentation/early-planning-gemini/`

- **Codex Strategy Doc and PRD for MVP.md** — 11-section architecture strategy + Option A MVP PRD. Covers voice capture loop, taxonomy/planner, 5-tier permissions (now superseded by Access Cards), CEF v1 export format, analytics funnel, security, 3-phase rollout.
- **Codex Strategy Doc.md** — Duplicate of strategy portion above.
- **Revised_MVP_PRD.md** — Gemini-revised MVP PRD. "Habit-first, value-always" philosophy, Anchor Sprint onboarding (superseded by three-stage Phase 0), Memory Map progress indicator, dark-mode aesthetic.
- **GPT-5-CODEX Recos.md** — GPT-5 review of MVP plan: simplification, long-term engagement mechanics, observability, cost controls.

Folder: `/Personal-Life-Chronicle/documentation/early-planning-v2/`

- **handoff-checklist.md** (Oct 2025) — Developer MVP build checklist; CEF v1 folder structure, JWT role_tier (superseded by Access Cards), Passkeys-first auth, cost guardrails.
- **Revised_PRD_v2.md** (Oct 2025) — Most complete pre-current-architecture PRD. Executor role, custom taxonomy with merge suggestion, voice-cloned public profile, KPI: 90-day retention ≥25%.
- **lovable-build-spec.v2.md** (Oct 2025) — Lovable.dev technical build spec; SLOs, tRPC namespaces.
- **cef-schema.json** (Oct 2025) — Formal JSON Schema (Draft 2020-12) for CEF v1 validation. **The canonical export specification.**
- **README_Import_Validation.txt** (Oct 2025) — Operational reference for taxonomy-seeder + AJV validation.

## Google Drive (Life Chronicle Asst folder, owned by andrewsbox@gmail.com)

- **MemRec Marketing Position and Messaging** (Oct 2025)
- **PRD Prompts for Life Chronicle** (Oct 2025)
- **LIFE CHRONICLE** (Jan 2024) — foundational doc
- **ChatPRD for Life Chronicle** (Feb 2024)
- **Gemini Taxonomy of Topics and Questions** (Oct 2025) — read April 2026; 8 chronological series; vehicle entity series and Financial Milestones added to schema as a result
- **first interview** (Jan 2024, 435KB) — large doc, likely real interview transcript. **NOT YET READ.** Priority: read when refining interview agent prompts beyond Step 5.
- **Andy Jyunmi & Beth, after DAS, Feb 8, 2024 VOICEMARKED** — voice-marked conversation between Andy, Jyunmi Hatcher, Beth Lyons. **NOT YET READ.**
- **WisdomTopicSort.xls** (2015) — original taxonomy; synthesized into the 10-axis dimension model. No need to re-read.

## Session Uploads (file gone, insight preserved)

- **`wiki vs open brain personal knowledge system.pdf`** — drove the dual-layer Raw Vault + Synthesis architecture. Insight in `project_lc_db_architecture.md`.
- **`Ontology-Driven Agents: The Missing Layer for Knowledge Apps.pdf`** (Nayan Paul, March 2026) — drove the ontology bootstrap protocol. Insight in `project_lc_ontology_bootstrap.md` and architecture doc Part IX.

## Resolved next-steps (formerly tracked here)

The original next-steps list (28 items) is now substantially resolved through PRD v1.1 + schema v1.3 + access_cards_requirements.md + Steps 1–5 of the build. The few remaining items are tracked in `documentation/LC_Development_Sequence.md` (Steps 6–15) and `project_lc_build_progress.md`.

## How to apply

When looking for the canonical version of something, prefer the workspace files in `documentation/` over the early-planning folders. Early-planning docs are retained for reference but several of their proposals have been superseded (5-tier privacy → Access Cards; Anchor Sprint → Phase 0; JWT role_tier → card-based JWT). When in doubt, check PRD v1.1.
