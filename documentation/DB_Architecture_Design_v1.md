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

## Appendix: Key Files

- `documentation/schema_v1.sql` — Full PostgreSQL schema with indexes, seed data, and search functions
- `documentation/DB_Architecture_Design_v1.md` — This document

## Next Steps

**Privacy Model (completed April 2026):**
- ✅ 5-tier `privacy_tier` enum created and applied to: `memories`, `entities`, `relationships`, `media`, `syntheses`
- ✅ `is_sensitive` flag on `dimensions` table for auto-Private enforcement
- ✅ `compute_synthesis_tier()` function + trigger for most-restrictive-source inheritance
- ✅ Cascade trigger on `memories.privacy_tier` changes to recompute downstream syntheses
- ✅ RLS policy scaffold documented with commented-out activation stubs

**Pending:**

1. **Add connection group tables** — `user_close_friends`, `user_family_members`, `user_professional_connections`; define membership management UX; activate the commented-out RLS policies once these exist
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
14. **Design the full Phase 0 Ontology Bootstrap Protocol** — Now understood as four stages (Temporal/Geographic Skeleton → Chapter Naming → Entity Seed → Topic Map), not just the residential history interview. Requires designing the validation gate interaction before memory collection begins. Supersedes the narrower "residential history onboarding interview" item.
15. **Add `session_type` to `interview_sessions`** — Distinguish `ontology_bootstrap`, `memory_collection`, `temporal_resolution`, `entity_resolution`, `review_and_correction`; agent prompts and downstream processing differ substantially by type
16. **Design the assumption log table** — First-class record of every agent inference and disambiguation decision (Tagger classifications, Entity Agent resolutions, Temporal Agent constraint inferences); required for synthesis traceability and user correction path
17. **Design constraint rules table for synthesis completeness** — Ontological rules specifying what a synthesis of a given type requires (e.g. a `career_narrative` requires ≥2 confirmed employment relationships with non-null start dates); enables dependency-aware gap detection rather than coverage scoring alone
18. **Implement `generate_residency_constraints()` triggering** — Hook the function to fire automatically when a `lived_at` relationship is inserted or its `started_at`/`ended_at` are updated, so the cascade is immediate
19. **Read `first interview` Google Drive doc** — Large document (435 KB, likely a real interview transcript or full question set); should inform interview agent prompt design before Capture Agent work begins

**From handoff-checklist.md (early-planning-v2, Oct 2025) — novel elements not yet in schema or design:**

