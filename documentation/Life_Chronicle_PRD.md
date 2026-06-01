# Life Chronicle — Product Requirements Document

**Version 1.1 · May 2026**
**Status:** Draft for Review (revised)
**Owner:** Andy Halliday

> v1.1 (2026-05-31) replaces §3, the §4 feature table, §5 Journey 1, the §6.3 review_queue spec, and §9 to incorporate the navigation-surfaces reframing captured in [`feature_navigation_surfaces.md`](feature_navigation_surfaces.md). v1.0 .docx archived at `archive/Life_Chronicle_PRD_v1.docx`.

This document specifies the requirements for the Life Chronicle MVP — a 3–4 month build targeting a technically comfortable adult audience (40+) who want to collect, organize, and selectively share their personal history. All seven pre-PRD decisions were resolved on 2026-04-30. This PRD crystallizes those decisions into a buildable specification.

# 1. Product Vision and Value Proposition

## 1.1 The Core Problem

Every person alive is accumulating more experience than they can hold. The events, relationships, insights, and moments that constitute a well-lived life exceed any individual's capacity to recall, organize, or recount them — let alone share them meaningfully with the people they love. The result is that most lives are substantially lost, not because they were not richly lived, but because the record was never made.

Life Chronicle is the system that makes the record.

## 1.2 Value Proposition — Three Layers

The value proposition is delivered in three layers, each appropriate to a different point in the product's maturity and the user's trust.

### Layer 1 — Lead (MVP)

| **Personal Memoir and Living Legacy Archive** Your life, organized and remembered — for yourself and the people who matter to you. |
| --- |

This is the opening message. It is personally recognizable, emotionally honest, and non-technical. It makes no AI claims it doesn't immediately demonstrate. The differentiating word is living: Life Chronicle is a continuously growing, ongoing system — not a one-time interview output like Memento or Storybook. It never stops getting richer.

### Layer 2 — Secondary Hook (MVP, vanguard users)

| **The Digital Twin** A continuously growing, structured representation of your life that deepens every time you add to it. |
| --- |

The digital twin framing speaks to early adopters who understand that a living, structured archive is fundamentally more valuable than a printed book. It gives a mental model for the platform's long-term ambition without requiring AI-agent framing that many users are not yet ready to receive. It also positions Life Chronicle as a durable investment — something that compounds — rather than a one-time product.

### Layer 3 — Reserved Mission (Phase 2–3 only)

| **The Agentic AI Legacy** A fully realized chronicle as the richest possible context for AI agents operating on a person's behalf — now and in the future. |
| --- |

The data model is already built for this. The messaging is held until the core value is proven, because general-public marketing should not attempt to compete on AI legacy (too abstract). When the product has a large enough installed base of engaged users with deep chronicles, this third layer becomes the most differentiated claim in the market.

## 1.3 Competitive Positioning

|   | **Life Chronicle** | **Memento / Storybook** | **Social Media Archives** |
| --- | --- | --- | --- |
| **Living / ongoing** | ✓ Continuously updated | ✗ One-time interview | Partial — but unstructured |
| **AI-structured** | ✓ Tagged, synthesized, navigable | ✗ Flat export | ✗ No synthesis |
| **Privacy-first** | ✓ Default deny, card-based | Partial | ✗ Designed for broad sharing |
| **Temporal intelligence** | ✓ Fuzzy-date model, constraint graph | ✗ | ✗ |
| **Shareable artifacts** | ✓ Globe, Life's Players | Partial | Feed posts only |

# 2. Target User and Use Cases

## 2.1 MVP Target User

The MVP targets technically comfortable adults, likely between 40 and 75 years of age, who:

- Have accumulated enough lived experience to feel the weight of what is not being captured or organized
- Can navigate a modern web application, receive and respond to SMS messages, and engage comfortably with AI-assisted interview sessions
- Have enough retrospective material — relationships, career history, geographic history, significant events — to make Phase 0 meaningful in one or two sessions
- Are motivated by either personal legacy (organizing their own story for themselves) or family legacy (preserving their story for their children and grandchildren)

This user does not require voice-only phone access. The MVP does not attempt to serve the least technically comfortable segment. That expansion is Phase 2 when the core loop is validated.

## 2.2 Primary Use Cases

- Organize and preserve personal history for private access — the user's own story, searchable and navigable, available any time they want to revisit it
- Create a living legacy record for their children and grandchildren — structured, rich, and shareable on their own terms
- Understand patterns in their own life — who the significant people were, how their world moved geographically, how relationships and career evolved across decades
- Share selected memories and artifacts with specific people they trust, using the Share Card permission model
- Leave a meaningful, durable record that survives them — organized in a way that captures not just what happened, but what it meant

## 2.3 Out of Scope for MVP

- Users who require voice-only phone capture (deferred to Phase 2)
- Users under 30 with shallow retrospective material (insufficient Phase 0 content for meaningful artifacts)
- Enterprise or institutional chronicling (Phase 3)
- Family-to-elder capture mode — one person recording another person's story (schema supports it via subject_user_id, but the UX is Phase 2)

## 2.4 Hypotheses the MVP Must Test

| **ID** | **Hypothesis** | **Success Indicator** |
| --- | --- | --- |
| H1 | Non-technical adults activate within the three-surfaces model and return for ongoing capture | ≥60% of users who place a first residential pin return for a second capture session (any surface) within 14 days; ≥40% engage in three or more capture sessions within the first 30 days. *(v1.1 replaces the original stage-completion metric; thresholds are first-cut, calibrated to alpha data once available.)* |
| H2 | Users return weekly under prompt cadence | ≥40% weekly active rate at 30 days post-activation |
| H3 | Sharing specific memories elicits commentary, and that commentary drives chronicle growth | ≥30% of users share at least one memory via Single Post Share within 30 days of activation; ≥50% of share recipients leave a comment; ≥20% of comments result in a new or enriched significant-other entity in the chronicle. *(v1.1 replaces the artifact-thumbs metric with a share→comment→entity-growth feedback-loop test.)* |
| H4 | Users trust the privacy model with one genuinely sensitive memory | ≥20% of users record at least one memory with a sensitive dimension tag without immediately deleting it |

# 3. Phase 0 — Onboarding via the Three Navigation Surfaces

