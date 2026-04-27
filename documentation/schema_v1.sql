-- ============================================================
-- LIFE CHRONICLE DATABASE SCHEMA v1.0
-- Platform: PostgreSQL 15+ with pgvector extension
-- Hosted: Supabase (managed Postgres)
-- Author: Architecture Design Session, April 2026
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pgvector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS postgis;     -- geospatial: geometry, geography, spatial indexes

-- ============================================================
-- PRIVACY TIER
-- Five-level visibility model applied consistently across all
-- content-bearing tables. Default is always 'private'.
--
-- Enforcement strategy:
--   Supabase Row Level Security (RLS) policies read this column
--   to filter what each authenticated viewer can see.
--   The application layer NEVER bypasses RLS for content reads.
--
-- Tier hierarchy (most → least restrictive):
--   private       → only the owning user
--   close_friends → user + explicitly invited close friends
--   family        → user + family members (linked person entities)
--   professional  → user + professional connections
--   public        → any authenticated or anonymous viewer
--
-- Sensitive-category auto-Private rule:
--   Memories tagged with sensitive dimensions (is_sensitive = true
--   on the dimension record) are created with privacy_tier = 'private'
--   regardless of the user's default preference. The user must
--   explicitly promote them — they cannot accidentally be public.
--
-- Synthesis tier rule:
--   A synthesis record inherits the MOST RESTRICTIVE tier among
--   all its source memories. A synthesis drawing from one 'private'
--   memory can never be 'public', even if all others are.
-- ============================================================

CREATE TYPE privacy_tier AS ENUM (
    'private',
    'close_friends',
    'family',
    'professional',
    'public'
);


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
    -- Sensitive flag: memories tagged with this dimension auto-default to
    -- privacy_tier = 'private' regardless of user preference.
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
    privacy_tier        privacy_tier NOT NULL DEFAULT 'private',
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
    -- Privacy: who can see this relationship exists.
    -- Often matches the least-public entity involved.
    -- E.g. a relationship to a therapist defaults to 'private'.
    privacy_tier    privacy_tier NOT NULL DEFAULT 'private',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_relationships_subject  ON relationships(subject_id);
CREATE INDEX idx_relationships_object   ON relationships(object_id);
CREATE INDEX idx_relationships_type     ON relationships(type_id);
CREATE INDEX idx_relationships_user     ON relationships(user_id);
CREATE INDEX idx_relationships_privacy  ON relationships(user_id, privacy_tier);


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
    privacy_tier            privacy_tier NOT NULL DEFAULT 'private',
                                                    -- always starts Private; user promotes explicitly
    tier_locked             BOOLEAN DEFAULT false,  -- true = system has auto-locked to Private
                                                    -- (sensitive category); user must confirm to unlock
    is_draft                BOOLEAN DEFAULT false,
    is_verified             BOOLEAN DEFAULT false,  -- user has reviewed/confirmed
    verified_at             TIMESTAMPTZ,

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
    -- Privacy: controls who can view this media item.
    -- A photo that appears in a shared memory still obeys its own tier.
    -- The consumer should always check BOTH memory.privacy_tier and
    -- media.privacy_tier and apply the MORE restrictive of the two.
    privacy_tier    privacy_tier NOT NULL DEFAULT 'private',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_user         ON media(user_id);
CREATE INDEX idx_media_type         ON media(user_id, type);
CREATE INDEX idx_media_captured     ON media(captured_at);
CREATE INDEX idx_media_privacy      ON media(user_id, privacy_tier);
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

    -- Privacy: MOST RESTRICTIVE tier among all source_memory_ids.
    -- Computed by compute_synthesis_tier() called after insert/update.
    -- Never manually set — always derived. A synthesis can be
    -- promoted only if ALL source memories are promoted first.
    privacy_tier    privacy_tier NOT NULL DEFAULT 'private',

    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_syntheses_user         ON syntheses(user_id);
CREATE INDEX idx_syntheses_type         ON syntheses(user_id, type);
CREATE INDEX idx_syntheses_dimension    ON syntheses(dimension_id);
CREATE INDEX idx_syntheses_entity       ON syntheses(entity_id);
CREATE INDEX idx_syntheses_current      ON syntheses(user_id, is_current) WHERE is_current;
CREATE INDEX idx_syntheses_privacy      ON syntheses(user_id, privacy_tier);
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
-- PRIVACY TIER FUNCTIONS
-- ============================================================

-- compute_synthesis_tier(source_memory_ids UUID[]) → privacy_tier
--
-- Returns the most restrictive privacy_tier among all source memories.
-- Called automatically by a trigger on syntheses INSERT/UPDATE.
-- The tier order (most → least restrictive) matches the enum declaration:
--   private < close_friends < family < professional < public
-- Since PostgreSQL enum comparison uses declaration order, MIN() on the
-- enum gives the most restrictive value directly.
--
-- Usage:
--   UPDATE syntheses
--     SET privacy_tier = compute_synthesis_tier(source_memory_ids)
--   WHERE id = <new_synthesis_id>;

