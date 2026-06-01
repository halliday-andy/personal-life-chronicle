# Life Chronicle — MVP Product Requirements Document

**Version 1.0 | April 2026**
**Status: Draft — all blocking decisions resolved**

---

## Table of Contents

1. [Product Vision and Value Proposition](#1-product-vision-and-value-proposition)
2. [Target User and Use Cases](#2-target-user-and-use-cases)
3. [Phase 0 Onboarding Flow](#3-phase-0-onboarding-flow)
4. [Feature Scope](#4-feature-scope)
5. [Core User Journeys](#5-core-user-journeys)
6. [Data Model Summary](#6-data-model-summary)
7. [Multi-Agent Architecture](#7-multi-agent-architecture)
8. [Privacy Model](#8-privacy-model)
9. [MVP Synthesis Artifacts](#9-mvp-synthesis-artifacts)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Open Questions and Risks](#11-open-questions-and-risks)

---

## 1. Product Vision and Value Proposition

### What Life Chronicle Is

Life Chronicle is a personal memory collection and chronicle system. Users record memories through AI-guided voice and text interviews; the system organizes them across ten dimensions of human experience, builds synthesis outputs (portraits, narratives, distillations), and presents them back through a navigable, ever-deepening life journey.

The system is simultaneously a personal archive and a living, growing record. It distinguishes itself from competitors not by asking better canned questions, but by continuously learning the shape of a person's life and deepening the record over time.

### Three-Layer Positioning

**Lead positioning (MVP):** Personal memoir and living legacy archive — organized memories for yourself and the people who matter to you. The differentiating claim against Memento, Storybook, and similar services is that Life Chronicle is a *living, ongoing system* rather than a one-time canned-question output. There is no AI framing required at this level; the product speaks for itself through what it produces.

**Secondary hook (MVP, vanguard users):** The digital twin — a continuously growing, structured representation of a person that deepens with every conversation. This frames the platform's ambition for early adopters who understand that a living archive compounds in value over time, distinguishing it from a printed memoir that is finished the moment it is produced.

**Reserved mission (Phase 2–3):** The agentic AI legacy. A fully realized Life Chronicle is the richest possible context for AI agents operating on a person's behalf — or for future systems that need to understand individual human experience at depth. The data model is built for this from day one. The messaging is held until the core memoir value is proven and a second wave of users is in scope. General public marketing does not attempt to compete on AI legacy (too abstract for a first encounter); the digital twin is the right intermediate hook for the vanguard segment.

### What the System Produces

Life Chronicle's value is delivered through concrete, shareable artifacts. These are not internal data structures; they are things a user might show a family member, return to on a birthday, or share as a piece of personal history. The MVP delivers two artifacts; subsequent phases expand the set. See Section 9 for detail.

---

## 2. Target User and Use Cases

### MVP Target User

The MVP targets technically comfortable adults who have accumulated a meaningful store of personal history — typically 40 and older — and who can engage with a web application, use SMS, and participate in AI-assisted interview sessions without friction. This is a vanguard segment, not the eventual mass market.

The MVP does not attempt to serve the least technically comfortable end of the potential audience. Voice-only phone access (for older adults with lower technical comfort) is deferred to Phase 2, when the core loop is validated and a broader user base is in scope. The user definition should reflect this choice throughout: features, UX copy, and onboarding assumptions are calibrated for an engaged early adopter, not a novice.

### Primary Use Cases

**Personal memoir:** The user wants to organize the memories they carry — sorting them, finding them again, reading them back in contexts that make sense of them. The system becomes the place where a life is held, not scattered across notes, photographs, and unaided recall.

**Legacy archive for family:** The user wants the memories that matter to survive them — or to be shared now with adult children, siblings, or a spouse. The chronicle becomes a gift, a way to transmit the texture of a life that would otherwise exist only in the user's head.

**Living record:** Unlike a memoir written once, the chronicle grows with every conversation. A memory captured today enriches syntheses already written about an earlier period. The system is never finished; it is always becoming more complete.

**Self-understanding:** The synthesis layer reveals patterns the user may not have seen — recurring themes across decades, the evolution of a relationship, the shape of a career arc. This is the benefit that becomes more valuable as the collection deepens.

### User Needs the System Must Satisfy

- Capture memories in whatever form they arrive — a conversation, a voice note, an SMS, a spontaneous recollection during a session
- Trust that what they shared is faithfully stored and never misrepresented
- Find memories again without knowing exactly what they're looking for
- Share specific memories or collections selectively, with people they choose
- Receive something meaningful back — an artifact, a portrait, a narrative — that justifies the investment of sharing
- Know the system is private by default, and that they control what others can see

---

## 3. Phase 0 Onboarding Flow

### Why Phase 0 Exists

Before memory collection can begin in earnest, the system needs a structural skeleton of the user's life: the broad temporal and geographic arc, the key people who populated it, and a map of which life domains matter most to this person. Without this skeleton, early memories float without context, and the first synthesis artifacts are too thin to be compelling.

Phase 0 is the ontology bootstrap — not a collection interview, but a structured elicitation of life structure. It is distinctly different in character from the memory interviews that follow.

### Session Model

Phase 0 is delivered across three discrete sessions, each approximately 15–30 minutes. Each stage is self-contained; the user receives a visible artifact on completing each one before the next is scheduled.

A single-session approach (one 60–90 minute upfront interview before any artifact appears) is explicitly rejected. The target user will not complete a session of that length without a reward before it ends. Three sessions of 20–30 minutes each, each closing with something to look at, is both more completable and more trust-building. The first artifact — the Life Globe — appears after the very first session.

### Why Chapter Naming Is Not Part of Phase 0

An earlier version of the Phase 0 design included a Stage 2 dedicated to asking the user to name the broad chapters of their life. This was removed.

The reason is practical: a person with a rich life history — say, someone in their 70s with multiple professional careers, extended family history, and many personal chapters — cannot usefully compress their story into named segments before any collection has occurred. There are too many chapters, and the natural vocabulary for naming them only emerges as the person begins to articulate their memories. Asking for chapter names upfront forces premature closure on a structure that should emerge from the material itself.

The residential arc and the relationship arc together provide sufficient organizational framing without requiring the user to impose chapter vocabulary early. Chapter structure will emerge from analysis once the collection is rich enough to support it. `user_periods` in the schema are populated in Phase 2, when the system can propose candidate chapter structures derived from actual collection data, which the user then reviews, names, and confirms.

### Stage 1: Temporal Skeleton

The first session establishes the residential history and broad life arc. The Temporal Agent builds this first because it is the most powerful temporal scaffold available: every home in a residential sequence generates bilateral constraints that anchor all other memories. The session asks where the user has lived and in what sequence, confirming approximate dates or relative orderings. It does not demand precise years.

**Session output (artifact):** The Life Globe — a 3D navigable globe rendering the residential and significant-place history assembled so far, with a temporal transit animation tracing the geographic path of the user's life. The globe is sparse but real; it shows what the system has learned. Hovering on a stop surfaces a place portrait. The transit animation moves through the residential chain chronologically, dwelling proportionally to time spent — a biography of movement from the very first session.

### Stage 2: Entity Seed

The second session populates the entity graph with the key people who have populated the user's life. The system asks who the significant people were across life stages: family, friends, mentors, partners, colleagues. It does not attempt completeness; it seeks depth on the people who will appear most often in subsequent collection interviews. The residential arc from Stage 1 provides natural prompting structure — for each place the user lived, who was there?

**Session output (artifact):** An entity portrait of one key person named during the session — a synthesized biographical sketch of that relationship, drawn from everything captured so far. This is the first demonstration of what the synthesis layer does: it writes about a real person from the user's life in language the user will recognize as capturing something true. Even with sparse data, an entity portrait is compelling when it reflects who someone was and the role they played.

### Stage 3: Topic Map and Life's Players

The third session maps which life domains have the richest material to explore and which are under-represented. It identifies the topic areas the user most wants to explore — career, family, travel, a particular relationship — and produces a coverage profile that the Planner Agent uses to schedule subsequent collection interviews.

**Session output (artifact):** Life's Players — the `lifes_cast` synthesis across all entities named in the entity seed. A time-series view of the significant people who played roles in the user's life: who was present at which life stages, how the cast of central figures evolved from the earliest remembered relationships through to the present. This closes the onboarding loop. The user entered Phase 0 with a residential map and a handful of named people; they exit with their first view of the relational arc of their life. It makes the chronicle feel inhabited.

### Why Globe and Life's Players Form the Right Opening

The two primary Phase 0 artifacts occupy complementary dimensions. The Globe is spatial and temporal: where were you, in what order, for how long. Life's Players is relational and temporal: who was with you, in what capacity, at which stages. Together they provide a two-axis orientation to the life that is simultaneously objective and deeply personal. They do not require the user to have articulated anything abstract about the shape of their life — only to have named the places they lived and the people who mattered.

Chapter structure, which requires a more interpretive act, emerges later when the system has material to interpret.

---

## 4. Feature Scope

### MVP Scope

The MVP delivers a complete, working version of the core loop: capture → organize → synthesize → share. Every feature listed here is required for the MVP to demonstrate its core value proposition.

**Capture channels:** Web application (desktop and mobile-web), SMS async capture. These are two distinct modalities. The web app supports full interview sessions — guided, multi-turn AI conversations. SMS supports asynchronous capture — the user sends a memory fragment or voice note via SMS and it is ingested, tagged, and linked to the growing collection without requiring a formal session.

**Phase 0 onboarding:** Three-stage ontology bootstrap as described in Section 3. Required before memory collection begins.

**Memory collection interviews:** Guided AI interview sessions on the web app. The Capture Agent conducts structured but conversational interviews, drawing on the coverage profile built in Phase 0 to explore under-represented life domains. Session topics emerge from the Planner Agent's scheduling.

**Entity graph:** Entities (people, places, organizations, artifacts) created and maintained by the Entity Agent. Confirmed by the user. Relationships between entities stored as typed, temporal edges.

**Temporal Agent:** Continuous background operation. Builds the temporal constraint graph from residential history first, then progressively narrows uncertainty envelopes through constraint propagation and proactive temporal clarification questions. Never asks for years directly.

**Dimension tagging:** All ten WisdomTopicSort dimensions applied to every memory by the Tagger Agent. Enables faceted navigation across life stages, topic domains, relationship roles, emotional registers, and the other seven axes.

**Synthesis layer:** Two synthesis artifacts delivered in MVP (see Section 9): the Life Globe (place portraits + temporal transit animation) and Life's Players (the `lifes_cast` time-series of significant people). The Synthesis Agent generates and maintains these; invalidated syntheses are regenerated when source memories change.

**Access Cards privacy model:** Five system cards pre-seeded for every user (Private, Close Friends, Family, Professional, Public). Custom card creation is Phase 2. Share Cards as the user-facing sharing primitive. View permission on share cards in MVP; Contribute permission in Phase 2. Full schema from day one; UI exposes system cards only at MVP.

**Social sharing and comment capture:** Users can share individual memories or artifacts via social media channels or direct link. The system records share events and captures comments from recipients. Comments are attributed and stored linked to the share instance; they are visible to the owner in a separate view and do not auto-enter the chronicle.

**Review queue:** Contributions and flagged items queue for owner review. Owner accepts, modifies, or rejects before anything enters the canon.

**Semantic and structured search:** The Search Agent serves queries across the full schema — semantic similarity (vector search), structured/relational (SQL), full-text (tsvector), and graph traversal (recursive CTEs). Accessible via a search interface in the web app.

### Phase 2 Scope (Not MVP)

The following features are deferred to Phase 2. They are architecturally anticipated in the schema and agent design but are not required for MVP launch.

- Voice-only phone capture channel (accessibility; serves less technically comfortable users)
- Custom share card creation (beyond the five system cards)
- Contribute permission on share cards (card holders adding embellishments and additional memories to the owner's review queue)
- Contributor file attachments on contributions (images and media)
- The Stroll — reminiscence and re-engagement mode, presenting curated memories back to the user as narrated experiences with three response pathways (adjacent stub, reflection, revision)
- Relationship Portrait synthesis (`relationship_portrait`) — a compiled narrative of a single significant relationship across the user's life
- Chapter naming and `user_periods` — asking users to define broad life chapter segments before collection has occurred is impractical; chapter structure is proposed by the system after sufficient collection and confirmed by the user
- Chapter narrative synthesis (`life_period_narrative`) — a prose chapter of a user-named life period; deferred because it requires both richer collection and confirmed user_periods to avoid feeling thin
- Video capture as a modality during Stroll or interview sessions
- Wisdom Distillation synthesis (`wisdom_distillation`) — extracted lessons and insights; requires The Stroll's reflection pathway as its primary input
- Career Story synthesis — structured arc of the user's professional life, drawing on topic_synthesis and employer entity biographies
- Wisdom Distillation artifact surfacing to the user

### Phase 3 Scope

- Processing of existing video archives: atomization, highlight extraction, attachment of video excerpts to memory records
- Facial recognition in video and photo archives (deferred for ethics and complexity reasons)
- Agentic AI legacy features — full chronicle as context for AI agents operating on the user's behalf

---

## 5. Core User Journeys

### Journey 1: First Contact Through First Artifact (Phase 0)

The user signs up, lands in the web application, and begins Phase 0 Stage 1. The Capture Agent conducts a conversational residential history interview — where they grew up, where they moved, key places in their life. The session is 15–25 minutes. At the end, the Life Globe renders their geographic life path. The user can navigate it, see the places marked, watch the temporal transit animation move through their life chronologically.

Before leaving, the system schedules Stage 2 and offers an SMS number the user can message between sessions when a memory comes to them.

The user returns for Stages 2, 3, and 4 across subsequent days. After Stage 4, they receive their first chapter narrative — a draft of their earliest life period in prose.

### Journey 2: Ongoing Memory Collection

After Phase 0 is complete, the Planner Agent schedules regular collection sessions based on the coverage profile. Sessions explore specific life domains, life stages, or entity relationships that are thin in the collection. Between sessions, the user texts memories to the SMS number; these are ingested, tagged, and integrated. Over time, as the collection grows, syntheses deepen and artifacts become richer.

### Journey 3: Sharing a Memory

The user navigates to a memory or artifact in the web application and chooses to share it. They select a share card (which controls access) or share via a social media post or direct link. The recipient receives access to the shared content. If the recipient has a comment to make, they can leave it; the owner sees it in their notifications and comment view. The comment does not alter the chronicle.

### Journey 4: Temporal Clarification

The Temporal Agent identifies a cluster of fuzzy memories from the user's early career that lack precise placement. It composes a short temporal clarification session — three questions, each anchored to a concrete event the user will remember ("Did this happen before or after you moved to Chicago?"). The user confirms or declines each. On confirmation, the constraint propagates through the graph, sharpening the timeline around that cluster. The user sees the timeline band narrow in the visualization.

### Journey 5: Synthesis Discovery

The user opens the Life's Players artifact — the time-series of significant people across their life. The system has organized their relationships chronologically, from the earliest remembered people through to the present central figures. The user reads the portrait of a mentor they had in their thirties — someone they had not thought about in years — and is prompted to capture more memories of that relationship. The artifact triggers a new collection thread.

---

## 6. Data Model Summary

The database is PostgreSQL 15+ with the pgvector, PostGIS, pg_trgm, and uuid-ossp extensions, hosted on Supabase. The full schema is in `documentation/schema_v1.sql`. This section summarizes the conceptual architecture.

### Six-Layer Structure

**Taxonomy layer:** `dimension_types` and `dimensions` — the WisdomTopicSort ten-axis category tree, stored as a self-referencing hierarchy. New dimensions can be added at any depth without schema migration (row insert, not ALTER TABLE).

**Entity graph:** `entities` and `relationships` — people, places, organizations, concepts, artifacts, and vehicles as first-class nodes. Relationships are typed, directed, temporally bounded edges. Place entities carry PostGIS geometry for the globe visualization. The entity graph enables genuine graph queries across the life — who appeared in both my early career and my romantic life, which places connect to which people.

**Raw Vault:** `memories` — append-only records of every captured memory. `content_raw` is verbatim and never modified after creation. The Raw Vault is the architectural invariant: all corrections go through `memory_revisions`; synthesis never writes back to source records. Each memory carries a 1536-dimensional semantic embedding, temporal uncertainty envelope fields, provenance, and confidence level.

**Tagging layer:** `memory_dimensions`, `memory_entities`, `memory_media` — junction tables linking memories to the taxonomy, entity graph, and media files. The Tagger Agent writes here; the user can review and correct.

**Synthesis layer:** `syntheses` — AI-generated narratives, portraits, and insights. Every synthesis record lists every source memory ID it drew from (full provenance). When source memories change, the synthesis is flagged `is_current = false` and regenerated. Contradiction flags are a first-class synthesis type — conflicts between memories are surfaced explicitly rather than silently resolved.

**Query layer:** Semantic search functions, the `life_journey` view and `life_journey_geojson()` function (for the globe), the `timeline_with_uncertainty` view, coverage tracking, and the temporal constraint graph.

### Key Tables Beyond the Core

`interview_sessions` — records of every capture session, including type, agent model, and session metadata.

`temporal_constraints` — the constraint graph: typed ordering relationships between memories (before, after, concurrent, during, same_trip, etc.), with confidence scores and provenance (user_stated, user_confirmed, agent_inferred, transitive).

`stroll_sessions`, `reflections`, `memory_revisions` — Phase 2 tables for The Stroll feature, present in the schema from MVP to allow seamless Phase 2 enablement. `reflections` is the sole input to the `wisdom_distillation` synthesis type.

`cards`, `contacts`, `card_holders`, `record_card_grants`, `synthesis_visibility_cache`, `card_audit_log`, `access_log` — the Access Cards privacy model (see Section 8).

`memory_shares`, `share_comments` — social sharing and comment capture.

`coverage` — tracks which dimension × entity combinations have been collected against, used by the Planner Agent to schedule sessions.

### Schema Additions Pending

The following tables and schema changes are decided but not yet written into `schema_v1.sql`. They should be added before development begins:

- `lifes_cast` added to the `synthesis_type` enum on `syntheses`
- `can_contribute` field (boolean) on `record_card_grants`, or a separate grant type for contribution permission
- `contributor_id` (UUID, nullable) on memory entries that arrive via contribution
- `memory_shares` table (memory_id, share_card_id, channel enum, shared_at, share_url)
- `share_comments` table (share_id, recipient_identity nullable, comment_text, created_at)
- Future: `contribution_attachments` (contribution_id, blob_key, mime_type, created_at)

---

## 7. Multi-Agent Architecture

Life Chronicle is built on a multi-agent architecture where each agent has a distinct responsibility and a distinct primary table or table set. Agents can run concurrently without coordination overhead because they write to different parts of the schema, and PostgreSQL row-level locking handles concurrent writes naturally.

### The Agents

**Capture Agent** — Conducts interview sessions (voice or text), produces `memories` records and `interview_sessions` records. Writes raw content faithfully; never synthesizes. The Capture Agent is the sole author of the Raw Vault. In Phase 2, also handles The Stroll sessions, producing `stroll_sessions` records.

**Tagger Agent** — Reads new untagged memories (where no `memory_dimensions` rows exist yet) and produces dimension tags, entity links, and media associations. Runs concurrently with the Capture Agent. Tags are stamped with `assigned_by = 'agent'`; the user can review and correct. Confidence scores on tags allow the user interface to surface low-confidence tags for review.

**Entity Agent** — Detects new entities mentioned in memories (people, places, organizations, artifacts). Creates or updates `entities` records. Proposes new `relationships` between entities and coordinates with the user to confirm relationship claims before they are committed. Also handles geocoding of place entities: resolves place names to PostGIS geometry via OpenStreetMap Nominatim or Google Maps Geocoding, stores `external_geo_id`, `geom`, `country_code`, and `timezone`.

**Planner Agent** — Reads `coverage` records to identify which dimension × entity × life-stage combinations are thin or unexplored. Schedules the next collection session. Interleaves temporal clarification sessions with memory collection interviews to ensure the timeline sharpens as the collection grows. Writes to `coverage.next_prompt_at` and `coverage.last_prompted_at`. Does not capture or synthesize; coordinates the work of the other agents.

**Temporal Agent** — Maintains the temporal constraint graph. Builds the residential spine first (bilateral constraint-generation from sequential home records). Proactively identifies fuzzy memories and generates targeted relational questions to narrow their uncertainty envelopes. Parses user responses, creates `temporal_constraints` records, and calls `propagate_temporal_constraints()` to push inferences outward. Surfaces conflicts as `contradiction_flag` synthesis records for user review. Never asks for a year directly; always anchors questions to concrete events the user will recognize.

**Synthesis Agent** — Monitors for invalidated syntheses (`is_current = false`). Reads the relevant source memories (always JOINing `memory_revisions` to get the latest revision-aware content before rendering). Generates new synthesis content, writes a new `syntheses` record with full source provenance (every contributing memory ID). Computes and maintains `synthesis_visibility_cache` for Access Cards visibility rules. In Phase 2, runs the `reflections → wisdom_distillation` pipeline.

**Search Agent** — Serves semantic and structured queries against the full schema. Read-only. Supports four query modes: semantic similarity (pgvector cosine distance), structured/relational (SQL with dimension/entity/temporal filters), full-text (tsvector on `content_raw`), and graph traversal (recursive CTEs across the `relationships` table).

**Timeline Agent** — Lightweight. Refreshes the `timeline` materialized view after memory inserts. Ensures the timeline view used by the web application is current without requiring expensive live computation on every page load.

### Agent Coordination

Agents communicate through the database state rather than through a message queue. The synthesis invalidation mechanism (`invalidated_at`, `is_current` on `syntheses`) is the primary signal: when the Tagger or Entity Agent changes data that a synthesis depends on, the synthesis is marked stale and the Synthesis Agent picks it up on its next cycle. This provides eventual consistency without requiring a message broker in v1.

The Planner Agent reads the outputs of the Tagger Agent (coverage) and the Temporal Agent (resolution queue) to schedule work. No direct agent-to-agent calls are required.

When the relationship graph grows large enough that recursive CTE performance degrades (estimated threshold: ~500,000 edges per user), the architecture should introduce Apache AGE (a PostgreSQL graph extension) on a read replica before reaching for a separate graph database. The raw vault and synthesis layer remain in the primary PostgreSQL instance.

---

## 8. Privacy Model

### Architectural Principle

Privacy in Life Chronicle is controlled by the Access Cards framework. The legacy `privacy_tier` ENUM (private / close_friends / family / professional / public) is deprecated and scheduled for removal in the Access Cards migration. No new code should depend on `privacy_tier` columns. All new privacy work targets the cards framework.

The canonical technical specification is `documentation/access_cards_requirements.md`.

### Access Cards Fundamentals

A **share card** is a named permission grant created by the chronicle owner. It defines a scope (which records it unlocks) and is held by zero or more contacts. The owner-viewer relationship is mediated entirely through card possession.

Five system cards are pre-seeded for every user on account creation: Private, Close Friends, Family, Professional, and Public. These emulate the legacy ENUM tiers. System cards cannot be deleted but can be renamed and edited freely. Custom card creation — user-defined cards with arbitrary scope rules and holders — is a Phase 2 feature.

**Default deny:** New records have no card associations. The owner sees all their own content. A card holder sees only what their card explicitly grants. There is no ambient visibility.

**Scope rules:** A card's scope is defined by any combination of: time band, user periods, life stages, dimension tags, entity references, place references, explicit memory IDs (includes and excludes). Within an axis, scope rules combine with OR. Across axes, rules combine with AND. An empty scope grants access to all owner content.

**Sensitive auto-isolation:** Memories tagged with sensitive dimensions receive an `auto_isolate` grant against every active card. The owner must explicitly remove auto-isolation before any card can grant access. Sensitive-flagged content cannot accidentally be shared.

**Synthesis visibility:** A synthesis is visible to a card holder if and only if every source memory it draws from is visible to that card. Synthesis visibility is computed and materialized in `synthesis_visibility_cache`.

**Time-banded validity:** Cards can have validity windows (distinct from scope time bands). A card can be active for a limited period — for example, granting a researcher access to a defined set of memories for six months.

### MVP Permission Levels on a Share Card

MVP exposes two permission levels:

**View** — the card holder can see the scoped content.

**Contribute** (Phase 2) — the card holder can add embellishments, additional memories of shared events, or details the owner did not have. Contributed content does not auto-ingest into the Raw Vault. Contributions arrive as attributed, staged entries with `contributor_id` preserved and enter the owner's review queue. The owner accepts, modifies, or rejects each contribution before it becomes part of the canon.

### Notification and Distribution Policy

When a chronicle owner shares a memory or artifact, the primary distribution mechanism may be social media — a post that links card holders or recipients to the content. The share post itself is the notification; no separate in-platform "you have been added as a card holder" message is required at MVP.

When a card holder arrives via a shared link, they see what their card grants on login. Scope is revealed on arrival, not before.

**Comment capture:** When a memory or artifact is shared via social media or direct link, recipients may leave comments. Comments are attributed (email, social handle, or anonymous as available) and stored in `share_comments` linked to the `memory_shares` record for that share event. Comments are visible to the owner in a dedicated view. Comments do not enter the chronicle.

Future (Phase 2+): contributors with contribute permission will be able to attach images or files to their contributions. `contribution_attachments` table anticipated in the schema.

---

## 9. MVP Synthesis Artifacts

### Synthesis Philosophy

The synthesis layer exists to make the collection legible and emotionally resonant — not just stored. The two MVP artifacts were chosen to work well with the data available after Phase 0 and early collection, while being compelling enough to justify the onboarding investment. Both artifacts are living: they update automatically as new memories are added.

### Artifact 1: The Life Globe

**Internal synthesis type:** `entity_biography` (for place entities)
**User-facing name:** Life Globe / Life Journey

The Life Globe is the first artifact the user receives — delivered after Phase 0 Stage 1. It is a 3D navigable globe where the user's residential and significant-place history is rendered as a weighted geographic journey. Each place is marked proportionally to the density of memories anchored there. Pausing on a stop surfaces a synthesized portrait of that period and place.

**Temporal transit layer:** A chronological animation traces the user's geographic path through life — camera moving between significant places in sequence, dwelling proportionally to time spent. This turns the globe from a map into a biography of movement. The animation is powered by `life_journey_geojson()`, an existing function in the schema that returns the journey as a GeoJSON FeatureCollection ordered chronologically.

The temporal transit layer is a UX enhancement on top of existing infrastructure — no new synthesis type is required. The animation reads `days_at_place` from the journey view to compute dwell time proportionally.

**Technology:** Cesium.js for the 3D globe (handles WGS84 natively, supports terrain rendering, has a rich entity API). Mapbox GL JS as a 2D/2.5D map alternative. Place entities in the schema carry PostGIS geometry (`GEOGRAPHY(GEOMETRY, 4326)` on the `entities` table) and a GiST spatial index. Entity Agent handles geocoding on place entity creation.

### Artifact 2: Life's Players

**Internal synthesis type:** `lifes_cast` (new type, not yet in schema — to be added to the synthesis_type enum)
**User-facing names:** Life's Players, Life's Cast, Life's Cast and Characters

Named for the Shakespeare passage from *As You Like It*, Act II Scene VII: *"All the world's a stage, and all the men and women merely players; they have their exits and their entrances."*

Life's Players is a time-series progression of the significant people who played roles in the user's life — from the earliest remembered relationships through to the present central figures. It shows how the cast of central figures evolved across life stages: who was present at each chapter, who entered and who exited, who remained central across decades.

This is distinct from the `relationship_portrait` synthesis type (which goes deep on one relationship). Life's Players is broader and temporal — it is the ensemble view, not the solo portrait. It draws on the entity seed from Phase 0 Stage 3 and requires only temporal placement of key entities, not dense per-relationship memory collection. It works well with MVP-level data.

**Key design principle:** The artifact accommodates relationships of any duration. A lifelong spouse and a formative three-year mentor are equally valid players. Duration is not the criterion; significance at the time is. The Synthesis Agent weights by `role_significance` and the density of memories featuring each entity within a life stage, not by relationship length.

**Why chapter narrative was deferred:** The `life_period_narrative` synthesis type (period narrative / memoir chapters) requires a richer collection to avoid feeling thin. With only Phase 0 data and early collection, a chapter narrative risks generating prose that the user will find sparse or generic. Life's Players works at lower data density because it is organized around the names and faces the user already gave the system in Stage 3 — it feels personal from the first render. Chapter narrative is reserved for Phase 2 when the chronicle has real depth.

---

## 10. Non-Functional Requirements

### Data Integrity

The Raw Vault is immutable. `memories.content_raw` is never modified after creation. All corrections and revisions go through the `memory_revisions` table. Synthesis agents must JOIN `memory_revisions` before rendering any memory content to ensure they operate on the latest revision-aware version. This is a hard requirement with no exceptions.

The Synthesis Agent produces a new synthesis record on refresh rather than overwriting the old one. The history of synthesis versions is preserved and inspectable.

### Privacy and Security

Row Level Security (RLS) policies on Supabase enforce per-user data isolation at the database level. The application layer never bypasses RLS for content reads. JWT tokens carry held card IDs per owner, enabling efficient card-based access checks without full database queries on every request.

All memory content is encrypted at rest. Media files are stored in Supabase Storage with user-scoped access controls.

### Performance

Target response times for the web application: page loads under 2 seconds; search results under 1 second for semantic queries on collections up to 10,000 memories; globe rendering initial load under 3 seconds.

Vector index (IVFFlat on embeddings): switch to HNSW index (available in pgvector 0.5+) when collections exceed approximately 1 million embeddings per user. HNSW provides better recall at scale.

Spatial index (GiST on PostGIS geometry): supports fast bounding-box and radius queries. `memories_within_radius()` function executes against the index; no full table scan.

The `timeline` materialized view is refreshed by the Timeline Agent after memory inserts rather than recomputed on every page load.

### Scalability

The architecture supports concurrent multi-agent write access natively — Capture, Tagger, Entity, and Planner agents can all write simultaneously without coordination overhead because they write to different tables, and PostgreSQL row-level locking handles the rest.

When the relationship graph exceeds approximately 500,000 edges per user and recursive CTE performance degrades, the recommended path is Apache AGE (a PostgreSQL graph extension) on a read replica, before reaching for a separate graph database.

### Channels

MVP channels: web application (desktop and responsive mobile-web), SMS async capture. Both channels ingest into the same Raw Vault and share the same session history. SMS ingestion extracts content, creates a `memories` record with `source_type = 'sms'`, and queues it for Tagger Agent processing.

### Auditability

Every synthesis record carries: the model and prompt hash used to generate it, the full list of source memory IDs, the generation timestamp, and whether it has been reviewed by the user. The `card_audit_log` and `access_log` tables record all share card changes and content access events for the owner's review.

---

## 11. Open Questions and Risks

### Remaining Schema Work

The schema additions identified in Section 6 must be completed before development begins. In particular, `lifes_cast` must be added to the `synthesis_type` enum, and the `memory_shares` / `share_comments` tables must be added for social sharing and comment capture.

### Access Cards Migration

The migration from `privacy_tier` ENUM to the Access Cards schema is documented in `documentation/access_cards_requirements.md` (§9). This migration must be planned and sequenced carefully — it is a breaking change to the privacy enforcement layer. The five system cards must be pre-seeded for every user at account creation, and existing `privacy_tier` values must be mapped losslessly to system card associations. Migration sequencing is an open question.

### Entity Agent Geocoding Reliability

The Entity Agent depends on geocoding APIs (OSM Nominatim or Google Maps) to resolve place names to PostGIS geometry. Historical places that no longer exist as named (military bases that closed, neighborhoods that were renamed) require manual coordinate entry. The threshold for triggering user confirmation vs. automatic resolution needs to be established. Over-triggering confirmation requests will frustrate users; under-triggering will produce quietly incorrect geography.

### The Stroll Feature Dependency on Collection Depth

The Stroll (Phase 2) — reminiscence mode — requires a collection rich enough that the curation engine can select memories that are genuinely evocative rather than thin. Defining the minimum collection threshold for enabling The Stroll is an open question. It may be a function of memory count, coverage across life stages, or both.

### Contribution Permission and Review Queue UX

The Contribute permission on share cards (Phase 2) introduces a review queue workflow that does not exist in MVP. The UX for the owner's review queue — accepting, modifying, or rejecting contributions — needs to be designed carefully to avoid creating a burden that discourages sharing. Contribution volume could become overwhelming if cards are broadly assigned.

### Cold-Start Problem for Synthesis Quality

Life's Players and the Life Globe are compelling at any data density. But early users who complete Phase 0 and only a few collection sessions may find that the system's synthesis quality is modest until the collection reaches a meaningful threshold. Managing expectations around synthesis quality in the early weeks of use — and communicating clearly that the system deepens over time — is a product marketing and onboarding risk.

### Competitive Response

The primary competitors (Memento, Storybook, traditional memoir apps) do not currently offer a living, AI-assisted chronicle system. However, the space is attracting investment. The MVP must ship quickly enough to establish a user base and a data moat before better-resourced competitors build toward this vision.

### Temporal Agent Conversation Quality

The Temporal Agent's effectiveness depends on generating questions that feel natural rather than interrogative. The example question patterns in the architecture document are a starting point, but the agent's prompt engineering and conversation evaluation need dedicated iteration. A temporal clarification session that feels like homework will see user dropout; one that feels like collaborative reconstruction of the past will succeed.

---

*This document reflects decisions made through the April 2026 decision session. All seven blocking decisions are resolved. Next step: schema additions (Section 6), then development planning.*

*Related documents:*
- *Schema: `documentation/schema_v1.sql`*
- *Architecture: `documentation/DB_Architecture_Design_v1.md`*
- *Access Cards: `documentation/access_cards_requirements.md`*
- *The Stroll: `documentation/feature_reminiscence_mode.md`*
- *Decision log: `memory/project_lc_prd_readiness.md`*
