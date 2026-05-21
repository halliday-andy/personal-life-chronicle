-- ============================================================
-- LIFE CHRONICLE — Initial Schema Migration
-- Generated: 2026-05-05
-- Based on: documentation/schema_v1.sql (v1.2)
--
-- Key deviation from source schema_v1.sql:
--   The privacy_tier ENUM and all columns, indexes, functions,
--   and triggers that depend on it have been OMITTED. The Access
--   Cards framework (cards, contacts, card_holders,
--   record_card_grants, synthesis_visibility_cache, card_audit_log,
--   access_log) is the sole privacy model from day one.
--   See: documentation/access_cards_requirements.md
--
-- viewer_can_access() is deployed as a stub returning FALSE.
-- Do NOT activate RLS policies until the full body is implemented.
-- ============================================================

-- Make Supabase-managed extensions (vector, postgis) visible without
-- schema-qualifying every type reference (VECTOR, GEOGRAPHY, etc.).
SET search_path TO public, extensions;

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;
-- uuid-ossp is pre-installed by Supabase in the extensions schema;
-- gen_random_uuid() (pg 13+ built-in) is used instead of gen_random_uuid().
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS postgis;


-- ============================================================
-- DIMENSION TAXONOMY
-- ============================================================

CREATE TABLE dimension_types (
    id          SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT,
    is_temporal BOOLEAN DEFAULT false,
    sort_order  SMALLINT
);

INSERT INTO dimension_types (code, name, description, is_temporal, sort_order) VALUES
    ('life_stage',        'Life Stage',              'Temporal arc of human development',                      true,  1),
    ('topic_domain',      'Topic Domain',            'Subject area of the experience',                         false, 2),
    ('phenomenon_type',   'Phenomenon Type',         'Nature or category of the experience itself',            false, 3),
    ('relationship_role', 'Relationship Role',       'Type of relationship to a person',                       false, 4),
    ('event_category',    'Life Event Category',     'Recurring life event pattern or milestone',              false, 5),
    ('environment',       'Personal Environment',    'Physical or domestic setting',                           false, 6),
    ('emotional_tone',    'Emotional Register',      'Feeling state or attitude present in the memory',        false, 7),
    ('expressive_form',   'Expressive Form',         'Quote, saying, insight, epiphany',                       false, 8),
    ('world_context',     'World/Cultural Context',  'External world events or cultural backdrop',             false, 9),
    ('artifact_type',     'Artifact Type',           'Physical or digital object associated with the memory',  false, 10);


CREATE TABLE dimensions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_id      SMALLINT NOT NULL REFERENCES dimension_types(id),
    parent_id    UUID REFERENCES dimensions(id),
    code         TEXT,
    name         TEXT NOT NULL,
    description  TEXT,
    sort_order   SMALLINT,
    is_sensitive BOOLEAN NOT NULL DEFAULT false,
    metadata     JSONB DEFAULT '{}',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dimensions_type    ON dimensions(type_id);
CREATE INDEX idx_dimensions_parent  ON dimensions(parent_id);
CREATE INDEX idx_dimensions_code    ON dimensions(code) WHERE code IS NOT NULL;


-- ============================================================
-- ENTITIES
-- ============================================================

CREATE TYPE entity_type AS ENUM (
    'person',
    'place',
    'organization',
    'concept',
    'artifact',
    'vehicle',
    'event_series'
);

CREATE TYPE place_type AS ENUM (
    'continent',
    'country',
    'region',
    'city',
    'neighborhood',
    'address',
    'landmark',
    'natural_feature',
    'transit_hub',
    'military_base',
    'vessel'
);

CREATE TABLE entities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    type                entity_type NOT NULL,
    canonical_name      TEXT NOT NULL,
    aliases             TEXT[],
    born_at             DATE,
    died_at             DATE,
    founded_at          DATE,
    dissolved_at        DATE,
    location_entity_id  UUID REFERENCES entities(id),
    place_subtype       place_type,
    geom                GEOGRAPHY(GEOMETRY, 4326),
    elevation_m         FLOAT,
    external_geo_id     TEXT,
    external_geo_source TEXT,
    country_code        CHAR(2),
    timezone            TEXT,
    description         TEXT,
    embedding           VECTOR(1536),
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entities_user      ON entities(user_id);
CREATE INDEX idx_entities_type      ON entities(user_id, type);
CREATE INDEX idx_entities_name      ON entities USING gin(to_tsvector('english', canonical_name));
CREATE INDEX idx_entities_embedding ON entities USING ivfflat(embedding vector_cosine_ops)
    WITH (lists = 100);
CREATE INDEX idx_entities_geom      ON entities USING GIST(geom);
CREATE INDEX idx_entities_country   ON entities(country_code) WHERE type = 'place';


-- ============================================================
-- RELATIONSHIPS
-- ============================================================

CREATE TABLE relationship_types (
    id           SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    code         TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    inverse_code TEXT,
    category     TEXT,
    description  TEXT
);

