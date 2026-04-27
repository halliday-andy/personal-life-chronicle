---
name: Life Chronicle — Schema File Locations and Document Inventory
description: Where schema/design files live, what source documents exist and what each contains, so sessions don't need to rediscover or re-read unnecessarily
type: reference
originSessionId: focused-eloquent-thompson
---

## Schema & Design Files (workspace, always current)

- `/Personal-Life-Chronicle/documentation/schema_v1.sql` — Full PostgreSQL schema: tables, indexes, PostGIS geospatial layer, temporal uncertainty model, residential scaffolding, semantic search functions. The canonical source of truth for the data model.
- `/Personal-Life-Chronicle/documentation/DB_Architecture_Design_v1.md` — Architecture rationale covering all major design decisions through April 2026: taxonomy, dual-layer Raw Vault + Synthesis design, platform selection, multi-agent architecture, geospatial globe vision, temporal agent, residential scaffold.

## Local Project Root Files

- **`/Personal-Life-Chronicle/Personal-Life-Chronicle-PRD.docx`** — The February 2026 video-intelligence PRD (Thread 2 of the architectural split). Covers: facial recognition, video atomization, entity extraction from home video, Creative Edit Suite integration. NOT read in full — content known from architectural split memory. Read before any video/media-processing agent design work.
- **`/Personal-Life-Chronicle/README.md`** — Project overview: components and status (video editing in active dev, all others not started), key differentiators, 12-phase implementation plan (Phases 1–7 = video/Creative Edit Suite, Phases 8–12 = Life Chronicle features). Confirms the project is git-tracked (`main` branch, origin remote exists).

## Local Early-Planning Documents (read April 2026)

Folder: `/Personal-Life-Chronicle/documentation/early-planning-gemini/`

- **Codex Strategy Doc and PRD for MVP.md** — 11-section architecture strategy + Option A MVP PRD. Covers: voice capture loop, taxonomy/planner, permissions/tiering (5 tiers: Private/Close Friends/Family/Professional/Public), CEF v1 export format, analytics funnel, security, 3-phase rollout. Source: Codex/Gemini session.
- **Codex Strategy Doc.md** — Strategy-only portion of the above (duplicate content, no unique additions).
- **Revised_MVP_PRD.md** — Gemini-revised MVP PRD. Adds: "habit-first, value-always" philosophy, Anchor Sprint onboarding (3 mandatory opening prompts: Birthplace, First Career Milestone, Key Life Mentor), "Incomplete Queue" UX, "Memory Map" visual progress indicator, dark-mode premium aesthetic, 4-week build schedule.
- **GPT-5-CODEX Recos.md** — GPT-5 Codex review of MVP plan. Covers: feature evaluation, simplification (one-tap capture, smart defaults, memory sprints), long-term engagement mechanics (quarterly retrospectives, capsule collections), architecture assessment (background job orchestration, observability, cost controls).

**Key things in these docs NOT yet in schema_v1.sql (gaps to close):**
1. ~~Privacy tiering~~ — ✅ Completed April 2026
2. CEF v1 export format — ZIP with manifest + checksums; folder structure now specified (see handoff-checklist.md); companion cef-schema.json not yet found
3. Anchor Sprint onboarding sequence — superseded by four-stage Phase 0 Ontology Bootstrap Protocol (see project_lc_ontology_bootstrap.md)

## Google Drive Documents (project context links)

All owned by andrewsbox@gmail.com. Available via Google Drive connector.

- **MemRec Marketing Position and Messaging** (Oct 2025) — Marketing positioning doc for MemRec/Life Chronicle
- **PRD Prompts for Life Chronicle** (Oct 2025) — Prompts used to generate PRD content
- **LIFE CHRONICLE** (Jan 2024) — Early foundational doc from Jan 2024
- **ChatPRD for Life Chronicle** (Feb 2024) — ChatGPT-generated PRD, early version
- **Gemini Taxonomy of Topics and Questions** (Oct 2025) — READ April 2026. 8 chronological series: Early Life, Education, Career, Relationships, Health & Wellness, Creative & Personal Pursuits, Homes & Transitions, Financial Milestones. Key findings: (1) Strong alignment with WisdomTopicSort 10-axis model — 7 of 8 series map cleanly. (2) Two genuine additions: **Vehicle entity series** (cars/motorcycles/boats as owned artifacts with chronological history) added to entity_type enum; **Financial Milestones** elevated from incidental events to a named series comparable to career milestones. (3) Health & Wellness and Financial series → mark leaf dimension nodes `is_sensitive = true` in seed data.
- **first interview** (Jan 2024, 435KB) — Large doc, likely a real example interview transcript or full question set. NOT YET READ. Priority: read when designing interview agent prompts.
- **Andy Jyunmi & Beth, after DAS, Feb 8, 2024 VOICEMARKED** (Feb 2024) — Voice-marked transcript of a conversation between Andy, Jyunmi Hatcher, and Beth Lyons about the project. NOT YET READ.
- **WisdomTopicSort.xls** (2015) — The original taxonomy spreadsheet. Read and synthesized into the 10-axis dimension model in schema_v1.sql. Content is captured; no need to re-read unless refining dimension seed data.

