---
name: Life Chronicle — Database Architecture Decisions
description: Key design decisions and their rationale for the LC database schema; prevents re-litigation in future sessions
type: project
originSessionId: focused-eloquent-thompson
---

Schema v1 established April 2026. Files in `/Personal-Life-Chronicle/documentation/`: `schema_v1.sql` and `DB_Architecture_Design_v1.md`.

**Platform:** PostgreSQL 15+ with pgvector, hosted on Supabase. Chosen over Neo4j, SurrealDB, and hybrid stacks because it handles all four required query types (semantic vector, structured SQL, graph traversal via recursive CTEs, full-text) in a single engine, and supports concurrent multi-agent write access natively.

**Why:** The multi-agent requirement (Capture, Tagger, Entity, Synthesis, Planner agents operating simultaneously) is decisive. The Karpathy wiki pattern presupposes a single writing agent and breaks under concurrent writes. Postgres row-level locking handles the rest.

**Dual-layer architecture (core principle):**
- **Raw Vault** (`memories` table): Append-only. `content_raw` is verbatim and never touched by the AI. AI editorial judgment is explicitly excluded from the source record.
- **Synthesis Layer** (`syntheses` table): AI-generated narratives and insights, always carrying full `source_memory_ids` provenance. Flagged as `is_current = false` when source memories change; a Synthesis Agent regenerates. User can always inspect raw material behind any synthesis.
- **Why this matters:** Adopted from the OpenBrain vs. Karpathy wiki discussion — neither pure wiki (input-time synthesis) nor pure database (query-time synthesis) alone is sufficient. Life Chronicle needs both narrative continuity AND precise queryability.

**Contradiction flagging:** `contradiction_flag` is a first-class `synthesis_type`. When two memories conflict, the system surfaces it for user review rather than silently resolving it. Tensions in a life story are often the most valuable data.

**Dimension taxonomy:** 10 orthogonal axes from WisdomTopicSort (life_stage, topic_domain, phenomenon_type, relationship_role, event_category, environment, emotional_tone, expressive_form, world_context, artifact_type). Stored as a self-referencing tree in `dimensions` table — new categories are a row insert, never a schema migration.

**How to apply:** When advising on schema changes or agent design, check against these principles first. Raw memories are sacrosanct. Synthesis is always derived and traceable. New life dimensions never require migrations.
