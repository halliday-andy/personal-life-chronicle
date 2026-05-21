# Life Chronicle — Database Architecture & Schema Design
**Version 1.0 | April 2026**

---

## The Central Design Problem

Before choosing a database or drawing a schema, we have to resolve a fundamental question that the attached reading (the Karpathy wiki vs. OpenBrain discussion) puts in the sharpest possible terms:

**When does the AI do its hard thinking — at the moment memories are ingested, or at the moment someone asks a question?**

This is not a trivial question. It determines the entire operational character of the system — what feels fast, what feels slow, how trustworthy the outputs are, and whether multiple agents can work simultaneously. The two poles of this design space are:

**The Wiki Model (Karpathy / input-time processing):** Every time a memory arrives, the AI reads it, synthesizes it into existing knowledge, updates topic pages, flags contradictions, builds links. The result is a compiled, pre-built understanding that makes retrieval nearly free. The trade-off: synthesis choices are made upfront by the AI, and nuance or contradiction can be smoothed away. The system presupposes a single writing agent.

**The Structured Database Model (OpenBrain / query-time processing):** Memories are stored faithfully, tagged, indexed, and left alone. When a question arrives, the AI reads the relevant records, synthesizes fresh, and delivers a precise answer with full provenance. Detail is never lost. Multi-agent concurrent access is natural. The trade-off: every complex query does real work, and there is no compiled understanding sitting ready.

**For Life Chronicle, the answer is: both, deliberately layered.**

A person's life chronicle is simultaneously a *narrative* (where the wiki model excels — capturing how understanding of yourself evolves over time) and a *structured archive* (where the database model excels — answering precise queries like "list every workplace and manager I've had since 1990"). Neither model alone is sufficient. A text-file wiki cannot serve three concurrent agents simultaneously, cannot do precise temporal queries, and loses detail in synthesis. A pure database cannot capture the emotional continuity of a life story without expensive reconstruction on every query.

The architecture below resolves this with a **Dual-Layer design**: a raw, structured, faithful database (the Raw Vault) plus an AI-maintained synthesis layer (the Synthesis Layer) that is explicitly traceable to its source records and can be invalidated and regenerated when those sources change.

---

## Part I: The Taxonomy — Life's Dimensions

The WisdomTopicSort framework, developed over years of work on this problem, reveals that human experience organizes naturally along **ten orthogonal axes** — dimensions that can each be applied to any memory independently. This is the key insight that distinguishes Life Chronicle from flat diary systems: a single memory can be tagged simultaneously on all ten dimensions, enabling faceted navigation that no linear timeline or flat tag cloud supports.

### The Ten Dimension Types

**1. Life Stage** *(temporal, the developmental arc)*
The age-span context of the memory — not just a date, but the developmental chapter of life in which it sits. From Andy's WisdomTopicSort:
- Family Pre-History (before birth — family of origin stories)
- Early Childhood (birth to age 6)
- Youth (7 to 12)
- Teen (13 to 19)
- Young Adult (20 to 27)
- Adult (28 to 45)
- Late Adult (45 to 64)
- Senior / Retirement (65+)

This dimension is special: it's the only one that is strictly temporal and ordered. All others are non-hierarchical axes.

**2. Topic Domain** *(the subject area)*
The broad life arena the memory belongs to:
- Music & Art / Entertainment
- Business & Occupation
- Love & Relationships
- Family & Personal
- Education & School
- Spirituality & Religion
- Body & Physical Health
- Mind & Emotional Life
- Lifestyle, Fashion & Beauty
- Food & Cuisine
- Travel & Adventure
- Animals & Pets
- World Events & History
- Vehicles (Cars, Boats, Planes)
- Sports & Athletics
- Finance & Wealth

**3. Phenomenon Type** *(the nature of the experience itself)*
What kind of thing this memory is at its core:
- Life Event (something that happened: time/place/happening)
- Behavior (an action taken)
- Practice or Discipline (an ongoing inner experience or habit)
- Belief or Attitude (a conviction, a knowing, a piece of wisdom)
- Natural Phenomenon (something experienced in the natural world)
- Human-made Phenomenon (technology, culture, built environment)
- Supernatural or Inexplicable Experience
- Saying, Quip, or Verbal Expression
- Social Dynamic or Group Experience
- Feeling or Emotional State
- Place or Setting
- Domestic Change (home, move, relocation)

**4. Relationship Role** *(who is involved)*
The relational identity of the key person in the memory:
- Family: Grandparents, Parents, Siblings, Children, Aunts/Uncles, Cousins, Self
- Romantic: Lovers, Spouses, Crushes
- Social: Friends, Acquaintances, Neighbors
- Professional: Bosses, Colleagues, Proteges, Mentors, Antagonists, Influencers
- Pets / Animals

**5. Life Event Category** *(recurring milestone patterns)*
The "type" of life event, independent of when it happened:
- Homes and Moves
- Jobs and Career Changes
- Military Service
- Performances and Presentations
- Media Mentions and Public Recognition
- Sports Events (victories, losses)
- Treasured Possessions
- Accidents, Injuries, Scars
- Marriages and Divorces
- Births and Deaths
- Educational Milestones (degrees, certifications)
- Travel (road trips, sea voyages, international)
- Setbacks and Failures
- Windfalls and Lucky Breaks
- Legal or Financial Events

**6. Personal Environment** *(physical and domestic setting)*
The physical world context: specific homes lived in, neighborhoods, domestic arrangements, possessions that anchored a period.

**7. Emotional Register** *(the feeling tone)*
The emotional or psychological quality of the memory: joy, grief, pride, shame, love, fear, confusion, wonder, peace. This dimension enables discovery of emotional arcs across a life — not just what happened, but how it felt.

**8. Expressive Form** *(quote, insight, or epiphany)*
When the memory is primarily a piece of wisdom, a memorable saying, a term of endearment, a personal philosophy — rather than a narrative event. This captures the verbal and intellectual heritage of a person's experience.

**9. World/Cultural Context** *(the historical backdrop)*
The external world events and cultural moment that provide backdrop: wars, economic conditions, cultural movements, technological shifts, political events. This dimension situates personal memory inside shared history.

**10. Artifact Type** *(associated objects)*
Physical or digital objects connected to the memory: photographs, documents, letters, heirlooms, music recordings, books. The link between memory and artifact is explicit in the schema.

### Why This Taxonomy Matters for the Schema

These ten dimensions cannot be hardcoded as columns in a memories table. Life is not that tidy — new categories will emerge, users will create personal sub-categories, and the system must evolve. Instead, the taxonomy is stored as a **self-referencing dimension tree** where:
- New categories can be added at any depth at any time without migration
- Each memory can carry tags across all ten axes simultaneously
- Weights allow primary vs. secondary tagging
- Provenance tracks whether a tag was user-assigned or agent-assigned

---

## Part II: The Core Schema

The schema is organized in six conceptual layers:

```
┌─────────────────────────────────────────────────────┐
│  SYNTHESIS LAYER                                     │
│  AI-compiled narratives, portraits, insights         │
│  (Karpathy wiki-style, but traceable to sources)     │
├─────────────────────────────────────────────────────┤
│  QUERY LAYER                                         │
│  Semantic search functions, timeline view,           │
│  coverage tracking, question bank                    │
├─────────────────────────────────────────────────────┤
│  TAGGING LAYER                                       │
│  memory_dimensions, memory_entities,                 │
│  memory_media — the junction tables                  │
├─────────────────────────────────────────────────────┤
│  RAW VAULT                                           │
│  memories — atomic, append-only, never modified      │
├─────────────────────────────────────────────────────┤
│  ENTITY GRAPH                                        │
│  entities, relationships — the knowledge graph       │
├─────────────────────────────────────────────────────┤
│  TAXONOMY                                            │
│  dimension_types, dimensions — the category tree     │
└─────────────────────────────────────────────────────┘
```

### The Raw Vault: `memories`

The most important design decision in the schema: **raw memories are never modified**. They are append-only records of what was captured, when, from what source, and with what confidence. The `content_raw` field is verbatim — exactly what the user said or wrote. A separate `content_normalized` field can hold a cleaned version, but the original is sacrosanct.

This is a deliberate rejection of the wiki model's editorial judgment at ingestion. In Life Chronicle, the AI may be wrong about what matters. We do not want AI synthesis choices baked silently into the source record.

Each memory carries:
- Its raw content and a normalized version
- A 1536-dimensional semantic embedding for vector search
- Temporal placement (specific dates or fuzzy description)
- Its life stage (a pointer into the dimension tree)
- Provenance (source type, which session, which media file)
- Confidence level (certain / probable / uncertain / inferred)

### The Entity Graph: `entities` and `relationships`

People, places, organizations, concepts, and artifacts are first-class entities — not just tags. This means a person like "Beth Lyons" is a node with her own record, aliases, dates, and attributes. Memories reference her through a junction table that specifies her *role* in the memory (participant, witness, location, antagonist).

Relationships between entities are typed directed edges with temporal bounds. The relationship type vocabulary (parent_of, mentored, collaborated_with, antagonist_of, lived_at, etc.) is pre-seeded from the WisdomTopicSort taxonomy but is extensible. The `inverse_code` field means graph traversal in either direction is clean: if you know A mentored B, the inverse (B was mentored by A) is derivable.

This structure enables genuine graph queries:
- Who were all the mentors across my professional life, and which memories support each relationship?
- What places did I live between ages 20 and 35, and who did I know in each?
- Which people appear in both my early career memories and my romantic life memories?

### The Tagging Layer

Three junction tables connect the raw vault to the rest of the schema:

`memory_dimensions` — tags each memory across the ten dimension axes, with weight and provenance (was it the user or an agent that tagged it?)

`memory_entities` — links memories to entities with roles (subject, participant, location, etc.)

`memory_media` — attaches photos, audio, video, and documents to memories

### The Synthesis Layer: `syntheses`

This is where the Karpathy wiki insight is incorporated — not as a replacement for the raw vault, but as an explicit, auditable, invalidatable derived layer. A synthesis record holds:

- **Type**: life_period_narrative, relationship_portrait, topic_synthesis, entity_biography, pattern_insight, contradiction_flag, wisdom_distillation, timeline_segment, persona_facet
- **Scope**: which dimension, entity, relationship, or time range it covers
- **Content**: the AI-generated narrative or insight
- **Source memory IDs**: every memory that contributed to it — full provenance
- **Agent model and prompt hash**: for auditability and reproducibility
- **Lifecycle fields**: when generated, whether invalidated (when source memories change), whether the user has reviewed it

When a new memory is added that touches a synthesis's scope, that synthesis is flagged as `invalidated_at = NOW()` and `is_current = false`. A background Synthesis Agent then regenerates it. The user always knows they are reading either a current synthesis or that a refresh is pending.

The `contradiction_flag` synthesis type is particularly important — it explicitly surfaces conflicts between memories rather than silently resolving them, directly addressing the concern raised in the reading about AI editorial judgment smoothing away valuable tensions.

---

## Part III: Platform Recommendation

### The Candidates

**PostgreSQL 15+ with pgvector** — Relational, ACID, battle-tested. The pgvector extension adds native 1536-dimensional vector support with IVFFlat and HNSW indexing. JSONB columns handle extensible attributes. Recursive CTEs handle graph traversal. Full-text search via tsvector/tsquery. Concurrent multi-agent write access is native (row-level locking). Supabase provides managed hosting with built-in auth, real-time subscriptions, and an object storage layer for media files.

**Neo4j** — A purpose-built graph database with native Cypher query language. Genuinely excellent for deep relationship traversal. But: running Neo4j alongside PostgreSQL doubles operational complexity, adds cost, and creates sync problems. And crucially, Neo4j has no native vector search (or weak approximations) — meaning you still need a separate vector store.

**SurrealDB** — Multi-model: relational, document, and graph in one engine. Attractive in theory. In practice, it's significantly less mature, has a smaller ecosystem, fewer hosting options, and is not yet battle-tested at the data volumes or access patterns Life Chronicle will require.

**Weaviate / Qdrant (vector-primary)** — These are excellent semantic search engines but are not general-purpose databases. They would need to be paired with a relational store anyway, creating the same sync complexity as Neo4j, without the graph benefits.

**Hybrid (PostgreSQL + Neo4j + vector store)** — The "use the right tool for each job" temptation. Resist it until forced. Three databases means three schemas to keep in sync, three failure modes, three operations burdens, and three billing items. Start with one.

### The Recommendation: PostgreSQL + pgvector via Supabase

PostgreSQL with pgvector is the right choice for Life Chronicle v1 through at least v2. The reasons:

It is already the established stack in prior project threads (Supabase + pgvector), eliminating the migration question.

It handles all four required query types in a single engine:
- **Semantic similarity** via pgvector (`embedding <=> query_vector`)
- **Structured / relational** via standard SQL (`WHERE life_stage_id = ? AND occurred_at_start > ?`)
- **Graph traversal** via recursive CTEs (`WITH RECURSIVE` across the relationships table)
- **Full-text** via tsvector indexes on content_raw

It supports concurrent multi-agent access natively — a Capture Agent, a Tagger Agent, a Synthesis Agent, and a Planner Agent can all write to the same database simultaneously without conflict, because they write to different tables and PostgreSQL row-level locking handles the rest. This is the explicit failure mode of the Karpathy wiki architecture when multiple agents are involved.

The `dimensions` table as a self-referencing tree means new life categories can be added without any schema migration — a row insert, not an ALTER TABLE.

When graph traversal genuinely becomes a bottleneck (which will require a very large relationship graph before it matters), a read replica with a graph extension or a Neo4j sync can be added incrementally without rearchitecting the primary store.

Supabase adds: managed auth (Row Level Security for per-user data isolation), real-time subscriptions (live updates to the app as memories are added), Storage (for media files), Edge Functions (for lightweight agent invocation), and a generous free tier for development.

### When to Reconsider

The recommendation should be revisited if:
- The relationship graph exceeds ~500,000 edges per user and recursive CTE performance degrades (switch to Apache AGE, a PostgreSQL graph extension, before reaching for Neo4j)
- The vector index exceeds ~1 million embeddings and IVFFlat accuracy degrades (switch to HNSW index, available in pgvector 0.5+)
- A need emerges for real-time multi-user collaborative editing of the same memory (adds conflict-resolution complexity, still solvable in Postgres)

---

## Part IV: Multi-Agent Architecture

The schema is designed from the outset to support a multi-agent architecture where each agent has a distinct responsibility and a distinct primary table:

**Capture Agent** — Conducts interviews (voice or text), produces `memories` records and `interview_sessions` records. Writes raw, never synthesizes.

**Tagger Agent** — Reads new untagged memories, produces `memory_dimensions`, `memory_entities`, and `memory_media` links. Can run concurrently with Capture Agent.

**Entity Agent** — Detects new entities mentioned in memories, creates or updates `entities` records, proposes `relationships`. Coordinates with the user to confirm new relationship claims.

**Planner Agent** — Reads `coverage` records to identify which dimension × entity combinations are thin or unexplored. Schedules the next interview session. Writes `coverage.next_prompt_at` and `coverage.last_prompted_at`.

**Synthesis Agent** — Monitors for invalidated syntheses (where `is_current = false`). Reads the relevant source memories, generates new synthesis content, writes a new `syntheses` record. Never modifies raw memories.

