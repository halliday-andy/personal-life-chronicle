-- ============================================================
-- LIFE CHRONICLE DATABASE SCHEMA v1.4
-- Platform: PostgreSQL 15+ with pgvector extension
-- Hosted: Supabase (managed Postgres)
-- Author: Architecture Design Session, April 2026
--
-- Synced to the deployed schema in migration
--   supabase/migrations/20260505000000_initial_schema.sql
-- and the follow-on migration
--   supabase/migrations/20260520182927_entity_confirmation_queue.sql
--
-- v1.4 — 2026-05-20: privacy_tier ENUM and tier_locked columns removed
--                    from memories, entities, relationships, media, and
--                    syntheses. The five-tier sharing model was superseded
--                    by the Access Cards framework (§E below). The
--                    compute_synthesis_tier()/trg_set_synthesis_privacy_tier
--                    helpers and their triggers were retired with it.
--                    The five tier names live on as the system_code values
--                    of the five system cards seeded per user.
--                    Also added: 'entity_confirmation_needed' as a
--                    review_queue.item_type value (tap-to-confirm flow
--                    for new person entities).
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pgvector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS postgis;     -- geospatial: geometry, geography, spatial indexes

-- ============================================================
-- PRIVACY MODEL — Access Cards (see §E below)
--
-- Life Chronicle's privacy model is the Access Cards framework
-- (cards / contacts / card_holders / record_card_grants /
-- synthesis_visibility_cache / card_audit_log / access_log). The
-- earlier five-tier privacy_tier ENUM was retired in v1.4 — both the
-- type and the columns on memories, entities, relationships, media,
-- and syntheses are gone from the deployed schema.
--
-- The five tier names live on as the system_code values of the five
-- system cards pre-seeded for every new user (Private, Close Friends,
-- Family, Professional, Public). The UI still presents these names;
-- the underlying mechanism is card-based.
--
-- Canonical spec: documentation/access_cards_requirements.md
-- Architecture summary: documentation/DB_Architecture_Design_v1.md §X
-- ============================================================


-- ============================================================
-- DIMENSION TAXONOMY
-- The WisdomTopicSort framework, stored as a self-referencing
-- tree. New dimensions can be added at any time, at any depth,
-- without schema migration.
-- ============================================================

CREATE TABLE dimension_types (
    id          SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT,
    is_temporal BOOLEAN DEFAULT false,
    sort_order  SMALLINT
);

-- Seed: The 10 primary dimension type axes
-- (populated in seed_dimensions.sql)
INSERT INTO dimension_types (code, name, description, is_temporal, sort_order) VALUES
    ('life_stage',       'Life Stage',              'Temporal arc of human development',                      true,  1),
    ('topic_domain',     'Topic Domain',            'Subject area of the experience',                         false, 2),
    ('phenomenon_type',  'Phenomenon Type',         'Nature or category of the experience itself',            false, 3),
    ('relationship_role','Relationship Role',       'Type of relationship to a person',                       false, 4),
    ('event_category',   'Life Event Category',     'Recurring life event pattern or milestone',              false, 5),
    ('environment',      'Personal Environment',    'Physical or domestic setting',                           false, 6),
    ('emotional_tone',   'Emotional Register',      'Feeling state or attitude present in the memory',        false, 7),
    ('expressive_form',  'Expressive Form',         'Quote, saying, insight, epiphany',                       false, 8),
    ('world_context',    'World/Cultural Context',  'External world events or cultural backdrop',             false, 9),
    ('artifact_type',    'Artifact Type',           'Physical or digital object associated with the memory',  false, 10);


CREATE TABLE dimensions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_id      SMALLINT NOT NULL REFERENCES dimension_types(id),
    parent_id    UUID REFERENCES dimensions(id),  -- for hierarchical sub-categories
    code         TEXT,                             -- optional machine-readable slug
    name         TEXT NOT NULL,
    description  TEXT,
    sort_order   SMALLINT,
    -- Sensitive flag: memories tagged with this dimension receive
    -- record_card_grants(grant_type='auto_isolate') against every active
    -- card on insert (Capture Agent responsibility). The owner must
    -- explicitly remove auto-isolation before any card can grant access.
    -- Apply to: medical, legal, financial, sexual, mental health domains.
    is_sensitive BOOLEAN NOT NULL DEFAULT false,
    metadata     JSONB DEFAULT '{}',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dimensions_type    ON dimensions(type_id);
CREATE INDEX idx_dimensions_parent  ON dimensions(parent_id);
CREATE INDEX idx_dimensions_code    ON dimensions(code) WHERE code IS NOT NULL;


-- ============================================================
-- ENTITIES
-- People, places, organizations, concepts, artifacts.
-- The "nodes" of the life graph.
-- ============================================================

CREATE TYPE entity_type AS ENUM (
    'person',
    'place',
    'organization',
    'concept',
    'artifact',
    'vehicle',          -- car, motorcycle, boat, plane — owned with temporal relationship
    'event_series'      -- recurring events like "Christmas at grandma's"
);

-- Sub-classification for place entities.
-- Determines icon, zoom level, label, and bounding treatment on map/globe.
CREATE TYPE place_type AS ENUM (
    'continent',
    'country',
    'region',           -- state, province, territory
    'city',
    'neighborhood',
    'address',          -- specific street address or building
    'landmark',         -- named public place: school, hospital, stadium
    'natural_feature',  -- mountain, lake, beach, park
    'transit_hub',      -- airport, train station, port
    'military_base',
    'vessel'            -- ship, boat — a moving place
);