## 3.1 Design Rationale

Phase 0 is the user’s first hours with Life Chronicle. The goal is not to extract a complete ontology before memory collection begins. The goal is to make the user fluent in the three navigation surfaces — Globe, Recollections, Timelines — by giving each surface enough data to render meaningfully, so the user feels they are constructing something real from the first interaction.

The original v1 framing (three sequential interview stages with a validation gate before memory collection began) was retired on 2026-05-30. Two assumptions in that framing did not survive design contact: that synthesis artifacts and navigation views are the same thing (they are not — the Globe is a surface from the first pin; portrait prose enriches but does not gate it), and that the target user wants a guided sequence with completion gates (they don’t — stage gates compete with the engagement we are trying to create). Strands run in parallel under the hood (per memory/project_lc_ontology_bootstrap.md); navigation surfaces are introduced organically when the data supports them.

The canonical spec for the surfaces is documentation/feature_navigation_surfaces.md.

## 3.2 The Three Surfaces and Their Introduction

The three navigation surfaces — Globe, Recollections, Timelines — are present in the top nav from the user’s first sign-in. They are not gated; the user can click any of them at any time. What changes over the course of Phase 0 is the onboarding agent’s invitation to visit each surface — drawn from the agent’s read of chronicle state.

The user’s first signed-in screen is the Globe with the welcome prompt “Where were you born?” (per feature_residential_globe_onboarding.md). The user places pins and writes or dictates per-pin context. Each pin is a residency memory plus a lived_at relationship plus a place entity. The Globe is meaningful from the first pin.

After the first pin or first capture-assistant submission (whichever comes first), the onboarding agent draws the user’s attention to the Recollections tab: “Here’s what you’ve shared so far — searchable any time.” The user clicks through and sees their captures as a chronological card list. They learn that the chronicle has a chronological face, not just a geographic one. (The Recollections tab was present before this moment; the agent’s invitation is what changes.)

After the user has confirmed three person entities through the entity verification UI, the onboarding agent draws the user to the Timelines tab with the Life’s Cast / Significant Relationships dimension pre-loaded: “You’ve named a few significant people — take a look at how the start of your life’s relationship arc is shaping up.” The user sees the swimlane render — three or four bars on a life-span axis. The visceral sense of “here’s the shape of my life starting to render” motivates continued capture.

The lead Timelines dimension at MVP is Life’s Cast — the user-facing branding of what is, technically, the Significant Relationships dimension. Casual acquaintances and professional contacts remain visible in Recollections as entity chips on memory cards but do not populate this dimension at MVP.

## 3.3 No Completion Gate

There is no “Phase 0 complete” event. The user never presses a “done” button. The system’s internal state tracks data accumulation across three strands (residential, entity, topic); when thresholds are met, synthesis artifacts generate in the background and enrich the existing surfaces. Surfaces start sparse and get richer as the user continues to capture.

## 3.4 Threshold-Triggered Agent Invitations (Not Surface Gating)

The three primary navigation surfaces — Globe, Recollections, Timelines — are always accessible in the top nav. No threshold ever removes a surface from the nav, and no threshold gates user-initiated navigation to a surface. The user can click any surface at any time, including before any data exists for it (in which case the surface shows its empty state with a directional invitation to capture, per the open-question resolution in feature_navigation_surfaces.md §10 OQ-NS-2).

The Planner Agent monitors chronicle state across the three strands (residential, entity, topic) and is responsible only for triggering the capture assistant’s invitations to visit each surface — the warm, contextual prompts that draw the user to a tab they may not have noticed yet. Threshold examples: first pin placed → invite to Recollections; three person entities confirmed → invite to Timelines / Life’s Cast. The thresholds tune the timing of the agent’s prompts, nothing more.

The interview_sessions table records session_type values for each user-facing interaction (capture_inline, residential_pin, entity_confirmation, etc.), allowing the Planner Agent to query strand-by-strand progress without relying on application-layer state.

## 3.5 The Residential Spine

Within the residential strand, the Globe is the highest-priority elicitation surface during onboarding. A person’s sequence of homes provides bilateral temporal constraints at every move — each confirmed move date simultaneously closes the previous period and opens the next. The residential chain is the structural backbone the Temporal Agent builds on first, before any other temporal resolution work.

The Globe onboarding flow (per feature_residential_globe_onboarding.md) is structured around what people remember easily: the place itself, who was there, why the move happened, and what was happening in life at the time. At MVP, the pin modal captures dates inline as part of pin creation — a free-text date field accepts approximations like "approximately 1962–1968," "early 70s," or "I don't know" (per feature_residential_globe_onboarding.md §3.2). The Temporal Agent's relational-questioning approach — never asking for years directly, always asking for orderings — is a Phase 2 design target for the conversational/voice flows that will eventually layer over the pin-based UI. At MVP, the pin sequence itself is the implicit ordering.

# 4. Feature Scope

## 4.1 Scope Summary

The MVP is a 3–4 month build scoped to establish the core value loop: Phase 0 bootstrapping → memory collection → synthesis → selective sharing. Temporal Agent, contribution access, custom sharing cards, and chapter narrative are all Phase 2. Video processing, voice clone, and enterprise features are Phase 3.

## 4.2 Feature Phase Table

*v1.1 format: MVP scope per domain, then Phase 2 additions per domain. Items that ship in MVP are not redundantly marked as “also in Phase 2”; Phase 2 entries are strictly incremental over MVP.*

### CAPTURE

**MVP: **text (web), voice (web/mobile via MediaRecorder), SMS async (deeplink-back)

**Phase 2 adds: **voice-only phone (inbound call, accessibility channel), video capture modality, video archive processing (atomization; facial recognition deferred)

### ORGANISATION

**MVP: **three-surfaces familiarisation (replaces the original Phase 0 three-stage bootstrap — see §3 and feature_navigation_surfaces.md), 10-dimension Tagger Agent (single-pass), Entity graph (Entity Agent proposes, user confirms via /review)

**Phase 2 adds: **user-defined chapter naming via user_periods (emerges from data, not pre-elicited), user-defined custom taxonomy nodes (schema ready; UI Phase 2), Temporal Agent + constraint propagation (raw envelope in MVP; agent is Phase 2)