**Search Agent** — Serves semantic and structured queries against the full schema. Read-only. The consumer of all the work done by the other agents.

**Timeline Agent** — Refreshes the `timeline` materialized view after memory inserts. Lightweight.

Each agent operates on different tables and can run simultaneously without coordination overhead. The synthesis invalidation mechanism (`invalidated_at`, `is_current`) provides eventual-consistency signaling between agents without requiring a message queue in v1.

---

## Part V: The Karpathy/OpenBrain Synthesis — What We Chose and Why

The reading presents the core trade-off clearly: **whose understanding matters — the AI's compiled synthesis, or the raw provenance of facts?**

For Life Chronicle, the answer is: **both, and they must be kept separately distinguishable by the user.**

We adopt the OpenBrain principle for the raw vault: memories are stored faithfully with full provenance. The user can always trace any claim back to the specific memory records that support it. The AI never edits what the user said.

We adopt the Karpathy principle for the synthesis layer: pre-built narratives, portraits, and insights exist so that the system can answer "who was my most significant mentor?" without reconstructing the answer from scratch every time.

But we add two safeguards the original Karpathy architecture does not include:

1. **Full source provenance on every synthesis.** Every synthesis record lists every memory ID it drew from. The user can always inspect the raw material.

2. **Contradiction flagging as a first-class synthesis type.** Rather than letting the AI resolve contradictions by picking one account, the system surfaces them explicitly for user review. Tensions in a life story are often the most interesting data.

The result is a system where the AI is a reader (for raw memories), a tagger (for dimension assignment), and a writer (for synthesis) — but the raw vault is beyond its editorial reach.

---

---

## Part VI: The Globe — Geospatial Architecture and the Life Journey View

### The Vision

A 3D navigable globe where a user can traverse the arc of their life geographically — each place they lived or visited rendered as a weighted stop, its visual prominence proportional to the density of memories anchored there. Pausing on a stop surfaces a synthesized portrait of that period and place. Drilling in opens the individual memories. Time becomes the animation axis: the globe animates through a life chronologically, dwelling longer on places where more time was spent.

This is not a gimmick. Geography organizes autobiographical memory in ways that linear timelines do not. People remember their life in chapters that are often as much spatial as temporal — "when we lived in Spain," "my New York years," "growing up on the base." A navigable globe makes those chapters viscerally accessible.

### What Was Added to the Schema

**PostGIS extension** gives PostgreSQL native geospatial capability — geometry types, spatial indexing, Earth-aware distance calculations, and GeoJSON export. It is available on Supabase with a single extension enable.

**`place_subtype` enum on `entities`** classifies place entities as continent, country, region, city, neighborhood, address, landmark, natural feature, transit hub, military base, or vessel. This drives icon selection, zoom level, and bounding treatment on the globe — a country gets a polygon boundary, a specific address gets a pin, a natural feature gets a terrain marker.

**`geom GEOGRAPHY(GEOMETRY, 4326)` column on `entities`** stores the actual spatial representation using the WGS84 coordinate system (the same as GPS and Google Maps). `GEOGRAPHY` rather than `GEOMETRY` because distance and area calculations on a geographic column automatically account for Earth's curvature — critical for correctly sizing polygons and computing travel distances. A specific address is stored as a `POINT`; a city or country is a `POLYGON` or `MULTIPOLYGON` loaded from OpenStreetMap or a similar source.

**`elevation_m`, `country_code`, `timezone`, `external_geo_id` / `external_geo_source`** complete the place metadata. Elevation enables proper 3D terrain placement. The external geocoding reference (OSM relation ID, Google Place ID, Wikidata Q-number) is the anchor for automated coordinate resolution — when the Entity Agent creates a place, it calls a geocoding API and stores the canonical external ID alongside the resolved geometry.

**GiST spatial index** on the `geom` column enables fast bounding-box and radius queries — "all memories within 100km of Paris" executes against the index, not a full table scan.

### The `life_journey` View

The view joins the `relationships` table (where `lived_at`, `visited`, `worked_at`, `attended` legs live) to the `entities` table to produce one row per place-leg, carrying everything the visualization layer needs:

- `geojson` — the place geometry as GeoJSON, ready for Cesium/Mapbox/Three.js
- `centroid_geojson` — a computed centroid point for polygon places (for camera positioning)
- `days_at_place` — duration in days, computed from `started_at` / `ended_at` (drives animation pacing)
- `memory_count` — count of memories anchored to this place (drives visual weight)
- `memory_ids` — array of memory IDs for drill-down
- `synthesis_id` — the current `entity_biography` synthesis for hover/pause display
- `elevation_m`, `country_code`, `parent_place_name` — supporting context

### The `life_journey_geojson()` Function

Returns the entire journey as a single GeoJSON `FeatureCollection` — the canonical interchange format for geospatial visualization libraries. Each `Feature` contains the place geometry plus all leg metadata as `properties`. A Cesium or Mapbox implementation consumes this directly. The function is called per user and ordered by `started_at`, giving the chronological sequence.

### The `memories_within_radius()` Function

Spatial query helper: given a lat/lng and radius in km, returns all memories whose place entities fall within that radius. Powers the "memories near here" interaction on the globe — when a user zooms into a region and asks what they remember about it.

### Geocoding Pipeline (Operational Requirement)

The schema supports the geospatial layer, but populating it requires a geocoding step in the Entity Agent's workflow. When a new place entity is created from a memory or interview response, the agent should:

1. Search OpenStreetMap Nominatim (free, no API key) or Google Maps Geocoding (precise, paid) with the place name and any available context (parent place, life stage date range for disambiguation)
2. Store the resolved `external_geo_id` and `external_geo_source`
3. Store the resolved `geom` (point for addresses, relation boundary for cities/regions)
4. Store `country_code`, `timezone`, and `elevation_m` from the geocoding response
5. Flag for user confirmation if confidence is below threshold

For historical places that no longer exist as named (military bases that closed, streets that were renamed), manual coordinate entry with `external_geo_source = 'manual'` is the fallback.

### Recommended Visualization Stack

**Cesium.js** — the strongest candidate for the 3D globe vision. Open-source, handles WGS84 natively, supports terrain rendering with real elevation data (via Cesium Ion or open terrain tiles), and has a rich entity API for placing markers, polygons, and animated paths on the globe. The `life_journey_geojson()` output loads directly into Cesium's GeoJSON data source.

**Mapbox GL JS** — excellent for 2D/2.5D map views with smooth animation. Better for the "map with timeline scrubber" interaction pattern. Easier to style than Cesium.

A production implementation would likely offer both: a Mapbox map view for browsing and a Cesium globe view for the full 3D temporal traversal experience.

---

---

## Part VII: Temporal Architecture and the Temporal Agent

### The Problem Space

Human autobiographical memory is radically imprecise about time. A person may recall an event with complete sensory vividness — the smell of a kitchen, the slant of afternoon light, the exact words someone said — while having almost no idea what year it occurred. Yet they may also know, with complete certainty, that it happened before a particular move and after a particular birth. That relative knowledge is real temporal information, and a system that can only store precise calendar dates throws it away entirely.

Life Chronicle must therefore treat temporal knowledge as something that exists on a spectrum of certainty, is stored explicitly in whatever form it comes in — precise, approximate, or purely relational — and is progressively refined as more information arrives. The goal is a timeline that starts coarse and sharpens over time, not a timeline that demands precision the user cannot honestly provide.

### Two Distinct Temporal Concepts in the Schema

The schema separates two things that are easy to conflate:

**Event duration** (`occurred_at_start`, `occurred_at_end`) is about the span of the experience itself. A two-week road trip has a start and an end. A conversation has an approximate duration. These fields describe the shape of the event in time, not how well we know when it happened.

**Temporal uncertainty envelope** (`time_earliest`, `time_latest`, `time_estimate`, `time_precision`, `time_confidence`) is about epistemics — how precisely the system knows when the event occurred. A well-dated memory has `time_earliest` and `time_latest` one day apart. A memory known only to a decade has a ten-year spread. A completely undated memory has both as NULL and `time_precision = 'unknown'`. As constraints accumulate and the agent asks clarifying questions, `time_earliest` and `time_latest` converge. The `time_precision` field updates automatically when the envelope narrows — so a memory that started as 'decade' becomes 'year' when enough constraints are established, without the user explicitly assigning a year.

`time_estimate` is the single best-guess point within the envelope, used for sorting and display. It never claims more precision than `time_precision` allows. A memory with `time_precision = 'year'` displays as "1973" even if `time_estimate` is technically a midpoint date — the display logic enforces honest labeling via the `timeline_with_uncertainty` view.

### The Constraint Graph

Relative ordering relationships between memories are stored as first-class structured data in the `temporal_constraints` table, not buried in natural-language text. Each constraint is a typed relationship: *before*, *after*, *concurrent*, *during*, *soon_before*, *soon_after*, *same_day*, *same_year*, *same_trip*.

Every constraint links a **subject** (the memory being constrained — typically the fuzzier of the two) to an **anchor** (the better-known temporal reference point). An anchor can be another memory, a piece of dated media (a photograph with an EXIF timestamp), an entity event (a birth, a move, a marriage whose date is known), or a world event (a historical occasion that can be looked up). Constraints carry a confidence score and a provenance field indicating whether they were user-stated, user-confirmed, agent-inferred from content text, or derived transitively from other constraints.

Together these constraints form a directed acyclic graph of temporal ordering. The `propagate_temporal_constraints()` function traverses this graph and pushes inferences back into memory records: a *before* constraint tightens `time_latest`; an *after* constraint tightens `time_earliest`. The function is called iteratively until no further changes occur (fixed point). Transitive inferences — A is before B, B is before C, therefore A is before C — are materialized as new constraint rows with `stated_by = 'transitive'`, making the derivation chain inspectable.

When propagation produces a conflict — a memory whose `time_earliest` has been pushed past its `time_latest` — the `detect_temporal_conflicts()` function surfaces it. These conflicts are escalated by the Temporal Agent as `contradiction_flag` synthesis records for user review: "Two constraints you've given me can't both be true. Here's the conflict."

### The Temporal Agent: Role and Behavior

The Temporal Agent is a continuously running background agent whose singular mission is temporal resolution — systematically narrowing the uncertainty envelopes of fuzzy memories through a combination of automated inference and proactive conversation with the user.

Its work cycle has four phases:

**Phase 1 — Inventory.** After each propagation pass, the agent queries `temporal_resolution_queue` for the highest-priority fuzzy memories still pending. Priority score is a composite of: how wide the uncertainty envelope is (uncertainty in days), how many other memories would cascade-benefit if this one were resolved (cascade benefit), and whether strong candidate anchors exist (anchor availability). A memory that many other fuzzy memories are *before* or *after* is worth resolving urgently because resolving it propagates benefits across the whole cluster.

**Phase 2 — Anchor discovery.** For each high-priority fuzzy memory, the agent searches for candidate anchors: dated media that shares entities with the memory, other memories with better-known dates that share the same life stage or location, entity events (births, moves, job changes) whose dates are known, and world events mentioned in the memory's text. It ranks these anchors by how much they would narrow the envelope if confirmed. The best three to five are stored in `candidate_anchor_ids` on the queue entry.

**Phase 3 — Question generation.** The agent composes a targeted, conversational question designed to establish a specific ordering constraint. The question form is deliberately relational rather than interrogative — rather than "what year did this happen?", it asks "did this happen before or after your family moved to Texas?" This matters because people rarely know a year but frequently know an ordering. A good temporal question presents a concrete anchor the user will remember and asks for the relationship, not the date. When multiple anchors are available, the agent selects the one that would produce the greatest envelope reduction on confirmation.

Examples of generated questions:

*"You described a memory of a neighborhood bonfire where everyone brought food to share. You've also told me that your family moved to the house on Lincoln Avenue in the summer of 1968. Did the bonfire happen before or after that move, or are you not sure?"*

*"You mentioned a trip to the mountains that you think was in the early seventies. There's a photograph in your collection of that trip dated July 1971. Does July 1971 feel right for that memory, or do you think there might have been more than one mountain trip?"*

*"You have three memories from what you've described as your 'college years' that we can't yet place within that period. Your college years ran from roughly 1972 to 1976. Do you remember whether [memory title] happened in your earlier college years, around the middle, or toward the end?"*

**Phase 4 — Constraint ingestion and propagation.** When the user responds, the agent parses the answer and creates one or more new rows in `temporal_constraints` with `stated_by = 'user_confirmed'`. It then calls `propagate_temporal_constraints()`, updates the affected memories, recalculates priorities across the queue, and checks for new conflicts. Memories that reach the 'day' or 'month' precision threshold with high confidence are marked resolved and removed from the active queue.

### Proactive Engagement: When and How

The Temporal Agent does not wait to be invoked. It runs proactively in two modes:

**Scheduled review sessions.** The Planner Agent allocates periodic "temporal clarification" sessions — short, focused conversations of three to five questions dedicated exclusively to temporal resolution. These are interleaved with regular memory-capture interviews so that as the collection grows, the timeline continuously sharpens rather than accumulating ever-larger uncertainty.

**Opportunistic mining.** Whenever a new memory is captured, the Temporal Agent scans its `content_raw` for temporal language — phrases like "three years after," "just before we left," "the same summer that," "right around the time Kennedy was shot" — and extracts candidate constraints. These are inserted as `stated_by = 'agent_inferred'` with lower confidence, and the affected memories are added to the resolution queue for user confirmation. This passive mining means many constraints are established without any extra burden on the user: they are already embedded in the natural language of the recollection.

**Media correlation.** When dated media is added to the collection — a photograph with an EXIF timestamp, a scanned document with a legible date, a video file — the agent immediately searches for memories that share entities with that media item (people in the photo, places mentioned in the document) and proposes temporal constraints linking those memories to the media date. A dated photograph is one of the most reliable temporal anchors available, and the agent treats it as such.

### The User Experience of Temporal Resolution

From the user's perspective, temporal resolution should feel like a curious companion helping them reconstruct their own timeline — not an interrogation or a data-entry exercise. Several design principles govern the agent's conversational approach:

**Never ask for a year directly** unless the user has demonstrated strong temporal memory. People know orderings far better than they know dates. The agent exploits this.

**Present the anchor, not the question in abstract.** "Did this happen before or after your move to Austin in 1979?" works because "Austin, 1979" is a concrete anchor the user can place. "Do you know approximately when this occurred?" does not work because it asks the user to do the work the agent should be doing.

**Offer an easy escape.** Every question should offer "I'm not sure" as a full and acceptable answer. An uncertain answer adds no constraint — and that is fine. The agent notes the memory as having been approached and tried, schedules it for a later attempt with a different anchor, and moves on.

**Confirm before acting on inferences.** Agent-inferred constraints (`stated_by = 'agent_inferred'`) are never propagated automatically. They are presented to the user for confirmation first. This preserves the principle that the raw vault is never corrupted by AI assumptions — only user-stated or user-confirmed constraints affect the temporal record.

**Show the user the timeline improving.** A visualization that shows the timeline band narrowing as constraints are confirmed is a powerful reward loop. The user sees their fuzzy "early 1970s" band sharpen to "1972–1973" and then to "summer 1972" in response to three questions. This makes temporal resolution feel like discovery rather than data entry.

### Residential History as the Primary Temporal Scaffold