## Local Early-Planning Documents — v2 folder (added April 2026)

Folder: `/Personal-Life-Chronicle/documentation/early-planning-v2/`

All five files READ April 2026. Novel findings in design doc Next Steps items 20–35.

- **handoff-checklist.md** (Oct 2025) — Developer MVP build checklist. Novel items: taxonomy_i18n/versions/prompts tables, sources/flags/audits tables, CEF v1 folder structure, privacy-safe RAG ordering, JWT role_tier claim, Passkeys-first auth, PostHog+OTEL funnel, cost guardrails.
- **Revised_PRD_v2.md** (Oct 2025) — Most complete pre-current-architecture PRD. 16 sections. Adds: Executor role (posthumous access, future 6th tier), user-defined custom taxonomy nodes with merge suggestion, voice-cloned public profile (60–90s), Deep Research opt-in (skeleton entries with citations), community flagging → admin queue, KPI: 90-day retention ≥25%.
- **lovable-build-spec.v2.md** (Oct 2025) — Technical build spec for Lovable.dev. Adds: SLOs (deep-link ≤2s TTFB, TTS ≤300ms cached, upload ≤10s LTE), tRPC API surface (entries/taxonomy/flags/export namespaces), `markIncomplete` and `mergeSuggestion` operations. Confirms 8 taxonomy series names matching Gemini Taxonomy.
- **cef-schema.json** (Oct 2025) — Formal JSON Schema (Draft 2020-12) for CEF v1 validation. THE canonical export specification. Key additions: `consent` object (voiceCloneAllowed, publicIndexingAllowed) per entry; `fuzzy` text field on Event for natural-language temporal uncertainty; taxonomy node `sensitivity` + `defaultTier` in export; `source` enum (user/linkedin/crawler). Validate all exports against this schema using AJV.
- **README_Import_Validation.txt** (Oct 2025) — Instructions for taxonomy-seeder tool and AJV-based CEF validation. No novel design content; operational reference only.

**Still not found:** `PRD_Addendum_MobileWeb_SMS.md`

## Session Uploads (ephemeral — file gone after session, insight preserved here)

- **`wiki vs open brain personal knowledge system.pdf`** (uploaded April 2026 session) — Video transcript comparing Karpathy's wiki approach (input-time AI synthesis, markdown files, single-agent) vs. OpenBrain structured database approach (query-time synthesis, concurrent multi-agent). This document directly drove the dual-layer Raw Vault + Synthesis Layer architecture decision. Key insight preserved in `project_lc_db_architecture.md`. File itself no longer available after session ended.
- **`Ontology-Driven Agents: The Missing Layer for Knowledge Apps.pdf`** (uploaded April 2026 session) — Medium article by Nayan Paul (March 2026). Drove ontology bootstrapping theory and four-stage Phase 0 protocol. Key insight preserved in `project_lc_ontology_bootstrap.md` and Part IX of DB_Architecture_Design_v1.md. File itself no longer available after session ended.
- **`Life_Chronicle_v2_docs.zip`** (uploaded April 2026 session) — Contained only `handoff-checklist.md` (see early-planning-v2 folder above). Copied to workspace.

## Next Steps (as of April 2026)

**Completed in April 2026 sessions:**
- ✅ 5-tier privacy model added to `memories`, `entities`, `relationships`, `media`, `syntheses`
- ✅ `compute_synthesis_tier()` trigger function (most-restrictive-source inheritance)
- ✅ Cascade trigger on memory privacy_tier changes
- ✅ RLS policy scaffold (commented activation stubs)
- ✅ `is_sensitive` flag on `dimensions` for auto-Private enforcement
- ✅ Part VIII (Privacy Architecture) added to DB_Architecture_Design_v1.md
- ✅ Gemini Taxonomy cross-referenced; vehicle entity and financial milestones incorporated

**Remaining (full list in DB_Architecture_Design_v1.md Next Steps items 1–28):**
1. Add connection group tables → activate RLS policies
2. Seed `dimensions` + `questions` tables
3. Read `first interview` Google Drive doc
4. Design full Phase 0 Ontology Bootstrap Protocol (four-stage)
5. Add `session_type` to `interview_sessions`
6. Design assumption log table + constraint rules table
7. Expand taxonomy tables (taxonomy_i18n, taxonomy_versions, taxonomy_prompts)
8. Add sources/flags/audits tables
9. Formalize CEF v1 export structure; locate cef-schema.json
10. Document privacy-safe RAG retrieval ordering as architectural constraint
11. Define JWT role_tier claim pattern
12. Confirm Passkeys-first auth strategy
13. Define PostHog + OTEL analytics funnel
14. Locate missing companion docs: Revised_PRD_v2.md, lovable-build-spec.v2.md, cef-schema.json, PRD_Addendum_MobileWeb_SMS.md
