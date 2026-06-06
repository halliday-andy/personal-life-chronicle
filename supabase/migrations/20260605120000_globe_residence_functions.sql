-- 2026-06-05 — Step 7 Slice 1: residential globe write/read functions
--
-- The globe persistence chain runs as a single transaction in plpgsql so
-- the entity + relationship (+ optional memory + link) either all land or
-- none do, and so PostGIS geography is built server-side with ST_MakePoint
-- (which PostgREST cannot do cleanly on insert).
--
-- A "residence" = a relationships row:
--   subject_id = the user's self person entity
--   object_id  = the place entity (type='place', geom set)
--   type_id    = relationship_types.code 'lived_at'
--   metadata   = { is_primary: true, when_text?: <verbatim date text> }
-- The memory (verbatim narrative) is OPTIONAL — a pin can be placed with
-- no description.

SET search_path TO public, extensions;

-- ── WRITE: create one residence pin ──────────────────────────────────
CREATE OR REPLACE FUNCTION create_residence_pin(
    p_user_id        UUID,
    p_self_entity_id UUID,
    p_lng            DOUBLE PRECISION,
    p_lat            DOUBLE PRECISION,
    p_name           TEXT,
    p_place_subtype  TEXT,
    p_country_code   TEXT,
    p_when_text      TEXT,
    p_body_text      TEXT
)
RETURNS TABLE (place_entity_id UUID, relationship_id UUID, memory_id UUID)
LANGUAGE plpgsql AS $$
DECLARE
    v_place_id UUID;
    v_rel_id   UUID;
    v_mem_id   UUID;
    v_type_id  SMALLINT;
BEGIN
    SELECT id INTO v_type_id FROM relationship_types WHERE code = 'lived_at';
    IF v_type_id IS NULL THEN
        RAISE EXCEPTION 'relationship_type code lived_at not found';
    END IF;

    INSERT INTO entities (user_id, type, canonical_name, place_subtype, country_code, geom)
    VALUES (
        p_user_id,
        'place',
        p_name,
        NULLIF(p_place_subtype, '')::place_type,
        NULLIF(p_country_code, ''),
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )
    RETURNING id INTO v_place_id;

    INSERT INTO relationships (user_id, subject_id, object_id, type_id, is_ongoing, metadata)
    VALUES (
        p_user_id,
        p_self_entity_id,
        v_place_id,
        v_type_id,
        false,
        jsonb_build_object('is_primary', true)
          || CASE WHEN COALESCE(p_when_text, '') <> ''
                  THEN jsonb_build_object('when_text', p_when_text)
                  ELSE '{}'::jsonb END
    )
    RETURNING id INTO v_rel_id;

    IF COALESCE(p_body_text, '') <> '' THEN
        INSERT INTO memories (
            user_id, content_raw, source, capture_mode,
            authored_by_actor, occurred_at_fuzzy, is_draft
        )
        VALUES (
            p_user_id, p_body_text, 'text_entry', 'globe_onboarding',
            'owner', NULLIF(p_when_text, ''), false
        )
        RETURNING id INTO v_mem_id;

        INSERT INTO memory_entities (memory_id, entity_id, role, is_primary)
        VALUES (v_mem_id, v_place_id, 'location', true);
    END IF;

    RETURN QUERY SELECT v_place_id, v_rel_id, v_mem_id;
END;
$$;

-- ── READ: all residence pins for a user, in placement order ───────────
-- Ordered by relationships.created_at (the click/placement sequence),
-- since Slice 1 dates are optional free-text and started_at is unset.
CREATE OR REPLACE FUNCTION get_residence_pins(p_user_id UUID)
RETURNS TABLE (
    relationship_id UUID,
    place_entity_id UUID,
    name            TEXT,
    place_subtype   TEXT,
    lng             DOUBLE PRECISION,
    lat             DOUBLE PRECISION,
    when_text       TEXT,
    has_memory      BOOLEAN,
    created_at      TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT
        r.id,
        e.id,
        e.canonical_name,
        e.place_subtype::TEXT,
        ST_X(e.geom::geometry),
        ST_Y(e.geom::geometry),
        r.metadata->>'when_text',
        EXISTS (
            SELECT 1 FROM memory_entities me
            WHERE me.entity_id = e.id AND me.role = 'location'
        ),
        r.created_at
    FROM relationships r
    JOIN entities e          ON e.id = r.object_id
    JOIN relationship_types rt ON rt.id = r.type_id
    WHERE r.user_id = p_user_id
      AND rt.code = 'lived_at'
      AND e.type = 'place'
    ORDER BY r.created_at ASC;
$$;