Of all the life dimensions available as temporal anchors, the sequence of homes a person has lived in is uniquely powerful. It deserves special treatment — not just as a category of memory, but as the structural backbone the Temporal Agent builds first before attempting to resolve anything else.

The reason is a property no other life dimension shares: **strict sequential non-overlap**. A person occupies one primary home at a time. This means every home in the sequence does double duty as a temporal anchor: it simultaneously closes the previous period and opens the next. A single confirmed move date generates two temporal constraints in one — an upper bound on everything associated with the home you left, and a lower bound on everything associated with the home you entered. No other class of life event has this bilateral constraint-generation property.

Consider a simple residential chain:

```
[Lockbourne AFB, Ohio]  →  [London, England]  →  [Madrid, Spain]  →  [Los Angeles]
     ?  –  1962               1962  –  1966        1966  –  1971       1971  –  ?
```

Once the move to London is confirmed as 1962, every memory tagged to the Ohio home is constrained *before* 1962, and every memory tagged to the London home is constrained *after* 1962. As each subsequent move is dated, the entire chain of period boundaries propagates outward through the constraint graph, tightening thousands of memories simultaneously. The residential spine is, in effect, a coarse but comprehensive temporal grid laid over the entire life.

**Phase 0 of temporal onboarding.** For this reason, the Temporal Agent treats residential history as Phase 0 — the first structured interview conducted before any other temporal resolution work begins. The Capture Agent's opening residential interview asks the user to walk through every home they can remember, from earliest to most recent, noting approximate move dates, who they lived with, and why they moved. Even rough date estimates at year precision are enough: the constraint propagation engine will make use of them immediately.

The interview is deliberately structured around what people remember easily:

- The *place itself* (address, neighborhood, what the house looked like) — vivid and reliable
- *Who was there* (family composition, housemates) — reliable; family events are memorable anchors
- *Why the move happened* — career transfer, military orders, marriage, school, financial change; these connect the residential spine to other timeline dimensions
- *What was happening in life at the time* — school year, job, relationship status; these generate additional constraints

Dates are asked last and framed relationally: "Was this before or after [another event the user has already described]?" rather than "What year did you move?"

**The move_reason dimension and cross-timeline connections.** The `move_reason` field on each `lived_at` relationship — drawn from a controlled vocabulary (career relocation, military posting, marriage, education, family care, financial, displacement, adventure) — is not decorative. It is a signal to the Temporal Agent about where to look for corroborating anchors in adjacent timelines.

A `career_relocation` move implies a job-start event somewhere nearby in the memories. A `military_posting` implies an orders date and a unit assignment. A `marriage` move implies a wedding date. Each of these connections can generate additional constraints that further tighten the temporal envelope — not just for the residency itself, but for all the memories surrounding it. The residential chain becomes the trunk of a tree, with branches of constraint reaching into career history, family history, and relationship history at every node.

**Gap detection.** The `residency_timeline` view computes `gap_days_to_next` — the interval between moving out of one home and moving into the next. Gaps are themselves meaningful: a long gap may indicate a period of travel, temporary housing, or a stay with family that deserves its own record. The Temporal Agent surfaces gaps to the user as gentle prompts: "There appears to be about eight months between when you left London and when you arrived in Madrid. Were you somewhere else during that time, or is one of those dates uncertain?"

Overlaps (negative gap values) flag potential data errors — two primary residences whose date ranges cross — and are escalated as contradiction flags for user review.