INSERT INTO relationship_types (code, name, inverse_code, category) VALUES
    ('parent_of',        'Parent of',          'child_of',          'family'),
    ('child_of',         'Child of',           'parent_of',         'family'),
    ('sibling_of',       'Sibling of',         'sibling_of',        'family'),
    ('grandparent_of',   'Grandparent of',     'grandchild_of',     'family'),
    ('grandchild_of',    'Grandchild of',      'grandparent_of',    'family'),
    ('aunt_uncle_of',    'Aunt/Uncle of',      'niece_nephew_of',   'family'),
    ('niece_nephew_of',  'Niece/Nephew of',    'aunt_uncle_of',     'family'),
    ('cousin_of',        'Cousin of',          'cousin_of',         'family'),
    ('spouse_of',        'Spouse of',          'spouse_of',         'romantic'),
    ('partner_of',       'Partner of',         'partner_of',        'romantic'),
    ('lover_of',         'Lover of',           'lover_of',          'romantic'),
    ('crush_on',         'Had crush on',       NULL,                'romantic'),
    ('friend_of',        'Friend of',          'friend_of',         'social'),
    ('acquaintance_of',  'Acquaintance of',    'acquaintance_of',   'social'),
    ('neighbor_of',      'Neighbor of',        'neighbor_of',       'social'),
    ('colleague_of',     'Colleague of',       'colleague_of',      'professional'),
    ('boss_of',          'Boss of',            'reported_to',       'professional'),
    ('reported_to',      'Reported to',        'boss_of',           'professional'),
    ('mentored',         'Mentored',           'mentored_by',       'professional'),
    ('mentored_by',      'Mentored by',        'mentored',          'professional'),
    ('protege_of',       'Protégé of',         'mentor_of',         'professional'),
    ('mentor_of',        'Mentor of',          'protege_of',        'professional'),
    ('collaborated_with','Collaborated with',  'collaborated_with', 'professional'),
    ('antagonist_of',    'Antagonist of',      'antagonist_of',     'adversarial'),
    ('influenced_by',    'Influenced by',      'influenced',        'social'),
    ('influenced',       'Influenced',         'influenced_by',     'social'),
    ('lived_at',         'Lived at',           'was_home_to',       'spatial'),
    ('worked_at',        'Worked at',          'employed',          'professional'),
    ('attended',         'Attended',           'enrolled',          'professional'),
    ('visited',          'Visited',            NULL,                'spatial'),
    ('member_of',        'Member of',          'had_member',        'social'),
    ('owned',            'Owned',              'was_owned_by',      'ownership'),
    ('was_owned_by',     'Was owned by',       'owned',             'ownership'),
    ('performed_in',     'Performed in',       'featured',          'creative'),
    ('participated_in',  'Participated in',    'included',          'social'),
    ('created',          'Created',            'was_created_by',    'creative');


CREATE TABLE relationships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    subject_id      UUID NOT NULL REFERENCES entities(id),
    object_id       UUID NOT NULL REFERENCES entities(id),
    type_id         SMALLINT NOT NULL REFERENCES relationship_types(id),
    started_at      DATE,
    ended_at        DATE,
    is_ongoing      BOOLEAN DEFAULT true,
    strength        FLOAT CHECK (strength BETWEEN 0 AND 1),
    notes           TEXT,
    source_memory_ids UUID[],
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_relationships_subject  ON relationships(subject_id);
CREATE INDEX idx_relationships_object   ON relationships(object_id);
CREATE INDEX idx_relationships_type     ON relationships(type_id);
CREATE INDEX idx_relationships_user     ON relationships(user_id);


-- ============================================================
-- MEDIA
-- ============================================================

CREATE TYPE media_type AS ENUM (
    'photo', 'video', 'audio',
    'document', 'scanned_document',
    'link', 'email'
);