### NAV SURFACES (new in v1.1)

**MVP: **Globe surface (Mapbox GL JS 2D/2.5D pins + transit animation + click-to-memories; single image attachable per residence pin, rendered in the pin card and shown in a modal mini-card that overlays the Globe on pin click — image plus a limited fact strip: place name, dates, who was there), Recollections surface (sort + filter chips + entity chips + draft badge + cross-surface deep links), Timelines surface (Life’s Cast / Significant Relationships dimension; swimlane render; dimension selector on page), navigation chrome (top tabs + slim left rail + capture FAB per feature_navigation_surfaces.md §11)

**Phase 2 adds: **Globe Cesium 3D + satellite memory prompts + video pin attachments; Recollections full-text + semantic search + saved searches + chapter grouping; Timelines Career / Education / Themes dimensions + cross-surface “where they appear” Globe highlight

### SYNTHESIS

**MVP: **Assumption log (silent background write — Tagger and Entity agents write traces; surfaces are not user-visible at MVP)

**Phase 2 adds: **Assumption log UI (user-visible review of agent reasoning); entity_biography for places (enriches Globe pin click with prose portrait); lifes_cast for Life’s Cast / Significant Relationships (enriches Timelines entries with prose summary per entity); Chapter Narrative (life_period_narrative, requires richer collection); Relationship Portrait (relationship_portrait, deep single-relationship synthesis); Wisdom Distillation (requires The Stroll reflections); The Stroll reminiscence mode (launched from within Recollections or Timelines, not a fourth nav surface); personal_biography (multi-dimensional, user-directable biography drawn from all 10 dimensions + the entity graph — see §9.5)

### PRIVACY & SHARING

**MVP: **Access Cards (5 system cards, full schema day one — see access_cards_requirements.md), Single Post Share (token URL, no login required, owner can expire or revoke)

**Phase 2 adds: **Custom Share Cards (user-defined, rule-builder UI + preview), Social media share + comment capture (memory_shares + share_comments tables), Contribution access (card holders add to chronicle — schema columns in MVP, UI Phase 2), Executor card (posthumous access, card with posthumous-trigger validity), Training consent UI (data model ready; messaging held until Phase 2–3)

### EXPORT

**MVP: **Basic JSON export

**Phase 2 adds: **CEF v1 structured export (ZIP with manifest, full spec in cef-schema.json)

# 5. Core User Journeys

## Journey 1: Onboarding via the Three Surfaces

User signs in for the first time. The first screen is the Globe with the welcome prompt “Where were you born?”

- User pans, zooms, and clicks. A pin appears. The modal opens for per-pin context (free-text, optional date, residence type). The Entity Agent creates a place entity for the pin with geocoordinates resolved via Mapbox Geocoding API. A residency memory is written; a lived_at relationship is created with dates entered as temporal constraints.
- After the first pin (and a small synthetic delay to let the user see the pin land), the onboarding agent draws the user’s attention to the Recollections tab in the top nav. The user notices it and may click in; the surface shows the residency memory as a card. The user learns the chronicle has a chronological face.
- The user continues placing pins or shifts to the capture FAB to dictate a separate memory. Both flows write to the same Raw Vault; both surface in Recollections.
- As the user mentions or directly enters significant people in their captures, the Entity Agent extracts them. New person entities surface as confirmation cards in the /review queue. The user confirms each (or renames, merges, rejects) via the /review UI.
- Once the user has confirmed three person entities, the onboarding agent draws the user to the Timelines tab with a warm prompt about the Life’s Cast / Significant Relationships arc. The user sees the swimlane render — three short bars on a life-span axis. The user is invited to add more people they cared about, with the visual feedback of new bars appearing on the swimlane.
- No completion banner, no stage celebration. The user simply has access to three navigation surfaces — Globe, Recollections, Timelines — each rendering whatever data exists, each inviting the user to add more.
- Synthesis artifacts (entity_biography for places, lifes_cast for the Life’s Cast / Significant Relationships dimension) generate in the background as data accumulates past Phase 2 thresholds. The surfaces remain functional throughout; synthesis enriches them.

## Journey 2: Ongoing Memory Capture (SMS)

The user receives a prompt SMS inviting them to share a memory of a specific period or topic — generated by the Planner Agent based on coverage gaps.

- User taps the deeplink in the SMS. On mobile-web, the capture interface opens in their browser. TTFB ≤2 seconds.
- The Capture Agent greets them, names the memory it would like to explore, and opens a voice recording interface. The user speaks their recollection.
- Audio is uploaded (≤10 seconds for a 2-minute recording on LTE). Whisper ASR produces a transcript. The memory is written to the Raw Vault as content_raw.
- The Tagger Agent assigns dimension tags in a single pass. The Entity Agent scans for new entity mentions. Both propose into the review queue rather than auto-merging.
- The user is notified when their memory has been processed. If it affects an active synthesis, that synthesis is flagged as stale.

## Journey 3: Viewing the Life Globe

User navigates to the Globe view on desktop or mobile-web.

- The globe renders from life_journey_geojson() output. The temporal transit animation begins automatically: the camera moves chronologically through the user's residential arc, dwelling proportionally to days_at_place.
- User can pause the animation, scrub the timeline, or jump to a specific stop.
- Hovering on a place stop surfaces the entity_biography synthesis for that place — a prose portrait of the period the user spent there.
- Clicking a stop opens the memory browser filtered to that place entity, showing all memories anchored to that location.
- The globe updates in real time as new memories are added and place entities accumulate more memory_count.

## Journey 4: Viewing Life's Players

User navigates to the Life's Players view from the synthesis gallery.

- The lifes_cast synthesis renders as a time-ordered cast list with per-entity summaries organized by life stage. Each player entry shows their entry and exit points, the roles they held, and a short prose summary of their significance.
- User can tap any player to see the memories that supported their entry in the synthesis.
- User rates the synthesis (thumbs up/down). Rating is stored in the eval loop.
- User can share the artifact externally or restrict it to a card.

## Journey 5: Single Post Share

User wants to share a specific memory as easily as sharing a social media post — no card setup, no account required on the recipient's side.

