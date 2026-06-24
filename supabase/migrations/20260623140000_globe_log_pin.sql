-- Slice 3.6 — the "Log" pin + generalized anchoring (Phase-5 finding 3).
--
-- A seventh, category-neutral globe pin type: a place marked purely because
-- something memorable happened there, making no category claim. MVP trial
-- label "Log" (candidates Waypoint/Relic/Capture parked) — the label lives in
-- lib/globe/pin-types.ts; the relationship code stays `logged_at`.
--
-- Generalized anchoring: a marker may now associate with ANY of the user's own
-- globe pins (primary OR marker, incl. a vacation), not only a primary
-- residence — enabling "places visited around a vacation destination."
-- validate_pin_anchor replaces validate_residence_anchor in the create/update
-- RPCs (the old function is left in place, now unused).
--
-- Additive/reversible: new lookup rows + CREATE OR REPLACE logic (loosens a
-- check) + get_residence_pins DROP/recreate (one widened IN-list, no shape
-- change). No data rewrite — clears the migration safety gate.

SET search_path TO public, extensions;

-- ── New relationship type (+ inverse) ────────────────────────────────
INSERT INTO relationship_types (code, name, inverse_code, category) VALUES
    ('logged_at',        'Logged at',          'was_logged_at_by',  'spatial'),
    ('was_logged_at_by', 'Was logged at by',   'logged_at',         'spatial')
ON CONFLICT (code) DO NOTHING;