CREATE TABLE media (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    type            media_type NOT NULL,
    uri             TEXT NOT NULL,
    thumbnail_uri   TEXT,
    filename        TEXT,
    mime_type       TEXT,
    file_size_bytes BIGINT,
    duration_secs   INTEGER,
    captured_at     DATE,
    location_text   TEXT,
    location_lat    FLOAT,
    location_lng    FLOAT,
    transcription   TEXT,
    ocr_text        TEXT,
    embedding       VECTOR(1536),
    faces_detected  JSONB,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_user         ON media(user_id);
CREATE INDEX idx_media_type         ON media(user_id, type);
CREATE INDEX idx_media_captured     ON media(captured_at);
CREATE INDEX idx_media_embedding    ON media USING ivfflat(embedding vector_cosine_ops)
    WITH (lists = 100);


-- ============================================================
-- INTERVIEW SESSIONS
-- Defined before temporal_resolution_queue (which references it).
-- ============================================================

CREATE TABLE interview_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    agent_type          TEXT,
    channel             TEXT,
    focus_dimension_id  UUID REFERENCES dimensions(id),
    focus_entity_id     UUID REFERENCES entities(id),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    turn_count          INTEGER DEFAULT 0,
    memory_ids          UUID[],
    transcript          JSONB,
    coverage_score      FLOAT,
    session_type        TEXT
        CHECK (session_type IN (
            'ontology_bootstrap',
            'memory_collection',
            'temporal_resolution',
            'entity_resolution',
            'stroll',
            'review_and_correction'
        )),
    phase0_stage        SMALLINT
        CHECK (phase0_stage BETWEEN 1 AND 4),
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user      ON interview_sessions(user_id);
CREATE INDEX idx_sessions_focus_dim ON interview_sessions(focus_dimension_id);
CREATE INDEX idx_sessions_focus_ent ON interview_sessions(focus_entity_id);


-- ============================================================
-- MEMORIES
-- ============================================================

CREATE TYPE memory_source AS ENUM (
    'voice_interview',
    'text_entry',
    'document_import',
    'photo_caption',
    'video_transcript',
    'email_import',
    'agent_extracted',
    'journal_import',
    'sms_import',
    'social_import'
);

CREATE TYPE memory_confidence AS ENUM (
    'certain',
    'probable',
    'uncertain',
    'inferred'
);

CREATE TABLE memories (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL,
    title                   TEXT,
    content_raw             TEXT NOT NULL,
    content_normalized      TEXT,
    embedding               VECTOR(1536),
    occurred_at_start       DATE,
    occurred_at_end         DATE,
    time_earliest           DATE,
    time_latest             DATE,
    time_estimate           DATE,
    time_precision          TEXT DEFAULT 'unknown'
        CHECK (time_precision IN
            ('unknown','decade','year','season','month','day')),
    time_confidence         FLOAT DEFAULT 0.5
        CHECK (time_confidence BETWEEN 0 AND 1),
    occurred_at_fuzzy       TEXT,
    life_stage_id           UUID REFERENCES dimensions(id),
    source                  memory_source NOT NULL,
    confidence              memory_confidence DEFAULT 'certain',
    source_session_id       UUID,
    source_media_id         UUID,
    is_draft                BOOLEAN DEFAULT false,
    is_verified             BOOLEAN DEFAULT false,
    verified_at             TIMESTAMPTZ,
    contributor_id          UUID,
    contribution_status     TEXT
        CHECK (contribution_status IN (
            'pending', 'accepted', 'modified', 'rejected'
        )),
    redacted_at             TIMESTAMPTZ,
    redaction_reason        TEXT,
    redacted_by             UUID,
    time_fuzzy_description  TEXT,
    voice_clone_allowed     BOOLEAN NOT NULL DEFAULT false,
    public_indexing_allowed BOOLEAN NOT NULL DEFAULT false,
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
CREATE INDEX idx_memories_time_range ON memories(user_id, time_earliest, time_latest);
CREATE INDEX idx_memories_fuzzy     ON memories(user_id, time_confidence ASC, time_precision)
    WHERE time_precision IN ('unknown', 'decade', 'year', 'season');
CREATE INDEX idx_memories_redacted  ON memories(user_id, redacted_at)
    WHERE redacted_at IS NOT NULL;


-- ============================================================
-- MEMORY → DIMENSION TAGS
-- ============================================================

CREATE TABLE memory_dimensions (
    memory_id       UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    dimension_id    UUID NOT NULL REFERENCES dimensions(id),
    weight          FLOAT DEFAULT 1.0,
    is_primary      BOOLEAN DEFAULT false,
    tagged_by       TEXT DEFAULT 'system',
    tagged_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (memory_id, dimension_id)
);

CREATE INDEX idx_memory_dim_dim     ON memory_dimensions(dimension_id);
CREATE INDEX idx_memory_dim_primary ON memory_dimensions(dimension_id) WHERE is_primary;


-- ============================================================
-- MEMORY → ENTITY LINKS
-- ============================================================

CREATE TABLE memory_entities (
    memory_id   UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    entity_id   UUID NOT NULL REFERENCES entities(id),
    role        TEXT NOT NULL DEFAULT 'participant',
    is_primary  BOOLEAN DEFAULT false,
    confidence  FLOAT DEFAULT 1.0,
    PRIMARY KEY (memory_id, entity_id, role)
);

CREATE INDEX idx_memory_entities_entity ON memory_entities(entity_id);


-- ============================================================
-- MEDIA JUNCTION TABLES
-- ============================================================

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
    is_primary  BOOLEAN DEFAULT false,
    PRIMARY KEY (entity_id, media_id)
);

ALTER TABLE media
    ADD COLUMN voice_clone_allowed        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN public_indexing_allowed    BOOLEAN NOT NULL DEFAULT false;


-- ============================================================
-- TEMPORAL CONSTRAINTS
-- ============================================================

CREATE TABLE temporal_constraints (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    subject_memory_id   UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    anchor_type         TEXT NOT NULL
        CHECK (anchor_type IN
            ('memory','media','entity_event','world_event','user_stated_date')),
    anchor_memory_id    UUID REFERENCES memories(id),
    anchor_media_id     UUID REFERENCES media(id),
    anchor_date         DATE,
    anchor_date_precision TEXT DEFAULT 'year'
        CHECK (anchor_date_precision IN
            ('unknown','decade','year','season','month','day')),
    anchor_label        TEXT,
    constraint_type     TEXT NOT NULL
        CHECK (constraint_type IN (
            'before', 'after', 'concurrent', 'during',
            'soon_before', 'soon_after', 'same_day', 'same_year', 'same_trip'
        )),
    offset_min_days     INTEGER,
    offset_max_days     INTEGER,
    confidence          FLOAT DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
    stated_by           TEXT NOT NULL DEFAULT 'user_explicit'
        CHECK (stated_by IN (
            'user_explicit', 'user_confirmed', 'agent_inferred',
            'exif_data', 'document_date', 'transitive'
        )),
    notes               TEXT,
    is_active           BOOLEAN DEFAULT true,
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
-- ============================================================

CREATE TABLE temporal_resolution_queue (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    memory_id           UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    priority_score      FLOAT,
    uncertainty_days    INTEGER,
    cascade_benefit     INTEGER,
    anchor_count        INTEGER,
    candidate_anchor_ids UUID[],
    candidate_anchor_labels TEXT[],
    proposed_question   TEXT,
    status              TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending', 'scheduled', 'asked', 'resolved', 'skipped', 'abandoned'
        )),
    session_id          UUID REFERENCES interview_sessions(id),
    scheduled_for       TIMESTAMPTZ,
    asked_at            TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ,
    resolution_notes    TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, memory_id)
);