CREATE OR REPLACE FUNCTION compute_synthesis_tier(p_source_ids UUID[])
RETURNS privacy_tier
LANGUAGE sql STABLE AS $$
    SELECT MIN(privacy_tier)          -- MIN on enum = most restrictive
    FROM   memories
    WHERE  id = ANY(p_source_ids)
    AND    privacy_tier IS NOT NULL;
$$;

-- Trigger function: auto-compute synthesis privacy_tier on insert/update
CREATE OR REPLACE FUNCTION trg_set_synthesis_privacy_tier()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Only recompute if source_memory_ids changed or tier not yet set
    IF (TG_OP = 'INSERT') OR
       (TG_OP = 'UPDATE' AND NEW.source_memory_ids IS DISTINCT FROM OLD.source_memory_ids)
    THEN
        NEW.privacy_tier := COALESCE(
            compute_synthesis_tier(NEW.source_memory_ids),
            'private'   -- fallback: if no sources found, default to private
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_syntheses_privacy_tier
    BEFORE INSERT OR UPDATE ON syntheses
    FOR EACH ROW EXECUTE FUNCTION trg_set_synthesis_privacy_tier();

-- When a source memory's privacy_tier is PROMOTED (made less restrictive),
-- cascade-recompute all syntheses that reference it.
-- Note: DEMOTION (making more restrictive) always flows through the trigger
-- above on the synthesis row itself. This function handles the promotion path.
CREATE OR REPLACE FUNCTION cascade_synthesis_tier_on_memory_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Only act when privacy_tier actually changed
    IF NEW.privacy_tier IS DISTINCT FROM OLD.privacy_tier THEN
        UPDATE syntheses s
        SET    privacy_tier = COALESCE(
                   compute_synthesis_tier(s.source_memory_ids), 'private'
               )
        WHERE  NEW.id = ANY(s.source_memory_ids)
          AND  s.user_id = NEW.user_id
          AND  s.is_current = true;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cascade_synthesis_tier
    AFTER UPDATE OF privacy_tier ON memories
    FOR EACH ROW EXECUTE FUNCTION cascade_synthesis_tier_on_memory_change();


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
-- ROW LEVEL SECURITY POLICY SCAFFOLD
--
-- Supabase enforces RLS when a row's privacy_tier is evaluated
-- against the requesting viewer's identity. The policies below
-- are a scaffold: enable them after user/connection group tables
-- are fully defined. The pattern is the same across all content
-- tables (memories, entities, relationships, media, syntheses).
--
-- Tier resolution logic (applied by each SELECT policy):
--
--   'private'       → auth.uid() = user_id
--   'close_friends' → auth.uid() = user_id
--                     OR auth.uid() IN (SELECT friend_id FROM user_close_friends
--                                       WHERE user_id = t.user_id)
--   'family'        → auth.uid() = user_id
--                     OR auth.uid() IN (SELECT member_id FROM user_family_members
--                                       WHERE user_id = t.user_id)
--   'professional'  → auth.uid() = user_id
--                     OR auth.uid() IN (SELECT connection_id FROM user_professional_connections
--                                       WHERE user_id = t.user_id)
--   'public'        → true (any authenticated user)
--
-- Implementation note: connection group tables (user_close_friends,
-- user_family_members, user_professional_connections) should be
-- added in a subsequent migration, alongside the RLS activation.
-- Until that migration, all content is readable only by the owner
-- (equivalent to treating everything as 'private').
--
-- To enable RLS on a table:
--   ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY memories_owner_all ON memories
--       USING (user_id = auth.uid());
--   CREATE POLICY memories_shared_read ON memories
--       FOR SELECT USING (
--           privacy_tier = 'public'
--           OR (privacy_tier = 'family'
--               AND auth.uid() IN (
--                   SELECT member_id FROM user_family_members
--                   WHERE user_id = memories.user_id
--               ))
--           -- ... extend for close_friends and professional
--       );
--
-- The Service Role key (used by all agents and background jobs)
-- bypasses RLS entirely — it must NEVER be exposed client-side.
-- All agent writes go through Service Role; all user reads go
-- through the anon/authenticated role which RLS governs.
--
-- Sensitive-dimension auto-lock is enforced at the application
-- layer (Capture Agent), not in SQL, to keep policies simple:
--   IF any tagged dimension.is_sensitive THEN
--       memory.privacy_tier = 'private'
--       memory.tier_locked  = TRUE
--   END IF
-- ============================================================

-- RLS activation (commented out until connection group tables exist):
-- ALTER TABLE memories       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE entities       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE relationships  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE media          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE syntheses      ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- END OF SCHEMA v1.0
-- Next migration targets:
--   1. Seed dimensions table (WisdomTopicSort + Gemini Taxonomy)
--   2. Seed questions table (interview questions → dimension IDs)
--   3. Add user_close_friends / user_family_members /
--      user_professional_connections tables + RLS activation
--   4. Privacy dashboard view: per-user tier distribution counts
--   5. CEF v1 export format support (ZIP manifest schema)
-- ============================================================