- User views a memory and taps the Share icon. A share sheet appears immediately — no card selection, no configuration required.
- The system generates a unique share token and constructs a URL: /share/{token}. The user copies the link or sends it directly via Messages, email, WhatsApp, or any app.
- The recipient opens the link in any browser with no login prompt. They see a read-only "shared view" of the memory: content, date context, and any attached media the owner has not separately restricted.
- Optionally at share time the owner sets an expiry: 7 days, 30 days, 1 year, or never (default). Expiry is displayed on the share sheet so the owner knows what they've committed to.
- The owner can view all active share links from the Shares management screen and revoke any link at any time. Revoked links return a "This share has been removed" page to anyone who tries to open them.
- view_count increments silently on each open; last_viewed_at updates. The owner sees "Last opened: 2 days ago" on the share management screen — useful for knowing if a link was ever received.

## Journey 6: Sharing a Memory with a Card Holder

User wants to give a family member ongoing access to a set of memories via the Access Cards system.

- User navigates to a memory and taps Share. The system shows which system cards the memory is currently visible through (default: none).
- User selects the Family card and confirms. A record_card_grants(include) row is written for the memory.
- The family member — already set up as a contact holding the Family card — now sees the memory in their card-governed view.
- If the recipient leaves a comment on the shared memory, a share_comments row is written and the owner sees a notification in their comments view.

## Journey 7: Using the Review Inbox

The review inbox surfaces pending items requiring the user's attention.

- The user opens the inbox and sees: proposed entity merges (e.g., "Is 'John' in memory #47 the same as 'John Smith' in your entity graph?"), agent-inferred temporal constraints awaiting confirmation, and synthesis stale notifications.
- For each item, the user accepts, modifies, or rejects. Accepted entity merges update the entity graph. Accepted temporal constraints trigger constraint propagation. Rejected items are removed from the queue with the rejection recorded.
- The inbox count is visible as a badge in the main navigation and is kept to a minimum by batching agent proposals rather than surfacing them individually in real time.

# 6. Data Model Summary

## 6.1 Architecture Overview

The schema is organized in six conceptual layers. The full schema is in documentation/schema_v1.sql; this section summarizes the design rationale and key tables.

| **Layer** | **Purpose and Key Tables** |
| --- | --- |
| **Raw Vault** | memories — the append-only, immutable record of everything captured. content_raw is never modified after creation. All corrections go through memory_revisions. The most important architectural invariant. |
| **Entity Graph** | entities, relationships — people, places, organizations, artifacts as first-class nodes. Typed directed edges with temporal bounds. Enables genuine graph queries across the life. |
| **Taxonomy** | dimension_types, dimensions — the WisdomTopicSort ten-axis self-referencing tree. New categories added as row inserts, not schema migrations. |
| **Tagging Layer** | memory_dimensions, memory_entities, memory_media — junction tables connecting the raw vault to the rest of the schema. Each memory can carry tags across all ten dimension axes simultaneously. |
| **Synthesis Layer** | syntheses, synthesis_visibility_cache — AI-generated narratives, portraits, and insights. Fully traceable to source memory IDs. Invalidated and regenerated when source memories change. Never merged back into the raw vault. |
| **Access Control** | cards, contacts, card_holders, record_card_grants, card_audit_log, access_log — the Access Cards framework. Default deny; every record starts with no audience. RLS enforces at the database level. |

## 6.2 Key Design Invariants

- Raw Vault is append-only: INSERT privilege only for the Capture Agent DB role; no UPDATE, no DELETE on memories or interview_sessions
- Privacy is default deny: no record is visible to any viewer other than the owner until explicitly granted via a card
- Synthesis is always derived: the Synthesis Layer is a downstream product of the Raw Vault; synthesis content is never promoted back into source records
- Temporal uncertainty is explicit: every memory carries an uncertainty envelope (time_earliest, time_latest, time_estimate, time_precision) — never a false precision
- Taxonomy is extensible: the dimension tree allows new categories at any depth via row insert; ENUMs are being migrated to lookup tables for all foreseeable-growth value sets

## 6.3 MVP-Critical Tables Added in v1.1

The following tables, specified in this PRD, are additions to the base schema_v1.sql and must be implemented before MVP build begins:

### review_queue — Unified user touch point

Holds all items requiring user attention: proposed entity merges, agent-inferred temporal constraints awaiting confirmation, sensitive-promotion requests, synthesis stale notifications, and (Phase 2) contribution reviews. New person entities surface here too (entity_confirmation_needed item_type).

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| id | UUID PK |   |
| user_id | UUID | Chronicle owner |
| item_type | TEXT | entity_merge_proposal \| entity_confirmation_needed \| temporal_constraint \| sensitive_promotion \| synthesis_stale \| contribution_review \| assumption_review \| memory_elaboration_needed |
| item_id | UUID | FK to the item being reviewed (polymorphic) |
| context_json | JSONB | Per-type metadata (extraction quote, proposed primary, etc.) |
| priority | SMALLINT | 1 (urgent) – 5 (low); drives sort order |
| surfaced_at | TIMESTAMPTZ | When added to the queue |
| resolved_at | TIMESTAMPTZ | NULL until resolved |
| resolution | TEXT | confirmed \| renamed \| rejected \| merged \| deferred \| dismissed |
| resolution_payload | JSONB | Action-specific structured data: {merged_into_id} for merged, {canonical_name, aliases} for renamed, {resurface_at} for deferred. Empty object for confirmed/rejected/dismissed. |
| resolution_note | TEXT | Optional free-text user note |
| resolved_by | TEXT | Channel that resolved the item: user (UI click) \| system (auto cleanup) \| agent:<name> (agent auto-resolution) |
| created_at | TIMESTAMPTZ |   |

### memory_shares — Share event log + Single Post Share tokens