-- ── Generalized anchor validator: any of the user's own globe pins ────
CREATE OR REPLACE FUNCTION validate_pin_anchor(p_anchor UUID, p_user_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF p_anchor IS NULL THEN RETURN; END IF;  -- NULL = standalone, allowed
    IF NOT EXISTS (
        SELECT 1 FROM relationships r
        JOIN relationship_types rt ON rt.id = r.type_id
        WHERE r.id = p_anchor AND r.user_id = p_user_id
          AND rt.code IN ('lived_at','worked_at','owned_residence_at',
                          'lived_briefly_at','vacationed_at','traveled_for_work_to','logged_at')
          AND (rt.code = 'lived_at' OR r.metadata->>'globe_pin' = 'true')
    ) THEN
        RAISE EXCEPTION 'invalid anchor pin %: must be one of the user''s own globe pins', p_anchor;
    END IF;
END;
$$;

-- ── create_residence_pin: accept logged_at + generalized anchor ───────
CREATE OR REPLACE FUNCTION create_residence_pin(
    p_user_id            UUID,
    p_self_entity_id     UUID,
    p_lng                DOUBLE PRECISION,
    p_lat                DOUBLE PRECISION,
    p_name               TEXT,
    p_place_subtype      TEXT,
    p_country_code       TEXT,
    p_when_text          TEXT,
    p_body_text          TEXT,
    p_position           INTEGER DEFAULT NULL,
    p_type_code          TEXT    DEFAULT 'lived_at',
    p_anchor_residence_id UUID   DEFAULT NULL
)
RETURNS TABLE (place_entity_id UUID, relationship_id UUID, memory_id UUID, sort_order INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
    v_place_id UUID;
    v_rel_id   UUID;
    v_mem_id   UUID;
    v_type_id  SMALLINT;
    v_order    INTEGER;
    v_is_spine BOOLEAN := (p_type_code = 'lived_at');
BEGIN
    SELECT id INTO v_type_id FROM relationship_types WHERE code = p_type_code;
    IF v_type_id IS NULL THEN
        RAISE EXCEPTION 'unknown relationship type code: %', p_type_code;
    END IF;
    IF p_type_code NOT IN ('lived_at','worked_at','owned_residence_at',
                           'lived_briefly_at','vacationed_at','traveled_for_work_to','logged_at') THEN
        RAISE EXCEPTION 'relationship type % is not a valid globe pin type', p_type_code;
    END IF;

    -- A marker may anchor to any of the user's own globe pins.
    IF NOT v_is_spine THEN
        PERFORM validate_pin_anchor(p_anchor_residence_id, p_user_id);
    END IF;

    IF v_is_spine THEN
        IF p_position IS NULL THEN
            SELECT COALESCE(MAX(rr.sort_order), -1) + 1 INTO v_order
            FROM relationships rr
            JOIN relationship_types rt ON rt.id = rr.type_id
            WHERE rr.user_id = p_user_id AND rt.code = 'lived_at';
        ELSE
            v_order := GREATEST(p_position, 0);
            UPDATE relationships rr
            SET sort_order = rr.sort_order + 1
            FROM relationship_types rt
            WHERE rt.id = rr.type_id
              AND rr.user_id = p_user_id
              AND rt.code = 'lived_at'
              AND rr.sort_order >= v_order;
        END IF;
    ELSE
        v_order := NULL;
    END IF;

    INSERT INTO entities (user_id, type, canonical_name, place_subtype, country_code, geom)
    VALUES (
        p_user_id, 'place', p_name,
        NULLIF(p_place_subtype, '')::place_type,
        NULLIF(p_country_code, ''),
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )
    RETURNING id INTO v_place_id;

    INSERT INTO relationships (
        user_id, subject_id, object_id, type_id, is_ongoing, sort_order,
        anchor_residence_id, metadata
    )
    VALUES (
        p_user_id, p_self_entity_id, v_place_id, v_type_id, false, v_order,
        CASE WHEN v_is_spine THEN NULL ELSE p_anchor_residence_id END,
        jsonb_build_object('globe_pin', true)
          || CASE WHEN v_is_spine THEN jsonb_build_object('is_primary', true) ELSE '{}'::jsonb END
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

    RETURN QUERY SELECT v_place_id, v_rel_id, v_mem_id, v_order;
END;
$$;

-- ── update_residence_pin: accept logged_at + generalized anchor ───────
-- (Current body from 20260623120000_globe_retype_anchor_restore.sql, with
--  logged_at added to the valid-type list and validate_pin_anchor in place
--  of validate_residence_anchor.)
CREATE OR REPLACE FUNCTION update_residence_pin(
    p_relationship_id    UUID,
    p_user_id            UUID,
    p_lng                DOUBLE PRECISION,
    p_lat                DOUBLE PRECISION,
    p_name               TEXT,
    p_place_subtype      TEXT,
    p_country_code       TEXT,
    p_when_text          TEXT,
    p_body               TEXT,
    p_type_code          TEXT DEFAULT NULL,
    p_anchor_residence_id UUID DEFAULT NULL
)
RETURNS TABLE (place_entity_id UUID, memory_id UUID, relocated BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
    v_place_id  UUID;
    v_mem_id    UUID;
    v_is_draft  BOOLEAN;
    v_old_raw   TEXT;
    v_relocated BOOLEAN := false;
    v_old_code  TEXT;
    v_old_anchor UUID;
    v_new_type_id SMALLINT;
    v_order     INTEGER;
BEGIN
    SELECT r.object_id, rt.code, r.anchor_residence_id
      INTO v_place_id, v_old_code, v_old_anchor
    FROM relationships r
    JOIN relationship_types rt ON rt.id = r.type_id
    WHERE r.id = p_relationship_id AND r.user_id = p_user_id;
    IF v_place_id IS NULL THEN
        RAISE EXCEPTION 'relationship % not found for user', p_relationship_id;
    END IF;

    UPDATE entities
    SET canonical_name = COALESCE(NULLIF(p_name, ''), canonical_name),
        place_subtype  = COALESCE(NULLIF(p_place_subtype, '')::place_type, place_subtype),
        country_code   = COALESCE(NULLIF(p_country_code, ''), country_code),
        geom = CASE WHEN p_lng IS NOT NULL AND p_lat IS NOT NULL
                    THEN ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
                    ELSE geom END,
        updated_at = NOW()
    WHERE id = v_place_id;
    IF p_lng IS NOT NULL AND p_lat IS NOT NULL THEN v_relocated := true; END IF;

    UPDATE relationships
    SET metadata = CASE WHEN COALESCE(p_when_text, '') <> ''
                        THEN metadata || jsonb_build_object('when_text', p_when_text)
                        ELSE metadata - 'when_text' END
    WHERE id = p_relationship_id;

    IF COALESCE(p_type_code, '') <> '' THEN
        SELECT id INTO v_new_type_id FROM relationship_types WHERE code = p_type_code;
        IF v_new_type_id IS NULL OR p_type_code NOT IN
            ('lived_at','worked_at','owned_residence_at','lived_briefly_at','vacationed_at','traveled_for_work_to','logged_at') THEN
            RAISE EXCEPTION 'invalid globe pin type: %', p_type_code;
        END IF;

        -- Validate the new anchor (markers only) before applying.
        IF p_type_code <> 'lived_at' THEN
            PERFORM validate_pin_anchor(p_anchor_residence_id, p_user_id);
        END IF;

        IF p_type_code = 'lived_at' AND v_old_code <> 'lived_at' THEN
            SELECT COALESCE(MAX(rr.sort_order), -1) + 1 INTO v_order
            FROM relationships rr JOIN relationship_types rt ON rt.id = rr.type_id
            WHERE rr.user_id = p_user_id AND rt.code = 'lived_at';
            UPDATE relationships
            SET type_id = v_new_type_id, sort_order = v_order,
                anchor_residence_id = NULL,
                metadata = metadata || jsonb_build_object('globe_pin', true, 'is_primary', true)
                    || CASE WHEN v_old_anchor IS NOT NULL
                            THEN jsonb_build_object('prior_anchor_residence_id', v_old_anchor::text)
                            ELSE '{}'::jsonb END
            WHERE id = p_relationship_id;
        ELSIF p_type_code <> 'lived_at' AND v_old_code = 'lived_at' THEN
            UPDATE relationships
            SET type_id = v_new_type_id, sort_order = NULL,
                anchor_residence_id = p_anchor_residence_id,
                metadata = (metadata - 'is_primary') || jsonb_build_object('globe_pin', true)
            WHERE id = p_relationship_id;
            UPDATE relationships SET anchor_residence_id = NULL
            WHERE anchor_residence_id = p_relationship_id;
        ELSE
            UPDATE relationships
            SET type_id = v_new_type_id,
                anchor_residence_id = CASE WHEN p_type_code = 'lived_at' THEN NULL ELSE p_anchor_residence_id END,
                metadata = metadata || jsonb_build_object('globe_pin', true)
            WHERE id = p_relationship_id;
        END IF;
    END IF;

    SELECT me.memory_id INTO v_mem_id
    FROM memory_entities me
    JOIN memories m ON m.id = me.memory_id
    WHERE me.entity_id = v_place_id
      AND me.role = 'location'
      AND m.user_id = p_user_id
      AND m.capture_mode = 'globe_onboarding'
    ORDER BY m.created_at ASC
    LIMIT 1;

    IF COALESCE(p_body, '') <> '' THEN
        IF v_mem_id IS NULL THEN
            INSERT INTO memories (user_id, content_raw, source, capture_mode, authored_by_actor, occurred_at_fuzzy, is_draft)
            VALUES (p_user_id, p_body, 'text_entry', 'globe_onboarding', 'owner', NULLIF(p_when_text, ''), false)
            RETURNING id INTO v_mem_id;
            INSERT INTO memory_entities (memory_id, entity_id, role, is_primary)
            VALUES (v_mem_id, v_place_id, 'location', true);
        ELSE
            SELECT is_draft, content_raw INTO v_is_draft, v_old_raw FROM memories WHERE id = v_mem_id;
            IF NOT v_is_draft AND v_old_raw IS DISTINCT FROM p_body THEN
                INSERT INTO memory_revisions (user_id, source_memory_id, revision_type, original_excerpt, revised_content, user_note)
                VALUES (p_user_id, v_mem_id, 'factual_correction', v_old_raw, p_body, 'Owner edit via globe pin');
            END IF;
            UPDATE memories
            SET content_raw = p_body, occurred_at_fuzzy = NULLIF(p_when_text, ''),
                is_draft = false, updated_at = NOW()
            WHERE id = v_mem_id;
        END IF;
    ELSE
        IF v_mem_id IS NOT NULL THEN
            SELECT is_draft INTO v_is_draft FROM memories WHERE id = v_mem_id;
            IF v_is_draft THEN
                DELETE FROM memories WHERE id = v_mem_id;
                v_mem_id := NULL;
            END IF;
        END IF;
    END IF;

    RETURN QUERY SELECT v_place_id, v_mem_id, v_relocated;
END;
$$;

-- ── get_residence_pins: include logged_at ─────────────────────────────
DROP FUNCTION IF EXISTS get_residence_pins(UUID);
CREATE FUNCTION get_residence_pins(p_user_id UUID)
RETURNS TABLE (
    relationship_id            UUID,
    place_entity_id            UUID,
    name                       TEXT,
    place_subtype              TEXT,
    description                TEXT,
    lng                        DOUBLE PRECISION,
    lat                        DOUBLE PRECISION,
    when_text                  TEXT,
    has_memory                 BOOLEAN,
    sort_order                 INTEGER,
    type_code                  TEXT,
    anchor_residence_id        UUID,
    prior_anchor_residence_id  UUID,
    created_at                 TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT
        r.id,
        e.id,
        e.canonical_name,
        e.place_subtype::TEXT,
        e.description,
        ST_X(e.geom::geometry),
        ST_Y(e.geom::geometry),
        r.metadata->>'when_text',
        EXISTS (
            SELECT 1 FROM memory_entities me
            WHERE me.entity_id = e.id AND me.role = 'location'
        ),
        r.sort_order,
        rt.code,
        r.anchor_residence_id,
        (r.metadata->>'prior_anchor_residence_id')::uuid,
        r.created_at
    FROM relationships r
    JOIN entities e            ON e.id = r.object_id
    JOIN relationship_types rt ON rt.id = r.type_id
    WHERE r.user_id = p_user_id
      AND e.type = 'place'
      AND rt.code IN ('lived_at','worked_at','owned_residence_at',
                      'lived_briefly_at','vacationed_at','traveled_for_work_to','logged_at')
      AND (rt.code = 'lived_at' OR r.metadata->>'globe_pin' = 'true')
    ORDER BY r.sort_order ASC NULLS LAST, r.created_at ASC;
$$;