**The `generate_residency_constraints()` function.** This database function runs automatically when a residency is added or its dates are confirmed. It produces two classes of constraints: *intra-residency* (every memory linked to a home place entity gets a `during` constraint anchoring it to that home's date range) and *inter-residency* (memories in one home get a `before` constraint at the move-out date, preventing them from bleeding into the next period). It then calls `propagate_temporal_constraints()` immediately, so the cascade benefit is realized in the same transaction.

### Cascade Benefit and Cluster Resolution

The most powerful property of the constraint graph is cascade: resolving one well-connected memory can tighten dozens of others. The priority scoring in `temporal_resolution_queue.cascade_benefit` is the agent's estimate of this downstream value.

A practical example: if "the Christmas we spent in my grandmother's house in Ohio" can be dated to 1964 with moderate confidence, and fifteen other memories are already constrained as *before* or *after* that Christmas, all fifteen narrow simultaneously in one propagation pass. The agent therefore prioritizes that Christmas memory very highly, even if its own envelope is only moderately wide — the cascade value justifies the effort.

This cluster reasoning is also the basis for the agent's sequencing strategy across longer sessions: rather than attacking the fuzziest memory first, it looks for "keystone" memories that are deeply embedded in the constraint graph. Resolving keystones propagates the most benefit across the collection.

---

## Part VIII: Privacy Architecture — The Five-Tier Model

> **⚠ Superseded April 2026.** The five-tier `privacy_tier` ENUM model documented in this section is being replaced by the **Access Cards framework** (see **Part X** below and the canonical specification at `documentation/access_cards_requirements.md`). The five tiers map to five system-defined cards under the new model and remain visible in the MVP UI; the schema underneath becomes card-based. This Part is retained as the migration's "from" specification and for historical context. Do not extend the tier model further; new privacy work should target the Access Cards tables.

### The Problem Privacy Solves

A life chronicle is among the most intimate datasets that can exist. It contains memories of grief, addiction, estrangement, illness, professional failure, and relationship wreckage alongside celebration and joy. A person builds this collection for their own benefit — and potentially, selectively, to share with people they trust. The system must make the risk of accidental exposure as close to zero as possible, while not making selective sharing so cumbersome that it goes unused.

A simple private/public boolean — the kind of flag typical in social platforms — is insufficient. A person may want to share their professional milestones with colleagues while keeping their family dynamics entirely private, and share some family memories only with their adult children. These distinctions cannot be expressed in binary.

### The Five Tiers

The privacy tier is a first-class typed enum applied uniformly to every content-bearing table: `memories`, `entities`, `relationships`, `media`, and `syntheses`. The five tiers, ordered from most to least restrictive:

**private** — visible only to the owning user. This is the default for all content. No shared access is ever granted unless the user explicitly promotes a record. The system can never automatically promote a record to a less restrictive tier.

**close_friends** — visible to the user and a small, explicitly curated set of individuals the user has invited as close friends. These are not social-graph connections; they are specific people the user has granted explicit access to, and the list is managed directly by the user.

**family** — visible to the user and individuals the user has linked as family members (connected via person entities with family relationship types). Family membership is derived from the entity-relationship graph, but the user must explicitly "activate" a family member for sharing before they can see anything.

**professional** — visible to the user and confirmed professional connections. This tier is designed for career history, accomplishments, and professional narrative that the user may want LinkedIn-adjacent contacts to see. Professional connections must be explicitly granted access — the tier is not inferred from any import.

**public** — visible to any authenticated viewer of the system. This tier is reserved for memories and narratives the user is proud to broadcast — achievements, published work, public records. Nothing is ever public by default.

### The Default Rule

**Every record is created `private`.** The only exception is if the user has explicitly configured a different default tier in their profile preferences — and even then, records tagged with sensitive dimensions override that preference back to `private`. There is no way for a record to become less restrictive than `private` without deliberate user action.

### Sensitive-Dimension Auto-Lock

The `dimensions` table carries an `is_sensitive` boolean column. Dimensions covering medical, mental health, legal, financial, sexual, and addiction topics are seeded with `is_sensitive = true`. When the Capture or Tagger Agent assigns a sensitive dimension to a memory, two things happen automatically at the application layer:

1. `privacy_tier` is forced to `'private'` regardless of any user default.
2. `tier_locked` is set to `true`, which surfaces a visual lock indicator in the UI and requires the user to explicitly acknowledge they are choosing to share something sensitive before promotion is allowed.

This is enforced in application code rather than in SQL because it requires conditional awareness of dimension tags at write time. The SQL schema supports it structurally (the columns exist and are not nullable) but does not enforce it in a trigger — the trigger would require a join on dimension tags at insert time, which introduces complexity better handled in the Capture Agent.

### Synthesis Tier Inheritance

Synthesis records are derived from one or more source memories. A synthesis that quotes from, summarizes, or analyzes a private memory cannot itself be less restrictive than that memory. The inheritance rule is strict:

**A synthesis inherits the most restrictive tier among all its source memories.**

This is enforced by a database trigger (`trg_syntheses_privacy_tier`) that fires before every INSERT or UPDATE on the `syntheses` table. The trigger calls `compute_synthesis_tier(source_memory_ids)`, which executes `MIN(privacy_tier)` across the source set — since the enum is declared in restriction order, MIN() yields the most restrictive value.

A second trigger (`trg_cascade_synthesis_tier`) fires after any UPDATE of `privacy_tier` on the `memories` table. When a source memory's tier changes, all currently-active syntheses that reference it are recomputed. This means: if a user promotes a memory from `private` to `family`, any synthesis that drew only from that memory (and other family-or-less-restrictive memories) can now be shared with family — the cascade applies immediately.

Demotion (making a source memory more restrictive) also propagates immediately: if the user locks a memory back to `private`, every synthesis containing it reverts to `private` in the same transaction.

### Media Privacy

Media items (photos, audio recordings, video clips) carry their own `privacy_tier` column independent of the memories they are attached to. The reason: a photo might appear in a memory shared at the `family` tier, but the raw audio recording of the interview session that produced the memory may be `private`. Consumers must apply the more restrictive of the two tiers — the memory tier and the media item tier — before surfacing any media.

This dual-tier check is enforced in the API layer, not in the database, because it requires joining across the `memory_media` table at query time.

### Relationship Privacy

The existence of a relationship between two entities is itself sensitive information. Knowing that a person has a therapist, an estranged sibling, or an ex-spouse is protected under the same model. Relationships default to `private`. When a user shares their professional profile publicly, the system does not automatically expose their family relationships — each relationship's tier is set independently.

### Row Level Security

Supabase Row Level Security policies implement the tier model at the database level, ensuring that no API query — regardless of the application code — can return a row a viewer is not entitled to see. The policies are scaffolded in the schema (commented out) pending the creation of the connection group tables (`user_close_friends`, `user_family_members`, `user_professional_connections`). Until those tables exist, the effective behavior is that all content is visible only to its owning user, which is the safest possible interim state.

The Service Role key, used by all agents and background jobs, bypasses RLS entirely. It must never be exposed client-side or in browser-side code. All agent writes and reads use Service Role. All user-facing reads go through the anon/authenticated role, which RLS fully governs.

### Gemini Taxonomy Cross-Reference — Privacy Implications

The Gemini Taxonomy document (October 2025) organizes life topics into eight chronological series: Early Life & Formative Experience, Education, Career & Professional Life, Relationships, Health & Wellness, Creative & Personal Pursuits, Homes & Transitions, and Financial Milestones. Cross-referencing against the WisdomTopicSort framework reveals strong alignment on topic coverage, with two notable additions: a **Vehicle** entity series (cars, motorcycles, boats as owned artifacts with chronological history) and elevated treatment of **financial milestones** (not just as events but as a named series comparable to career milestones).

For the privacy model, the Gemini Taxonomy's Health & Wellness series and the financial series are the two categories that most reliably warrant `is_sensitive = true` on their dimension nodes. Medical events, mental health treatments, addiction recovery, debt situations, and legal issues should all auto-lock to `private`. Career setbacks and terminations are borderline — they may warrant `is_sensitive` on specific leaf dimensions but not at the series level.

---

## Part IX: Ontology Bootstrapping — Eliciting the Personal Semantic Layer

*Added April 2026, informed by Nayan Paul's "Ontology-Driven Agents: The Missing Layer for Knowledge Apps" (Medium, March 2026), cross-applied to the personal domain.*

### The Core Problem: A Personal Ontology Cannot Be Imported

Enterprise ontology-driven agents work by consulting a pre-existing institutional schema — "Customer," "Contract," "Regulatory Category" are defined before the agent arrives, and the agent reasons over those definitions. The architecture is sound, but the assumption doesn't transfer to personal life chronicles.

For Life Chronicle, **the person is the domain**. What constitutes a "major career milestone" for one person is not the same as for another. What "family" means — who is in it, who has been excised from it, what emotional weight it carries — is irreducibly personal. The vocabulary of life periods is idiosyncratic: one person calls a stretch of years "the lost decade," another calls it "when we were still in Philly," and both phrasings carry meaning that no external schema can pre-define.

This means the personal ontology cannot be imported. It must be **elicited progressively from the person**, in a structured way, before memory collection begins in earnest. This is a fundamental difference from enterprise AI architecture and has significant implications for how the system bootstraps.

### Why Ordering Matters: The Orphan Memory Problem

Memories collected before a semantic scaffold is established are orphans. They have no reliable temporal home, entity resolution is guesswork, and topic classification is inconsistent. Every new session has to re-ask about people and places already mentioned. The cleanup cost accumulates, and user fatigue sets in.

When the scaffold exists first, every subsequent memory immediately has a candidate home: a period it belongs to, entities it references that are already in the graph, topics that are already named. Integration is fast, accurate, and satisfying for the user.

The sequencing is therefore not optional. It is the difference between a collection that compounds in value over time and one that becomes increasingly expensive to maintain.

### The Dependency Ordering — Four Tiers

Ontology elements have a natural dependency hierarchy. Higher tiers cannot be reliably placed without lower tiers being established first.

**Tier 1 — The Structural Scaffold** (universal across all people; must come first)

These are the coordinate systems into which everything else gets placed.

Temporal anchors — birth, major life transitions, significant moves. These establish the timeline from which all subsequent memory dating proceeds. Geographic anchoring — the residential history that is already designated as Phase 0. Sequential, non-overlapping residencies provide bilateral temporal constraints (each confirmed move date simultaneously bounds the end of one period and the beginning of another). Chapter naming — how does *this person* divide their own life into periods? "The Philly years," "before I left finance," "after my father died." This is where personal ontology first diverges from universal structure, but the elicitation question is universal even if the answers differ profoundly.

**Tier 2 — The Entity Seed** (structure is universal; content is personal)

The ten to fifteen most important people: family members, mentors, partners, formative friendships and rivalries. Key institutions: schools, employers, organizations. These do not need to be exhaustive — just the major nodes. The purpose is that when someone later mentions "my mentor at the agency," the system has a candidate entity to resolve against rather than treating it as an unknown. Relationship quality elicitation also begins here: not just *who*, but *what kind* — and what that relationship type means to this specific person.

**Tier 3 — The Topic Map** (builds on scaffold and entity seed)

Recurring themes and interests across the person's life. Professional domains and disciplines. Life preoccupations — the questions, causes, or challenges that recurred across decades. These dimensions can only be meaningfully mapped once the person's periods and entities are known. "Music was important to me" means something different if it was a career, a private solace, a family tradition, or an abandoned aspiration.

**Tier 4 — Content Collection** (only after Tiers 1–3 are substantially established)

Individual memories — specific recollections, anecdotes, formative moments — now integrable because they have a home. Syntheses — narrative arcs, character portraits, wisdom statements — now trustworthy because they are grounded in a confirmed scaffold.

### Universal Structure, Personal Content

The commonalities of human life experience are what make a standardized opening protocol possible. Every human life has temporal periods, geographic locations, family (however constituted), some form of education, some form of work, and relationships. These universal categories allow the opening interview questions to be scripted once and applied to all users. The divergence begins in Tier 1 Stage 2 (chapter naming) and deepens from there.

This also enables an **adaptive branching protocol** based on what early answers reveal. A person with a single long career gets a different depth of professional chapter elicitation than one who had three distinct careers. A highly geographically mobile person gets deeper geographic anchoring questions. A person with a complex family structure — blended, estrangement, chosen family — gets more deliberate family entity elicitation. The questions that open every session are universal; the direction and depth of follow-up is computed from what the person reveals.

### Ontology Elicitation vs. Memory Collection: Two Distinct Interview Modes

These are categorically different agent behaviors with different goals, different question styles, and different success criteria. Conflating them is an architectural mistake.

Ontology bootstrap sessions are trying to establish structure. The questions are systematic ("walk me through all the places you've lived, in order"), the output is entity records and period definitions, and success means the scaffold is complete enough to anchor subsequent content. Memory collection sessions are trying to gather content. The questions are evocative and open-ended ("tell me about the summer after you graduated"), the output is memory records tagged and anchored to the scaffold, and success means rich, well-placed recollections.

The `interview_sessions` table needs a `session_type` field to encode this distinction, since the agent prompts, downstream processing, and evaluation criteria differ substantially across session types. At minimum: `ontology_bootstrap`, `memory_collection`, `temporal_resolution`, `entity_resolution`, `review_and_correction`.

### Phase 0 Redefined: The Full Ontology Bootstrap Protocol

Phase 0 is broader than the residential history interview previously described. Residential history is Stage 1 of Phase 0, not the entirety of it. Phase 0 is the complete **Ontology Bootstrap Protocol** — a structured, staged sequence that must be substantially complete before memory collection begins.

**Stage 1 — Temporal/Geographic Skeleton** (approximately 15–20 minutes): Birth year and location. Complete residential history in order: place, household composition, approximate dates, reason for move. Major life transitions that don't attach to a home move: marriages, divorces, significant bereavements, career pivots.

**Stage 2 — Chapter Naming** (approximately 10–15 minutes): "How do you think about the major chapters of your life?" The system elicits the person's own vocabulary for their life periods, then reflects its inferred periodization back to the user for confirmation and correction. This vocabulary becomes the canonical period naming used in all subsequent sessions and syntheses.

**Stage 3 — Entity Seed** (approximately 20–30 minutes): Key family members (name, relationship type, period of significance in the person's life). Key professional figures (mentors, managers, collaborators, significant adversaries). Key institutions (schools, employers, organizations joined). The goal is completeness on the most significant; the long tail fills in naturally during memory collection.

**Stage 4 — Topic Map** (approximately 10–15 minutes): Main areas of interest, passion, and professional domain. Recurring life themes or preoccupations. What the person considers the spine of their own story, if they have a sense of it.

**Validation gate before memory collection begins**: After Stage 4, the system presents its understanding of the person's ontology scaffold — the periods, major entities, and topic domains — and asks the person to confirm, correct, or expand. Memory collection does not begin until this is explicitly confirmed. This gate also serves a trust-building function: the user sees that the system understands the shape of a life before it asks them to fill it in.

### The User Experience Value

Beyond the architectural benefit, the bootstrapping protocol solves a fundamental UX problem: the blank canvas. Asking someone to simply "tell me their life story" is overwhelming. There is no natural starting point. Walking them through structured, relatively tractable questions — "where have you lived?", "who are the most important people in your story?" — creates immediate forward momentum and a satisfying sense of shape and progress. The emotional weight of memory collection comes later, after the person has already built a working relationship with the system through the comparatively easier structural work.

The bootstrap interview is therefore both an ontology elicitation protocol and a **trust-building protocol** — it demonstrates that the system is competent to hold someone's story before asking them to share it.

### Relationship to Gap-Aware Reasoning

The ontology scaffold is also what enables the full gap-aware reasoning capability described in the Ontology-Driven Agent pattern. Once the scaffold is established, agents can reason not just about what content is missing, but about what *cannot be synthesized* until specific prerequisites are resolved — dependency-aware gap detection rather than simple coverage scoring.

A Synthesis Agent building a professional narrative can check: "Does this synthesis cover the required entities — employers, key managers, formative projects — that the ontology says are necessary for a complete professional narrative? If not, what specifically is missing and what question would resolve it?" That is a qualitatively different capability than a coverage matrix alone provides.

An **assumption log** — not yet in the schema — should capture every agent inference and disambiguation decision as a traceable, reviewable record. When a synthesis is subtly wrong, the user needs a path to correction: "The Tagger Agent assumed 'John' in memory #47 was the same John as in memory #12, based on shared employer." Without logging that assumption, the user sees a wrong output with no way to understand or fix it. With the assumption log, the path to correction is direct.

The schema additions required to support this architecture are: a `session_type` field on `interview_sessions`, a constraint rules table for synthesis completeness requirements, and an assumption log table for agent inference traceability. These are the next schema targets after the connection group tables needed to activate Row Level Security.

---

## Part X: Access Cards — Replacing the Privacy Tier ENUM

*Added April 2026. Supersedes Part VIII (Privacy Architecture — The Five-Tier Model). The canonical specification is `documentation/access_cards_requirements.md` (47 numbered functional requirements, schema sketch, access-evaluation algorithm, RLS policy outline, migration plan, and ten open questions). This Part is a summary; resolve to the requirements doc for any implementation work.*

### Why the Tier Model Was Replaced

The five-tier `privacy_tier` ENUM (Part VIII) imposed a strict hierarchy — Private → Close Friends → Family → Professional → Public — under which each tier was a strict superset of the one below. Real-life sharing does not honor that hierarchy. *My old Air Force buddies*, *my book club*, *the kids only*, *my advisory board*, *my therapist and my wife* are not points on a single line, and they are not contained inside any of the five pre-defined bands. The tier model also fought the schema's own extensibility principle: every other axis (dimensions, entities, relationships) was designed for unbounded extension, but privacy was capped at five values picked at design time. Three roadmap items — the **Executor role** (Part VIII Next Steps item 31), the **training-consent layer** for AI-corpus contribution, and **reciprocal sharing patterns** — could not be expressed cleanly as additional ENUM values without violating the model's logic.

### The New Model in One Paragraph

A **card** is a named permission grant created by the chronicle owner. It defines a **scope** (which records it unlocks, expressible across time band, user-named periods, life stages, dimensions, entities, places, and explicit memory IDs — with include and exclude lists) and is held by zero or more **contacts**. Possession of the card by a contact governs that contact's visibility into the owner's content. Cards may be **time-banded** (a 30-day reunion card, an executor card with a posthumous trigger). A holder's effective access is the **union** of the scopes of all cards they hold from a given owner. Synthesis visibility is the **intersection** of the per-source-memory access checks: a synthesis is visible to a card holder if and only if every source memory is also visible to that holder. Five **system cards** (Private, Close Friends, Family, Professional, Public) are pre-seeded for every user and emulate the legacy tier model. Custom cards are user-created and unbounded by schema.

### What This Replaces in Part VIII

| Part VIII concept | Access Cards replacement |
|---|---|
| `privacy_tier` ENUM column | Dropped. Records carry no tier; visibility is computed from card scope rules and explicit grants. |
| `compute_synthesis_tier()` MIN-of-sources trigger | Replaced by `synthesis_visibility_cache` materialization; visibility is intersection-of-sources. |
| Cascade trigger on memory tier changes | Replaced by recompute of the visibility cache when card scopes or memory grants change. |
| Sensitive-dimension auto-lock to `'private'` | Renamed *auto-isolation*; implemented as `record_card_grants(grant_type='auto_isolate')` against every active card. |
| Connection group tables (`user_close_friends`, `user_family_members`, `user_professional_connections`) | Replaced by `contacts` + `card_holders`. Connection-group plurality emerges from card holder lists. |
| JWT `role_tier` claim | Replaced by JWT carrying the set of card IDs the viewer holds for a given owner. |

### What This Unlocks (Beyond Tier Parity)

**Executor card** — Part VIII Next Steps item 31 sketched an "Executor role" as a possible sixth tier; it never fit the hierarchy. As a card, it is a designated holder with a posthumous-trigger validity window and a configurable scope. No new ENUM value, no new privacy primitive.

**Training/research consent** — Today's gap review identified the absence of a training-consent layer as a missed opportunity for the "AI legacy" mission claim. Under cards, training consent is one or more cards held by special "research corpus" contacts with terms-of-use metadata in the card's `metadata` JSONB. The same evaluation engine governs research access as governs every other access.

**Reciprocal sharing** — Two users who chronicle each other's stories simply hold cards from each other. No special bidirectional primitive needed.

**Time-banded sharing** — Reunion access, professional engagement windows, conditional access during a mediation — all naturally expressed as a card's `validity_start`/`validity_end`.

### New Schema Footprint

Seven new tables (sketched in `access_cards_requirements.md` §4):

- `cards` — Card definition with name, owner, validity bounds, scope rules JSONB.
- `contacts` — Potential card holders, registered LC users or email-only invitees.
- `card_holders` — Many-to-many between cards and contacts.
- `record_card_grants` — Explicit per-record include/exclude/auto-isolate overrides.
- `synthesis_visibility_cache` — Materialized synthesis-to-card visibility.
- `card_audit_log` — Immutable audit trail for all card-related actions.
- `access_log` — Holder access events (sampled at scale).

Five tables lose the `privacy_tier` column: `memories`, `entities`, `relationships`, `media`, `syntheses`. Four functions/triggers are retired: `compute_synthesis_tier()`, `trg_syntheses_privacy_tier`, `trg_cascade_synthesis_tier`, and the RLS scaffold that read `privacy_tier`.

### MVP Behavior

The schema is fully card-based from MVP day one — no `privacy_tier` ENUM, no tier-based triggers. The MVP UI exposes only the five system cards as named "tiers," preserving the simple mental model. Users can add holders and adjust scope on each system card. Custom-card creation is a Phase 2 unlock that requires zero further schema work — only the rule-builder UI and a scope-preview affordance.

### Migration

The migration from the ENUM to the card model is lossless and is specified step-by-step in `access_cards_requirements.md` §9. Every existing record's `privacy_tier` value maps to a `record_card_grants(grant_type='include')` row referencing the appropriate system card. Every `tier_locked = true` record maps to an `auto_isolate` exclusion. The ENUM column is dropped at the end of the migration.

### Open Questions

Ten open questions are tracked in `access_cards_requirements.md` §11 — terminology ("card" vs. "audience"), max card count and holder count limits, holder notification policy, link-based shares (URL-bearer access without identifying the viewer), view-as-holder UI, granular permissions beyond view (comment, suggest correction, download), conflict resolution between scope rules and explicit grants, anonymized-research access modeling, and others. These resolve into the PRD before implementation begins.

---

---

## Part XI: The Stroll — Reminiscence Feature Architecture

*Added April 2026. Canonical feature spec: `documentation/feature_reminiscence_mode.md`.*

### Purpose and Position in the Architecture

The Stroll is a re-engagement and memory rehearsal mode that is architecturally distinct from both the interview pipeline and the synthesis layer. It does not collect new structured memories through probing questions. It does not produce pre-built narratives. It presents a single existing memory from the chronicle as a compact narrative, listens for the user's response, and routes what it hears into one or more of three capture pathways.

Its outputs are three new entry types — memory stubs, reflections, and revisions — that feed directly into the existing pipeline: stubs enter the interview intake queue, reflections seed the `wisdom_distillation` synthesis type, and revisions layer non-destructively over existing memory records.

### The Curation Engine

Memory selection for each Stroll session is probabilistic, weighted by: anniversary proximity (temporal resonance), relational density (memories tagged with multiple entities), emotional valence calibrated for cadence, recording recency (older-recorded memories benefit more from rehearsal), synthesis gap (not yet surfaced in any synthesis output), and explicit user signals (starred or previously revisited memories). The curation engine is updated after every session from the engagement signals logged in `stroll_sessions`.

### The Listening Pause

After presenting the reminiscence passage, the agent goes quiet. This silence is the primary interaction design decision: it creates space for spontaneous response before any question is asked. If no response arrives within a configurable threshold, the agent delivers a single fallback prompt designed to open both backward and forward response directions simultaneously:

> *"What does thinking about this past event make you recall or think about now as we're talking about it?"*

If still no response, the agent releases gracefully. The `stroll_sessions` table records `had_spontaneous_response`, `required_fallback_prompt`, and `session_ended_gracefully` as engagement signals for the curation engine.

### Three Response Pathways

**Pathway A — Adjacent Memory Expansion**

The user recalls a connected event, person, or earlier version of the situation. Linguistic signals: *"That reminds me of..."*, *"I forgot that..."*, *"Before that, there was..."* The agent captures a **memory stub** (a `memories` record with `is_draft = true`, `capture_mode = 'stroll'`, and `triggered_by_memory_id` set to the origin memory). Stubs enter the interview intake queue for development in a future session. The relationship between the triggering memory and the triggered stub is preserved as a narrative link via `triggered_by_memory_id`.

**Pathway B — Wisdom Distillation**

The user articulates a present-tense understanding that the memory produced: a lesson, a belief formed or revised, a regret, a gratitude, or an unresolved question. Linguistic signals: *"That's when I realized..."*, *"Looking back, what I understand now is..."*, *"I never did figure out why..."* The agent captures this as a **reflection** record linked to the source memory. A single follow-up question — *"Did you understand that at the time, or more in hindsight?"* — provides the `temporality` tag, which distinguishes contemporaneous insight from retrospective wisdom in the Wisdom Distillation synthesis. Reflections are the **primary and exclusive** input source for `wisdom_distillation` synthesis records; no other feature in the current architecture produces this data type.

**Pathway C — Correction and Revision (The Self-Distancing Effect)**

Hearing one's own memory narrated back in a different voice, in prose the user did not write, creates *cognitive self-distancing* — a well-documented psychological phenomenon in which third-person perspective enables more accurate self-evaluation than first-person recollection. Details that felt settled may suddenly seem wrong. Framings that felt accurate may reveal themselves as constructed. Linguistic signals: *"That's not quite right"*, *"Actually..."*, *"I think I've always told it that way but..."* The agent captures a **memory revision** record linked to the source memory. The agent confirms: *"Got it — the original stays, this sits alongside it."*

**Non-destructive versioning is a foundational principle.** The original memory record is immutable once written. It represents who the user was and what they understood when they first recorded this story. The revision is a new layer, dated to the present, with the relationship between them preserved. Synthesis agents must check `memory_revisions` before rendering any memory; the most recent non-retracted revision represents current understanding, but both the original and the revision history are exposed in the detailed record view. The *arc* of how a person has understood their own experience over time is itself meaningful data.

Revisions are classified by type: `factual_correction` (a detail was simply wrong), `emotional_reframe` (facts stand; the felt meaning has changed), `context_update` (new information acquired since the original recording changes its meaning), and `narrative_revision` (the user recognizes their version as a construction rather than a record). The `narrative_revision` type is the most significant: it is one of the only mechanisms by which a person can observe, directly and with a timestamp, that they have been carrying a constructed version of their own past.

**Compound responses (A+B+C)** are common. Hearing the narration often produces a triggered memory, a distilled insight, and a correction all at once. The agent captures all three as linked records — stub, reflection, and revision — each linked to the origin memory and to each other where the causal chain is direct.

### Schema Additions

Three new tables (`stroll_sessions`, `reflections`, `memory_revisions`) and three new columns on `memories` (`triggered_by_memory_id`, `triggered_in_stroll_session`, `capture_mode`). See the full schema at the end of `schema_v1.sql`.

**`stroll_sessions`** tracks each Stroll engagement as a session-level record with the origin memory, adjacency trace (ordered array of memory IDs visited), output counts, and engagement signals. The adjacency trace is itself a form of data about the user's subjective memory clustering — which associations they follow and in which order — and feeds back into the curation engine over time.

**`reflections`** is the first-class home for present-tense wisdom. It carries `source_memory_id`, `stroll_session_id`, `content`, `reflection_type`, `temporality`, and `synthesis_ready`. The `synthesis_ready` flag is set by the Synthesis Agent when a reflection has enough content to contribute to a `wisdom_distillation` synthesis.

**`memory_revisions`** carries `source_memory_id`, `stroll_session_id`, `triggered_by_reflection` (for A+B+C compounds), `revision_type`, `original_excerpt` (optional surgical patch), `revised_content`, and `user_note`. The `is_retracted` flag allows a user to withdraw a revision while preserving the record that it was made and then retracted.

### Relationship to the Synthesis Layer

The Stroll is the primary feeder for the `wisdom_distillation` synthesis type that has been present in the `synthesis_type` enum since v1.0 but has had no defined input source until now. The pipeline is:

```
Stroll session
    ↓
User articulates reflection (Pathway B)
    ↓
reflections table (synthesis_ready = false initially)
    ↓
Synthesis Agent flags synthesis_ready when content is sufficient
    ↓
wisdom_distillation synthesis record generated
    ↓
Wisdom Distillation shareable artifact
```

The Stroll also feeds the `contradiction_flag` synthesis type indirectly: a `narrative_revision` type correction, if it conflicts with other memories in the chronicle, should trigger contradiction detection.

### Open Questions

Four open questions are tracked in `feature_reminiscence_mode.md`: whether to surface incomplete memories in Stroll curation (OQ-1), voice delivery opt-in default (OQ-2), full vs. light format for adjacent memories (OQ-3), and whether to mirror Pathway B responses back as a paraphrase (OQ-4). Two additional questions bear on architecture: whether patterns of `narrative_revision` corrections on the same event over years should be surfaced as a signal to the user (OQ-6), and whether a Pathway C revision should trigger a check for downstream entries that reference the same event and may need updating (OQ-5).

---

## Part XII: Phase 0 — Multi-Session Onboarding with Artifact Delivery

*April 2026 decision (Decision 3 of the PRD readiness session), amended same day. Expands Part IX's Phase 0 protocol description with the confirmed session model and artifact delivery sequence.*

### The Session Model Decision

Phase 0 is delivered across three discrete sessions, not as a single upfront interview. Each stage is self-contained; the user receives a visible artifact immediately on completing each one before the next session is scheduled.

A single-session approach — one 60–90 minute interview before any artifact appears — was explicitly evaluated and rejected. The target MVP user (technically comfortable adults, likely 40+) will not complete a session of that length without a reward before it ends. Three sessions of 15–30 minutes each, each closing with something to look at, is both more completable and more trust-building. The system demonstrates value before asking for more time.

### Why Chapter Naming Was Removed from Phase 0

The original four-stage model included a Stage 2 dedicated to eliciting user-defined life chapter names ("The Madrid Years," "After my father died") as an ontological scaffolding step before collection begins. This was removed.

The core problem is practical: a person with a rich life — say, a 72-year-old with multiple professional careers, extensive family history, and many distinct personal chapters — cannot usefully compress their story into broad segments on demand, before any collection has occurred. There are too many chapters, and the natural vocabulary for naming them only emerges as the person begins to articulate their memories. Asking for chapter names upfront forces premature closure on a structure that should emerge from the material itself.

The residential arc and the relationship arc together provide sufficient organizational framing without requiring the user to impose chapter vocabulary early. Every home in the residential sequence corresponds generally to a period of professional engagement, family configuration, and personal circumstances — the chapter structure is latent in the places and relationships already being collected in Stages 1 and 2. Making it explicit is a later analytical act, not an onboarding step.

`user_periods` remain in the schema for post-collection use. Chapter naming becomes a Phase 2 interaction: once the collection is rich enough — enough memories across life stages and dimensions to reveal recurring patterns and period boundaries — the system can propose candidate chapter structures derived from the data, which the user then reviews, names, and confirms. This is a fundamentally better experience than asking someone to define chapters in the abstract at session one.

### Artifact Delivery Sequence

Each stage produces a deliverable. This is not a nice-to-have — it is the principal mechanism for establishing trust and motivating continuation.

**Stage 1 complete → Life Globe.** The residential history gathered in the first session renders an initial Life Globe: a 3D navigable globe with the user's geographic life path marked, weighted by the density of memories already associated with each place, with a temporal transit animation tracing the path chronologically. The globe is sparse at this point but unmistakably personal. The `life_journey_geojson()` function drives the rendering from whatever `lived_at` relationships have been captured. Even a five-stop residential history is visually compelling as an animated path through a life. Hovering on a stop surfaces the place's `entity_biography` synthesis — a prose portrait of that period and setting.

**Stage 2 complete → Entity portrait.** An `entity_biography` synthesis is generated for one key person named during the entity seed — typically the most significant relationship surfaced or the one with the most supporting context from Stage 1 data. This is the first prose synthesis the user receives. It demonstrates what the synthesis layer does: it writes about a real person from the user's life in language the user will recognize as capturing something true. Even with only Phase 0 data, an entity portrait is compelling when it reflects the kind of person someone was and the role they played. It makes the collection feel inhabited.

**Stage 3 complete → Life's Players.** The `lifes_cast` synthesis is generated across all entities named in the entity seed, organized as a time-series progression: who was significant at which life stages, how the cast of central figures evolved from earliest remembered relationships through to the present. This closes the onboarding loop. The user entered Phase 0 with a residential map and a handful of named people; they exit with their first view of the relational arc of their life — the ensemble of people who made it. It is the artifact that makes the chronicle feel like a portrait of a life rather than a database of facts.

### Why the Globe and Life's Players Form the Right MVP Opening

The two non-portrait artifacts — Globe and Life's Players — occupy complementary dimensions. The Globe is spatial and temporal: where were you, in what order, for how long. Life's Players is relational and temporal: who was with you, in what capacity, at which stages. Together they provide a two-axis orientation to the life that is simultaneously objective (places are verifiable, relationships are named) and deeply personal. They do not require the user to have articulated anything abstract about the shape of their life — only to have named the places they lived and the people who mattered.

Chapter structure, which requires a more interpretive act, emerges later when the system has material to interpret.

### Implications for the Planner Agent

The Planner Agent must treat Phase 0 as a structured, sequenced protocol. Stages proceed in order; the artifact delivery for each stage is a trigger condition for scheduling the next. The validation gate — the user reviewing and confirming the entity seed and their initial Life's Players view before memory collection begins — is a prerequisite for transitioning to the collection phase.

The `interview_sessions.session_type = 'ontology_bootstrap'` and `interview_sessions.phase0_stage` columns (added in schema v1.1) allow the Planner Agent to query current Phase 0 state without relying on application-layer state: the highest completed `phase0_stage` with `session_type = 'ontology_bootstrap'` determines where the user is in the sequence. Stage values 1–3 map to the three stages above; the value 4 is now unused and reserved.

---

## Part XIII: MVP Synthesis Artifacts — Life Globe and Life's Players

*April 2026 decision (Decision 4 of the PRD readiness session). Specifies the two MVP synthesis artifacts, their rationale, and the architectural implications of the Life's Players choice.*

### Selection Rationale

The MVP produces two user-facing synthesis artifacts. The selection criteria were: (a) works with MVP-level data (Phase 0 + early collection), (b) is emotionally resonant at low density, (c) is shareable as a standalone artifact, and (d) demonstrates a distinct capability. The pairing of globe and people satisfies all four.

The previously proposed pairing was place portrait + chapter narrative. Chapter narrative was replaced because it requires a richer collection to avoid feeling thin. With only Phase 0 data and a handful of collection sessions, a chapter narrative risks generating prose that the user will find generic. Life's Players works at lower data density because it is organized around the names and faces the user already gave the system in Phase 0 Stage 3.

### Artifact 1: The Life Globe

**Internal synthesis type:** `entity_biography` (for place entities), no new synthesis type needed.
**Visualization layer:** Cesium.js (3D globe with terrain) or Mapbox GL JS (2D/2.5D map). Both consume GeoJSON natively.

The Life Globe has two layers:

**Place portraits layer.** Each significant place the user has lived at, worked at, or visited is a weighted stop on the globe. Visual weight (size, glow, prominence) is proportional to `memory_count` from the `life_journey` view. Pausing on a stop surfaces the `entity_biography` synthesis for that place — a prose portrait of the period the user spent there. This synthesis is what the user reads when they hover over London or hover over a childhood home. It is generated by the Synthesis Agent from all memories tagged to that place entity.

**Temporal transit layer (new, April 2026).** A chronological animation traces the user's geographic path through life — camera moving between significant places in sequence, dwelling proportionally to `days_at_place`. This turns the globe from a map into an autobiography of movement. The animation is implemented entirely within the visualization layer consuming `life_journey_geojson()` — no new synthesis type, no new database function. The `days_at_place` field in the view already provides the duration weighting. The camera path is the ordered sequence of leg centroids (`centroid_geojson`) with `started_at` as the temporal sequencing key.

The transit layer animation is the primary first-time engagement: the camera moves through a life, pausing where years were spent, moving quickly through brief stays. It delivers the emotional impact of a life trajectory before the user interacts with individual stops.

### Artifact 2: Life's Players (lifes_cast)

**Internal synthesis type:** `lifes_cast` (new enum value added in schema v1.1).
**User-facing names:** Life's Players, Life's Cast, Life's Cast and Characters.

Named for Shakespeare's *As You Like It*, Act II Scene VII:

> *"All the world's a stage, and all the men and women merely players; they have their exits and their entrances."*

**What it is.** A time-series progression of the significant people who played roles in the user's life — from the earliest remembered relationships through the present central figures. It shows how the cast of central figures evolved across life stages: who was present at each chapter, who entered and who exited, who remained central across decades.

**What it is not.** This is categorically distinct from `relationship_portrait`, which goes deep on a single relationship — the arc of one person across the whole life. Life's Players is the ensemble view: all significant people, arranged temporally, showing the composition of the cast at each life stage. The synthesis type `relationship_portrait` remains in the enum for Phase 2 use; it is not being removed, only not prioritized for MVP.

**Why it works at low data density.** The entity seed in Phase 0 Stage 3 collects the ten to fifteen most significant people in the user's life, with rough temporal placement (when they were significant, what relationship type they held). That data is sufficient to render an initial Life's Players view. It does not require dense memory collection about each person — it requires temporal placement and relational classification, which Stage 3 provides. As memory collection deepens, the synthesis enriches; at MVP data levels, it is already personal and recognizable.

**Duration is not the criterion; significance is.** A lifelong spouse and a three-year mentor who changed the user's career are equally valid players. The Synthesis Agent weights by `role_significance` and memory density within a life stage, not by relationship length. A relationship that lasted three years but produced twenty vivid memories should feature prominently in that life stage.

**Architectural note.** The `lifes_cast` synthesis type uses the following scope fields on the `syntheses` record: `user_id` (the owner), `time_range_start` / `time_range_end` (the full life span covered), and `source_memory_ids` (all contributing entity mentions). It does not use `entity_id` or `relationship_id` as scope fields — it is inherently a cross-entity synthesis. The generated `content` JSONB or text represents the time-ordered cast, structured for rendering by the client.

---

## Part XIV: Social Sharing, Comment Capture, and Contribution Model

*April 2026 decision (Decision 7 of the PRD readiness session, extended). Specifies the social distribution mechanism, comment capture pattern, and the contribution model for Share Card holders.*

### Social Media as Primary Distribution Channel

Sharing in Life Chronicle is not a platform-to-holder notification. The primary distribution mechanism is the user sharing a memory or artifact to social media — a post that may include a preview image, a short excerpt, and a link. The share card controls who can access the underlying chronicle content; the social post is both the distribution act and the notification.

This design choice has several architectural implications:

**No in-platform "you have been added" notification required at MVP.** When a card holder arrives via a shared link, they authenticate and see what their card grants on login. Scope is revealed on arrival, not before. The social post — or a direct link sent via messaging — is the implicit invitation.

**`memory_shares` records the share event.** Each time the user shares a memory or synthesis, a `memory_shares` row is written with the channel (social_media, direct_link, sms), the card used to govern access (if any), the sharing timestamp, and optionally the platform post ID if captured. This allows the owner to see a history of what they have shared and where, and allows comment capture to be linked back to specific share instances.

**Share channels are typed.** The `share_channel` enum (`social_media`, `direct_link`, `sms`) is extensible but starts with these three because they cover the realistic distribution mechanisms for MVP: a public social post, a privately shared URL, and an SMS. Future channels (email, within-app share) can be added to the enum.

### Comment Capture

When someone receives a shared memory — whether via social media post or direct link — they may leave a comment. The system captures these comments in `share_comments`, linked to the specific `memory_shares` instance.

Comments are attributed where possible: by email, social handle, display name, or Life Chronicle user ID if the recipient is a registered user. Anonymous comments (where the recipient provides neither identity nor handle) are valid — the comment text is still worth preserving.

**Comments do not enter the chronicle automatically.** They live in `share_comments` and are visible to the owner in a dedicated notification/comments view. They are not memories; they are external responses to shared memories. The owner may choose to manually capture a comment as a memory stub if they find it significant, but no automatic ingestion occurs.

The owner can hide individual comments (`is_hidden = true`) without deleting them. Deletion is not exposed in the MVP UI — the audit principle applies here as elsewhere: what happened remains in the record.

### The Contribution Model (Phase 2)

The `can_contribute` field on `card_holders` (boolean, default false) enables a second permission level for Share Card holders. A contributor can add content to the owner's chronicle — embellishments, additional memories of shared events, details the owner did not have — without that content auto-ingesting into the Raw Vault.

**Contribution flow:**
1. The contributor (a card holder with `can_contribute = true`) submits a memory contribution linked to a specific existing memory or as a new stub.
2. The contribution arrives in the owner's review queue as a `memories` record with `contributor_id` set (identifying the contributing contact) and `contribution_status = 'pending'`.
3. The owner reviews, accepts, modifies, or rejects. Acceptance sets `contribution_status = 'accepted'` and integrates the memory into the canon. Rejection sets `contribution_status = 'rejected'`; the record is retained for audit but hidden from the owner's view.
4. Attribution is preserved: `contributor_id` on the accepted memory record ensures the source of the contribution is always traceable.

The `triggered_by_memory_id` pattern from The Stroll applies: contributions link to the memory they are enriching via `triggered_by_memory_id` where a specific memory prompted the contribution.

**Contribution permission is Phase 2.** The schema supports it from MVP (the `can_contribute` column exists on `card_holders`; the `contributor_id` and `contribution_status` columns exist on `memories`). The UI for granting contribute access, submitting contributions, and managing the review queue is a Phase 2 deliverable.

**Future: file attachments on contributions (Phase 2+).** The `contribution_attachments` table is added as a schema stub in v1.1. Contributors with contribute access will eventually be able to attach images or files to their contributions. Review status mirrors the memory contribution review model.

### Architectural Implications for the Review Queue

The review queue — already planned as an MVP table — now serves two overlapping purposes: synthesis review (the user reviewing AI-generated synthesis content) and contribution review (the user reviewing external contributions). These are structurally similar workflows — a staged item awaiting owner approval — and should share a review queue model where practical. The `contribution_status` field on `memories` is the primary state machine for contributions; the synthesis lifecycle fields on `syntheses` serve the synthesis review path.

---

## Appendix: Key Files

- `documentation/schema_v1.sql` — Full PostgreSQL schema with indexes, seed data, and search functions
- `documentation/DB_Architecture_Design_v1.md` — This document
- `documentation/access_cards_requirements.md` — Canonical specification for the Access Cards framework that replaces the Part VIII privacy tier model (added April 2026; see Part X for summary)

## Next Steps

**Privacy Model — superseded April 2026 by Access Cards (see Part X):**
- ⚠️ The five-tier `privacy_tier` ENUM and its associated triggers/RLS scaffolding are deprecated. The check-marked items below describe the implementation of the now-superseded model and are retained as the migration's "from" specification.
- ✅ 5-tier `privacy_tier` enum created and applied to: `memories`, `entities`, `relationships`, `media`, `syntheses` *(to be dropped in cards migration)*
- ✅ `is_sensitive` flag on `dimensions` table for auto-Private enforcement *(retained; semantics shift from "auto-lock to private" to "auto-isolate from all cards")*
- ✅ `compute_synthesis_tier()` function + trigger for most-restrictive-source inheritance *(to be dropped; replaced by `synthesis_visibility_cache` mechanism)*
- ✅ Cascade trigger on `memories.privacy_tier` changes to recompute downstream syntheses *(to be dropped; replaced by visibility-cache recompute)*
- ✅ RLS policy scaffold documented with commented-out activation stubs

**Pending:**

1. ~~**Add connection group tables**~~ — **Superseded by Access Cards (Part X).** The `contacts` + `card_holders` tables in the cards model replace `user_close_friends`/`user_family_members`/`user_professional_connections`. Connection-group plurality emerges from card holder lists rather than from per-tier tables.
2. **Seed the dimension taxonomy** — Populate the `dimensions` table with the full WisdomTopicSort category tree + Gemini Taxonomy additions, marking `is_sensitive = true` on Health/Wellness and Financial series leaf nodes that carry personal risk
3. **Seed the question bank** — Import interview questions into the `questions` table, linked to dimension IDs
4. **Define the Capture Agent prompt** — The agent that conducts interviews and writes to `memories`
5. **Define the Tagger Agent** — Rules and prompts for auto-tagging new memories across all ten dimension axes; must enforce `is_sensitive` → `tier_locked` rule at write time
6. **Define Coverage scoring** — Algorithm for `depth_score` and `breadth_score` in the `coverage` table, which drives the Planner Agent
7. **Choose embedding model** — OpenAI `text-embedding-3-small` (1536 dimensions) is the current recommendation; confirm or substitute with a local model if privacy concerns heighten at scale
8. **Build the geocoding pipeline in the Entity Agent** — When a place entity is created, resolve it to coordinates via OSM Nominatim or Google Maps Geocoding; store `external_geo_id`, `geom`, `country_code`, `timezone`, `elevation_m`
9. **Prototype the globe view** — Load `life_journey_geojson()` output into Cesium.js; validate the data contract against real journey data before full UI build
10. **Design the hover/pause portrait** — Define the UX for surfacing `entity_biography` syntheses when a user pauses on a place stop on the globe; this drives the Synthesis Agent's priority queue
11. **Implement the Temporal Agent** — Build the work cycle (inventory → anchor discovery → question generation → constraint ingestion → propagation); the `temporal_resolution_queue` and `temporal_constraints` tables are ready
12. **Design the temporal resolution UX** — The "timeline band narrowing" interaction; how temporal Q&A sessions are surfaced to the user (push notification, scheduled session, in-app prompt)
13. **Seed anchor vocabulary** — Compile a reference list of world events, cultural moments, and historical anchors (elections, moon landings, major cultural events) that the Temporal Agent can use to anchor memories when no personal event is available
14. ✅ **Phase 0 Ontology Bootstrap Protocol** — Four stages confirmed (Temporal/Geographic Skeleton → Chapter Naming → Entity Seed → Topic Map). Session model decided: multi-session with artifact delivery after each stage (not single long onboarding). Validation gate before memory collection is required. Artifact delivery sequence documented in Part XII.
15. ✅ **Add `session_type` to `interview_sessions`** — Added in schema v1.1 with `phase0_stage` column. Types: `ontology_bootstrap`, `memory_collection`, `temporal_resolution`, `entity_resolution`, `stroll`, `review_and_correction`.
16. **Design the assumption log table** — First-class record of every agent inference and disambiguation decision (Tagger classifications, Entity Agent resolutions, Temporal Agent constraint inferences); required for synthesis traceability and user correction path
17. **Design constraint rules table for synthesis completeness** — Ontological rules specifying what a synthesis of a given type requires (e.g. a `career_narrative` requires ≥2 confirmed employment relationships with non-null start dates); enables dependency-aware gap detection rather than coverage scoring alone
18. **Implement `generate_residency_constraints()` triggering** — Hook the function to fire automatically when a `lived_at` relationship is inserted or its `started_at`/`ended_at` are updated, so the cascade is immediate
19. **Read `first interview` Google Drive doc** — Large document (435 KB, likely a real interview transcript or full question set); should inform interview agent prompt design before Capture Agent work begins

**From handoff-checklist.md (early-planning-v2, Oct 2025) — novel elements not yet in schema or design:**

20. **Expand taxonomy tables** — The checklist specifies a more granular taxonomy layer than our current `dimensions` tree: `taxonomy_i18n` (internationalization of dimension names and prompts), `taxonomy_versions` (versioned taxonomy management so evolving the category tree doesn't break existing entries), `taxonomy_prompts` (prompt templates stored per taxonomy node, with primary and follow-up variants). Evaluate whether to extend `dimensions` or introduce these as sibling tables.
21. **Add `sources`, `flags`, `audits` tables** — Moderation and provenance layer currently absent from the schema. `sources` tracks origin of imported content (LinkedIn, email, document, social) with citation metadata, supporting the Raw Vault provenance principle. `flags` supports content moderation and user-reported issues. `audits` is a general access and action log, required for HIPAA readiness (Phase 2 goal) and for the assumption log pattern.
22. **Define CEF v1 export folder structure formally** — The checklist specifies the exact ZIP layout: `/manifest.json`, `/users/<id>/profile.json`, `/users/<id>/entities.json`, `/users/<id>/taxonomy.json`, `/users/<id>/events.json`, per-entry folders containing `entry.json` + `transcript.vtt` + `transcript.srt` + `transcript.json` + `media/*` + optional `embeddings.json`. SHA-256 checksums in both `manifest.json` and each `entry.json`. Delta exports ("since last backup") required. Locate the companion `cef-schema.json` (referenced but not yet found) for formal validation schema.
23. **Document the privacy-safe RAG retrieval ordering** — Enforce in all vector search implementations: (1) permissions filter in SQL/RLS first, (2) metadata filters (time, entities, taxonomy), (3) pgvector similarity on allowed rows only, (4) app-level rerank and deduplicate. Running vector similarity before the permissions filter is a privacy vulnerability. This ordering must be documented as an architectural constraint, not left to individual implementation decisions. *(Still required under Access Cards; the permissions filter now calls `viewer_can_access()` per Part X §5.)*
24. **Define JWT `role_tier` claim for RLS performance** — *Modified by Access Cards (Part X):* the JWT no longer carries a single ordered `role_tier` value. Instead it carries the **set of card IDs the viewer holds for the queried owner**, plus a recency timestamp for cache validation. RLS policies read this claim to short-circuit the `card_holders` join on every query. Design claim issuance, refresh, and revocation logic as part of the cards migration (Part X §9).
25. **Authentication: Passkeys (WebAuthn) as primary, magic link as fallback** — Earlier documents led with magic link as primary auth. The checklist recommends Passkeys (WebAuthn) as primary with magic link fallback. Passkeys are now broadly supported on iOS Safari 16+ and Android Chrome 111+ and are significantly more secure. Confirm this as the auth strategy in the final PRD.
26. **Define analytics funnel and observability stack** — Instrument the full capture funnel: `sms_sent` → `deeplink_opened` → `tts_played` → `record_started` → `record_uploaded` → `asr_success` → `entry_completed`, plus error events: `mic_denied`, `media_recorder_unsupported`, `upload_failed`, `asr_failed`. Recommended stack: PostHog (product analytics) + OpenTelemetry (distributed tracing). Tie analytics events to OTEL traces for drop-off diagnosis.
27. **Capture cost guardrails as operational constraints** — TTS capped at 20 seconds per prompt, cached by template-hash + variables. Client-side silence trim before upload (−40 dB threshold, head/tail). Recordings over 3 minutes dropped at client, not truncated. ASR batched with capped retries and exponential backoff. These are not UX decisions — they are cost-control architecture that must be enforced at the API and client layers.
28. ~~Locate missing companion documents~~ — ✅ Found and added to `documentation/early-planning-v2/`: `Revised_PRD_v2.md`, `lovable-build-spec.v2.md`, `cef-schema.json`, `README_Import_Validation.txt`. `PRD_Addendum_MobileWeb_SMS.md` still not found.

**From Revised_PRD_v2.md + lovable-build-spec.v2.md + cef-schema.json (Oct 2025) — additional novel elements:**

29. **Add consent metadata fields to `memories` and `media`** — The CEF v1 schema formalizes two per-entry consent flags: `voiceCloneAllowed` (whether the user's voice recording may be used for voice synthesis features) and `publicIndexingAllowed` (whether this entry may appear in search engine indexes). These are distinct from privacy tier — they govern specific downstream uses of the content rather than viewer access. Both should default to `false` / `null` (most conservative). Add to `memories` and `media` tables.

30. **Add `fuzzy` text field to temporal model** — The CEF v1 `Event` definition includes a `fuzzy` free-text field alongside `start`, `end`, and `confidence`. This is the human-readable description of temporal uncertainty ("sometime in the late 1980s", "before my sister was born") that accompanies the structured uncertainty envelope. Maps naturally to our `time_precision` model but adds an explicit natural-language companion that the Temporal Agent can use as evidence and that exports can carry. Add `time_fuzzy_description TEXT` to the `memories` table.

31. ~~**Design the Executor role as a future 6th privacy tier**~~ — **Resolved by Access Cards (Part X).** Under the cards model the Executor is a card with a posthumous-trigger validity window and a configurable scope, held by one or more designated contacts. No new ENUM value, no separate access-control layer. Detailed design (trigger conditions, scope defaults, holder-confirmation flow) deferred to Phase 3 per the access cards requirements doc.

32. **Support user-defined custom taxonomy nodes** — `Revised_PRD_v2.md` specifies: "User-defined custom nodes; agent suggests merges and generates 3–5 starter prompts." Our current `dimensions` table supports hierarchy and custom entries structurally, but the application layer has no defined workflow for user-created nodes, no merge suggestion capability, and no auto-generated prompt seeding for custom nodes. The Planner Agent needs a `createCustomNode` capability and a `mergeSuggestion` operation (both named in the tRPC API surface in `lovable-build-spec.v2.md`).

33. **Formalize `cef-schema.json` as the validation artifact for exports** — The formal JSON Schema (Draft 2020-12) is now on disk at `documentation/early-planning-v2/cef-schema.json`. The export pipeline must validate every generated `manifest.json` and `entry.json` against this schema before delivery. Note: the schema's `Entry.source` enum currently lists only `user`, `linkedin`, `crawler` — this will need updating as additional import sources are added (email, SMS, journal, etc.). The `Taxonomy.nodes[].sensitivity` field and `Taxonomy.nodes[].defaultTier` in the schema formalize what we've implemented as `is_sensitive` + application-layer enforcement — worth aligning these to ensure exports are self-describing.

34. **Adopt SLOs from the build spec as PRD performance requirements** — `lovable-build-spec.v2.md` specifies: deep-link open ≤2s TTFB; TTS tap-to-play ≤300ms (cached); 2-minute audio upload ≤10s on LTE. These are the only formal performance targets across all reviewed documents and should be carried into the PRD as acceptance criteria baselines.

35. **Define the tRPC API surface as the canonical agent-facing interface** — `lovable-build-spec.v2.md` names the API namespaces: `entries` (createFromUpload, getTimeline, searchHybrid, markTier, markIncomplete), `taxonomy` (getPlan, getCoverage, createCustomNode, mergeSuggestion), `flags` (create, resolve), `export` (createFull, createDelta, status, download), plus REST webhooks for SMS, recordings, ingest, and billing. The `markIncomplete` operation is notable — it is the explicit API for returning an entry to the Incomplete Queue for follow-up, which the agent uses after ASR to flag entries needing clarification. This should be in the design doc as the planned API surface before implementation begins. *(Note: under Access Cards, `entries.markTier` becomes `entries.attachToCard` / `entries.detachFromCard`.)*

**From April 2026 schema v1.1 additions:**

36. **Seed five system cards per new user account** — On account creation, insert five `cards` rows with `is_system = true` and `system_code` values (private, close_friends, family, professional, public). Scopes and holder lists start empty; the user populates them. This is a required application-layer bootstrap step, not a schema migration item. Must run before any content is created for the user.

37. **Implement `viewer_can_access()` SQL function** — The access evaluation algorithm in `access_cards_requirements.md §5` must be implemented as a PostgreSQL function before RLS policies can be activated. The function takes `(viewer_id UUID, owner_id UUID, record_type TEXT, record_id UUID)` and returns `BOOLEAN`. Its performance profile (single-digit ms for 1–5 cards with 1–3 populated scope axes) must be verified before RLS activation.

38. **Activate RLS policies on content tables** — Once `viewer_can_access()` is implemented and `synthesis_visibility_cache` is being maintained, activate RLS on `memories`, `entities`, `relationships`, `media`, and `syntheses`. The synthesis policy reads from `synthesis_visibility_cache` rather than calling `viewer_can_access()` per row. The scaffold is already documented in the schema file.

39. **Design the Life Globe temporal transit animation** — The transit layer (camera moving between geographic stops chronologically, dwelling proportional to `days_at_place`) is specified in Part XIII. Implementation requires: computing a camera path from the ordered sequence of `centroid_geojson` values from `life_journey_geojson()`, implementing easing and dwell-time logic in Cesium.js, and defining the interaction model (play/pause, scrubbing, jumping to a specific stop). No new database work is needed — the data contract is fully served by the existing `life_journey` view.

40. ✅ **Build the Life's Players synthesis pipeline** — Fully specified in **Part XV** (May 2026): entity significance weighting model, output JSON schema, Synthesis Agent prompt design, client rendering requirements, and synthesis lifecycle. Resolves this item.

41. **Design the social sharing UX and `memory_shares` integration** — The share flow in the web application must write a `memory_shares` row for every share act. Design decisions: how the owner selects which card to use (if any) when sharing, how the share URL is constructed (should it carry the card ID, or resolve via the user's card holdings on the recipient's auth), how the `share_comments` view is surfaced to the owner (notification badge, inbox-style view, or per-memory comment thread), and how anonymous vs. attributed comments are handled in the UI.

42. **Design the contribution review queue UX** — Phase 2 deliverable, but architecture must anticipate it. The review queue holds: contributions from card holders with `can_contribute = true` (pending memories with `contributor_id` set), contribution attachments from `contribution_attachments` with `review_status = 'pending'`, and optionally synthesis review items. The owner accepts, modifies, or rejects each item. Design the notification mechanism (how does the owner know contributions have arrived?) and the review interaction (accept-as-is, edit-then-accept, reject-with-note).

43. **Define `user_periods` population flow** — The `user_periods` table (added in v1.1) is populated during Phase 0 Stage 2 (chapter naming). The system proposes periods derived from the residential spine (e.g., one period per home, named after the place); the user renames, merges, splits, and confirms them. Design the interaction: does the agent present all proposed periods at once for review, or propose them one by one? How does the Capture Agent decide when the chapter naming session is "complete"? What is the validation that triggers `confirmed_by_user = true` on each period?

44. **Implement `memory_periods` assignment pipeline** — Once `user_periods` are confirmed, existing memories need to be assigned to periods (via `memory_periods`). This is an automated Tagger Agent task: for each memory, evaluate its `time_estimate` against each period's `time_range_start` / `time_range_end`, and insert `memory_periods` rows for matches. Memories may belong to multiple periods if their dates overlap with more than one. The assignment must be re-run when period date ranges change (user edits a chapter's bounds).

**From April 2026 gap review (Opus 4.7) — newly identified items:**

36. ✅ **Design agent orchestration / job queue / dispatch model** — The schema's claim that agents can run concurrently is structurally true but operationally underspecified. There is no event/queue/dispatcher table or external scheduler choice documented. Decide between an in-DB queue table (e.g. `agent_jobs` with status, kind, priority, lease) versus an external orchestrator (Inngest, Trigger.dev, Supabase Edge cron). Document failure modes, retries, and observability. Without this, "Synthesis Agent regenerates when `is_current = false`" is a database flag, not a working scheduler.

37. **Add unified user review inbox (`review_queue` table)** — Pending entity merges, contradiction flags, sensitive-promotion confirmations, agent-inferred temporal constraints awaiting confirmation, suggested syntheses for review, and custom-dimension merge proposals all need a single user-facing surface. Without it, these signals are scattered across views and ignored. Generic table holding (item_type, item_id, surfaced_at, resolved_at, resolution).

38. **Add `user_periods` and `memory_periods` for chapter naming** — Phase 0 Stage 2 elicits the user's own vocabulary for life chapters ("the Philly years," "after my father died"). The current schema has no first-class home for these; `life_stage` is universal (Early Childhood, Young Adult, …), not personal. New tables: `user_periods` (id, user_id, name, description, started_at, ended_at, anchor_relationship_ids, anchor_entity_ids) and `memory_periods` junction. Memories link to user-named chapters in addition to life_stage. Required for the Period Narrative shareable artifact.

39. **Design soft-delete / redaction for memories** — The append-only Raw Vault principle conflicts with right-to-erasure (GDPR) and with reconsidered memories. Add `redacted_at`, `redaction_reason`, `redacted_by` on `memories`; redacted rows are invisible to all reads except an explicit owner-controlled audit view. Distinct from physical delete — preserves audit trail of the redaction event.

40. **Convert ENUMs to controlled-vocabulary tables where extension is foreseeable** — The schema claims migration-free extensibility but several ENUMs (`memory_source`, `entity_type`, `synthesis_type`, `media_type`, `place_type`, `relationship_role`) require an `ALTER TYPE` migration to add a new value. Convert these to lookup tables (`memory_source_types`, `synthesis_types`, etc.) with foreign-key references on the dependent columns. Retain ENUMs only where the value set is genuinely bounded by design (none in this list qualifies; all are foreseeable to grow). The `privacy_tier` ENUM is dropped entirely under Access Cards (Part X).

41. **Add second-person memory mode** — A daughter interviewing her father about his childhood produces memories whose subject is the father but whose narrator is the daughter. Today's schema's `memory_entities.role` allows witness/participant/etc. but does not cleanly distinguish "told by" from "experienced by." Add `subject_user_id` to `memories` (defaults to `user_id`; differs when capture is on behalf of another). Update Capture Agent to support the on-behalf-of flow. Unlocks family-to-elder capture as the primary growth wedge for the secondary market.

42. **Add forward-looking content schema** — The product brief promises "progressive history as they experience it in real time" but the schema models only retrospective memories. Goals, anticipated events, in-progress projects, and aspirations have no home. Decide between extending `memories` with a `tense` field (past/present/future) or introducing a parallel `intentions` / `aspirations` table. The latter is cleaner because the temporal-uncertainty model is calibrated for retrospective memory; forward-looking content has different epistemic structure.

43. **Define the synthesis regeneration cost model** — Real-time cascade regeneration on every memory insert is expensive and slow at scale. Adopt a pull-based, batched policy: invalidation marks records stale; regeneration runs on a schedule (nightly per user) and on-demand when the user opens a synthesis view. Add `synthesis_refresh_policy` per user (immediate / batched / on-demand). UI shows "updated 3 hours ago" or "refresh available" rather than blocking on regeneration. Define per-user monthly $ ceilings as architectural constraint, not deployment concern.

44. **Build an evaluation framework from day one** — No mechanism today to know whether the Capture Agent is asking good questions or whether a synthesis is accurate. Add: thumbs up/down on every synthesis the user reads, a `prompt_versions` table tracking deployed prompt strings with rolling quality scores, a periodic "is this still right?" review prompt against a sample of memories, and an automated weekly summary of low-rated outputs paired with the prompts that produced them. Without this loop, agent quality decays silently.

45. **Sketch subscription / billing / tenancy model** — Connection-group sharing (now Access Cards) implies multi-user, which implies tenancy and billing. Define plans, billing events, usage metering tables before card holders begin viewing each other's content. Usage metering is also vital for cost guardrails (item 27, item 43).

46. **Enforce raw-vault sanctity as a Postgres role** — The principle "AI never edits raw memories" should be a database-permissions fact, not application discipline. Create a `capture_agent` role with `INSERT` (no `UPDATE`, no `DELETE`) on `memories` and `interview_sessions`. The Synthesis, Tagger, and Entity Agents get their own roles with appropriate per-table grants. The Service Role retains full access for migrations and admin operations. This survives a buggy agent prompt that tries to UPDATE a memory: the database refuses, rather than silently corrupting the vault.

**From April 2026 — The Stroll feature additions (Part XI):**

48. **Implement the Stroll curation engine** — Probabilistic memory selection weighted by: anniversary proximity, relational density, recording recency (favor older-recorded), synthesis gap, and explicit user signals. Update weights after each session from `stroll_sessions` engagement signals. Define the silence threshold for voice (suggested 6–10s) and the UI state for text (open input, no prompt text).

49. **Implement the Synthesis Agent path from reflections → wisdom_distillation** — Define the `synthesis_ready` flagging criteria (minimum content length? reflection_type must not be 'other'? at least one temporality tag?). The Synthesis Agent must query the `reflections` table filtered by `synthesis_ready = true` and `user_id` before generating a `wisdom_distillation` synthesis. Note: `wisdom_distillation` is already in the `synthesis_type` enum — the synthesis table requires no schema change, only a new agent prompt.

50. **Enforce non-destructive versioning in all synthesis reads** — Synthesis agents and the Search Agent must `LEFT JOIN memory_revisions` on `source_memory_id` and apply the most recent non-retracted revision before rendering any memory record. This is an **architectural constraint**, not an optional enhancement: a synthesis that renders a memory the user has corrected misrepresents their chronicle. Document the JOIN pattern as a required step in the Synthesis Agent prompt template.

47. **Resolve the video / Thread-2 architectural split** — The local `Personal-Life-Chronicle-PRD.docx` (Feb 2026) describes a video-first system and is still active in the project root. Memory notes record the decision to defer video and lead with voice/interview, but the canonical PRD on disk has not been retired. Move the document to an archive folder; add a one-line note at the project root stating that voice/interview is the primary capture path and media-intelligence (video atomization, facial recognition) is a Phase 3 input modality.


---

## Part XV: Life's Players — Synthesis Agent Design

*May 2026. Resolves Next Step #40 (Build the Life's Players synthesis pipeline). This section specifies the Synthesis Agent prompt design, entity significance weighting model, output structure, and client rendering requirements for the `lifes_cast` synthesis type.*

---

### Overview

Life's Players is one of two MVP synthesis artifacts (alongside the Life Globe). It is a time-series progression of the significant people who played roles in the user's life — from the earliest remembered relationships through the present central figures. It shows how the cast evolved across life stages: who was present, who entered and who exited, who remained central across decades.

It is categorically distinct from `relationship_portrait` (which goes deep on a single relationship) and from `life_period_narrative` (which narrates a time period rather than its cast). Life's Players is the ensemble view — all significant people, arranged temporally.

---

### Input Data Requirements

The Synthesis Agent reads the following data to produce a `lifes_cast` synthesis:

**Primary inputs:**
- All entity records of `type = 'person'` linked to the user via `memory_entities.role IN ('subject', 'participant')` (or linked via `relationships` with the owner as one party)
- For each person entity: the relationships table records that link them to the owner, including `relationship_role` type and `started_at` / `ended_at` temporal bounds
- For each person entity: the count of `memory_entities` rows where that entity appears, grouped by `life_stage_id` of the associated memory — this is the **memory density signal**
- Phase 0 Stage 3 entity seed data: `role_significance` metadata stored in `relationships.metadata` JSONB at the time of the entity seed interview (set by the Capture Agent during ontology bootstrapping)

**Secondary inputs (enrich where available):**
- `entity_biography` syntheses for the person entities (if already generated) — their prose summaries are reused as the per-player summary rather than regenerated
- `memory_revisions` — applied before rendering any memory content (see Part XI Pathway C); the most recent non-retracted revision represents current understanding
- `user_periods` — if confirmed, the life stage labels in the output use the user's own period vocabulary rather than the generic WisdomTopicSort stage names

---

### Entity Significance Weighting Model

Each person entity is scored on two axes:

**1. Role significance** (set during Phase 0 entity seed, range 1–5):
The Capture Agent asks "How central was this person to your life?" during the entity seed interview. The response (or the agent's inference from the user's language) sets `role_significance` in `relationships.metadata`. If not set, it defaults to 3 (moderate).

**2. Memory density** (computed, range 0–∞):
The count of memories in which this entity appears, grouped by life stage. A relationship that produced twenty memories across two life stages has higher density than one that produced two memories across six stages.

**Composite significance score per entity per life stage:**
```
stage_score(entity, stage) = role_significance × log1p(memory_density(entity, stage))
```

The `log1p` transform prevents a very long relationship with many routine memories from swamping a short but intensely documented formative one. Duration is not in the formula; a three-year mentor who generated fifteen vivid memories outscores a thirty-year acquaintance who appears in two.

**Inclusion threshold:** Entities with a composite score below 1.0 across all life stages are omitted from the synthesis. This typically excludes very peripheral mentions. The threshold is configurable per prompt version.

**Cast ordering within each life stage:**
Entities are sorted by `stage_score` descending. The top five entities per life stage are rendered in full; additional entities above the threshold appear as a supporting cast list (name + relationship type only, no prose summary).

---

### Output Structure

The `lifes_cast` synthesis content is stored as structured JSON in `syntheses.content` (JSONB). This is a deliberate departure from the prose-only format of `life_period_narrative` and `entity_biography` — the ensemble view requires structured data for client rendering, but also carries a prose summary per life stage for text-sharing and accessibility.

```json
{
  "synthesis_type": "lifes_cast",
  "generated_at": "2026-05-02T...",
  "life_stages_covered": ["Early Childhood", "Youth", "Teen", "Young Adult", "Adult"],
  "total_players": 14,
  "stages": [
    {
      "stage_id": "uuid-young-adult",
      "stage_label": "Young Adult",
      "stage_label_personal": "My New York Years",
      "date_range": { "start": "1978", "end": "1985" },
      "prose_summary": "These were the years of Beth, Marcus, and the advertising world ...",
      "cast": [
        {
          "entity_id": "uuid-beth",
          "name": "Beth Lyons",
          "relationship_type": "colleague_mentor",
          "period_label": "1979–1984",
          "stage_score": 4.2,
          "entry": "entered",
          "exit": "remained",
          "summary": "Beth was the creative director who took a chance on Andy at ...",
          "supporting_memory_ids": ["uuid-m1", "uuid-m2"],
          "entity_biography_id": "uuid-eb-beth"
        }
      ],
      "supporting_cast": [
        { "entity_id": "uuid-x", "name": "...", "relationship_type": "..." }
      ]
    }
  ],
  "narrative_arc": "From the close family world of early childhood through the dense social fabric of a New York career ...",
  "confidence_notes": "Entity seed data only — synthesis will enrich as collection deepens."
}
```

**Key design decisions in the structure:**

- `stage_label_personal` uses the user's `user_periods` vocabulary if available; falls back to the WisdomTopicSort stage name
- `entry` / `exit` values are: `"entered"` (first appearance in this stage), `"remained"` (also present in prior stage), `"exited"` (last appearance), `"lifelong"` (present across all stages to date)
- `summary` is a 50–100 word prose passage for the main cast members; generated by the Synthesis Agent from memory content and the entity_biography if available; omitted for supporting cast
- `narrative_arc` is a 100–150 word synthesis-level prose passage describing the overall trajectory of the cast across the life — the opening paragraph of a text-share version of the artifact
- `confidence_notes` is surfaced in the UI when data density is Phase-0-only, setting honest expectations

---

### Synthesis Agent Prompt Design

The Synthesis Agent prompt for `lifes_cast` must communicate:

1. **The ensemble framing:** The output is about the *cast of people* across a life, not a deep dive into any single relationship. Resist the urge to write a relationship portrait for each person. The goal is the temporal view of who was there and when.

2. **The significance principle:** Duration is not significance. A three-year relationship that changed the person's trajectory belongs in the main cast. A forty-year acquaintance with sparse memories is supporting cast at best.

3. **The non-destructive versioning requirement:** Before writing any prose that references a memory, check `memory_revisions` for that memory. Use the most recent non-retracted revision if one exists. Never render a memory the user has corrected.

4. **The personal vocabulary requirement:** If `user_periods` data is available and confirmed, use the user's period names (e.g., "My New York Years") rather than the generic stage labels. The output should sound as if it was written by someone who knows this specific person, not a template.

5. **The low-density grace:** When the synthesis is being generated from Phase 0 data only (entity seed + residential history, no deep memory collection), the prose should reflect what is known with confidence and signal what will enrich over time. Do not fill gaps with speculation. A short, confident summary is better than a long uncertain one.

**Prompt structure (high level):**
```
System: You are a synthesis agent for a personal life chronicle. Your task is to 
generate a Life's Players synthesis — a time-series view of the significant people 
in [user]'s life, organized by life stage...

[Contextual data block: entity list with role_significance, memory density by stage,
entity_biography excerpts, user_periods if available]

Generate the JSON output following the lifes_cast schema. For each life stage:
1. Identify the top cast members by composite score
2. Write a 50-100 word prose summary for each main cast member
3. Write a 100-150 word prose_summary for the stage as a whole
4. Classify entry/exit for each cast member
5. Write a 100-150 word narrative_arc for the synthesis as a whole

Rules:
- Do not speculate about relationships not documented in the source data
- Check memory_revisions before referencing any memory content
- Use the user's own period vocabulary if user_periods are confirmed
- A relationship of short duration but high memory density should feature
  prominently in its life stage(s)
- If this is Phase-0-only data, add a confidence_notes field explaining the
  synthesis will enrich as collection deepens
```

---

### Client Rendering Requirements

The `lifes_cast` output format requires a rendering approach different from the prose-only syntheses. The client must:

**1. Life-stage accordion or timeline-scroll view:**
The primary navigation model is chronological — the user moves forward or backward through life stages. Each stage expands to show the cast. The current "active" stage is visually prominent; adjacent stages are visible but compressed.

**2. Entry and exit visualization:**
Cast members should have a visual representation of their lifecycle in the user's story — a timeline bar or fade-in/fade-out treatment that shows which stages they span. A person present in eight life stages gets a longer bar than one present in two. Entry and exit events are marked.

**3. Player cards:**
Each main cast member is a tappable card. The card shows name, relationship type, period label, and the 50–100 word prose summary. Tapping the card opens a detail view showing the supporting memories.

**4. Supporting cast:**
Supporting cast members below the main five per stage are listed as a compact row of name + relationship type chips. They are not individually expandable in the MVP; tapping them navigates to the entity graph view for that person.

**5. Text-share rendering:**
The `narrative_arc` field plus a simplified stage-by-stage cast list produces a text-shareable version of the artifact suitable for social sharing or inclusion in an email. The client should render a "Share" action that generates this text representation.

**6. Enrichment signal:**
When `confidence_notes` is non-null, the artifact header displays a gentle signal: "This view will deepen as you add more memories." This manages expectations without undermining the artifact's current value.

---

### Synthesis Lifecycle

The `lifes_cast` synthesis follows the same invalidation pattern as all synthesis types:

- Generated at the end of Phase 0 Stage 3 (the first version, from entity seed data)
- `is_current = false` / `invalidated_at = NOW()` set whenever:
  - A new entity is added or merged that would affect the cast
  - A memory is added whose entity tags affect the memory density score for an entity
  - A memory_revision changes content referenced in any cast member summary
  - A `user_periods` record is confirmed, modifying the stage vocabulary
- The Synthesis Agent detects invalidated `lifes_cast` syntheses in its batch cycle and regenerates

The first version (Phase 0 only) is expected to be thin but accurate. Subsequent versions enrich automatically as the collection grows. The user should see the synthesis improve visibly over the first few months of collection — this is part of the product's core retention loop.

---

### Relationship to Next Steps

This section resolves **Next Step #40** in the architecture doc. The remaining open design items related to Life's Players:

- **Next Step #39 (Globe transit animation):** Independent of Life's Players; no dependency.
- **Synthesis Agent orchestration:** Blocked by the agent orchestration decision (Next Step #36). Life's Players cannot be regenerated on a schedule until the scheduler is implemented.
- **User periods vocabulary:** The `user_periods` table is in the schema but is populated only when the user confirms chapter naming (Phase 2 for the elicitation UI). MVP syntheses use WisdomTopicSort stage labels as the fallback; the vocabulary upgrade is automatic when `user_periods` are confirmed.

---

## Part XVI: Agent Orchestration — Inngest Decision

*May 2026. Resolves Next Step #36 (Design agent orchestration / job queue / dispatch model). This section documents the selected orchestration approach, rationale, pricing strategy, event taxonomy, and integration pattern for all Life Chronicle agents.*

---

### Decision: Inngest as the Agent Orchestration Layer

After evaluating in-DB queue tables and external orchestrators (pg_cron, Inngest, Trigger.dev), **Inngest** is the selected agent orchestration layer for Life Chronicle.

**What Inngest provides:**

- **Event-driven triggering:** Agents fire on named events emitted from the application (e.g., `memory.ingested`, `synthesis.invalidated`). This maps cleanly to Life Chronicle's append-only model — writes to the Raw Vault naturally produce the events that trigger downstream processing.
- **Durable multi-step flows:** Inngest steps are individually retried; a failed step does not restart the whole function. This is important for the Temporal Agent (Phase 2), which iterates a constraint graph over many turns — each constraint resolution can be its own step.
- **Exactly-once semantics:** Inngest deduplicates on event ID, preventing double-processing if the same event is emitted twice (e.g., on network retry from the application).
- **Built-in retry with backoff:** Configurable per-function retry policies with exponential backoff. No custom lease management code required.
- **Observability dashboard:** Step-level traces, execution history, and failure inspection out of the box. This is critical for debugging synthesis pipelines that touch multiple agents and tables.
- **No infra to manage:** No worker process to deploy, no Redis queue to operate. Functions run as serverless handlers; Inngest delivers events.

**What was not chosen and why:**

- **In-DB queue table (e.g., `agent_jobs`):** Would require polling workers, custom lease management, dead-letter handling, and a monitoring dashboard — all from scratch. Adds operational complexity without benefit at this scale.
- **pg_cron:** Supports scheduled jobs only, not event-driven triggering. Cannot react to `memory.ingested` without polling. Also Supabase-managed; limited observability.
- **Trigger.dev:** Viable alternative with similar capabilities. Inngest selected on the basis of established pricing transparency, larger community, and tighter Supabase integration patterns documented in the ecosystem.

---

### Pricing and Tier Strategy

Inngest's pricing structure maps well to Life Chronicle's growth trajectory:

**Hobby tier ($0/month):**
- 50,000 step executions included
- 5 concurrent steps
- 3 users (sufficient for solo build phase)

**Estimated execution volume for a single active user:**
- Phase 0 completion: ~200–400 steps (one-time ontology bootstrap)
- Ongoing daily use: 15–30 events/day × ~4–6 steps per event = 60–180 steps/day
- Monthly steady state: ~1,800–5,400 steps/month
- Plus nightly batch jobs: ~30 steps/night = ~900 steps/month
- **Total estimate: 2,700–6,300 steps/month for one active user**

The Hobby tier comfortably accommodates Andy's personal build phase (likely 12–18 months of solo use before beta).

**Pro tier ($75/month + usage):**
- 50,000 step executions included in base price; additional steps billed at tiered rates
- Triggers at approximately 400–500 active beta users engaging daily (est. 1.1M–2.0M steps/month)
- Additional usage charge at Pro scale estimated at $25–35/month (using Inngest's published rates for the 1M–5M step range)
- **Effective Pro cost at 500 active users: ~$100–110/month** before any user-side cost recovery

Migration from Hobby to Pro requires no code changes — upgrade in Inngest dashboard.

---

### Event Taxonomy

The following named events constitute the primary interface between the Life Chronicle application and Inngest:

| Event Name | Emitted By | Consumed By | Trigger Condition |
|---|---|---|---|
| `memory.ingested` | Capture Agent (after INSERT to `memories`) | Tagger Agent, Entity Agent | New memory row confirmed in Raw Vault |
| `synthesis.invalidated` | Any agent that sets `is_current = false` on a `syntheses` row | Synthesis Agent | Synthesis record marked stale |
| `phase0.stage_completed` | Planner Agent | Synthesis Agent, Planner Agent | A Phase 0 stage milestone is reached (triggers stage-appropriate synthesis) |
| `entity.merged` | Entity Agent | Synthesis Agent, Tagger Agent | Two entity records merged; downstream syntheses using either must be invalidated |
| `review_queue.item_added` | Any agent inserting to `review_queue` | (notification layer; no agent auto-response) | High-priority review item needs user attention |
| `user.period_confirmed` | Application (user action) | Synthesis Agent | User confirms a life stage label; `lifes_cast` synthesis vocabulary must update |

---

### Scheduled Jobs

The following jobs run on a time-based schedule (Inngest cron syntax):

| Job | Schedule | Agent | Purpose |
|---|---|---|---|
| `planner.daily_review` | Daily, 03:00 UTC | Planner Agent | Review review_queue items, identify memory density gaps, generate suggested interview topics |
| `synthesis.nightly_batch` | Daily, 02:00 UTC | Synthesis Agent | Sweep `syntheses` WHERE `is_current = false`; regenerate stale synthesis records |
| `assumption.review_prompt` | Weekly, Sunday 08:00 UTC | (notification) | Surface assumption_log items with `is_confirmed = false` older than 7 days for user review |

---

### Integration Pattern

**Application → Inngest:**
Events are sent via the Inngest SDK from within Supabase Edge Functions or the application backend. The pattern is:

```
// After Capture Agent confirms INSERT to memories:
await inngest.send({
  name: "memory.ingested",
  data: { memory_id: newMemory.id, user_id: session.userId }
});
```

**Inngest → Agent functions:**
Each agent is implemented as one or more Inngest functions. Functions receive the event payload and execute their steps (database reads, LLM calls, database writes) as individual retryable steps:

```
inngest.createFunction(
  { id: "tagger-agent", retries: 3 },
  { event: "memory.ingested" },
  async ({ event, step }) => {
    const memory = await step.run("fetch-memory", () => fetchMemory(event.data.memory_id));
    const tags = await step.run("generate-tags", () => callLLM(memory));
    await step.run("write-tags", () => writeTagsToDb(memory.id, tags));
  }
);
```

**Failure handling:**
- Steps retry up to the configured maximum (default 3) with exponential backoff
- After max retries, the function moves to Inngest's failed state and appears in the observability dashboard
- `assumption_log` records the last-known agent decision before failure, supporting post-failure audit
- `review_queue` items created by agents before failure are preserved; the user sees outstanding items even if the agent did not complete

---

### What This Replaces / Supersedes

This decision supersedes the architectural note in Part VI ("Concurrent writes to different tables will work correctly due to PostgreSQL's row-level locking") that implied concurrency without specifying a dispatch model. The row-level locking observation remains correct; Inngest provides the event delivery and retry layer above it.

The `agent_jobs` table considered in Next Step #36 is **not implemented**. Inngest's event log is the equivalent record of what has been dispatched and its outcome.

---

### Relationship to Next Steps

This section resolves **Next Step #36** in the architecture doc. With orchestration decided, the following previously blocked items are now unblocked:

- **Capture Agent implementation** — can now be built with `inngest.send()` calls after confirmed INSERTs
- **Tagger Agent implementation** — listens to `memory.ingested`, no longer needs an ad hoc trigger
- **Synthesis Agent nightly batch** — implemented as `synthesis.nightly_batch` cron function
- **Life's Players first generation** (Part XV) — triggered by `phase0.stage_completed` event at Stage 3

The only remaining orchestration-adjacent open item is the viewer_can_access() full implementation (Next Step in schema_v1.sql), which is a schema concern, not an orchestration concern.


---

## Part XVII — Orchestrator Agent + Dual-Mode Sub-Agents + Private Notes Layer (added 2026-05-17)

This part captures three interrelated architectural additions made during the May 2026 spec work: the introduction of a new agent class (the Orchestrator), the reshaping of existing sub-agents as dual-mode, and the addition of a second content layer on memories (private notes) that sits below Access Cards in the visibility model.

Canonical specs: `documentation/feature_capture_assistant.md` v1.1 and `documentation/feature_residential_globe_onboarding.md` v1.1.

### The Orchestrator Agent

A new agent class introduced alongside the capture assistant work. The orchestrator is a Claude Sonnet 4.5 instance invoked synchronously on every user submission (typed, dictated, pasted, eventually file-uploaded). It has broad context of the user's chronicle state and produces a reasoned response with proposed actions visible to the user as cards.

The orchestrator does NOT replace the existing sub-agents — Tagger, Entity, Search, future Temporal. It coordinates them. The sub-agents continue to listen to Inngest events for deeper async passes; the orchestrator calls into them inline as tools when generating the user-facing immediate response.

**Three-layer prompt structure (multi-tenant safety + cost efficiency):**

| Layer | Scope | Cache strategy |
|---|---|---|
| A. Generic system prompt | Multi-user, version-controlled. Agent role, output protocol, tool semantics, hard invariants. No user data. | Anthropic `cache_control` with long TTL |
| B. Per-user chronicle context digest | User-specific. Compact 1–3k-token summary of chronicle state. Stored in `user_chronicle_digests`, regenerated on chronicle changes via Planner-owned compaction job. | `cache_control`, hash-keyed; cache invalidates naturally when digest is regenerated |
| C. Submission-time inputs | This call only. User's submission + active-screen context. | Never cached |

This separation is enforced at the SDK wrapper level (`lib/agents/orchestrator.ts`). Layer A never carries user data; Layer B is always loaded from the per-user store; only Layer C is constructed fresh per call.

### Dual-Mode Sub-Agents

Tagger and Entity (and eventually Temporal) are designed as both:

- **Inngest async listeners** on `memory/ingested` — heavier, slower passes that enrich the record over the minute after ingestion
- **Synchronous inline tools** — called by the orchestrator during the immediate response generation, returning structured data for the user-facing proposal cards

Both modes share a core function. The Inngest listener wraps it with event handling and persistence side-effects; the inline tool wraps it as an Anthropic tool definition. Designing these together (rather than building event listeners first and adding tools later) prevents wasted refactoring.

### Private Notes Layer

A second content layer on `memories`:

```
memories.private_notes TEXT  -- owner-only commentary; filtered out of non-owner projections
```

This is **not** another Access Card tier. It is a content-layer split *within* every memory:

| Layer | Visibility | Use |
|---|---|---|
| Public content (existing `content_raw`, `content_normalized`, etc.) | Governed by Access Cards | The recollection as the owner wants it represented to whichever audience the card grants |
| Private notes (new `private_notes`) | Owner-only, regardless of Access Card grants | Owner's honest assessments, social-context reminders, drafts, second thoughts |

**RLS enforcement (column-level filter):** When `viewer_can_access()` is fully implemented in Step 13, it must project all columns EXCEPT `private_notes` for non-owner viewers — even when the memory itself is granted via an Access Card. This is column-level filtering, not row-level. Implementation pattern: a view `memories_visible` that the API queries, which omits `private_notes` when the calling user is not the owner.

### Phase 0 Reframe — Parallel Strands

Captured here for traceability against the architecture record: Phase 0 is no longer three sequential stages with explicit completion gates. It is three parallel strands (residential, entity, topic) that run concurrently under the capture assistant's orchestration. The system internally tracks data thresholds and emits `chronicle/threshold.reached` events when criteria are met. The original `phase0/stage.completed` event is renamed accordingly.

The dependency theory (Tier 1 structural scaffold → Tier 2 entity seed → Tier 3 topic map) remains unchanged as theory; the orchestrator enforces it internally by choosing which strand to prompt next based on chronicle state. The user never sees a "Stage N of 3" indicator.

### What This Replaces / Adds To

This part adds to (not replaces) the existing architecture:

- Adds the Orchestrator Agent as a new layer above the sub-agents
- Adds the `user_chronicle_digests` and `capture_submissions` tables
- Adds the `memories.private_notes` column
- Reshapes Tagger and Entity to dual-mode
- Renames the `phase0/stage.completed` Inngest event to `chronicle/threshold.reached`
- Adds `viewer_can_access()` requirement: column-level filter on `private_notes`

The existing dual-layer Raw Vault + Synthesis model, the Access Cards privacy model, and the constraint-graph temporal model are all unchanged.