Records each time the user shares a memory or synthesis. Doubles as the Single Post Share token store: share_token embedded in the URL /share/{token} is the sole credential for anonymous access; no login required.

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| id | UUID PK |   |
| user_id | UUID | Chronicle owner |
| memory_id / synthesis_id | UUID | FK to shared record (exactly one non-null) |
| card_id | UUID | Privacy context at time of share (defaults to Private system card for token shares). Not a permission gate — the token is. |
| channel | ENUM | social_media \| direct_link \| sms |
| share_url / platform_post_id | TEXT | Generated URL and optional social post ID |
| share_token | UUID UNIQUE | Token embedded in share URL. Auto-generated. Never changes. |
| expires_at | TIMESTAMPTZ | NULL = no expiry. Owner sets at share time. |
| is_revoked / revoked_at | BOOLEAN / TIMESTAMPTZ | Owner can kill any link. Revoked links return 410 Gone. |
| view_count / last_viewed_at | INT / TIMESTAMPTZ | Anonymous view tracking. No PII stored. |

### share_comments — Recipient comments

Captures comments left by recipients of shared memories. Comments do not enter the chronicle automatically; they are visible to the owner in a dedicated view.

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| id | UUID PK |   |
| share_id | UUID | FK to memory_shares |
| commenter_user_id | UUID | NULL if not a registered user |
| commenter_email | CITEXT | Optional attribution |
| commenter_display_name | TEXT | Optional |
| content | TEXT | Comment body |
| is_hidden | BOOLEAN | Owner can hide without deleting |
| created_at | TIMESTAMPTZ |   |

The full Access Cards schema (cards, contacts, card_holders, record_card_grants, synthesis_visibility_cache, card_audit_log, access_log) is specified in documentation/access_cards_requirements.md §4 and must replace the deprecated privacy_tier ENUM columns on memories, entities, relationships, media, and syntheses.

# 7. Multi-Agent Architecture

## 7.1 Design Principles

- Each agent has a single primary responsibility and a distinct set of tables it writes to
- Agents run concurrently without coordination overhead; row-level locking in PostgreSQL handles conflict avoidance naturally
- The Capture Agent DB role has INSERT-only privilege on memories and interview_sessions — no UPDATE, no DELETE. This is a database-permissions fact, not application discipline
- Synthesis invalidation is signaled via is_current = false and invalidated_at; a background Synthesis Agent detects and regenerates rather than cascading in real time
- All agent decisions are written to the assumption_log for traceability and user correction

## 7.2 Agent Responsibilities

| **Agent** | **Primary Tables Written** | **Responsibility** |
| --- | --- | --- |
| **Capture Agent** | memories, interview_sessions | Conducts interviews (voice or text). Writes raw memory records and session records. Never synthesizes. Session type encoded on every session: ontology_bootstrap, memory_collection, temporal_resolution, entity_resolution, review_and_correction. |
| **Tagger Agent** | memory_dimensions | Reads new untagged memories. Assigns dimension tags across all ten axes. Enforces sensitive-dimension auto-isolation. Proposes into review_queue; does not autonomously merge. Single-pass at MVP; no autonomous correction in Phase 1. |
| **Entity Agent** | entities, relationships, memory_entities | Detects entity mentions in memories. Creates or updates entity records. Proposes relationship merges and new relationship claims into review_queue for user confirmation. Calls geocoding API for place entities (OSM Nominatim or Google Maps Geocoding). Writes assumption_log entries for all disambiguation decisions. |
| **Planner Agent** | coverage, interview_sessions (scheduling) | Reads coverage records to identify thin dimension × entity combinations. Schedules the next interview session. Manages Phase 0 stage progression and artifact delivery triggers. Interleaves temporal clarification sessions as the collection grows. |
| **Synthesis Agent** | syntheses, synthesis_visibility_cache | Monitors for invalidated syntheses (is_current = false). Reads relevant source memories (applying memory_revisions before rendering). Generates synthesis content using pull-based, batched policy — not real-time cascade. Recomputes synthesis_visibility_cache after generation. Never modifies raw memories. |
| **Temporal Agent** | temporal_constraints, temporal_resolution_queue | PHASE 2. Manages constraint graph: inventory → anchor discovery → question generation → constraint ingestion → propagation. Never asks for years directly; always asks for relative orderings. |
| **Search Agent** | Read-only | Serves semantic (pgvector cosine similarity) and structured (SQL) queries. Enforces privacy-safe RAG retrieval ordering: RLS/permissions filter first, metadata filters second, vector similarity on allowed rows only. Never runs similarity before the permissions filter. |
| **Timeline Agent** | timeline (materialized view) | Lightweight. Refreshes the timeline materialized view after memory inserts. |

## 7.3 Agent Orchestration — Inngest (Decided)

Inngest is the selected agent orchestration layer. Agents are implemented as Inngest functions that listen to named events emitted by the application after writes to the Raw Vault. This decision unblocks all agent implementation work. (Architecture doc Part XVI.)