CREATE INDEX idx_trq_user_priority  ON temporal_resolution_queue(user_id, priority_score DESC)
    WHERE status = 'pending';
CREATE INDEX idx_trq_scheduled      ON temporal_resolution_queue(user_id, scheduled_for)
    WHERE status = 'scheduled';


-- ============================================================
-- SYNTHESIS LAYER
-- ============================================================

CREATE TYPE synthesis_type AS ENUM (
    'life_period_narrative',
    'relationship_portrait',
    'topic_synthesis',
    'entity_biography',
    'pattern_insight',
    'contradiction_flag',
    'wisdom_distillation',
    'timeline_segment',
    'persona_facet',
    'lifes_cast'
);

CREATE TABLE syntheses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    type                synthesis_type NOT NULL,
    dimension_id        UUID REFERENCES dimensions(id),
    entity_id           UUID REFERENCES entities(id),
    relationship_id     UUID REFERENCES relationships(id),
    time_range_start    DATE,
    time_range_end      DATE,
    title               TEXT NOT NULL,
    content             TEXT NOT NULL,
    embedding           VECTOR(1536),
    source_memory_ids   UUID[] NOT NULL,
    agent_model         TEXT,
    agent_prompt_hash   TEXT,
    generation_version  INTEGER DEFAULT 1,
    generated_at        TIMESTAMPTZ DEFAULT NOW(),
    invalidated_at      TIMESTAMPTZ,
    is_current          BOOLEAN DEFAULT true,
    reviewed_by_user    BOOLEAN DEFAULT false,
    reviewed_at         TIMESTAMPTZ,
    user_corrections    TEXT,
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
-- COVERAGE TRACKING
-- ============================================================

CREATE TABLE coverage (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    dimension_id        UUID NOT NULL REFERENCES dimensions(id),
    entity_id           UUID REFERENCES entities(id),
    memory_count        INTEGER DEFAULT 0,
    depth_score         FLOAT DEFAULT 0,
    breadth_score       FLOAT DEFAULT 0,
    last_touched_at     TIMESTAMPTZ,
    last_prompted_at    TIMESTAMPTZ,
    next_prompt_at      TIMESTAMPTZ,
    UNIQUE (user_id, dimension_id, entity_id)
);

CREATE INDEX idx_coverage_user      ON coverage(user_id);
CREATE INDEX idx_coverage_gaps      ON coverage(user_id, depth_score ASC);


-- ============================================================
-- QUESTION BANK
-- ============================================================

CREATE TABLE questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dimension_id    UUID NOT NULL REFERENCES dimensions(id),
    parent_id       UUID REFERENCES questions(id),
    text            TEXT NOT NULL,
    prompt_variant  TEXT,
    life_stage_id   UUID REFERENCES dimensions(id),
    entity_type     entity_type,
    is_followup     BOOLEAN DEFAULT false,
    depth_level     SMALLINT DEFAULT 1,
    sort_order      SMALLINT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_dimension ON questions(dimension_id);
CREATE INDEX idx_questions_stage     ON questions(life_stage_id);


-- ============================================================
-- TIMELINE VIEW (materialized)
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
    array_agg(DISTINCT me.entity_id)    AS entity_ids,
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
-- ============================================================