CREATE TABLE entities (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL,
    type                entity_type NOT NULL,
    canonical_name      TEXT NOT NULL,
    aliases             TEXT[],                     -- nicknames, maiden names, etc.

    -- Temporal anchors (null for non-persons / non-orgs)
    born_at             DATE,
    died_at             DATE,
    founded_at          DATE,
    dissolved_at        DATE,

    -- Spatial anchor (parent in geographic hierarchy, e.g. city → country)
    location_entity_id  UUID REFERENCES entities(id),

    -- ----------------------------------------------------------------
    -- GEOSPATIAL FIELDS (populated for type = 'place')
    -- ----------------------------------------------------------------

    -- Sub-classification: what kind of place
    place_subtype       place_type,

    -- PostGIS geography column.
    -- POINT for specific locations; POLYGON/MULTIPOLYGON for regions.
    -- GEOGRAPHY (not GEOMETRY) so distance calculations respect Earth's curvature.
    -- SRID 4326 = standard WGS84 lat/lng used by GPS, Google Maps, OSM.
    geom                GEOGRAPHY(GEOMETRY, 4326),

    -- Elevation in metres above sea level (for 3D globe rendering)
    elevation_m         FLOAT,

    -- Canonical external geocoding reference — resolves to authoritative coords.
    -- Store whichever is most specific: OSM node/relation ID, Google Place ID,
    -- Wikidata Q-number, or similar.
    external_geo_id     TEXT,
    external_geo_source TEXT,                       -- 'osm' | 'google' | 'wikidata' | 'manual'

    -- ISO 3166-1 alpha-2 country code (for flag display, locale formatting)
    country_code        CHAR(2),

    -- IANA timezone identifier (e.g. 'America/New_York', 'Europe/Madrid')
    timezone            TEXT,

    -- ----------------------------------------------------------------

    description         TEXT,
    embedding           VECTOR(1536),               -- for semantic entity discovery
    metadata            JSONB DEFAULT '{}',         -- extensible: occupation, nationality, etc.
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entities_user      ON entities(user_id);
CREATE INDEX idx_entities_type      ON entities(user_id, type);
CREATE INDEX idx_entities_name      ON entities USING gin(to_tsvector('english', canonical_name));
CREATE INDEX idx_entities_embedding ON entities USING ivfflat(embedding vector_cosine_ops)
    WITH (lists = 100);

-- GiST spatial index — enables fast bounding-box and radius queries on the globe
CREATE INDEX idx_entities_geom      ON entities USING GIST(geom);

-- Fast lookup of place entities by country (for regional filtering)
CREATE INDEX idx_entities_country   ON entities(country_code) WHERE type = 'place';


-- ============================================================
-- RELATIONSHIPS
-- Typed, directed, temporal edges between entities.
-- The graph layer lives here — query with recursive CTEs.
-- ============================================================

CREATE TABLE relationship_types (
    id           SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    code         TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    inverse_code TEXT,           -- e.g. 'mentored_by' is inverse of 'mentored'
    category     TEXT,           -- 'family' | 'professional' | 'romantic' | 'social' | 'adversarial'
    description  TEXT
);

-- Move reason vocabulary — stored as metadata->>'move_reason' on lived_at relationships.
-- Captures WHY a move happened, which connects residential history to career, family,
-- and other life event timelines. Also used by the Temporal Agent to find corroborating
-- anchors: a career move implies a hire/start date somewhere in the memories.
--
-- Valid values (extensible via metadata — not enforced as enum):
--   'career_relocation'   — new job or transfer required the move
--   'military_posting'    — military orders
--   'marriage'            — moved in with or following a partner
--   'divorce_separation'  — left shared home after relationship ended
--   'education'           — moved for school or university
--   'family_care'         — moved to be near or to care for family member
--   'financial'           — downsizing, upsizing, affordability
--   'retirement'          — post-career relocation
--   'health'              — climate, medical proximity, disability accommodation
--   'displacement'        — forced: eviction, disaster, conflict, foreclosure
--   'adventure'           — deliberate life change with no single cause
--   'unknown'             — person doesn't recall or hasn't said

-- Residency metadata fields (stored in relationships.metadata JSONB for lived_at rows):
--   is_primary          BOOLEAN   — true for primary residence, false for secondary/seasonal
--   move_reason         TEXT      — from vocabulary above
--   moved_in_precision  TEXT      — 'day'|'month'|'year'|'season'|'decade'|'unknown'
--   moved_out_precision TEXT      — same
--   household_members   UUID[]    — entity IDs of people sharing the residence
--   housing_type        TEXT      — 'house'|'apartment'|'dormitory'|'military_base_housing'|
--                                   'rented_room'|'family_home'|'boat'|'other'
--   notes               TEXT      — any additional context

INSERT INTO relationship_types (code, name, inverse_code, category) VALUES
    -- Family
    ('parent_of',       'Parent of',        'child_of',         'family'),
    ('child_of',        'Child of',         'parent_of',        'family'),
    ('sibling_of',      'Sibling of',       'sibling_of',       'family'),
    ('grandparent_of',  'Grandparent of',   'grandchild_of',    'family'),
    ('grandchild_of',   'Grandchild of',    'grandparent_of',   'family'),
    ('aunt_uncle_of',   'Aunt/Uncle of',    'niece_nephew_of',  'family'),
    ('niece_nephew_of', 'Niece/Nephew of',  'aunt_uncle_of',    'family'),
    ('cousin_of',       'Cousin of',        'cousin_of',        'family'),
    ('spouse_of',       'Spouse of',        'spouse_of',        'romantic'),
    ('partner_of',      'Partner of',       'partner_of',       'romantic'),
    -- Romantic
    ('lover_of',        'Lover of',         'lover_of',         'romantic'),
    ('crush_on',        'Had crush on',     NULL,               'romantic'),
    -- Social
    ('friend_of',       'Friend of',        'friend_of',        'social'),
    ('acquaintance_of', 'Acquaintance of',  'acquaintance_of',  'social'),
    ('neighbor_of',     'Neighbor of',      'neighbor_of',      'social'),
    -- Professional
    ('colleague_of',    'Colleague of',     'colleague_of',     'professional'),
    ('boss_of',         'Boss of',          'reported_to',      'professional'),
    ('reported_to',     'Reported to',      'boss_of',          'professional'),
    ('mentored',        'Mentored',         'mentored_by',      'professional'),
    ('mentored_by',     'Mentored by',      'mentored',         'professional'),
    ('protege_of',      'Protégé of',       'mentor_of',        'professional'),
    ('mentor_of',       'Mentor of',        'protege_of',       'professional'),
    ('collaborated_with','Collaborated with','collaborated_with','professional'),
    -- Adversarial
    ('antagonist_of',   'Antagonist of',    'antagonist_of',    'adversarial'),
    -- Influence
    ('influenced_by',   'Influenced by',    'influenced',       'social'),
    ('influenced',      'Influenced',       'influenced_by',    'social'),
    -- Spatial
    ('lived_at',        'Lived at',         'was_home_to',      'spatial'),
    ('worked_at',       'Worked at',        'employed',         'professional'),
    ('attended',        'Attended',         'enrolled',         'professional'),
    ('visited',         'Visited',          NULL,               'spatial'),
    ('member_of',       'Member of',        'had_member',       'social'),
    -- Ownership — primary relationship for vehicles, artifacts, and property.
    -- started_at = acquired/purchased, ended_at = sold/lost/gifted.
    -- metadata: purchase_price, sale_price, make, model, year, vin, notes.
    ('owned',           'Owned',            'was_owned_by',     'ownership'),
    ('was_owned_by',    'Was owned by',     'owned',            'ownership'),
    -- Creative/participation — for hobbies, bands, sports teams, theatre groups
    ('performed_in',    'Performed in',     'featured',         'creative'),
    ('participated_in', 'Participated in',  'included',         'social'),
    ('created',         'Created',          'was_created_by',   'creative');


CREATE TABLE relationships (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,
    subject_id      UUID NOT NULL REFERENCES entities(id),
    object_id       UUID NOT NULL REFERENCES entities(id),
    type_id         SMALLINT NOT NULL REFERENCES relationship_types(id),
    started_at      DATE,
    ended_at        DATE,
    is_ongoing      BOOLEAN DEFAULT true,
    strength        FLOAT CHECK (strength BETWEEN 0 AND 1),
    notes           TEXT,
    source_memory_ids UUID[],        -- provenance: which memories established this
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_relationships_subject  ON relationships(subject_id);
CREATE INDEX idx_relationships_object   ON relationships(object_id);
CREATE INDEX idx_relationships_type     ON relationships(type_id);
CREATE INDEX idx_relationships_user     ON relationships(user_id);


-- ============================================================
-- MEMORIES
-- The atomic unit. One memory = one recollection, insight,
-- event account, or artifact reference.
-- Raw, unmodified. Append-only by convention.
-- ============================================================

CREATE TYPE memory_source AS ENUM (
    'voice_interview',      -- voice response, Whisper-transcribed
    'text_entry',           -- direct text from user
    'document_import',      -- extracted from uploaded document
    'photo_caption',        -- derived from photo/image context
    'video_transcript',     -- extracted from video processing
    'email_import',         -- extracted from email archive
    'agent_extracted',      -- AI-derived from cross-memory analysis
    'journal_import',       -- legacy diary or journal text
    'sms_import',           -- SMS/message thread import
    'social_import'         -- social media post import
);

CREATE TYPE memory_confidence AS ENUM (
    'certain',              -- user stated explicitly, high certainty
    'probable',             -- user believes this is correct
    'uncertain',            -- fuzzy or approximate
    'inferred'              -- AI inference from other memories
);

CREATE TABLE memories (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL,

    -- Content
    title                   TEXT,
    content_raw             TEXT NOT NULL,          -- verbatim capture, never modified
    content_normalized      TEXT,                   -- cleaned version (spelling, etc.)
    embedding               VECTOR(1536),           -- semantic search vector

    -- ----------------------------------------------------------------
    -- TEMPORAL PLACEMENT
    --
    -- Two distinct concepts kept separate:
    --
    -- (A) Event duration: when the event itself began and ended.
    --     occurred_at_start / occurred_at_end mark the span of
    --     the experience (e.g. a two-week holiday, a multi-year job).
    --     NULL if the event is instantaneous or duration is unknown.
    --
    -- (B) Temporal uncertainty envelope: how precisely do we know
    --     WHEN it occurred? A memory may be known only to a decade,
    --     a year, or a season. The range [time_earliest, time_latest]
    --     is what we know with confidence; time_estimate is the best
    --     single point within that range. As new constraints arrive
    --     (relative ordering, dated anchors, user clarification),
    --     the Temporal Agent narrows this envelope automatically.
    -- ----------------------------------------------------------------

    -- (A) Event duration bounds — the span of the event itself
    occurred_at_start       DATE,                   -- when the event/experience began
    occurred_at_end         DATE,                   -- when it ended (NULL if instantaneous)

    -- (B) Temporal uncertainty envelope
    time_earliest           DATE,                   -- earliest this could have occurred
    time_latest             DATE,                   -- latest this could have occurred
    time_estimate           DATE,                   -- best single-point estimate (used for sort/display)
    time_precision          TEXT DEFAULT 'unknown'
        CHECK (time_precision IN
            ('unknown','decade','year','season','month','day')),
    time_confidence         FLOAT DEFAULT 0.5
        CHECK (time_confidence BETWEEN 0 AND 1),
                                                    -- 0 = pure guess, 1 = certain

    -- Natural-language temporal description (verbatim, always preserved)
    occurred_at_fuzzy       TEXT,                   -- "summer of 1972", "before we left Spain"

    -- Life stage anchor — coarsest but most reliable temporal signal
    life_stage_id           UUID REFERENCES dimensions(id),

    -- Provenance
    source                  memory_source NOT NULL,
    confidence              memory_confidence DEFAULT 'certain',
    source_session_id       UUID,                   -- interview session that produced this
    source_media_id         UUID,                   -- media file this was derived from

    -- State
    is_draft                BOOLEAN DEFAULT false,
    is_verified             BOOLEAN DEFAULT false,  -- user has reviewed/confirmed
    verified_at             TIMESTAMPTZ,
    -- Visibility on this memory is governed by record_card_grants (§E)
    -- rather than a per-row column. Sensitive-dimension auto-isolation
    -- is enforced by inserting auto-isolate grants against every card.

    metadata                JSONB DEFAULT '{}',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memories_user      ON memories(user_id);
CREATE INDEX idx_memories_occurred  ON memories(user_id, occurred_at_start, occurred_at_end);
CREATE INDEX idx_memories_stage     ON memories(life_stage_id);
CREATE INDEX idx_memories_source    ON memories(source);
CREATE INDEX idx_memories_fts       ON memories USING gin(to_tsvector('english', coalesce(content_raw, '')));
CREATE INDEX idx_memories_embedding ON memories USING ivfflat(embedding vector_cosine_ops)
    WITH (lists = 100);

-- Temporal envelope index — drives timeline rendering and gap detection
CREATE INDEX idx_memories_time_range ON memories(user_id, time_earliest, time_latest);

-- Fuzzy memory index — Temporal Agent queries these first for resolution work
CREATE INDEX idx_memories_fuzzy     ON memories(user_id, time_confidence ASC, time_precision)
    WHERE time_precision IN ('unknown', 'decade', 'year', 'season');


-- ============================================================
-- MEMORY → DIMENSION TAGS
-- Every memory can be tagged across all 10 dimension types.
-- Enables faceted filtering across any combination of axes.
-- ============================================================

CREATE TABLE memory_dimensions (
    memory_id       UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    dimension_id    UUID NOT NULL REFERENCES dimensions(id),
    weight          FLOAT DEFAULT 1.0,      -- relevance weight (0-1)
    is_primary      BOOLEAN DEFAULT false,  -- primary tag for this type
    tagged_by       TEXT DEFAULT 'system',  -- 'user' | 'system' | 'agent:planner' | 'agent:tagger'
    tagged_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (memory_id, dimension_id)
);

CREATE INDEX idx_memory_dim_dim     ON memory_dimensions(dimension_id);
CREATE INDEX idx_memory_dim_primary ON memory_dimensions(dimension_id) WHERE is_primary;


-- ============================================================
-- MEMORY → ENTITY LINKS
-- Which entities appear in a memory, and in what capacity.
-- ============================================================

CREATE TABLE memory_entities (
    memory_id   UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    entity_id   UUID NOT NULL REFERENCES entities(id),
    role        TEXT NOT NULL DEFAULT 'participant',
                -- 'subject' | 'participant' | 'witness' | 'location' | 'object' | 'antagonist'
    is_primary  BOOLEAN DEFAULT false,
    confidence  FLOAT DEFAULT 1.0,
    PRIMARY KEY (memory_id, entity_id, role)
);

CREATE INDEX idx_memory_entities_entity ON memory_entities(entity_id);


-- ============================================================
-- MEDIA
-- Photos, audio, video, documents.
-- Linked to memories or directly to entities.
-- ============================================================

CREATE TYPE media_type AS ENUM (
    'photo', 'video', 'audio',
    'document', 'scanned_document',
    'link', 'email'
);

CREATE TABLE media (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,
    type            media_type NOT NULL,
    uri             TEXT NOT NULL,              -- storage path (Supabase Storage bucket)
    thumbnail_uri   TEXT,
    filename        TEXT,
    mime_type       TEXT,
    file_size_bytes BIGINT,
    duration_secs   INTEGER,                    -- audio/video duration
    captured_at     DATE,
    location_text   TEXT,                       -- where captured
    location_lat    FLOAT,
    location_lng    FLOAT,
    transcription   TEXT,                       -- Whisper ASR output
    ocr_text        TEXT,                       -- OCR for docs/photos
    embedding       VECTOR(1536),               -- semantic search
    faces_detected  JSONB,                      -- [{entity_id, confidence, bounding_box}]
    -- Visibility is governed by record_card_grants against the linked
    -- memory (and, when card grants are extended to media in a future
    -- iteration, against the media row directly). A photo appearing in
    -- a shared memory is visible to viewers granted that memory.
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_user         ON media(user_id);
CREATE INDEX idx_media_type         ON media(user_id, type);
CREATE INDEX idx_media_captured     ON media(captured_at);
CREATE INDEX idx_media_embedding    ON media USING ivfflat(embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE TABLE memory_media (
    memory_id   UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    media_id    UUID NOT NULL REFERENCES media(id),
    caption     TEXT,
    sort_order  SMALLINT,
    PRIMARY KEY (memory_id, media_id)
);

CREATE TABLE entity_media (
    entity_id   UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    media_id    UUID NOT NULL REFERENCES media(id),
    caption     TEXT,
    is_primary  BOOLEAN DEFAULT false,          -- primary photo for this entity
    PRIMARY KEY (entity_id, media_id)
);


-- ============================================================
-- TEMPORAL CONSTRAINTS
-- Relative ordering relationships between memories and anchors.
-- Together these form a constraint graph from which the Temporal
-- Agent infers and tightens date ranges on fuzzy memories.
--
-- A "constraint" says: "subject_memory happened [relationship]
-- anchor_* (which is known to be on/around anchor_date)."
--
-- As constraints accumulate, the Temporal Agent runs propagation:
--   BEFORE  → subject.time_latest  = MIN(time_latest,  anchor_date)
--   AFTER   → subject.time_earliest = MAX(time_earliest, anchor_date)
--   DURING  → subject range ⊆ anchor range
--   CONCURRENT → subject range ∩ anchor range
-- Transitive closure is computed iteratively until stable.
-- ============================================================

CREATE TABLE temporal_constraints (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL,

    -- Subject: the memory whose date is being constrained
    subject_memory_id   UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,

    -- Anchor: the better-known temporal reference point
    -- Exactly one of the anchor_*_id fields should be non-null,
    -- OR anchor_date alone used for world/historical events.
    anchor_type         TEXT NOT NULL
        CHECK (anchor_type IN
            ('memory','media','entity_event','world_event','user_stated_date')),
    anchor_memory_id    UUID REFERENCES memories(id),
    anchor_media_id     UUID REFERENCES media(id),
    anchor_date         DATE,           -- best known date of the anchor (denormalized)
    anchor_date_precision TEXT DEFAULT 'year'
        CHECK (anchor_date_precision IN
            ('unknown','decade','year','season','month','day')),
    anchor_label        TEXT,           -- human-readable: "the move to Austin"
                                        -- "Mom's 50th birthday party photo"

    -- The temporal relationship
    constraint_type     TEXT NOT NULL
        CHECK (constraint_type IN (
            'before',       -- subject happened before anchor
            'after',        -- subject happened after anchor
            'concurrent',   -- subject happened at roughly the same time as anchor
            'during',       -- subject happened within the span of the anchor event
            'soon_before',  -- subject happened shortly before anchor
            'soon_after',   -- subject happened shortly after anchor
            'same_day',     -- subject and anchor are on the same calendar day
            'same_year',    -- subject and anchor are in the same calendar year
            'same_trip'     -- subject and anchor are part of the same journey/event
        )),

    -- Quantification of "soon" or known offset range (optional)
    offset_min_days     INTEGER,        -- minimum days between subject and anchor
    offset_max_days     INTEGER,        -- maximum days between subject and anchor

    -- Provenance
    confidence          FLOAT DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
    stated_by           TEXT NOT NULL DEFAULT 'user_explicit'
        CHECK (stated_by IN (
            'user_explicit',    -- user directly stated the ordering
            'user_confirmed',   -- user confirmed a Temporal Agent suggestion
            'agent_inferred',   -- Temporal Agent inferred from content_raw text
            'exif_data',        -- derived from photo EXIF timestamp
            'document_date',    -- derived from a dated document
            'transitive'        -- derived by constraint propagation
        )),
    notes               TEXT,

    -- Lifecycle
    is_active           BOOLEAN DEFAULT true,   -- false = user retracted this constraint
    retracted_at        TIMESTAMPTZ,
    retraction_reason   TEXT,

    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tc_subject     ON temporal_constraints(subject_memory_id) WHERE is_active;
CREATE INDEX idx_tc_anchor_mem  ON temporal_constraints(anchor_memory_id)  WHERE is_active;
CREATE INDEX idx_tc_user        ON temporal_constraints(user_id)           WHERE is_active;
CREATE INDEX idx_tc_type        ON temporal_constraints(constraint_type)   WHERE is_active;


-- ============================================================
-- TEMPORAL RESOLUTION QUEUE
-- The Temporal Agent's work queue. Each row is one fuzzy memory
-- the agent intends to address through proactive Q&A.
--
-- Priority score drives which memories to tackle first.
-- The agent selects the highest-priority unresolved memories,
-- generates targeted questions using nearby anchors, and
-- conducts a focused Q&A session with the user to establish
-- ordering constraints that narrow the uncertainty envelope.
-- ============================================================

CREATE TABLE temporal_resolution_queue (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL,

    memory_id           UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,

    -- Priority scoring (recomputed by Temporal Agent after each propagation pass)
    -- Components:
    --   uncertainty_days:   time_latest - time_earliest (wider = higher priority)
    --   cascade_benefit:    how many other fuzzy memories would tighten if this resolves
    --   anchor_availability: are there good candidate anchors nearby?
    priority_score      FLOAT,
    uncertainty_days    INTEGER,        -- width of the current envelope in days
    cascade_benefit     INTEGER,        -- estimated count of memories that would tighten
    anchor_count        INTEGER,        -- number of candidate anchors identified

    -- Candidate anchors the agent identified as likely to help
    -- (ordered by usefulness — first is the most promising question)
    candidate_anchor_ids UUID[],
    candidate_anchor_labels TEXT[],     -- human-readable labels for each anchor

    -- The question the agent intends to ask (pre-generated, may be revised)
    proposed_question   TEXT,

    -- Lifecycle
    status              TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',      -- waiting to be addressed
            'scheduled',    -- included in an upcoming session
            'asked',        -- question has been posed to the user
            'resolved',     -- constraints established; envelope tightened
            'skipped',      -- user passed; try again later
            'abandoned'     -- no useful anchors found; leave fuzzy
        )),
    session_id          UUID REFERENCES interview_sessions(id),
    scheduled_for       TIMESTAMPTZ,
    asked_at            TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ,
    resolution_notes    TEXT,

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (user_id, memory_id)         -- one queue entry per memory
);

CREATE INDEX idx_trq_user_priority  ON temporal_resolution_queue(user_id, priority_score DESC)
    WHERE status = 'pending';
CREATE INDEX idx_trq_scheduled      ON temporal_resolution_queue(user_id, scheduled_for)
    WHERE status = 'scheduled';


-- ============================================================
-- SYNTHESIS LAYER
-- AI-compiled narratives and insights built from raw memories.
-- Karpathy wiki-style: pre-computed at write time, not query time.
-- Always traceable back to source memory IDs.
-- Never overwrite raw memories; always a separate derived layer.
-- ============================================================

CREATE TYPE synthesis_type AS ENUM (
    'life_period_narrative',    -- Narrative of a life stage
    'relationship_portrait',    -- Portrait of a relationship
    'topic_synthesis',          -- Cross-time view of a topic domain
    'entity_biography',         -- Summary of an entity across all memories
    'pattern_insight',          -- Recurring theme or behavioral pattern
    'contradiction_flag',       -- Conflicting accounts flagged for user review
    'wisdom_distillation',      -- Extracted lesson or life insight
    'timeline_segment',         -- Ordered events for a time slice
    'persona_facet'             -- Who the user was during a particular period/domain
);

CREATE TABLE syntheses (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL,
    type                synthesis_type NOT NULL,

    -- Scope: what this synthesis covers
    dimension_id        UUID REFERENCES dimensions(id),
    entity_id           UUID REFERENCES entities(id),
    relationship_id     UUID REFERENCES relationships(id),
    time_range_start    DATE,
    time_range_end      DATE,

    -- The synthesis content
    title               TEXT NOT NULL,
    content             TEXT NOT NULL,          -- the generated narrative
    embedding           VECTOR(1536),           -- for synthesis-level semantic search

    -- Provenance (critical for trustworthiness)
    source_memory_ids   UUID[] NOT NULL,        -- every memory this drew from
    agent_model         TEXT,                   -- e.g. 'claude-sonnet-4-6'
    agent_prompt_hash   TEXT,                   -- SHA256 of the prompt used
    generation_version  INTEGER DEFAULT 1,      -- incremented on re-generation

    -- Lifecycle
    generated_at        TIMESTAMPTZ DEFAULT NOW(),
    invalidated_at      TIMESTAMPTZ,            -- null = still current
    is_current          BOOLEAN DEFAULT true,

    -- User review
    reviewed_by_user    BOOLEAN DEFAULT false,
    reviewed_at         TIMESTAMPTZ,
    user_corrections    TEXT,                   -- user notes on what to adjust

    -- Visibility: governed by synthesis_visibility_cache (§E). A
    -- synthesis is visible to a card holder iff every source memory
    -- is visible via that card's grants. Cache is recomputed when
    -- source memories' grants change.

    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_syntheses_user         ON syntheses(user_id);
CREATE INDEX idx_syntheses_type         ON syntheses(user_id, type);
CREATE INDEX idx_syntheses_dimension    ON syntheses(dimension_id);
CREATE INDEX idx_syntheses_entity       ON syntheses(entity_id);
CREATE INDEX idx_syntheses_current      ON syntheses(user_id, is_current) WHERE is_current;
CREATE INDEX idx_syntheses_embedding    ON syntheses USING ivfflat(embedding vector_cosine_ops)
    WITH (lists = 100);


-- ============================================================
-- INTERVIEW SESSIONS
-- Track AI-led interview sessions that elicit memories.
-- ============================================================

CREATE TABLE interview_sessions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL,
    agent_type          TEXT,                   -- 'voice_interviewer' | 'chat_interviewer'
    channel             TEXT,                   -- 'sms' | 'app' | 'voice' | 'email'
    focus_dimension_id  UUID REFERENCES dimensions(id),
    focus_entity_id     UUID REFERENCES entities(id),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    turn_count          INTEGER DEFAULT 0,
    memory_ids          UUID[],                 -- memories produced in this session
    transcript          JSONB,                  -- [{role, content, timestamp}]
    coverage_score      FLOAT,                  -- 0-1: how rich was this session
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user      ON interview_sessions(user_id);
CREATE INDEX idx_sessions_focus_dim ON interview_sessions(focus_dimension_id);
CREATE INDEX idx_sessions_focus_ent ON interview_sessions(focus_entity_id);


-- ============================================================
-- COVERAGE TRACKING
-- Which dimension × entity combinations have been explored.
-- The Planner Agent reads this to decide what to ask next.
-- ============================================================

CREATE TABLE coverage (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL,
    dimension_id        UUID NOT NULL REFERENCES dimensions(id),
    entity_id           UUID REFERENCES entities(id),           -- null = dimension-wide coverage
    memory_count        INTEGER DEFAULT 0,
    depth_score         FLOAT DEFAULT 0,        -- 0-1 richness of coverage
    breadth_score       FLOAT DEFAULT 0,        -- 0-1 variety of angles covered
    last_touched_at     TIMESTAMPTZ,
    last_prompted_at    TIMESTAMPTZ,
    next_prompt_at      TIMESTAMPTZ,            -- scheduled next inquiry
    UNIQUE (user_id, dimension_id, entity_id)
);

CREATE INDEX idx_coverage_user      ON coverage(user_id);
CREATE INDEX idx_coverage_gaps      ON coverage(user_id, depth_score ASC);  -- find gaps


-- ============================================================
-- QUESTION BANK
-- The curated library of interview questions, tagged by dimension.
-- The WisdomTopicSort question column feeds directly into this.
-- ============================================================

CREATE TABLE questions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dimension_id    UUID NOT NULL REFERENCES dimensions(id),
    parent_id       UUID REFERENCES questions(id),   -- follow-up question tree
    text            TEXT NOT NULL,
    prompt_variant  TEXT,                            -- alternate phrasing
    life_stage_id   UUID REFERENCES dimensions(id),  -- if stage-specific
    entity_type     entity_type,                     -- if entity-type-specific
    is_followup     BOOLEAN DEFAULT false,
    depth_level     SMALLINT DEFAULT 1,              -- 1=surface, 5=deep
    sort_order      SMALLINT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_dimension ON questions(dimension_id);
CREATE INDEX idx_questions_stage     ON questions(life_stage_id);


-- ============================================================
-- TIMELINE VIEW (materialized)
-- Pre-computed for fast timeline rendering.
-- Refreshed by the Timeline Agent after memory inserts.
-- ============================================================

CREATE MATERIALIZED VIEW timeline AS
SELECT
    m.id                AS memory_id,
    m.user_id,
    m.title,
    m.occurred_at_start,
    m.occurred_at_end,
    m.occurred_at_fuzzy,
    m.life_stage_id,
    d.name              AS life_stage_name,
    array_agg(DISTINCT me.entity_id)   AS entity_ids,
    array_agg(DISTINCT md.dimension_id) AS dimension_ids
FROM memories m
LEFT JOIN dimensions d ON d.id = m.life_stage_id
LEFT JOIN memory_entities me ON me.memory_id = m.id
LEFT JOIN memory_dimensions md ON md.memory_id = m.id
GROUP BY m.id, m.user_id, m.title, m.occurred_at_start, m.occurred_at_end,
         m.occurred_at_fuzzy, m.life_stage_id, d.name;

CREATE INDEX idx_timeline_user  ON timeline(user_id, occurred_at_start);


-- ============================================================
-- TIMELINE WITH UNCERTAINTY VIEW
-- Every memory rendered as a temporal band rather than a point.
-- The band width (uncertainty_days) drives visual representation:
--   narrow band → precise memory, render as thin line
--   wide band   → fuzzy memory, render as shaded region
-- is_resolved = true means the memory is dated to day or month
-- precision with confidence ≥ 0.8 — display as a firm point.
-- ============================================================

CREATE OR REPLACE VIEW timeline_with_uncertainty AS
SELECT
    m.id                                            AS memory_id,
    m.user_id,
    m.title,
    m.content_raw,

    -- Uncertainty envelope
    m.time_earliest,
    m.time_latest,
    m.time_estimate,
    m.time_precision,
    m.time_confidence,

    -- Visual band width in days (NULL if either bound is unknown)
    CASE
        WHEN m.time_earliest IS NOT NULL AND m.time_latest IS NOT NULL
        THEN (m.time_latest - m.time_earliest)
        ELSE NULL
    END                                             AS uncertainty_days,

    -- Display label respects precision — never shows false accuracy
    CASE m.time_precision
        WHEN 'decade'  THEN TO_CHAR(m.time_estimate, '"circa "YYY0s')
        WHEN 'year'    THEN TO_CHAR(m.time_estimate, 'YYYY')
        WHEN 'season'  THEN
            CASE EXTRACT(MONTH FROM m.time_estimate)
                WHEN 1 THEN 'Winter '  WHEN 2  THEN 'Winter '
                WHEN 3 THEN 'Spring '  WHEN 4  THEN 'Spring '  WHEN 5  THEN 'Spring '
                WHEN 6 THEN 'Summer '  WHEN 7  THEN 'Summer '  WHEN 8  THEN 'Summer '
                WHEN 9 THEN 'Autumn '  WHEN 10 THEN 'Autumn '  WHEN 11 THEN 'Autumn '
                WHEN 12 THEN 'Winter '
            END || TO_CHAR(m.time_estimate, 'YYYY')
        WHEN 'month'   THEN TO_CHAR(m.time_estimate, 'Mon YYYY')
        WHEN 'day'     THEN TO_CHAR(m.time_estimate, 'DD Mon YYYY')
        ELSE m.occurred_at_fuzzy    -- fall back to natural language
    END                                             AS display_date,

    -- Is this memory fully resolved? (high confidence, day or month precision)
    (m.time_precision IN ('day','month') AND m.time_confidence >= 0.8)
                                                    AS is_resolved,

    -- How many active constraints are pinning this memory?
    (SELECT COUNT(*) FROM temporal_constraints tc
     WHERE tc.subject_memory_id = m.id AND tc.is_active)
                                                    AS constraint_count,

    -- Is this memory in the resolution queue and what is its status?
    trq.status                                      AS resolution_status,
    trq.priority_score,
    trq.proposed_question,

    -- Life stage for swim-lane grouping on timeline
    d.name                                          AS life_stage_name,
    m.life_stage_id,

    m.occurred_at_start,
    m.occurred_at_end,
    m.source,
    m.created_at

FROM memories m
LEFT JOIN dimensions d          ON d.id  = m.life_stage_id
LEFT JOIN temporal_resolution_queue trq ON trq.memory_id = m.id
ORDER BY m.user_id, m.time_estimate NULLS LAST, m.time_earliest NULLS LAST;


-- ============================================================
-- SYNTHESIS VISIBILITY
--
-- The legacy compute_synthesis_tier() / trg_set_synthesis_privacy_tier
-- / cascade_synthesis_tier_on_memory_change() helpers were retired in
-- v1.4 along with the privacy_tier ENUM. Synthesis visibility is now
-- materialised in synthesis_visibility_cache (see §E) and recomputed
-- when source memories' record_card_grants change. The invariant
-- preserved across the change: a synthesis is visible to a card holder
-- iff every one of its source memories is visible to that card.
-- ============================================================


-- ============================================================
-- CONSTRAINT PROPAGATION FUNCTION
-- Runs a single pass of forward/backward constraint inference
-- for one user's memories. Called by the Temporal Agent after
-- each new constraint is inserted.
--
-- Returns the count of memory records updated (confidence change
-- or envelope narrowing). Caller should loop until 0 is returned
-- (fixed point — no further inference possible this pass).
--
-- Note: transitive constraints (A before B, B before C → A before C)
-- are handled by inserting derived rows with stated_by='transitive'
-- before calling propagation. The Temporal Agent manages this.
-- ============================================================

CREATE OR REPLACE FUNCTION propagate_temporal_constraints(
    p_user_id UUID
)
RETURNS INTEGER       -- count of memory rows updated
LANGUAGE plpgsql AS $$
DECLARE
    v_updated INTEGER := 0;
BEGIN
    -- BEFORE constraints: subject.time_latest must not exceed anchor_date
    UPDATE memories m
    SET
        time_latest = LEAST(
            COALESCE(m.time_latest, tc.anchor_date),
            tc.anchor_date
        ),
        time_estimate = CASE
            WHEN m.time_estimate IS NULL THEN tc.anchor_date - INTERVAL '1 day'
            WHEN m.time_estimate >= tc.anchor_date
                THEN tc.anchor_date - INTERVAL '1 day'
            ELSE m.time_estimate
        END,
        updated_at = NOW()
    FROM temporal_constraints tc
    WHERE tc.user_id = p_user_id
      AND tc.subject_memory_id = m.id
      AND tc.constraint_type = 'before'
      AND tc.is_active
      AND tc.anchor_date IS NOT NULL
      AND (m.time_latest IS NULL OR m.time_latest > tc.anchor_date);

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    -- AFTER constraints: subject.time_earliest must not precede anchor_date
    UPDATE memories m
    SET
        time_earliest = GREATEST(
            COALESCE(m.time_earliest, tc.anchor_date),
            tc.anchor_date
        ),
        time_estimate = CASE
            WHEN m.time_estimate IS NULL THEN tc.anchor_date + INTERVAL '1 day'
            WHEN m.time_estimate <= tc.anchor_date
                THEN tc.anchor_date + INTERVAL '1 day'
            ELSE m.time_estimate
        END,
        updated_at = NOW()
    FROM temporal_constraints tc
    WHERE tc.user_id = p_user_id
      AND tc.subject_memory_id = m.id
      AND tc.constraint_type = 'after'
      AND tc.is_active
      AND tc.anchor_date IS NOT NULL
      AND (m.time_earliest IS NULL OR m.time_earliest < tc.anchor_date);

    GET DIAGNOSTICS v_updated = v_updated + ROW_COUNT;

    -- CONCURRENT constraints: intersect subject range with anchor range
    -- (simplified: set time_estimate to anchor_date if within current range)
    UPDATE memories m
    SET
        time_estimate = COALESCE(m.time_estimate, tc.anchor_date),
        time_confidence = LEAST(1.0, m.time_confidence + 0.15),
        updated_at = NOW()
    FROM temporal_constraints tc
    WHERE tc.user_id = p_user_id
      AND tc.subject_memory_id = m.id
      AND tc.constraint_type IN ('concurrent', 'same_year', 'same_day', 'same_trip')
      AND tc.is_active
      AND tc.anchor_date IS NOT NULL
      AND m.time_estimate IS DISTINCT FROM tc.anchor_date;

    GET DIAGNOSTICS v_updated = v_updated + ROW_COUNT;

    -- Recalculate time_precision based on envelope width after propagation
    UPDATE memories m
    SET time_precision =
        CASE
            WHEN m.time_latest - m.time_earliest <= 1    THEN 'day'
            WHEN m.time_latest - m.time_earliest <= 31   THEN 'month'
            WHEN m.time_latest - m.time_earliest <= 92   THEN 'season'
            WHEN m.time_latest - m.time_earliest <= 366  THEN 'year'
            WHEN m.time_latest - m.time_earliest <= 3652 THEN 'decade'
            ELSE 'unknown'
        END
    WHERE m.user_id = p_user_id
      AND m.time_earliest IS NOT NULL
      AND m.time_latest IS NOT NULL
      AND m.time_precision != CASE
            WHEN m.time_latest - m.time_earliest <= 1    THEN 'day'
            WHEN m.time_latest - m.time_earliest <= 31   THEN 'month'
            WHEN m.time_latest - m.time_earliest <= 92   THEN 'season'
            WHEN m.time_latest - m.time_earliest <= 366  THEN 'year'
            WHEN m.time_latest - m.time_earliest <= 3652 THEN 'decade'
            ELSE 'unknown'
        END;

    RETURN v_updated;
END;
$$;


-- Detect conflicts: memories where constraints have made time_earliest > time_latest
-- These are surfaced by the Temporal Agent as contradiction_flag syntheses.
CREATE OR REPLACE FUNCTION detect_temporal_conflicts(p_user_id UUID)
RETURNS TABLE (
    memory_id       UUID,
    title           TEXT,
    time_earliest   DATE,
    time_latest     DATE,
    constraint_ids  UUID[]
)
LANGUAGE sql STABLE AS $$
    SELECT
        m.id,
        m.title,
        m.time_earliest,
        m.time_latest,
        ARRAY_AGG(tc.id)    AS constraint_ids
    FROM memories m
    JOIN temporal_constraints tc ON tc.subject_memory_id = m.id AND tc.is_active
    WHERE m.user_id = p_user_id
      AND m.time_earliest IS NOT NULL
      AND m.time_latest IS NOT NULL
      AND m.time_earliest > m.time_latest
    GROUP BY m.id, m.title, m.time_earliest, m.time_latest;
$$;


-- ============================================================
-- SEMANTIC SEARCH FUNCTIONS
-- Helper functions for vector similarity search
-- ============================================================

-- Find memories semantically similar to a query embedding
CREATE OR REPLACE FUNCTION search_memories(
    p_user_id       UUID,
    p_embedding     VECTOR(1536),
    p_limit         INTEGER DEFAULT 20,
    p_threshold     FLOAT DEFAULT 0.75
)
RETURNS TABLE (
    memory_id       UUID,
    title           TEXT,
    content_raw     TEXT,
    similarity      FLOAT,
    occurred_at_start DATE
)
LANGUAGE sql STABLE AS $$
    SELECT
        m.id,
        m.title,
        m.content_raw,
        1 - (m.embedding <=> p_embedding) AS similarity,
        m.occurred_at_start
    FROM memories m
    WHERE m.user_id = p_user_id
      AND m.embedding IS NOT NULL
      AND 1 - (m.embedding <=> p_embedding) >= p_threshold
    ORDER BY m.embedding <=> p_embedding
    LIMIT p_limit;
$$;

-- Find memories by dimension tag(s)
CREATE OR REPLACE FUNCTION memories_by_dimension(
    p_user_id       UUID,
    p_dimension_ids UUID[]
)
RETURNS SETOF memories
LANGUAGE sql STABLE AS $$
    SELECT DISTINCT m.*
    FROM memories m
    JOIN memory_dimensions md ON md.memory_id = m.id
    WHERE m.user_id = p_user_id
      AND md.dimension_id = ANY(p_dimension_ids)
    ORDER BY m.occurred_at_start NULLS LAST;
$$;


-- ============================================================
-- RESIDENCY TIMELINE VIEW
-- The ordered, sequential chain of primary homes across a life.
-- This is the primary temporal scaffold of the entire chronicle.
--
-- Key properties exploited here:
--   1. Sequential non-overlap: a person has one primary home at a time.
--      Each residency therefore provides BOTH an upper bound on the
--      previous period AND a lower bound on the next.
--   2. Moves are causally linked to other life events (career changes,
--      marriages, military postings, education) — the move_reason field
--      connects residential history to other timeline dimensions.
--   3. People recall moves more reliably than most other events.
--      Building the residential spine first gives the Temporal Agent
--      anchor zones that cover the entire life.
--
-- LAG/LEAD window functions surface the chain structure directly,
-- enabling gap detection (missing homes) and constraint generation.
-- ============================================================

CREATE OR REPLACE VIEW residency_timeline AS
SELECT
    r.id                                        AS residency_id,
    r.user_id,
    r.subject_id                                AS person_entity_id,

    -- Home identity
    e.id                                        AS place_entity_id,
    e.canonical_name                            AS place_name,
    e.place_subtype,
    e.country_code,
    e.timezone,
    ST_AsGeoJSON(e.geom)::JSONB                 AS geojson,
    ST_AsGeoJSON(ST_Centroid(e.geom::GEOMETRY))::JSONB AS centroid_geojson,

    -- Temporal bounds of the residency
    r.started_at                                AS moved_in,
    r.ended_at                                  AS moved_out,
    r.is_ongoing                                AS is_current_home,

    -- Precision of each bound (stored in metadata)
    r.metadata->>'moved_in_precision'           AS moved_in_precision,
    r.metadata->>'moved_out_precision'          AS moved_out_precision,

    -- Why the move happened — connects to career, family, military timelines
    r.metadata->>'move_reason'                  AS move_reason,
    r.metadata->>'housing_type'                 AS housing_type,
    r.metadata->'household_members'             AS household_member_ids,

    -- Duration in days (NULL if either bound is unknown)
    CASE
        WHEN r.started_at IS NOT NULL AND r.ended_at IS NOT NULL
            THEN r.ended_at - r.started_at
        WHEN r.started_at IS NOT NULL AND r.is_ongoing
            THEN CURRENT_DATE - r.started_at
        ELSE NULL
    END                                         AS days_in_residence,

    -- Temporal certainty of this residency as an anchor zone
    -- A residency with both bounds known at month precision or better
    -- is a strong anchor for any memory mentioning this home.
    (
        r.started_at IS NOT NULL AND
        r.ended_at IS NOT NULL AND
        COALESCE(r.metadata->>'moved_in_precision', 'unknown')
            IN ('day','month','year') AND
        COALESCE(r.metadata->>'moved_out_precision', 'unknown')
            IN ('day','month','year')
    )                                           AS is_fully_bounded,

    -- Memory density for this home
    (SELECT COUNT(*)
     FROM memory_entities me
     WHERE me.entity_id = e.id)                 AS memory_count,

    -- Memory IDs anchored to this home (for drill-down)
    (SELECT ARRAY_AGG(me.memory_id)
     FROM memory_entities me
     WHERE me.entity_id = e.id)                 AS memory_ids,

    -- Synthesis portrait for this home period
    (SELECT s.id FROM syntheses s
     WHERE s.entity_id = e.id
       AND s.type = 'entity_biography'
       AND s.is_current = true
     ORDER BY s.generated_at DESC LIMIT 1)      AS synthesis_id,

    -- Chain structure — previous and next home in the sequence
    LAG(r.id)    OVER w                         AS previous_residency_id,
    LEAD(r.id)   OVER w                         AS next_residency_id,
    LAG(e.canonical_name)  OVER w               AS previous_home_name,
    LEAD(e.canonical_name) OVER w               AS next_home_name,
    LAG(r.ended_at)  OVER w                     AS previous_home_moved_out,
    LEAD(r.started_at) OVER w                   AS next_home_moved_in,

    -- Gap detection: days unaccounted for between this home and the next
    -- Positive = gap (transition period, temporary housing, travel)
    -- Negative = overlap (possible data error or secondary residence)
    -- NULL = next home has no start date yet
    LEAD(r.started_at) OVER w - r.ended_at      AS gap_days_to_next,

    -- Rank in the residential chain (1 = earliest known home)
    ROW_NUMBER() OVER w                         AS sequence_number

FROM relationships r
JOIN entities e         ON e.id = r.object_id
JOIN relationship_types rt ON rt.id = r.type_id
WHERE rt.code = 'lived_at'
  AND e.type = 'place'
  AND COALESCE((r.metadata->>'is_primary')::BOOLEAN, true) = true
WINDOW w AS (PARTITION BY r.user_id ORDER BY r.started_at NULLS LAST);


-- ============================================================
-- GENERATE RESIDENCY CONSTRAINTS
-- Exploits the sequential non-overlap property of primary residences
-- to automatically produce temporal constraints for memories.
--
-- Two kinds of constraints are generated:
--
-- (A) Inter-residency constraints: if home A ended on date X and
--     home B started on date X (or nearby), memories linked to
--     home A are constrained BEFORE X, memories linked to home B
--     are constrained AFTER X. One confirmed move date creates
--     two temporal bounds simultaneously.
--
-- (B) Intra-residency anchor zones: every memory linked to a place
--     entity that is a known home, and whose time_estimate falls
--     within the residency period, gets a DURING constraint pointing
--     to that residency — tightening its envelope to [moved_in, moved_out].
--
-- Returns count of new constraint rows inserted.
-- Safe to run repeatedly — duplicate constraints are skipped via
-- the ON CONFLICT DO NOTHING pattern on a partial unique index.
-- ============================================================

CREATE OR REPLACE FUNCTION generate_residency_constraints(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    v_inserted INTEGER := 0;
    v_batch    INTEGER;
    r_res      RECORD;
BEGIN
    -- Iterate over all fully-bounded residency periods for this user
    FOR r_res IN
        SELECT
            rt_view.residency_id,
            rt_view.place_entity_id,
            rt_view.moved_in,
            rt_view.moved_out,
            rt_view.moved_in_precision,
            rt_view.moved_out_precision
        FROM residency_timeline rt_view
        WHERE rt_view.user_id = p_user_id
          AND rt_view.is_fully_bounded = true
    LOOP
        -- (B) DURING constraints: memories linked to this home entity
        --     that don't yet have a constraint from this residency.
        INSERT INTO temporal_constraints (
            user_id,
            subject_memory_id,
            anchor_type,
            anchor_date,
            anchor_date_precision,
            anchor_label,
            constraint_type,
            offset_min_days,
            offset_max_days,
            confidence,
            stated_by
        )
        SELECT
            p_user_id,
            me.memory_id,
            'entity_event',
            r_res.moved_in,
            COALESCE(r_res.moved_in_precision, 'year'),
            'Moved into ' || e.canonical_name,
            'during',
            0,
            r_res.moved_out - r_res.moved_in,
            0.85,
            'agent_inferred'
        FROM memory_entities me
        JOIN memories m ON m.id = me.memory_id
        JOIN entities e ON e.id = me.entity_id
        WHERE me.entity_id = r_res.place_entity_id
          AND m.user_id = p_user_id
          -- Only where the memory's estimate falls within the residency period
          AND (m.time_estimate IS NULL
               OR (m.time_estimate BETWEEN r_res.moved_in AND r_res.moved_out))
          -- Don't duplicate existing constraints of this type for this memory
          AND NOT EXISTS (
              SELECT 1 FROM temporal_constraints tc
              WHERE tc.subject_memory_id = me.memory_id
                AND tc.anchor_type = 'entity_event'
                AND tc.constraint_type = 'during'
                AND tc.anchor_date = r_res.moved_in
                AND tc.is_active
          )
        ON CONFLICT DO NOTHING;

        GET DIAGNOSTICS v_batch = ROW_COUNT;
        v_inserted := v_inserted + v_batch;
    END LOOP;

    -- (A) Inter-residency constraints: for each pair of adjacent homes,
    --     if both move dates are known, generate BEFORE/AFTER boundaries
    --     at the transition point.
    INSERT INTO temporal_constraints (
        user_id,
        subject_memory_id,
        anchor_type,
        anchor_date,
        anchor_date_precision,
        anchor_label,
        constraint_type,
        confidence,
        stated_by
    )
    SELECT DISTINCT
        p_user_id,
        me.memory_id,
        'entity_event',
        rt_view.moved_out,
        COALESCE(rt_view.moved_out_precision, 'year'),
        'Left ' || rt_view.place_name || ' (moved to ' || rt_view.next_home_name || ')',
        'before',
        0.90,
        'agent_inferred'
    FROM residency_timeline rt_view
    JOIN memory_entities me ON me.entity_id = rt_view.place_entity_id
    JOIN memories m ON m.id = me.memory_id
    WHERE rt_view.user_id = p_user_id
      AND rt_view.moved_out IS NOT NULL
      AND rt_view.next_home_name IS NOT NULL
      AND m.user_id = p_user_id
      AND NOT EXISTS (
          SELECT 1 FROM temporal_constraints tc
          WHERE tc.subject_memory_id = me.memory_id
            AND tc.anchor_date = rt_view.moved_out
            AND tc.constraint_type = 'before'
            AND tc.is_active
      )
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_batch = ROW_COUNT;
    v_inserted := v_inserted + v_batch;

    -- After generating constraints, run propagation
    PERFORM propagate_temporal_constraints(p_user_id);

    RETURN v_inserted;
END;
$$;


-- ============================================================
-- LIFE JOURNEY VIEW
-- The ordered sequence of places in a person's life —
-- the data layer for map and 3D globe navigation.
--
-- Each row is one place-leg: a place the user lived at,
-- worked at, visited, or attended, with its geometry,
-- date range, duration, and experiential weight (memory count).
--
-- Visualization contract:
--   geojson        → render on globe/map (point or polygon)
--   elevation_m    → terrain height for 3D placement
--   days_at_place  → animation pacing (longer stay = more time)
--   memory_count   → visual weight (size, glow, prominence)
--   memory_ids     → drill-down: which memories belong here
--   synthesis_id   → place portrait to surface on hover/pause
-- ============================================================

CREATE OR REPLACE VIEW life_journey AS
SELECT
    r.id                                        AS leg_id,
    r.user_id,
    r.subject_id                                AS person_entity_id,

    -- Place identity
    e.id                                        AS place_entity_id,
    e.canonical_name                            AS place_name,
    e.place_subtype,
    e.country_code,
    e.timezone,
    e.elevation_m,

    -- Geometry — GeoJSON for direct consumption by Cesium / Mapbox / Three.js
    ST_AsGeoJSON(e.geom)::JSONB                 AS geojson,

    -- For globe centroid positioning when geom is a polygon
    ST_AsGeoJSON(ST_Centroid(e.geom::GEOMETRY))::JSONB AS centroid_geojson,

    -- Relationship type: lived_at, visited, worked_at, attended
    rt.code                                     AS relationship_type,
    rt.name                                     AS relationship_label,

    -- Temporal
    r.started_at,
    r.ended_at,
    r.is_ongoing,

    -- Duration in days (drives animation pacing and visual weight)
    EXTRACT(DAYS FROM (
        COALESCE(r.ended_at::TIMESTAMPTZ, NOW()) - r.started_at::TIMESTAMPTZ
    ))::INTEGER                                 AS days_at_place,

    -- Experiential density — how much of the user's life is recorded here
    (
        SELECT COUNT(*)
        FROM memory_entities me
        WHERE me.entity_id = e.id
    )                                           AS memory_count,

    -- The actual memory IDs for drill-down
    (
        SELECT ARRAY_AGG(me.memory_id)
        FROM memory_entities me
        WHERE me.entity_id = e.id
    )                                           AS memory_ids,

    -- Synthesized place portrait for hover/pause display
    -- (most recent current synthesis of type 'entity_biography' for this place)
    (
        SELECT s.id
        FROM syntheses s
        WHERE s.entity_id = e.id
          AND s.type = 'entity_biography'
          AND s.is_current = true
        ORDER BY s.generated_at DESC
        LIMIT 1
    )                                           AS synthesis_id,

    -- Parent place for hierarchy context (e.g. city → country label)
    parent_e.canonical_name                     AS parent_place_name,
    parent_e.place_subtype                      AS parent_place_subtype

FROM relationships r
JOIN entities e          ON e.id = r.object_id
JOIN relationship_types rt ON rt.id = r.type_id
LEFT JOIN entities parent_e ON parent_e.id = e.location_entity_id
WHERE rt.code IN ('lived_at', 'visited', 'worked_at', 'attended')
  AND e.type = 'place'
ORDER BY r.user_id, r.started_at NULLS LAST;


-- ============================================================
-- SPATIAL SEARCH FUNCTIONS
-- ============================================================

-- Find all memories whose place entities fall within a radius
-- of a given lat/lng point. Useful for "memories near here" queries
-- and for clustering nearby memories on the globe.
CREATE OR REPLACE FUNCTION memories_within_radius(
    p_user_id       UUID,
    p_lat           FLOAT,
    p_lng           FLOAT,
    p_radius_km     FLOAT DEFAULT 50
)
RETURNS TABLE (
    memory_id       UUID,
    place_name      TEXT,
    distance_km     FLOAT,
    occurred_at_start DATE,
    title           TEXT
)
LANGUAGE sql STABLE AS $$
    SELECT DISTINCT
        m.id,
        e.canonical_name,
        ST_Distance(
            e.geom,
            ST_MakePoint(p_lng, p_lat)::GEOGRAPHY
        ) / 1000.0              AS distance_km,
        m.occurred_at_start,
        m.title
    FROM memories m
    JOIN memory_entities me ON me.memory_id = m.id
    JOIN entities e         ON e.id = me.entity_id
    WHERE m.user_id = p_user_id
      AND e.type = 'place'
      AND e.geom IS NOT NULL
      AND ST_DWithin(
            e.geom,
            ST_MakePoint(p_lng, p_lat)::GEOGRAPHY,
            p_radius_km * 1000  -- ST_DWithin takes metres
          )
    ORDER BY distance_km, m.occurred_at_start;
$$;


-- Return a GeoJSON FeatureCollection of the user's life journey —
-- ready to pass directly to Cesium, Mapbox, or Leaflet.
-- Each Feature carries the full leg metadata as properties.
CREATE OR REPLACE FUNCTION life_journey_geojson(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE sql STABLE AS $$
    SELECT jsonb_build_object(
        'type',     'FeatureCollection',
        'features', jsonb_agg(
            jsonb_build_object(
                'type',       'Feature',
                'geometry',   lj.geojson,
                'properties', jsonb_build_object(
                    'leg_id',            lj.leg_id,
                    'place_name',        lj.place_name,
                    'place_subtype',     lj.place_subtype,
                    'relationship_type', lj.relationship_type,
                    'started_at',        lj.started_at,
                    'ended_at',          lj.ended_at,
                    'days_at_place',     lj.days_at_place,
                    'memory_count',      lj.memory_count,
                    'memory_ids',        lj.memory_ids,
                    'synthesis_id',      lj.synthesis_id,
                    'elevation_m',       lj.elevation_m,
                    'centroid',          lj.centroid_geojson,
                    'parent_place',      lj.parent_place_name,
                    'country_code',      lj.country_code
                )
            )
            ORDER BY lj.started_at NULLS LAST
        )
    )
    FROM life_journey lj
    WHERE lj.user_id = p_user_id
      AND lj.geojson IS NOT NULL;
$$;


-- ============================================================
-- ROW LEVEL SECURITY POLICY SCAFFOLD (Access Cards model)
--
-- RLS gating for content tables (memories, entities, relationships,
-- media, syntheses) is mediated by viewer_can_access(), which reads
-- the Access Cards data model (§E) — cards, card_holders, and
-- record_card_grants — to decide whether a given viewer can see a
-- given content row.
--
-- Current status: viewer_can_access() exists as a stub returning
-- FALSE. RLS must NOT be activated until the function body is fully
-- implemented (Step 13 of the development sequence), or all users
-- will be locked out of their own content.
--
-- Sensitive-dimension auto-isolation is enforced at the application
-- layer (Capture Agent): when a memory is tagged with a dimension
-- that has is_sensitive=true, the agent inserts record_card_grants
-- rows with grant_type='auto_isolate' against every active card.
-- The owner must explicitly remove auto-isolation before any card
-- can grant access.
--
-- The Service Role key (used by all agents and background jobs)
-- bypasses RLS entirely — it must NEVER be exposed client-side.
-- All agent writes go through Service Role; all user reads go
-- through the anon/authenticated role which RLS governs.
--
-- To enable RLS on a content table (deferred until Step 13):
--   ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY memories_select ON memories
--       FOR SELECT USING (
--           viewer_can_access(auth.uid(), user_id, 'memory', id)
--       );
--   CREATE POLICY memories_owner_write ON memories
--       FOR ALL USING (auth.uid() = user_id);
--
-- Private-notes layer: when v1.5 adds memories.private_notes, the
-- SELECT policy must use a view that projects all memory columns
-- EXCEPT private_notes for non-owner viewers — column-level filter,
-- not row-level (see DB_Architecture_Design_v1.md Part XVII).
-- ============================================================

-- RLS activation (commented out until viewer_can_access() is fully
-- implemented in Step 13):
-- ALTER TABLE memories       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE entities       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE relationships  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE media          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE syntheses      ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- THE STROLL — REMINISCENCE FEATURE ADDITIONS
-- April 2026 | See: documentation/feature_reminiscence_mode.md
--
-- Adds three new tables and three new columns on memories:
--
--   stroll_sessions      — each Stroll engagement session
--   reflections          — present-tense insights (Pathway B)
--   memory_revisions     — non-destructive corrections (Pathway C)
--
--   memories.triggered_by_memory_id      — if stub was triggered during a Stroll
--   memories.triggered_in_stroll_session — which Stroll session triggered it
--   memories.capture_mode                — how the memory was created
-- ============================================================

CREATE TABLE stroll_sessions (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                     UUID NOT NULL,

    -- The memory The Stroll started from (the "origin" memory)
    origin_memory_id            UUID NOT NULL REFERENCES memories(id),

    -- Temporal bounds
    started_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at                    TIMESTAMPTZ,

    -- Ordered list of memory IDs visited in this session
    -- (origin first, then each adjacent memory navigated to)
    adjacency_trace             UUID[],

    -- Counts of outputs produced in this session
    stubs_created               INTEGER DEFAULT 0,      -- Pathway A: triggered memory stubs
    reflections_created         INTEGER DEFAULT 0,      -- Pathway B: wisdom/reflection entries
    revisions_created           INTEGER DEFAULT 0,      -- Pathway C: corrections to existing records

    -- Engagement signals (feed back into curation engine)
    had_spontaneous_response    BOOLEAN DEFAULT false,  -- user responded before fallback prompt
    required_fallback_prompt    BOOLEAN DEFAULT false,  -- agent had to deliver the fallback question
    session_ended_gracefully    BOOLEAN DEFAULT true,   -- false = user closed without engaging

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stroll_sessions_user    ON stroll_sessions(user_id);
CREATE INDEX idx_stroll_sessions_origin  ON stroll_sessions(origin_memory_id);
CREATE INDEX idx_stroll_sessions_started ON stroll_sessions(user_id, started_at DESC);


-- Columns added to memories for Stroll-triggered stubs (Pathway A)
ALTER TABLE memories
    ADD COLUMN triggered_by_memory_id       UUID REFERENCES memories(id),
    ADD COLUMN triggered_in_stroll_session  UUID REFERENCES stroll_sessions(id),
    ADD COLUMN capture_mode                 TEXT CHECK (capture_mode IN (
                                                'stroll',     -- captured during The Stroll
                                                'interview',  -- captured in an interview session
                                                'freeform'    -- user-initiated, no structured session
                                            ));

CREATE INDEX idx_memories_triggered ON memories(triggered_by_memory_id)
    WHERE triggered_by_memory_id IS NOT NULL;


-- ============================================================
-- REFLECTIONS
-- Present-tense insights and wisdom statements surfaced from
-- memories during Stroll sessions (Pathway B response type).
--
-- A reflection is NOT a memory event — it lives in the present
-- tense and has its source in the past. It is the primary raw
-- material for the wisdom_distillation synthesis type.
--
-- The temporality field records a critical distinction:
--   contemporaneous = user understood this at the time of the event
--   retrospective   = user only understands it in hindsight
-- This distinction shapes how Wisdom Distillation renders the insight.
-- ============================================================

CREATE TABLE reflections (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL,

    -- Provenance
    source_memory_id        UUID REFERENCES memories(id),           -- memory that surfaced it
    stroll_session_id       UUID REFERENCES stroll_sessions(id),

    -- Content
    content                 TEXT NOT NULL,  -- verbatim or lightly cleaned user utterance

    reflection_type         TEXT CHECK (reflection_type IN (
                                'lesson_learned',
                                'belief_formed',
                                'belief_revised',
                                'regret',
                                'gratitude',
                                'unresolved_question',
                                'other'
                            )),

    -- Was this wisdom understood at the time of the event, or only in hindsight?
    -- Agent sets this from a single follow-up question ("at the time, or looking back?")
    temporality             TEXT CHECK (temporality IN (
                                'contemporaneous',   -- understood at the time of the event
                                'retrospective',     -- understood only in hindsight
                                'uncertain'          -- user couldn't say
                            )),

    -- Optional: emotional resonance tags from unclassifiable or affect-heavy responses
    emotional_resonance     TEXT[],

    -- Lifecycle
    synthesis_ready         BOOLEAN DEFAULT false,  -- flagged when ready for Wisdom Distillation
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reflections_user            ON reflections(user_id);
CREATE INDEX idx_reflections_source_memory   ON reflections(source_memory_id);
CREATE INDEX idx_reflections_stroll          ON reflections(stroll_session_id);
CREATE INDEX idx_reflections_type            ON reflections(user_id, reflection_type);
CREATE INDEX idx_reflections_synthesis_ready ON reflections(user_id)
    WHERE synthesis_ready = true;


-- ============================================================
-- MEMORY REVISIONS
-- Non-destructive correction layer over memory records (Pathway C).
--
-- CORE PRINCIPLE: The original memory record is NEVER overwritten
-- or deleted. It represents who the user was and what they
-- understood when they first told this story. The revision sits
-- alongside it as a dated correction — the arc of changing
-- understanding is itself meaningful.
--
-- Synthesis agents MUST check for revisions before rendering any
-- memory: if revisions exist, the most recent non-retracted
-- revision represents the user's current understanding of the event.
-- The original is still accessible and should be preserved in the
-- detailed record view.
--
-- The self-distancing mechanism: hearing one's own memory narrated
-- back by the agent (in a different voice, in prose the user didn't
-- write) creates cognitive distance that enables more accurate
-- self-evaluation. Pathway C captures what that distance reveals.
-- ============================================================

CREATE TABLE memory_revisions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL,
    source_memory_id        UUID NOT NULL REFERENCES memories(id),

    -- Context of the revision
    stroll_session_id       UUID REFERENCES stroll_sessions(id),
    triggered_by_reflection UUID REFERENCES reflections(id),  -- if a reflection catalyzed this

    -- Classification of what kind of revision this is
    revision_type           TEXT CHECK (revision_type IN (
                                'factual_correction',   -- a detail was simply wrong (date, name, sequence)
                                'emotional_reframe',    -- facts stand; the felt meaning has changed
                                'context_update',       -- new information acquired since original recording
                                'narrative_revision'    -- user recognizes their version as a construction
                            )),

    -- Content
    original_excerpt        TEXT,       -- the specific portion being revised (NULL = whole-record revision)
    revised_content         TEXT NOT NULL,   -- the corrected or updated account
    user_note               TEXT,       -- why the revision is being made, in the user's own words

    -- Lifecycle (revisions can be retracted, but the retraction is itself recorded)
    is_retracted            BOOLEAN DEFAULT false,
    retracted_at            TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_memory_revisions_user         ON memory_revisions(user_id);
CREATE INDEX idx_memory_revisions_source       ON memory_revisions(source_memory_id);
CREATE INDEX idx_memory_revisions_stroll       ON memory_revisions(stroll_session_id);
CREATE INDEX idx_memory_revisions_type         ON memory_revisions(user_id, revision_type);
CREATE INDEX idx_memory_revisions_active       ON memory_revisions(source_memory_id)
    WHERE is_retracted = false;


-- ============================================================
-- END OF SCHEMA v1.0
-- Next migration targets (remaining after v1.1 additions below):
--   1. Seed dimensions table (WisdomTopicSort + Gemini Taxonomy)
--   2. Seed questions table (interview questions → dimension IDs)
--   3. CEF v1 export format support (ZIP manifest schema)
--   4. Add assumption_log table for agent inference traceability
--   5. Add soft-delete / redaction fields to memories
--      (redacted_at, redaction_reason, redacted_by)
--   6. Seed five system cards per user on account creation
--      (Private, Close Friends, Family, Professional, Public)
--   7. Implement viewer_can_access() SQL function and activate RLS policies
-- ============================================================


-- ============================================================
-- SCHEMA v1.1 — APRIL 2026
--
-- Additions from the April 2026 architecture decisions:
--
--   A. synthesis_type enum extension:  lifes_cast
--   B. interview_sessions: session_type column
--   C. memories: contributor_id column
--   D. USER PERIODS (Phase 0 Stage 2 — chapter naming)
--   E. ACCESS CARDS framework
--      (cards, contacts, card_holders, record_card_grants,
--       synthesis_visibility_cache, card_audit_log, access_log)
--   F. SOCIAL SHARING & COMMENT CAPTURE
--      (memory_shares, share_comments)
--   G. CONTRIBUTION ATTACHMENTS stub (Phase 2+)
--
-- Design authority:
--   Access Cards:         documentation/access_cards_requirements.md
--   Social sharing:       Life_Chronicle_PRD.md §8 (Decision 7, April 2026)
--   Life's Players:       Life_Chronicle_PRD.md §9 (Decision 4, April 2026)
--   Phase 0 chapter naming: Life_Chronicle_PRD.md §3
-- ============================================================


-- ============================================================
-- A. SYNTHESIS TYPE EXTENSION
-- Add lifes_cast to capture the "Life's Players" MVP artifact —
-- a time-series progression of the significant people who played
-- roles in the user's life from earliest remembered relationships
-- through present central figures.
--
-- Named for Shakespeare's As You Like It (Act II Scene VII):
--   "All the world's a stage, and all the men and women merely
--    players; they have their exits and their entrances."
--
-- Differs from relationship_portrait (deep on one relationship)
-- in that it is broader and temporal — the ensemble view across
-- all life stages, not a solo portrait.
-- ============================================================

ALTER TYPE synthesis_type ADD VALUE IF NOT EXISTS 'lifes_cast';


-- ============================================================
-- B. SESSION TYPE ON INTERVIEW SESSIONS
-- Classifies the purpose of each interview session.
-- The Planner Agent uses session_type to schedule and track
-- session coverage across the different session modalities.
-- ============================================================

ALTER TABLE interview_sessions
    ADD COLUMN IF NOT EXISTS session_type TEXT
        CHECK (session_type IN (
            'ontology_bootstrap',   -- Phase 0: any of the four bootstrap stages
            'memory_collection',    -- Regular collection: exploring a dimension/entity
            'temporal_resolution',  -- Dedicated temporal clarification session
            'entity_resolution',    -- Confirming/correcting entity relationships
            'stroll',               -- Phase 2: The Stroll reminiscence session
            'review_and_correction' -- User reviewing and correcting existing records
        )),
    ADD COLUMN IF NOT EXISTS phase0_stage SMALLINT
        CHECK (phase0_stage BETWEEN 1 AND 4);
        -- 1 = Temporal Skeleton, 2 = Chapter Naming,
        -- 3 = Entity Seed, 4 = Topic Map
        -- NULL for all non-ontology_bootstrap sessions


-- ============================================================
-- C. CONTRIBUTOR ID ON MEMORIES
-- Records the identity of a card holder who contributed a
-- memory entry via the contribute permission (Phase 2).
-- Contributed memories arrive in the review_queue and must
-- be accepted by the owner before they enter the canon.
-- NULL for all owner-authored memories.
-- ============================================================

ALTER TABLE memories
    ADD COLUMN IF NOT EXISTS contributor_id UUID,
        -- UUID of the contributing contact (references contacts.id)
        -- NULL = owner-authored; non-NULL = contribution awaiting or past review
    ADD COLUMN IF NOT EXISTS contribution_status TEXT
        CHECK (contribution_status IN (
            'pending',    -- in review queue, not yet accepted
            'accepted',   -- owner accepted; now part of the canon
            'modified',   -- owner modified and accepted
            'rejected'    -- owner rejected; record retained for audit, invisible to owner
        ));
        -- NULL for all owner-authored memories


-- ============================================================
-- D. USER PERIODS
-- Named life chapters defined by the chronicle owner during
-- Phase 0 Stage 2 (Chapter Naming). Examples: "The Madrid Years",
-- "After my father died", "The startup decade".
--
-- user_periods are:
--   • Referenced in Access Cards scope_rules as period_ids
--   • Used to scope life_period_narrative syntheses
--   • The organizing unit for memoir chapter presentation
--
-- A memory may belong to zero or more periods (via memory_periods).
-- Periods may overlap — a period named "when I was raising kids"
-- and "my years at IBM" may share years without contradiction.
-- ============================================================

CREATE TABLE user_periods (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,
    name            TEXT NOT NULL,              -- user-supplied chapter name
    description     TEXT,                       -- optional: user's own framing of this period
    time_range_start DATE,                      -- approximate start date (may be fuzzy)
    time_range_end   DATE,                      -- approximate end date (NULL if ongoing)
    is_ongoing       BOOLEAN DEFAULT false,     -- true if this period includes the present
    sort_order       SMALLINT,                  -- user-defined display order
    confirmed_by_user BOOLEAN DEFAULT false,    -- true once user has reviewed and confirmed
    confirmed_at     TIMESTAMPTZ,
    created_by       TEXT DEFAULT 'system'
        CHECK (created_by IN ('system', 'user', 'agent')),
                                                -- system = proposed in Phase 0; user = manually created
    metadata         JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE INDEX idx_user_periods_user       ON user_periods(user_id);
CREATE INDEX idx_user_periods_time       ON user_periods(user_id, time_range_start, time_range_end);
CREATE INDEX idx_user_periods_confirmed  ON user_periods(user_id) WHERE confirmed_by_user;


-- Junction: which memories belong to which user periods
-- A memory may belong to multiple periods; a period may contain many memories.
CREATE TABLE memory_periods (
    memory_id       UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    period_id       UUID NOT NULL REFERENCES user_periods(id) ON DELETE CASCADE,
    assigned_by     TEXT DEFAULT 'agent'
        CHECK (assigned_by IN ('agent', 'user')),
    assigned_at     TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (memory_id, period_id)
);

CREATE INDEX idx_memory_periods_period ON memory_periods(period_id);


-- ============================================================
-- E. ACCESS CARDS FRAMEWORK — the privacy model
-- Full requirements: documentation/access_cards_requirements.md
--
-- The Access Cards framework is the sole privacy model from v1.4
-- onward. The legacy privacy_tier ENUM and the per-row privacy_tier
-- columns on content tables were removed in v1.4. The five tier
-- names live on as system_code values of the five system cards
-- pre-seeded for every user.
--
-- Remaining work: viewer_can_access() full body + RLS activation
-- (Step 13 of the development sequence).
-- ============================================================

-- E.1 cards — Card definitions (permission grants)
CREATE TABLE cards (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id   UUID NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    is_system       BOOLEAN NOT NULL DEFAULT false,
    system_code     TEXT,
        -- 'private' | 'close_friends' | 'family' | 'professional' | 'public'
        -- NULL for custom (user-created) cards
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_public       BOOLEAN NOT NULL DEFAULT false,  -- true only for the Public system card
    validity_start  TIMESTAMPTZ,    -- card active from this date/time (NULL = always active)
    validity_end    TIMESTAMPTZ,    -- card expires at this date/time (NULL = no expiry)
    scope_rules     JSONB NOT NULL DEFAULT '{}',
        -- Structured scope rules. Empty object = grants all owner content.
        -- Shape (all fields optional):
        -- {
        --   "time_band":        { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
        --   "period_ids":       ["uuid", ...],
        --   "life_stage_ids":   ["uuid", ...],
        --   "dimension_ids":    ["uuid", ...],
        --   "entity_ids":       ["uuid", ...],
        --   "place_ids":        ["uuid", ...],
        --   "include_memory_ids": ["uuid", ...],
        --   "exclude_memory_ids": ["uuid", ...]
        -- }
        -- Within an axis: OR. Across axes: AND. Excludes always win.
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (owner_user_id, name)
);

CREATE INDEX idx_cards_owner        ON cards(owner_user_id);
CREATE INDEX idx_cards_active       ON cards(owner_user_id) WHERE is_active;
CREATE INDEX idx_cards_system       ON cards(owner_user_id, system_code) WHERE is_system;


-- E.2 contacts — Potential and actual card holders
CREATE TABLE contacts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id       UUID NOT NULL,
    contact_user_id     UUID,               -- NULL until invitation accepted
    email               TEXT NOT NULL,      -- citext behavior enforced at app layer
    display_name        TEXT,
    person_entity_id    UUID REFERENCES entities(id),
        -- Optional link to a person entity in the chronicle's entity graph.
        -- Enables "Beth Lyons (contact) is the same as Beth Lyons (entity)" without forcing it.
    invitation_status   TEXT NOT NULL DEFAULT 'pending'
        CHECK (invitation_status IN ('pending', 'accepted', 'declined', 'revoked')),
    invited_at          TIMESTAMPTZ DEFAULT NOW(),
    accepted_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (owner_user_id, email)
);

CREATE INDEX idx_contacts_owner     ON contacts(owner_user_id);
CREATE INDEX idx_contacts_user      ON contacts(contact_user_id) WHERE contact_user_id IS NOT NULL;
CREATE INDEX idx_contacts_entity    ON contacts(person_entity_id) WHERE person_entity_id IS NOT NULL;


-- E.3 card_holders — Which contacts hold which cards
CREATE TABLE card_holders (
    card_id             UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    granted_at          TIMESTAMPTZ DEFAULT NOW(),
    granted_by          UUID NOT NULL,  -- user_id of the granter (typically the owner)
    last_accessed_at    TIMESTAMPTZ,
    -- Contribution permission (Decision 6, April 2026):
    -- Whether this holder can contribute embellishments and additional memories
    -- to the owner's chronicle via the review queue. View-only in MVP;
    -- can_contribute is Phase 2 when contribute UI is built.
    can_contribute      BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (card_id, contact_id)
);

CREATE INDEX idx_card_holders_contact ON card_holders(contact_id);
CREATE INDEX idx_card_holders_card    ON card_holders(card_id);


-- E.4 record_card_grants — Explicit per-record overrides
-- Handles three cases:
--   'include'       — explicitly grant this record to this card (overrides scope)
--   'exclude'       — explicitly exclude this record from this card (always wins)
--   'auto_isolate'  — system-applied exclusion for sensitive-dimension memories
--                     (applied to ALL cards; user must remove to share)
CREATE TABLE record_card_grants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id         UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    record_type     TEXT NOT NULL
        CHECK (record_type IN ('memory', 'entity', 'relationship', 'media', 'synthesis')),
    record_id       UUID NOT NULL,
    grant_type      TEXT NOT NULL
        CHECK (grant_type IN ('include', 'exclude', 'auto_isolate')),
    reason          TEXT,
        -- e.g., 'sensitive_dimension', 'user_explicit', 'owner_promoted'
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    created_by      UUID NOT NULL,
    UNIQUE (card_id, record_type, record_id, grant_type)
);

CREATE INDEX idx_rcg_card_record ON record_card_grants(card_id, record_type, record_id);
CREATE INDEX idx_rcg_record      ON record_card_grants(record_type, record_id);
CREATE INDEX idx_rcg_isolate     ON record_card_grants(record_id)
    WHERE grant_type = 'auto_isolate';


-- E.5 synthesis_visibility_cache — Pre-computed synthesis access
-- One row per (synthesis, card) pair where the card grants full access
-- to all source memories of the synthesis. Recomputed by the Synthesis
-- Agent when source memory sets change or when card scopes change.
CREATE TABLE synthesis_visibility_cache (
    synthesis_id    UUID NOT NULL REFERENCES syntheses(id) ON DELETE CASCADE,
    card_id         UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    computed_at     TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (synthesis_id, card_id)
);

CREATE INDEX idx_svc_card ON synthesis_visibility_cache(card_id);


-- E.6 card_audit_log — Immutable audit trail of all card operations
CREATE TABLE card_audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id   UUID NOT NULL,
    actor_user_id   UUID NOT NULL,
    action          TEXT NOT NULL
        CHECK (action IN (
            'card_created', 'card_modified', 'card_deleted',
            'card_deactivated', 'card_reactivated',
            'holder_added', 'holder_removed',
            'scope_changed',
            'record_granted', 'record_excluded',
            'contribute_granted', 'contribute_revoked'
        )),
    card_id         UUID,
    contact_id      UUID,
    record_type     TEXT,
    record_id       UUID,
    before_state    JSONB,
    after_state     JSONB,
    occurred_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cal_owner      ON card_audit_log(owner_user_id, occurred_at DESC);
CREATE INDEX idx_cal_card       ON card_audit_log(card_id, occurred_at DESC);


-- E.7 access_log — Holder content access events
-- Records every successful access by a card holder.
-- Partitioned conceptually by month; sampling acceptable at scale.
CREATE TABLE access_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id   UUID NOT NULL,
    viewer_user_id  UUID NOT NULL,
    card_id         UUID NOT NULL REFERENCES cards(id),
    record_type     TEXT NOT NULL,
    record_id       UUID NOT NULL,
    accessed_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_access_log_owner  ON access_log(owner_user_id, accessed_at DESC);
CREATE INDEX idx_access_log_viewer ON access_log(viewer_user_id, accessed_at DESC);
CREATE INDEX idx_access_log_card   ON access_log(card_id, accessed_at DESC);


-- ============================================================
-- F. SOCIAL SHARING & COMMENT CAPTURE
-- Decision 7, April 2026:
--
-- Sharing a memory to social media is the primary distribution
-- mechanism. The share card controls who can access the chronicle;
-- a social post (or direct link) is the notification. Recipients
-- may leave comments; the owner sees them in a dedicated view.
-- Comments do not enter the chronicle automatically.
--
-- memory_shares — records each share event
-- share_comments — captures recipient comments on a share
-- ============================================================

CREATE TYPE share_channel AS ENUM (
    'social_media',     -- shared via external social media post (Twitter/X, Facebook, etc.)
    'direct_link',      -- a shareable URL sent directly (email, messaging app, etc.)
    'sms'               -- shared via the system's SMS channel
);

CREATE TABLE memory_shares (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,              -- the chronicle owner who shared
    memory_id       UUID REFERENCES memories(id),
        -- NULL if the share is of a synthesis or artifact rather than a raw memory
    synthesis_id    UUID REFERENCES syntheses(id),
        -- NULL if the share is of a raw memory. Exactly one of memory_id /
        -- synthesis_id should be non-null for a well-formed share record.
    card_id         UUID REFERENCES cards(id),
        -- For Single Post Shares: records the privacy context of the shared item at
        -- time of share (defaults to the Private system card). This is NOT a permission
        -- grant — the share_token is the credential. For card-governed shares this
        -- records which card determined access. NULL = explicitly public (no card context).
    channel         share_channel NOT NULL,
    share_url       TEXT,                       -- the URL shared (if captured)
    platform_post_id TEXT,                      -- external post ID (if captured, e.g. tweet ID)
    shared_at       TIMESTAMPTZ DEFAULT NOW(),
    metadata        JSONB DEFAULT '{}',

    -- ── Single Post Share (token-based, no login required) ──────────────────
    -- MVP feature. The share_token is embedded in the share URL and is the
    -- sole credential for accessing the shared view. Anyone with the URL
    -- can view the item; no Life Chronicle account required.
    share_token     UUID UNIQUE DEFAULT uuid_generate_v4(),
        -- Token embedded in the shareable URL: /share/{share_token}
        -- Generated automatically on INSERT; never changes after creation.
    expires_at      TIMESTAMPTZ,
        -- NULL = no expiry (link lives until revoked).
        -- Owner can set 7-day / 30-day / 1-year / custom expiry at share time.
    is_revoked      BOOLEAN NOT NULL DEFAULT false,
        -- Owner can kill any share link at any time. Revoked links return 410 Gone.
    revoked_at      TIMESTAMPTZ,
    view_count      INTEGER NOT NULL DEFAULT 0,
        -- Incremented on each anonymous token-authenticated view. No PII stored.
    last_viewed_at  TIMESTAMPTZ
        -- Timestamp of most recent view. Helps owner see if a link was ever opened.
);

CREATE INDEX idx_memory_shares_user    ON memory_shares(user_id, shared_at DESC);
CREATE INDEX idx_memory_shares_memory  ON memory_shares(memory_id) WHERE memory_id IS NOT NULL;
CREATE INDEX idx_memory_shares_synth   ON memory_shares(synthesis_id) WHERE synthesis_id IS NOT NULL;
CREATE INDEX idx_memory_shares_token   ON memory_shares(share_token) WHERE is_revoked = false;
    -- Partial index: only active (non-revoked) tokens are looked up on the public share endpoint.


-- Comments from recipients on a shared memory or artifact
CREATE TABLE share_comments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    share_id        UUID NOT NULL REFERENCES memory_shares(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,              -- chronicle owner (for RLS scoping)
    -- Recipient identity (all nullable — anonymous comments are valid)
    recipient_email TEXT,
    recipient_name  TEXT,
    recipient_handle TEXT,                      -- social media handle if captured
    recipient_user_id UUID,                     -- if the recipient is a registered LC user
    -- Content
    comment_text    TEXT NOT NULL,
    -- Moderation
    is_hidden       BOOLEAN DEFAULT false,      -- owner can hide without deleting
    hidden_at       TIMESTAMPTZ,
    -- Lifecycle
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_share_comments_share ON share_comments(share_id);
CREATE INDEX idx_share_comments_user  ON share_comments(user_id, created_at DESC);
CREATE INDEX idx_share_comments_unhidden ON share_comments(user_id)
    WHERE is_hidden = false;


-- ============================================================
-- G. CONTRIBUTION ATTACHMENTS (Phase 2+ stub)
-- Card holders with can_contribute = true (Phase 2) will be
-- able to attach images or files to their contributions.
-- Table defined here for schema completeness; no UI or agent
-- logic is required at MVP.
-- ============================================================

CREATE TABLE contribution_attachments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,              -- chronicle owner
    memory_id       UUID REFERENCES memories(id),
        -- The contributed memory this attachment belongs to.
        -- Set once the contribution is accepted by the owner.
    contributor_id  UUID,
        -- contacts.id of the contributing holder (NOT the owner's user_id)
    blob_key        TEXT NOT NULL,              -- Supabase Storage object path
    mime_type       TEXT,
    file_size_bytes BIGINT,
    filename        TEXT,
    caption         TEXT,
    review_status   TEXT NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending', 'accepted', 'rejected')),
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contrib_attach_user   ON contribution_attachments(user_id);
CREATE INDEX idx_contrib_attach_memory ON contribution_attachments(memory_id)
    WHERE memory_id IS NOT NULL;
CREATE INDEX idx_contrib_attach_review ON contribution_attachments(user_id, review_status)
    WHERE review_status = 'pending';


-- ============================================================
-- H. REVIEW QUEUE
-- Unified user touch point for all pending review items.
-- Every agent-proposed action that requires user approval lands
-- here before taking effect.  Keeps the "pending decisions"
-- surface in one place rather than scattered across views.
--
-- item_type values:
--   entity_merge_proposal   — Entity Agent found two entity records
--                             that may be the same person/place.
--   temporal_constraint     — Temporal Agent inferred a relative
--                             ordering constraint (awaiting confirmation).
--   sensitive_promotion     — User is about to un-isolate a sensitive
--                             memory from all cards (requires ack).
--   synthesis_stale         — A synthesis has been invalidated and is
--                             ready for review / regeneration.
--   contribution_review     — A card holder submitted a memory
--                             contribution (Phase 2; schema-ready).
--   assumption_review       — Agent made a disambiguation decision
--                             the user may want to inspect.
-- ============================================================

CREATE TABLE review_queue (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL,

    item_type           TEXT NOT NULL
        CHECK (item_type IN (
            'entity_merge_proposal',
            'temporal_constraint',
            'sensitive_promotion',
            'synthesis_stale',
            'contribution_review',
            'assumption_review'
        )),

    -- Polymorphic FK to the item being reviewed.
    -- The referencing table depends on item_type:
    --   entity_merge_proposal → entities.id (the proposed primary entity)
    --   temporal_constraint   → temporal_constraints.id
    --   sensitive_promotion   → memories.id
    --   synthesis_stale       → syntheses.id
    --   contribution_review   → memories.id (the contributed memory)
    --   assumption_review     → assumption_log.id
    item_id             UUID NOT NULL,

    -- Context snapshot stored at queue-time so the review surface
    -- can render without fetching the full row.
    context_json        JSONB DEFAULT '{}',

    priority            SMALLINT NOT NULL DEFAULT 3
        CHECK (priority BETWEEN 1 AND 5),
        -- 1 = urgent (conflict / sensitive), 3 = normal, 5 = low

    surfaced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ,                    -- NULL until resolved
    resolution          TEXT
        CHECK (resolution IN ('accepted', 'modified', 'rejected', 'snoozed')),
    resolution_note     TEXT,                           -- optional user note on rejection

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_queue_user         ON review_queue(user_id, resolved_at NULLS FIRST);
CREATE INDEX idx_review_queue_pending      ON review_queue(user_id, priority)
    WHERE resolved_at IS NULL;
CREATE INDEX idx_review_queue_item         ON review_queue(item_type, item_id);


-- ============================================================
-- I. ASSUMPTION LOG
-- First-class record of every agent inference and
-- disambiguation decision.  Required for synthesis traceability
-- and the user correction path: "The Tagger Agent assumed 'John'
-- in memory #47 was the same as 'John Smith' — here's why."
-- Without this, wrong synthesis outputs have no inspectable path
-- to correction.  Writes silently at MVP; user-visible in Phase 2.
-- ============================================================

CREATE TABLE assumption_log (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL,

    -- Which agent made this decision
    agent               TEXT NOT NULL
        CHECK (agent IN (
            'capture_agent',
            'tagger_agent',
            'entity_agent',
            'synthesis_agent',
            'planner_agent',
            'temporal_agent',
            'search_agent'
        )),

    -- What kind of decision
    assumption_type     TEXT NOT NULL
        CHECK (assumption_type IN (
            'entity_disambiguation',    -- "This 'John' is John Smith (entity #X)"
            'dimension_assignment',     -- "This memory is tagged with career_change"
            'temporal_inference',       -- "Constraint inferred from text: 'after the move'"
            'entity_merge',             -- "Two entity records merged as same person"
            'synthesis_source',         -- "Memory #X included in synthesis scope"
            'geocoding_resolution',     -- "Place resolved to OSM relation #Y"
            'other'
        )),

    -- The decision context
    memory_id           UUID REFERENCES memories(id),   -- memory this applies to (if any)
    entity_id           UUID REFERENCES entities(id),   -- entity involved (if any)
    synthesis_id        UUID REFERENCES syntheses(id),  -- synthesis involved (if any)

    -- Machine-readable decision record
    decision_json       JSONB NOT NULL DEFAULT '{}',
        -- Structure varies by assumption_type; always includes:
        --   { "input": "...", "decision": "...", "confidence": 0.0–1.0,
        --     "reasoning": "...", "alternatives_considered": [...] }

    -- Human-readable summary (for review_queue display)
    summary             TEXT NOT NULL,

    confidence          FLOAT DEFAULT 1.0
        CHECK (confidence BETWEEN 0 AND 1),

    -- User review state
    is_confirmed        BOOLEAN,   -- NULL = unreviewed, true = user confirmed, false = user rejected
    reviewed_at         TIMESTAMPTZ,
    review_note         TEXT,

    -- The model + prompt version that produced this decision (for eval)
    model_version       TEXT,
    prompt_hash         TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assumption_log_user        ON assumption_log(user_id, created_at DESC);
CREATE INDEX idx_assumption_log_memory      ON assumption_log(memory_id) WHERE memory_id IS NOT NULL;
CREATE INDEX idx_assumption_log_entity      ON assumption_log(entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_assumption_log_unreviewed  ON assumption_log(user_id, confidence)
    WHERE is_confirmed IS NULL;


-- ============================================================
-- J. MEMORIES — MISSING COLUMNS (v1.2 additions)
-- Columns required by the PRD that were absent from v1.1.
-- Applied via ALTER TABLE so the base table definition above
-- remains readable as the canonical structure.
-- ============================================================

-- Soft-delete / redaction (GDPR right-to-erasure compatible)
-- Redacted rows are invisible to all reads except an explicit
-- owner-controlled audit view.  Distinct from physical delete —
-- preserves the audit trail of the redaction event.
ALTER TABLE memories
    ADD COLUMN IF NOT EXISTS redacted_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS redaction_reason   TEXT,           -- 'user_request' | 'gdpr_erasure' | 'moderation'
    ADD COLUMN IF NOT EXISTS redacted_by        UUID;           -- user_id of actor

CREATE INDEX idx_memories_redacted ON memories(user_id, redacted_at)
    WHERE redacted_at IS NOT NULL;

-- Natural-language temporal description companion to the
-- structured uncertainty envelope.  The free-text field
-- ("sometime in the late 1980s", "before my sister was born")
-- is preserved verbatim alongside time_earliest/time_latest/
-- time_precision.  The Temporal Agent uses it as evidence;
-- exports carry it in CEF v1 Event.fuzzy.
-- (Maps to time_fuzzy_description; distinct from occurred_at_fuzzy
--  which captures the user's original phrasing at record time.)
ALTER TABLE memories
    ADD COLUMN IF NOT EXISTS time_fuzzy_description TEXT;

-- Per-memory downstream-use consent flags.
-- Distinct from privacy / card grants — these govern specific
-- AI and indexing uses of the content, not viewer access.
-- Both default to false (most conservative).
ALTER TABLE memories
    ADD COLUMN IF NOT EXISTS voice_clone_allowed        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS public_indexing_allowed    BOOLEAN NOT NULL DEFAULT false;

-- Apply the same consent flags to media (a voice recording
-- may be consented differently from the derived memory text).
ALTER TABLE media
    ADD COLUMN IF NOT EXISTS voice_clone_allowed        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS public_indexing_allowed    BOOLEAN NOT NULL DEFAULT false;


-- ============================================================
-- K. viewer_can_access() — Access Evaluation Function (stub)
-- This function must be implemented before RLS policies can be
-- activated on content tables.  The stub below defines the
-- signature and documents the algorithm; replace the body with
-- the full implementation once the cards schema is seeded and
-- verified.  See access_cards_requirements.md §5 for the
-- full algorithm and performance requirements.
-- ============================================================

CREATE OR REPLACE FUNCTION viewer_can_access(
    p_viewer_id     UUID,
    p_owner_id      UUID,
    p_record_type   TEXT,
    p_record_id     UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
/*
  Access evaluation algorithm (access_cards_requirements.md §5):

  1. If viewer == owner → grant immediately.
  2. Find all active cards owned by owner where:
       - viewer is a holder (via card_holders → contacts), AND
       - card is within its validity window.
  3. For each such card C:
       a. If record is in record_card_grants(C, 'exclude' | 'auto_isolate') → skip.
       b. If record is in record_card_grants(C, 'include') → GRANT.
       c. Else evaluate record against C.scope_rules:
            - Empty scope_rules ({}) → GRANT.
            - Else all populated axes must match (AND across axes,
              OR within each axis).
  4. If no card grants access → DENY.

  Performance target: single-digit ms for 1–5 cards, 1–3 scope axes.
  JWT optimization: viewer's card IDs for this owner can be carried
  in the JWT to avoid the card_holders join on every query
  (see access_cards_requirements.md §10).
*/
BEGIN
    -- Owner always has full access.
    IF p_viewer_id = p_owner_id THEN
        RETURN TRUE;
    END IF;

    -- TODO: implement full card-scope evaluation here.
    -- Return FALSE (deny) as safe default until implementation is complete.
    -- Do NOT activate RLS policies until this function has a full body.
    RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION viewer_can_access IS
    'Access Cards evaluation function. STUB — full body required before RLS activation. '
    'See access_cards_requirements.md §5 for algorithm and performance requirements.';


-- ============================================================
-- END OF SCHEMA v1.2
-- ============================================================
-- STATUS SUMMARY
--   ✅ Raw Vault (memories, memory_revisions)
--   ✅ Entity Graph (entities, relationships, temporal_constraints)
--   ✅ Dimension Taxonomy (dimension_types, dimensions)
--   ✅ Tagging Layer (memory_dimensions, memory_entities, memory_media)
--   ✅ Synthesis Layer (syntheses, synthesis_visibility_cache)
--   ✅ Access Cards schema (cards, contacts, card_holders,
--       record_card_grants, card_audit_log, access_log)
--   ✅ Geospatial (entities.geom, life_journey view,
--       life_journey_geojson(), memories_within_radius())
--   ✅ The Stroll (stroll_sessions, reflections, memory_revisions)
--   ✅ Phase 0 support (interview_sessions.session_type,
--       interview_sessions.phase0_stage)
--   ✅ Social sharing (memory_shares, share_comments,
--       contribution_attachments)
--   ✅ User periods (user_periods, memory_periods)
--   ✅ Review queue (review_queue)
--   ✅ Assumption log (assumption_log)
--   ✅ Soft-delete fields on memories
--   ✅ Consent flags on memories and media
--   ✅ viewer_can_access() stub (full body required before RLS)
--   ✅ Seed dimensions + questions (v1.3 build, May 2026)
--   ✅ Seed five system cards on signup via on-user-created Edge Function
--   ✅ Agent orchestration via Inngest (architecture doc Part XVI)
--   ✅ privacy_tier ENUM and tier_locked columns removed (v1.4, 2026-05-20)
--   ✅ entity_confirmation_needed item_type for tap-to-confirm
--      (migration 20260520182927_entity_confirmation_queue.sql)
--
-- REMAINING BEFORE MVP BUILD
--   1. Implement viewer_can_access() full body (§5 algorithm) —
--      Step 13 of the development sequence
--   2. Activate RLS on memories, entities, relationships, media
--      using viewer_can_access(); syntheses uses
--      synthesis_visibility_cache for performance — Step 13
--   3. Add memories.private_notes column + column-level filter in
--      viewer_can_access() (per DB_Architecture_Design_v1.md
--      Part XVII; targeted for substep 6h)
--   4. Add capture_submissions table + user_chronicle_digests table
--      (per feature_capture_assistant.md §10.1 and §4.5; Step 6 work)
--   5. CEF v1 export: validate against cef-schema.json;
--      add delta-export support (since last backup)
-- ============================================================