Rationale: Inngest provides event-driven triggering, durable multi-step flows (individual steps retry independently — important for the Temporal Agent's constraint-graph iteration), exactly-once semantics via event-ID deduplication, built-in retry with exponential backoff, and an observability dashboard for step-level trace inspection. No custom lease management or polling workers are required.

Event taxonomy: memory.ingested (Capture → Tagger + Entity Agents), synthesis.invalidated (any agent → Synthesis Agent), phase0.stage_completed (Planner → Synthesis Agent for stage artifacts), entity.merged (Entity → Synthesis + Tagger), user.period_confirmed (application → Synthesis Agent). Scheduled jobs: synthesis.nightly_batch (02:00 UTC), planner.daily_review (03:00 UTC).

Tier strategy: Inngest's free tier accommodates the personal build phase (estimated 2,700–6,300 steps/month for a single active user, well under the free allowance). Tier upgrades happen as user count grows, with no code changes required at upgrade time. Specific cost projections and per-user economics are governed by §10.4 Cost Guardrails, anchored against the MVP user-subscription target of approximately $10/month.

## 7.4 Privacy-Safe RAG Retrieval Ordering

| **Mandatory architectural constraint** Permissions filter (RLS / viewer_can_access()) must run BEFORE vector similarity search. Running pgvector similarity across unfiltered rows is a privacy vulnerability — it can leak existence of records a user is not permitted to see through similarity scoring. All Search Agent implementations must follow this ordering: (1) permissions/RLS filter in SQL, (2) metadata filters (time, entities, taxonomy), (3) pgvector similarity on allowed rows only, (4) application-level rerank and dedup. |
| --- |

# 8. Privacy Model — Access Cards

## 8.1 Design Rationale

The original five-tier privacy_tier ENUM model (private → close_friends → family → professional → public) imposed a strict linear hierarchy that real-life sharing does not honor. Sharing with "my old Air Force buddies," "the book club," "my advisory board," and "my therapist and my wife" are not points on a single line. The ENUM model also conflicted with the schema's own extensibility principle: every other axis used open-ended trees, but privacy was capped at five values.

The Access Cards framework replaces the ENUM with a permission-grant artifact. A card defines a named scope of content and is held by zero or more contacts. Five system cards emulate the legacy five tiers for MVP; custom cards are user-defined and unlimited by schema.

## 8.2 Core Model

- A card is a named permission grant created by the chronicle owner. It defines a scope (which records it unlocks) and is held by zero or more contacts.
- A scope can constrain by time band, user-named periods, life stages, dimensions, entities, places, and explicit memory ID lists — with include and exclude lists. Empty scope = all of the owner's content.
- Within an axis, multiple values combine as OR. Across axes, all populated axes must match (AND). Explicit excludes always win.
- A holder's effective access is the union of all active cards they hold from a given owner.
- Synthesis visibility: a synthesis is visible to a card holder if and only if every source memory is visible to them. The synthesis_visibility_cache materializes this intersection for query performance.

## 8.3 System Cards (MVP)

Five system cards are pre-seeded for every user on account creation. They cannot be deleted; their display names and scopes/holder lists are fully editable.

| **System Card** | **Default Scope** | **Notes** |
| --- | --- | --- |
| Private | Empty (grants nothing) | Default for all content. Not assignable to any holder. |
| Close Friends | All owner content | User populates holder list. User may narrow scope. |
| Family | All owner content | User populates holder list. User may narrow scope. |
| Professional | Career & Education dimensions | User populates holder list. |
| Public | No records by default | Anyone with a viewing URL. No holder list required. Records must be explicitly granted. |

## 8.4 Sensitive-Dimension Auto-Isolation

When the Tagger Agent assigns a dimension with is_sensitive = true to a memory, the memory is automatically excluded from all cards via record_card_grants(grant_type='auto_isolate') entries against every active card. This is equivalent to the prior "auto-lock to private" behavior. The user must explicitly remove the auto-isolation (with a confirmation dialog explaining the sensitivity classification) before any card can grant access to the memory.

## 8.5 Default Deny

Every record is created with no card associations. There is no way for a record to become visible to any viewer other than the owner without deliberate user action. Both the application layer and database RLS enforce this; neither layer alone is sufficient.

## 8.6 MVP vs. Phase 2 Cut

MVP exposes: five system cards with editable holder lists; default-private discipline; sensitive auto-isolation; audit log writing; per-record grant/exclude as simple "share with Family card" / "hide from Family card" toggles; Single Post Share (§8.7).

Phase 2 unlocks: custom card creation UI, scope rule-builder with preview, card templates (reunion card, career-banded card, etc.), time-banded card validity, full holder management UI.

## 8.7 Single Post Share — Token-Based Sharing

Single Post Share is a parallel sharing mechanism to Access Cards, designed for frictionless one-off sharing. Where the card system requires deliberate setup (create card → define scope → assign holders), Single Post Share requires a single tap and generates a link that works like a social media post share: no account required, anyone with the URL can view the item.

Mechanism: tapping Share on any memory generates a unique share_token (UUID) and constructs the URL /share/{share_token}. The token is the sole credential. The public share endpoint looks up the non-revoked, non-expired token and returns a stripped-down read-only view of the item. No session, no login.

Privacy context: the memory_shares.card_id column records the Private system card by default — not as a permission gate, but as an audit record of the privacy context the item was in at the time of sharing. The memory's underlying card assignments are unchanged by the act of sharing.

Owner controls: (1) Optional expiry at share time — 7 days, 30 days, 1 year, or never. (2) Revocation at any time from the Shares management screen; revoked links return 410 Gone. (3) View counter and last_viewed_at give passive signal on whether a link was received and opened.

Relationship to the card system: the two mechanisms coexist without interference. A memory can simultaneously have card-based access for card holders and a share token for anonymous one-off viewers. Single Post Share does not affect, and is not affected by, the memory's card assignments or auto-isolation status. Auto-isolated sensitive memories cannot be Single Post Shared — the UI disables the Share action on any memory with an auto_isolate grant in place.

# 9. MVP Synthesis Artifacts

## 9.1 Scope Note

Per the navigation-surfaces reframing (§3 + documentation/feature_navigation_surfaces.md), the MVP ships three navigation surfaces — Globe, Recollections, Timelines — each of which functions without synthesis. Synthesis artifacts are not standalone MVP deliverables; they are Phase 2 enrichments to the surfaces. This section describes how the synthesis types fit each surface.

## 9.2 Surface enrichment: the Globe

**Synthesis type: **entity_biography for place entities (Phase 2).

**Where it appears: **as prose attached to each pin’s detail panel.

**Surface behaviour without synthesis: **pin click opens the memories anchored to that place (the Recollections cross-surface deep link).

**Surface behaviour with synthesis: **pin click also surfaces the entity_biography portrait — “the period the user spent there” — as prose above the memory list.

**Globe visualisation library: **Mapbox GL JS (2D/2.5D at MVP; Cesium 3D deferred).

## 9.3 Surface enrichment: Life’s Cast (Significant Relationships)

**Internal synthesis type: **lifes_cast (Phase 2).

**User-facing name (branding): **Life’s Cast.

**Technical descriptor (subtext): **the Significant Relationships dimension of the Timelines surface.

The name “Life’s Cast” is preserved from the original v1 §9 framing and from the Shakespeare resonance (“all the world’s a stage, and all the men and women merely players; they have their exits and their entrances”). It carries the emotional register the chronicle reaches for. The technical name “Significant Relationships” carries the scoping precision — this dimension covers the people who occupied the central emotional roles (partners, deepest friendships, lifelong family figures), not casual acquaintances or professional contacts. Both names point at the same data; the user sees “Life’s Cast” in the UI, and the technical literature (this PRD, the feature spec, schema comments) uses both.

**Where it appears: **as the prose body of each entity entry in the swimlane, when the user expands an entry.

**Surface behaviour without synthesis: **the entry shows entity name, period of significance, memory count, and the first-line excerpt from the most recent memory. The swimlane bar itself is unaffected by synthesis presence — it renders from the entity and memory data alone.

**Surface behaviour with synthesis: **the expanded entry includes the lifes_cast prose summary of the person’s role across the life stages they were active. Memory IDs that supported the entry are linkable to Recollections.

**Visualisation pattern (canonical): **swimlane / Gantt-style layout, one horizontal bar per entity, x-axis = life span (birth → present), bar length = period of significance, bar opacity or tick-marks = memory density. Lifelong presences span the full axis; short blooms are visually obvious. See feature_navigation_surfaces.md §5.2a for the persistence rationale.

## 9.4 Synthesis as Phase 2 work

The MVP does not block on synthesis. Both entity_biography and lifes_cast are scheduled for Step 11 (post-MVP). The MVP launch ships the three surfaces functional and unenriched; Step 11 enriches them.

The other synthesis types in the original PRD v1 (Chapter Narrative, Relationship Portrait, Wisdom Distillation) remain Phase 2 per §4. None block on MVP work.

## 9.5 Surface enrichment: personal_biography (Phase 2, user-directable)

**Synthesis type:** `personal_biography` (new in PRD v1.1, Phase 2).
**User-facing name:** TBD (candidates: "Your Story" or "Life Narrative" — to be validated in UX testing).

**Concept.** A multi-dimensional prose biography of the user, woven across all ten WisdomTopicSort dimensions and the entity graph, with user direction over emphasis, voice, audience, and omissions.

The first generation of synthesis types (`entity_biography`, `lifes_cast`, `life_period_narrative`, `relationship_portrait`, `wisdom_distillation`) each render a slice of the chronicle. `personal_biography` is the integrative output — the user's life as a single coherent read, drawn from every axis. It's the artifact that answers *"what does my chronicle add up to?"*

**User direction (Phase 2 affordances).** The user can guide the synthesis with prompts such as:

- "Emphasize family relationships over career"
- "Write this for my grandchildren"
- "Omit anything tagged sensitive"
- "Focus on the years 1985–2005"
- "Write in third person"

The result is a draft the user can edit, regenerate with different direction, or save as a versioned narrative. Versioning matters because successive iterations may target different framings or audiences — a memoir for family, a professional retrospective, a wisdom-focused legacy narrative for grandchildren.

**Data inputs.** Memories (all dimensions), the entity graph (significant relationships, places, organizations), the residential arc (Globe path), the Life's Cast timeline (Significant Relationships), and — when present — accumulated reflections from The Stroll (which carry the user's own interpretive voice).