CREATE OR REPLACE VIEW timeline_with_uncertainty AS
SELECT
    m.id                                            AS memory_id,
    m.user_id,
    m.title,
    m.content_raw,
    m.time_earliest,
    m.time_latest,
    m.time_estimate,
    m.time_precision,
    m.time_confidence,
    CASE
        WHEN m.time_earliest IS NOT NULL AND m.time_latest IS NOT NULL
        THEN (m.time_latest - m.time_earliest)
        ELSE NULL
    END                                             AS uncertainty_days,
    CASE m.time_precision
        WHEN 'decade'  THEN TO_CHAR(m.time_estimate, '"circa "YYY0s')
        WHEN 'year'    THEN TO_CHAR(m.time_estimate, 'YYYY')
        WHEN 'season'  THEN
            CASE EXTRACT(MONTH FROM m.time_estimate)
                WHEN 1  THEN 'Winter '  WHEN 2  THEN 'Winter '
                WHEN 3  THEN 'Spring '  WHEN 4  THEN 'Spring '  WHEN 5  THEN 'Spring '
                WHEN 6  THEN 'Summer '  WHEN 7  THEN 'Summer '  WHEN 8  THEN 'Summer '
                WHEN 9  THEN 'Autumn '  WHEN 10 THEN 'Autumn '  WHEN 11 THEN 'Autumn '
                WHEN 12 THEN 'Winter '
            END || TO_CHAR(m.time_estimate, 'YYYY')
        WHEN 'month'   THEN TO_CHAR(m.time_estimate, 'Mon YYYY')
        WHEN 'day'     THEN TO_CHAR(m.time_estimate, 'DD Mon YYYY')
        ELSE m.occurred_at_fuzzy
    END                                             AS display_date,
    (m.time_precision IN ('day','month') AND m.time_confidence >= 0.8)
                                                    AS is_resolved,
    (SELECT COUNT(*) FROM temporal_constraints tc
     WHERE tc.subject_memory_id = m.id AND tc.is_active)
                                                    AS constraint_count,
    trq.status                                      AS resolution_status,
    trq.priority_score,
    trq.proposed_question,
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
-- TEMPORAL PROPAGATION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION propagate_temporal_constraints(
    p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    v_updated INTEGER := 0;
    v_batch   INTEGER;
BEGIN
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

    GET DIAGNOSTICS v_batch = ROW_COUNT;
    v_updated := v_updated + v_batch;

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

    GET DIAGNOSTICS v_batch = ROW_COUNT;
    v_updated := v_updated + v_batch;

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

    GET DIAGNOSTICS v_batch = ROW_COUNT;
    v_updated := v_updated + v_batch;

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
        ARRAY_AGG(tc.id) AS constraint_ids
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
-- ============================================================

CREATE OR REPLACE FUNCTION search_memories(
    p_user_id       UUID,
    p_embedding     VECTOR(1536),
    p_limit         INTEGER DEFAULT 20,
    p_threshold     FLOAT DEFAULT 0.75
)
RETURNS TABLE (
    memory_id         UUID,
    title             TEXT,
    content_raw       TEXT,
    similarity        FLOAT,
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
-- ============================================================

CREATE OR REPLACE VIEW residency_timeline AS
SELECT
    r.id                                        AS residency_id,
    r.user_id,
    r.subject_id                                AS person_entity_id,
    e.id                                        AS place_entity_id,
    e.canonical_name                            AS place_name,
    e.place_subtype,
    e.country_code,
    e.timezone,
    ST_AsGeoJSON(e.geom)::JSONB                 AS geojson,
    ST_AsGeoJSON(ST_Centroid(e.geom::GEOMETRY))::JSONB AS centroid_geojson,
    r.started_at                                AS moved_in,
    r.ended_at                                  AS moved_out,
    r.is_ongoing                                AS is_current_home,
    r.metadata->>'moved_in_precision'           AS moved_in_precision,
    r.metadata->>'moved_out_precision'          AS moved_out_precision,
    r.metadata->>'move_reason'                  AS move_reason,
    r.metadata->>'housing_type'                 AS housing_type,
    r.metadata->'household_members'             AS household_member_ids,
    CASE
        WHEN r.started_at IS NOT NULL AND r.ended_at IS NOT NULL
            THEN r.ended_at - r.started_at
        WHEN r.started_at IS NOT NULL AND r.is_ongoing
            THEN CURRENT_DATE - r.started_at
        ELSE NULL
    END                                         AS days_in_residence,
    (
        r.started_at IS NOT NULL AND
        r.ended_at IS NOT NULL AND
        COALESCE(r.metadata->>'moved_in_precision', 'unknown')
            IN ('day','month','year') AND
        COALESCE(r.metadata->>'moved_out_precision', 'unknown')
            IN ('day','month','year')
    )                                           AS is_fully_bounded,
    (SELECT COUNT(*)
     FROM memory_entities me
     WHERE me.entity_id = e.id)                 AS memory_count,
    (SELECT ARRAY_AGG(me.memory_id)
     FROM memory_entities me
     WHERE me.entity_id = e.id)                 AS memory_ids,
    (SELECT s.id FROM syntheses s
     WHERE s.entity_id = e.id
       AND s.type = 'entity_biography'
       AND s.is_current = true
     ORDER BY s.generated_at DESC LIMIT 1)      AS synthesis_id,
    LAG(r.id)    OVER w                         AS previous_residency_id,
    LEAD(r.id)   OVER w                         AS next_residency_id,
    LAG(e.canonical_name)  OVER w               AS previous_home_name,
    LEAD(e.canonical_name) OVER w               AS next_home_name,
    LAG(r.ended_at)  OVER w                     AS previous_home_moved_out,
    LEAD(r.started_at) OVER w                   AS next_home_moved_in,
    LEAD(r.started_at) OVER w - r.ended_at      AS gap_days_to_next,
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
-- ============================================================

CREATE OR REPLACE FUNCTION generate_residency_constraints(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    v_inserted INTEGER := 0;
    v_batch    INTEGER;
    r_res      RECORD;
BEGIN
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
          AND (m.time_estimate IS NULL
               OR (m.time_estimate BETWEEN r_res.moved_in AND r_res.moved_out))
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

    PERFORM propagate_temporal_constraints(p_user_id);

    RETURN v_inserted;
END;
$$;


-- ============================================================
-- LIFE JOURNEY VIEW
-- ============================================================

CREATE OR REPLACE VIEW life_journey AS
SELECT
    r.id                                        AS leg_id,
    r.user_id,
    r.subject_id                                AS person_entity_id,
    e.id                                        AS place_entity_id,
    e.canonical_name                            AS place_name,
    e.place_subtype,
    e.country_code,
    e.timezone,
    e.elevation_m,
    ST_AsGeoJSON(e.geom)::JSONB                 AS geojson,
    ST_AsGeoJSON(ST_Centroid(e.geom::GEOMETRY))::JSONB AS centroid_geojson,
    rt.code                                     AS relationship_type,
    rt.name                                     AS relationship_label,
    r.started_at,
    r.ended_at,
    r.is_ongoing,
    EXTRACT(DAYS FROM (
        COALESCE(r.ended_at::TIMESTAMPTZ, NOW()) - r.started_at::TIMESTAMPTZ
    ))::INTEGER                                 AS days_at_place,
    (SELECT COUNT(*)
     FROM memory_entities me
     WHERE me.entity_id = e.id)                 AS memory_count,
    (SELECT ARRAY_AGG(me.memory_id)
     FROM memory_entities me
     WHERE me.entity_id = e.id)                 AS memory_ids,
    (SELECT s.id
     FROM syntheses s
     WHERE s.entity_id = e.id
       AND s.type = 'entity_biography'
       AND s.is_current = true
     ORDER BY s.generated_at DESC
     LIMIT 1)                                   AS synthesis_id,
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

CREATE OR REPLACE FUNCTION memories_within_radius(
    p_user_id       UUID,
    p_lat           FLOAT,
    p_lng           FLOAT,
    p_radius_km     FLOAT DEFAULT 50
)
RETURNS TABLE (
    memory_id         UUID,
    place_name        TEXT,
    distance_km       FLOAT,
    occurred_at_start DATE,
    title             TEXT
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
            p_radius_km * 1000
          )
    ORDER BY distance_km, m.occurred_at_start;
$$;


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
-- THE STROLL — REMINISCENCE FEATURE
-- ============================================================

CREATE TABLE stroll_sessions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL,
    origin_memory_id            UUID NOT NULL REFERENCES memories(id),
    started_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at                    TIMESTAMPTZ,
    adjacency_trace             UUID[],
    stubs_created               INTEGER DEFAULT 0,
    reflections_created         INTEGER DEFAULT 0,
    revisions_created           INTEGER DEFAULT 0,
    had_spontaneous_response    BOOLEAN DEFAULT false,
    required_fallback_prompt    BOOLEAN DEFAULT false,
    session_ended_gracefully    BOOLEAN DEFAULT true,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stroll_sessions_user    ON stroll_sessions(user_id);
CREATE INDEX idx_stroll_sessions_origin  ON stroll_sessions(origin_memory_id);
CREATE INDEX idx_stroll_sessions_started ON stroll_sessions(user_id, started_at DESC);


ALTER TABLE memories
    ADD COLUMN IF NOT EXISTS triggered_by_memory_id       UUID REFERENCES memories(id),
    ADD COLUMN IF NOT EXISTS triggered_in_stroll_session  UUID REFERENCES stroll_sessions(id),
    ADD COLUMN IF NOT EXISTS capture_mode                 TEXT CHECK (capture_mode IN (
                                                              'stroll', 'interview', 'freeform'
                                                          ));

CREATE INDEX idx_memories_triggered ON memories(triggered_by_memory_id)
    WHERE triggered_by_memory_id IS NOT NULL;


CREATE TABLE reflections (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL,
    source_memory_id        UUID REFERENCES memories(id),
    stroll_session_id       UUID REFERENCES stroll_sessions(id),
    content                 TEXT NOT NULL,
    reflection_type         TEXT CHECK (reflection_type IN (
                                'lesson_learned', 'belief_formed', 'belief_revised',
                                'regret', 'gratitude', 'unresolved_question', 'other'
                            )),
    temporality             TEXT CHECK (temporality IN (
                                'contemporaneous', 'retrospective', 'uncertain'
                            )),
    emotional_resonance     TEXT[],
    synthesis_ready         BOOLEAN DEFAULT false,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reflections_user            ON reflections(user_id);
CREATE INDEX idx_reflections_source_memory   ON reflections(source_memory_id);
CREATE INDEX idx_reflections_stroll          ON reflections(stroll_session_id);
CREATE INDEX idx_reflections_type            ON reflections(user_id, reflection_type);
CREATE INDEX idx_reflections_synthesis_ready ON reflections(user_id)
    WHERE synthesis_ready = true;


CREATE TABLE memory_revisions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL,
    source_memory_id        UUID NOT NULL REFERENCES memories(id),
    stroll_session_id       UUID REFERENCES stroll_sessions(id),
    triggered_by_reflection UUID REFERENCES reflections(id),
    revision_type           TEXT CHECK (revision_type IN (
                                'factual_correction', 'emotional_reframe',
                                'context_update', 'narrative_revision'
                            )),
    original_excerpt        TEXT,
    revised_content         TEXT NOT NULL,
    user_note               TEXT,
    is_retracted            BOOLEAN DEFAULT false,
    retracted_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_memory_revisions_user     ON memory_revisions(user_id);
CREATE INDEX idx_memory_revisions_source   ON memory_revisions(source_memory_id);
CREATE INDEX idx_memory_revisions_stroll   ON memory_revisions(stroll_session_id);
CREATE INDEX idx_memory_revisions_type     ON memory_revisions(user_id, revision_type);
CREATE INDEX idx_memory_revisions_active   ON memory_revisions(source_memory_id)
    WHERE is_retracted = false;


-- ============================================================
-- USER PERIODS (Phase 0 Stage 2 — chapter naming)
-- ============================================================

CREATE TABLE user_periods (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL,
    name             TEXT NOT NULL,
    description      TEXT,
    time_range_start DATE,
    time_range_end   DATE,
    is_ongoing       BOOLEAN DEFAULT false,
    sort_order       SMALLINT,
    confirmed_by_user BOOLEAN DEFAULT false,
    confirmed_at     TIMESTAMPTZ,
    created_by       TEXT DEFAULT 'system'
        CHECK (created_by IN ('system', 'user', 'agent')),
    metadata         JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE INDEX idx_user_periods_user      ON user_periods(user_id);
CREATE INDEX idx_user_periods_time      ON user_periods(user_id, time_range_start, time_range_end);
CREATE INDEX idx_user_periods_confirmed ON user_periods(user_id) WHERE confirmed_by_user;


CREATE TABLE memory_periods (
    memory_id   UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    period_id   UUID NOT NULL REFERENCES user_periods(id) ON DELETE CASCADE,
    assigned_by TEXT DEFAULT 'agent'
        CHECK (assigned_by IN ('agent', 'user')),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (memory_id, period_id)
);

CREATE INDEX idx_memory_periods_period ON memory_periods(period_id);


-- ============================================================
-- ACCESS CARDS FRAMEWORK
-- Sole privacy model. The privacy_tier ENUM is NOT deployed.
-- Full spec: documentation/access_cards_requirements.md
-- ============================================================

CREATE TABLE cards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id   UUID NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    is_system       BOOLEAN NOT NULL DEFAULT false,
    system_code     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_public       BOOLEAN NOT NULL DEFAULT false,
    validity_start  TIMESTAMPTZ,
    validity_end    TIMESTAMPTZ,
    scope_rules     JSONB NOT NULL DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (owner_user_id, name)
);

CREATE INDEX idx_cards_owner   ON cards(owner_user_id);
CREATE INDEX idx_cards_active  ON cards(owner_user_id) WHERE is_active;
CREATE INDEX idx_cards_system  ON cards(owner_user_id, system_code) WHERE is_system;


CREATE TABLE contacts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id       UUID NOT NULL,
    contact_user_id     UUID,
    email               TEXT NOT NULL,
    display_name        TEXT,
    person_entity_id    UUID REFERENCES entities(id),
    invitation_status   TEXT NOT NULL DEFAULT 'pending'
        CHECK (invitation_status IN ('pending', 'accepted', 'declined', 'revoked')),
    invited_at          TIMESTAMPTZ DEFAULT NOW(),
    accepted_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (owner_user_id, email)
);

CREATE INDEX idx_contacts_owner  ON contacts(owner_user_id);
CREATE INDEX idx_contacts_user   ON contacts(contact_user_id) WHERE contact_user_id IS NOT NULL;
CREATE INDEX idx_contacts_entity ON contacts(person_entity_id) WHERE person_entity_id IS NOT NULL;


CREATE TABLE card_holders (
    card_id          UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    contact_id       UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    granted_at       TIMESTAMPTZ DEFAULT NOW(),
    granted_by       UUID NOT NULL,
    last_accessed_at TIMESTAMPTZ,
    can_contribute   BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (card_id, contact_id)
);

CREATE INDEX idx_card_holders_contact ON card_holders(contact_id);
CREATE INDEX idx_card_holders_card    ON card_holders(card_id);


CREATE TABLE record_card_grants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id     UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    record_type TEXT NOT NULL
        CHECK (record_type IN ('memory', 'entity', 'relationship', 'media', 'synthesis')),
    record_id   UUID NOT NULL,
    grant_type  TEXT NOT NULL
        CHECK (grant_type IN ('include', 'exclude', 'auto_isolate')),
    reason      TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    created_by  UUID NOT NULL,
    UNIQUE (card_id, record_type, record_id, grant_type)
);

CREATE INDEX idx_rcg_card_record ON record_card_grants(card_id, record_type, record_id);
CREATE INDEX idx_rcg_record      ON record_card_grants(record_type, record_id);
CREATE INDEX idx_rcg_isolate     ON record_card_grants(record_id)
    WHERE grant_type = 'auto_isolate';


CREATE TABLE synthesis_visibility_cache (
    synthesis_id UUID NOT NULL REFERENCES syntheses(id) ON DELETE CASCADE,
    card_id      UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    computed_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (synthesis_id, card_id)
);

CREATE INDEX idx_svc_card ON synthesis_visibility_cache(card_id);


CREATE TABLE card_audit_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL,
    actor_user_id UUID NOT NULL,
    action        TEXT NOT NULL
        CHECK (action IN (
            'card_created', 'card_modified', 'card_deleted',
            'card_deactivated', 'card_reactivated',
            'holder_added', 'holder_removed',
            'scope_changed',
            'record_granted', 'record_excluded',
            'contribute_granted', 'contribute_revoked'
        )),
    card_id       UUID,
    contact_id    UUID,
    record_type   TEXT,
    record_id     UUID,
    before_state  JSONB,
    after_state   JSONB,
    occurred_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cal_owner ON card_audit_log(owner_user_id, occurred_at DESC);
CREATE INDEX idx_cal_card  ON card_audit_log(card_id, occurred_at DESC);


CREATE TABLE access_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id  UUID NOT NULL,
    viewer_user_id UUID NOT NULL,
    card_id        UUID NOT NULL REFERENCES cards(id),
    record_type    TEXT NOT NULL,
    record_id      UUID NOT NULL,
    accessed_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_access_log_owner  ON access_log(owner_user_id, accessed_at DESC);
CREATE INDEX idx_access_log_viewer ON access_log(viewer_user_id, accessed_at DESC);
CREATE INDEX idx_access_log_card   ON access_log(card_id, accessed_at DESC);


-- ============================================================
-- SOCIAL SHARING
-- ============================================================

CREATE TYPE share_channel AS ENUM (
    'social_media',
    'direct_link',
    'sms'
);

CREATE TABLE memory_shares (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL,
    memory_id        UUID REFERENCES memories(id),
    synthesis_id     UUID REFERENCES syntheses(id),
    card_id          UUID REFERENCES cards(id),
    channel          share_channel NOT NULL,
    share_url        TEXT,
    platform_post_id TEXT,
    shared_at        TIMESTAMPTZ DEFAULT NOW(),
    metadata         JSONB DEFAULT '{}',
    share_token      UUID UNIQUE DEFAULT gen_random_uuid(),
    expires_at       TIMESTAMPTZ,
    is_revoked       BOOLEAN NOT NULL DEFAULT false,
    revoked_at       TIMESTAMPTZ,
    view_count       INTEGER NOT NULL DEFAULT 0,
    last_viewed_at   TIMESTAMPTZ
);

CREATE INDEX idx_memory_shares_user   ON memory_shares(user_id, shared_at DESC);
CREATE INDEX idx_memory_shares_memory ON memory_shares(memory_id) WHERE memory_id IS NOT NULL;
CREATE INDEX idx_memory_shares_synth  ON memory_shares(synthesis_id) WHERE synthesis_id IS NOT NULL;
CREATE INDEX idx_memory_shares_token  ON memory_shares(share_token) WHERE is_revoked = false;


CREATE TABLE share_comments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id          UUID NOT NULL REFERENCES memory_shares(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL,
    recipient_email   TEXT,
    recipient_name    TEXT,
    recipient_handle  TEXT,
    recipient_user_id UUID,
    comment_text      TEXT NOT NULL,
    is_hidden         BOOLEAN DEFAULT false,
    hidden_at         TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_share_comments_share    ON share_comments(share_id);
CREATE INDEX idx_share_comments_user     ON share_comments(user_id, created_at DESC);
CREATE INDEX idx_share_comments_unhidden ON share_comments(user_id)
    WHERE is_hidden = false;


-- ============================================================
-- CONTRIBUTION ATTACHMENTS (Phase 2+ stub)
-- ============================================================

CREATE TABLE contribution_attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    memory_id       UUID REFERENCES memories(id),
    contributor_id  UUID,
    blob_key        TEXT NOT NULL,
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
-- REVIEW QUEUE
-- ============================================================

CREATE TABLE review_queue (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    item_type   TEXT NOT NULL
        CHECK (item_type IN (
            'entity_merge_proposal',
            'temporal_constraint',
            'sensitive_promotion',
            'synthesis_stale',
            'contribution_review',
            'assumption_review'
        )),
    item_id     UUID NOT NULL,
    context_json JSONB DEFAULT '{}',
    priority    SMALLINT NOT NULL DEFAULT 3
        CHECK (priority BETWEEN 1 AND 5),
    surfaced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution  TEXT
        CHECK (resolution IN ('accepted', 'modified', 'rejected', 'snoozed')),
    resolution_note TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_queue_user    ON review_queue(user_id, resolved_at NULLS FIRST);
CREATE INDEX idx_review_queue_pending ON review_queue(user_id, priority)
    WHERE resolved_at IS NULL;
CREATE INDEX idx_review_queue_item    ON review_queue(item_type, item_id);


-- ============================================================
-- ASSUMPTION LOG
-- ============================================================

CREATE TABLE assumption_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    agent           TEXT NOT NULL
        CHECK (agent IN (
            'capture_agent', 'tagger_agent', 'entity_agent',
            'synthesis_agent', 'planner_agent', 'temporal_agent', 'search_agent'
        )),
    assumption_type TEXT NOT NULL
        CHECK (assumption_type IN (
            'entity_disambiguation', 'dimension_assignment', 'temporal_inference',
            'entity_merge', 'synthesis_source', 'geocoding_resolution', 'other'
        )),
    memory_id       UUID REFERENCES memories(id),
    entity_id       UUID REFERENCES entities(id),
    synthesis_id    UUID REFERENCES syntheses(id),
    decision_json   JSONB NOT NULL DEFAULT '{}',
    summary         TEXT NOT NULL,
    confidence      FLOAT DEFAULT 1.0
        CHECK (confidence BETWEEN 0 AND 1),
    is_confirmed    BOOLEAN,
    reviewed_at     TIMESTAMPTZ,
    review_note     TEXT,
    model_version   TEXT,
    prompt_hash     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assumption_log_user       ON assumption_log(user_id, created_at DESC);
CREATE INDEX idx_assumption_log_memory     ON assumption_log(memory_id) WHERE memory_id IS NOT NULL;
CREATE INDEX idx_assumption_log_entity     ON assumption_log(entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_assumption_log_unreviewed ON assumption_log(user_id, confidence)
    WHERE is_confirmed IS NULL;


-- ============================================================
-- viewer_can_access() — Access Evaluation Function (STUB)
--
-- Returns FALSE for all non-owner viewers until the full body
-- is implemented. Do NOT activate RLS policies on content tables
-- until this stub is replaced with the full algorithm.
-- See: documentation/access_cards_requirements.md §5
-- ============================================================

CREATE OR REPLACE FUNCTION viewer_can_access(
    p_viewer_id   UUID,
    p_owner_id    UUID,
    p_record_type TEXT,
    p_record_id   UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    IF p_viewer_id = p_owner_id THEN
        RETURN TRUE;
    END IF;
    -- Stub: deny all non-owner access until Access Cards RLS is implemented.
    RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION viewer_can_access IS
    'Access Cards evaluation function. STUB — returns FALSE for all non-owners. '
    'Full body required before RLS activation. See access_cards_requirements.md §5.';


-- ============================================================
-- RLS activation is intentionally deferred.
-- Do NOT enable until viewer_can_access() has a full body.
-- ============================================================