20. **Expand taxonomy tables** — The checklist specifies a more granular taxonomy layer than our current `dimensions` tree: `taxonomy_i18n` (internationalization of dimension names and prompts), `taxonomy_versions` (versioned taxonomy management so evolving the category tree doesn't break existing entries), `taxonomy_prompts` (prompt templates stored per taxonomy node, with primary and follow-up variants). Evaluate whether to extend `dimensions` or introduce these as sibling tables.
21. **Add `sources`, `flags`, `audits` tables** — Moderation and provenance layer currently absent from the schema. `sources` tracks origin of imported content (LinkedIn, email, document, social) with citation metadata, supporting the Raw Vault provenance principle. `flags` supports content moderation and user-reported issues. `audits` is a general access and action log, required for HIPAA readiness (Phase 2 goal) and for the assumption log pattern.
22. **Define CEF v1 export folder structure formally** — The checklist specifies the exact ZIP layout: `/manifest.json`, `/users/<id>/profile.json`, `/users/<id>/entities.json`, `/users/<id>/taxonomy.json`, `/users/<id>/events.json`, per-entry folders containing `entry.json` + `transcript.vtt` + `transcript.srt` + `transcript.json` + `media/*` + optional `embeddings.json`. SHA-256 checksums in both `manifest.json` and each `entry.json`. Delta exports ("since last backup") required. Locate the companion `cef-schema.json` (referenced but not yet found) for formal validation schema.
23. **Document the privacy-safe RAG retrieval ordering** — Enforce in all vector search implementations: (1) permissions filter in SQL/RLS first, (2) metadata filters (time, entities, taxonomy), (3) pgvector similarity on allowed rows only, (4) app-level rerank and deduplicate. Running vector similarity before the permissions filter is a privacy vulnerability. This ordering must be documented as an architectural constraint, not left to individual implementation decisions.
24. **Define JWT `role_tier` claim for RLS performance** — Rather than joining connection-group tables on every query, encode the viewer's privacy tier as a JWT claim (`role_tier`: public | professional | family | close_friends). The RLS policies read this claim directly, making tier-filtered queries fast. Design claim issuance, refresh, and revocation logic alongside the connection group tables (item 1 above).
25. **Authentication: Passkeys (WebAuthn) as primary, magic link as fallback** — Earlier documents led with magic link as primary auth. The checklist recommends Passkeys (WebAuthn) as primary with magic link fallback. Passkeys are now broadly supported on iOS Safari 16+ and Android Chrome 111+ and are significantly more secure. Confirm this as the auth strategy in the final PRD.
26. **Define analytics funnel and observability stack** — Instrument the full capture funnel: `sms_sent` → `deeplink_opened` → `tts_played` → `record_started` → `record_uploaded` → `asr_success` → `entry_completed`, plus error events: `mic_denied`, `media_recorder_unsupported`, `upload_failed`, `asr_failed`. Recommended stack: PostHog (product analytics) + OpenTelemetry (distributed tracing). Tie analytics events to OTEL traces for drop-off diagnosis.
27. **Capture cost guardrails as operational constraints** — TTS capped at 20 seconds per prompt, cached by template-hash + variables. Client-side silence trim before upload (−40 dB threshold, head/tail). Recordings over 3 minutes dropped at client, not truncated. ASR batched with capped retries and exponential backoff. These are not UX decisions — they are cost-control architecture that must be enforced at the API and client layers.
28. ~~Locate missing companion documents~~ — ✅ Found and added to `documentation/early-planning-v2/`: `Revised_PRD_v2.md`, `lovable-build-spec.v2.md`, `cef-schema.json`, `README_Import_Validation.txt`. `PRD_Addendum_MobileWeb_SMS.md` still not found.

**From Revised_PRD_v2.md + lovable-build-spec.v2.md + cef-schema.json (Oct 2025) — additional novel elements:**

29. **Add consent metadata fields to `memories` and `media`** — The CEF v1 schema formalizes two per-entry consent flags: `voiceCloneAllowed` (whether the user's voice recording may be used for voice synthesis features) and `publicIndexingAllowed` (whether this entry may appear in search engine indexes). These are distinct from privacy tier — they govern specific downstream uses of the content rather than viewer access. Both should default to `false` / `null` (most conservative). Add to `memories` and `media` tables.

30. **Add `fuzzy` text field to temporal model** — The CEF v1 `Event` definition includes a `fuzzy` free-text field alongside `start`, `end`, and `confidence`. This is the human-readable description of temporal uncertainty ("sometime in the late 1980s", "before my sister was born") that accompanies the structured uncertainty envelope. Maps naturally to our `time_precision` model but adds an explicit natural-language companion that the Temporal Agent can use as evidence and that exports can carry. Add `time_fuzzy_description TEXT` to the `memories` table.

31. **Design the Executor role as a future 6th privacy tier** — `Revised_PRD_v2.md` lists "Executor role" in post-MVP scope. This is a posthumous/estate access role: a designated person who gains access to some or all of a user's chronicle after death or incapacitation. It is not simply another sharing tier — it requires a separate identity, a triggering condition, and potentially granular access rules. The 5-tier enum should be designed to accommodate a future `executor` value without schema migration, or the Executor role should be managed as a separate access control layer. Flag this as an architectural decision to make before finalizing the RLS design.

32. **Support user-defined custom taxonomy nodes** — `Revised_PRD_v2.md` specifies: "User-defined custom nodes; agent suggests merges and generates 3–5 starter prompts." Our current `dimensions` table supports hierarchy and custom entries structurally, but the application layer has no defined workflow for user-created nodes, no merge suggestion capability, and no auto-generated prompt seeding for custom nodes. The Planner Agent needs a `createCustomNode` capability and a `mergeSuggestion` operation (both named in the tRPC API surface in `lovable-build-spec.v2.md`).

33. **Formalize `cef-schema.json` as the validation artifact for exports** — The formal JSON Schema (Draft 2020-12) is now on disk at `documentation/early-planning-v2/cef-schema.json`. The export pipeline must validate every generated `manifest.json` and `entry.json` against this schema before delivery. Note: the schema's `Entry.source` enum currently lists only `user`, `linkedin`, `crawler` — this will need updating as additional import sources are added (email, SMS, journal, etc.). The `Taxonomy.nodes[].sensitivity` field and `Taxonomy.nodes[].defaultTier` in the schema formalize what we've implemented as `is_sensitive` + application-layer enforcement — worth aligning these to ensure exports are self-describing.

34. **Adopt SLOs from the build spec as PRD performance requirements** — `lovable-build-spec.v2.md` specifies: deep-link open ≤2s TTFB; TTS tap-to-play ≤300ms (cached); 2-minute audio upload ≤10s on LTE. These are the only formal performance targets across all reviewed documents and should be carried into the PRD as acceptance criteria baselines.

35. **Define the tRPC API surface as the canonical agent-facing interface** — `lovable-build-spec.v2.md` names the API namespaces: `entries` (createFromUpload, getTimeline, searchHybrid, markTier, markIncomplete), `taxonomy` (getPlan, getCoverage, createCustomNode, mergeSuggestion), `flags` (create, resolve), `export` (createFull, createDelta, status, download), plus REST webhooks for SMS, recordings, ingest, and billing. The `markIncomplete` operation is notable — it is the explicit API for returning an entry to the Incomplete Queue for follow-up, which the agent uses after ASR to flag entries needing clarification. This should be in the design doc as the planned API surface before implementation begins.