**Production economics.** Generation is expensive (full-chronicle context window plus directable prompting), so generation is user-triggered, not automatic, and is rate-limited per subscription tier. The MVP user-subscription target of approximately $10/month (§10.4) doesn't cover unlimited personal_biography generation; this is a Phase 3 candidate for inclusion in a premium tier. Requires enough chronicle density to produce a meaningful narrative — heuristic threshold: ≥50 memories with broad dimension coverage. Below that the user sees a "your chronicle is still gathering shape" affordance rather than a forced generation.

**Where it appears.** From a dedicated synthesis surface (Phase 2 — likely a "Studio" or "Synthesis Gallery" page reachable from the slim left rail or the user profile).

# 10. Non-Functional Requirements

## 10.1 Performance

| **Metric** | **Target** | **Source** |
| --- | --- | --- |
| Deep-link open TTFB | ≤2 seconds | lovable-build-spec.v2.md |
| TTS tap-to-play (cached prompts) | ≤300 ms | lovable-build-spec.v2.md |
| 2-minute audio upload on LTE | ≤10 seconds | lovable-build-spec.v2.md |
| Card scope preview (up to 10k records) | ≤1 second | access_cards_requirements.md FR-10 |
| viewer_can_access() SQL function | Single-digit ms (1–5 cards, 1–3 scope axes) | access_cards_requirements.md §10 |
| Globe initial render | ≤3 seconds on broadband | Derived from TTFB + GeoJSON payload |

## 10.2 Security

- The Supabase Service Role key must never be exposed client-side or in browser-side code. All agent writes and reads use Service Role. All user-facing reads go through the authenticated role, which RLS fully governs.
- RLS policies on all content tables (memories, entities, relationships, media, syntheses) must be active before any multi-user access is enabled.
- Authentication: Passkeys (WebAuthn) as primary auth method, magic link as fallback. Both are broadly supported on iOS Safari 16+ and Android Chrome 111+.
- The Capture Agent DB role is INSERT-only on memories and interview_sessions. No UPDATE, no DELETE. This must be enforced at the database permissions level, not application discipline alone.

## 10.3 Privacy and Data Governance

- Default deny: every record is created with no card associations. Accidental exposure is architecturally impossible without deliberate user action.
- Sensitive-dimension auto-isolation: dimensions with is_sensitive = true trigger automatic record_card_grants(auto_isolate) against all cards.
- Soft-delete / redaction: memories support redacted_at, redaction_reason, redacted_by fields for GDPR right-to-erasure without physical deletion. Redacted rows are invisible to all reads except an explicit owner-controlled audit view.
- Training consent: consent fields are present on memories and media (voiceCloneAllowed, publicIndexingAllowed). Both default to false. No training use of user data without explicit opt-in per record.
- Privacy-safe RAG: permissions filter runs before vector similarity on all Search Agent queries. This is a mandatory architectural constraint, not a guideline.

## 10.4 Cost Guardrails

- TTS capped at 20 seconds per prompt, cached by template-hash + variables. Repeated prompts do not incur per-call TTS cost.
- Client-side silence trim before audio upload (−40 dB threshold, head/tail). Recordings over 3 minutes are dropped at the client, not truncated, with a user message.
- Synthesis regeneration is pull-based and batched, not real-time cascade. Invalidated syntheses are regenerated on a schedule (nightly per user) and on-demand when the user opens a synthesis view. The UI shows "updated N hours ago" or "refresh available."
- Per-user monthly cost ceilings are a required architectural constraint, not an ops deployment concern. These must be designed before Phase 2 scale.
- **MVP user-subscription target: approximately $10/month per user.** All per-user infrastructure costs (LLM tokens, vector storage, Inngest executions, audio/image storage, geocoding API calls) must fit within that envelope while preserving margin. Synthesis features that exceed the envelope are either Phase 2/3 enhancements at a higher subscription tier (e.g. personal_biography, premium-tier candidate) or rate-limited at MVP. Specific dollar projections for hosting tiers (Supabase, Inngest, Anthropic, Mapbox) belong in an ops/finance worksheet, not in this product spec — but every architectural decision must be checked against this envelope before being committed.

## 10.5 Observability

The following analytics funnel events must be instrumented before MVP launch:

- sms_sent → deeplink_opened → tts_played → record_started → record_uploaded → asr_success → entry_completed
- Error events: mic_denied, media_recorder_unsupported, upload_failed, asr_failed
- Synthesis eval loop: thumbs up/down on every synthesis the user reads, stored with the prompt_version hash that generated the synthesis

Recommended stack: PostHog (product analytics) + OpenTelemetry (distributed tracing). Tie analytics events to OTEL traces for drop-off diagnosis.

# 11. Open Questions and Risks

## 11.1 Open Questions

| **ID** | **Question** | **Recommendation / Status** |
| --- | --- | --- |
| OQ-1 | Agent orchestration: in-DB queue vs. external scheduler (Inngest, Trigger.dev, Supabase Edge cron)? | RESOLVED (May 2026): Inngest selected. Event-driven, durable multi-step flows, exactly-once semantics, built-in retry/observability. Hobby tier ($0/mo) for personal build phase; Pro ($75/mo) at ~400–500 active beta users. Architecture doc Part XVI. |
| OQ-1b | Link-based "share with anyone who has this URL" — separate primitive from cards, or card variant? (Previously deferred to Phase 2.) | RESOLVED (May 2026): Separate primitive, not a card variant. Implemented as Single Post Share in MVP. Token UUID in URL = credential; no login. card_id on memory_shares records privacy context (defaults to Private) for audit only. See §8.7. |
| OQ-2 | Life's Players output format: time-ordered prose narrative, structured cast list (JSON), or hybrid? | Recommend hybrid: structured JSON for client rendering with a prose summary per life stage. Client renders the structured data; prose serves as the text-share representation. Open for final decision. |
| OQ-3 | Access Cards user-facing term: "Share Card", "Card", or "Audience"? | Resolved as "Share Card" for MVP. Test in qualitative UX sessions before launch. |
| OQ-4 | Globe visualization library: Cesium.js (full 3D terrain) or Mapbox GL JS (2D/2.5D, simpler)? | Recommend validating both by loading life_journey_geojson() into each before final decision. Cesium provides more compelling 3D; Mapbox is easier to customize. Open. |
| OQ-5 | Passkeys (WebAuthn) as primary auth or magic link as primary? | Recommend Passkeys (WebAuthn) primary, magic link fallback. Passkeys broadly supported on iOS 16+ and Android 111+. Pending confirmation for the PRD. |
| OQ-6 | Access Cards max count per user and max holders per card in MVP? | Recommend: 25 card soft limit in MVP (schema unlimited); no holder limit (UI warns at >50). From access_cards_requirements OQ-2/OQ-3. |
| OQ-7 | Should holder notification fire on card scope change (not just on initial add)? | Recommend: yes for significant scope narrowing; no for scope widening. From access_cards_requirements OQ-4. |
| OQ-8 | Should the chronicle owner have a "view as holder" mode to see exactly what a specific card holder sees? | Recommend: yes, this is essential for trust. Should be in MVP UI. From access_cards_requirements OQ-10. |

## 11.2 Key Risks

| **ID** | **Severity** | **Risk** | **Mitigation** |
| --- | --- | --- | --- |
| R1 | **High** | Phase 0 completion rate falls below H1 threshold (60%). Users drop after Stage 1 and never receive Life's Players. | Mid-flight artifact after every stage. Stage 1 Globe must render within 30 seconds of session end. Monitor funnel: Stage1_complete → Stage2_started within 48 hours. |
| R2 | **High** | Life's Players synthesis quality is poor at Phase 0 data density — generic prose that doesn't feel personal. | Prompt engineering with explicit entity names, relationship types, and temporal placement. User testing before launch. Thumbs eval loop from day one. Hold artifact until confidence threshold is met. |
| R3 | **Medium** | Privacy model complexity (Access Cards) creates confusion — users don't understand what their card holders can see. | "View as holder" mode in MVP. Clear, plain-language card management UI. Card scope preview before saving. Avoid surfacing Access Cards complexity in onboarding. |
| R4 | **Medium** | Sensitive-memory auto-isolation is perceived as the system withholding content from the user, creating friction. | Clear in-UI explanation at the moment of auto-isolation: "We've kept this private because it touches [topic]. You can choose to share it whenever you're ready." |
| R5 | **Medium** | Globe geocoding failures for historical places (military bases, renamed streets, international locations not in OSM) leave places unresolved. | Manual coordinate entry fallback with external_geo_source='manual'. Graceful degradation: unresolved places appear as text stubs on the globe with a prompt to help resolve them. |
| R6 | Mitigated | Agent orchestration decision delayed; Synthesis Agent regeneration becomes a database flag with no working scheduler. | RESOLVED (May 2026): Inngest selected as orchestration layer (OQ-1). Agent implementation is now unblocked. Risk retired. |

## 11.3 Deferred Decisions (Post-MVP)

- Chapter naming interaction: how and when does the system propose candidate chapter structures once the collection is rich enough? (Phase 2; schema ready with user_periods)
- Contribution review queue UX: how does the owner know contributions have arrived, and what is the review interaction? (Phase 2; schema columns can_contribute and contributor_id are already present)
- Temporal Agent implementation: constraint-graph traversal, question generation, propagation cycle. (Phase 2; temporal_constraints and temporal_resolution_queue tables are ready)
- CEF v1 export: full structured ZIP export with manifest and per-entry JSON matching cef-schema.json. (Phase 2)
- Wisdom Distillation synthesis: depends on The Stroll reflections as primary input — both are Phase 2 deliverables
- Training and research consent UI: data model is present (voiceCloneAllowed, publicIndexingAllowed on memories/media); messaging is held for Phase 2–3

