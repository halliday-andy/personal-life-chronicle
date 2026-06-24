-- Slice 3 close-out — Phase-5 finding 2: re-type anchor/tether restore.
--
-- Bug: marker → primary → marker re-typing lost the anchor. The marker →
-- primary leg of update_residence_pin set anchor_residence_id = NULL and
-- forgot the old value, so reverting fell back to "standalone" with no
-- dashed tether.
--
-- Fix (additive, no data rewrite):
--   1. update_residence_pin stashes the old anchor into
--      relationships.metadata.prior_anchor_residence_id when a marker is
--      re-typed to a primary (CREATE OR REPLACE — signature unchanged).
--   2. get_residence_pins surfaces prior_anchor_residence_id so the edit
--      panel can default the anchor picker back to the prior primary on
--      revert (DROP + recreate — adds one output column).
--
-- The live anchor_residence_id stays authoritative for a marker; the stash
-- is only a hint for the picker default. No backend "magic restore" — the
-- user's explicit picker choice (including standalone) is always honored.

SET search_path TO public, extensions;

-- ── 1. Stash the prior anchor on marker → primary ─────────────────────
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
            ('lived_at','worked_at','owned_residence_at','lived_briefly_at','vacationed_at','traveled_for_work_to') THEN
            RAISE EXCEPTION 'invalid globe pin type: %', p_type_code;
        END IF;

        -- C. Validate the new anchor (markers only) before applying.
        IF p_type_code <> 'lived_at' THEN
            PERFORM validate_residence_anchor(p_anchor_residence_id, p_user_id);
        END IF;

        IF p_type_code = 'lived_at' AND v_old_code <> 'lived_at' THEN
            SELECT COALESCE(MAX(rr.sort_order), -1) + 1 INTO v_order
            FROM relationships rr JOIN relationship_types rt ON rt.id = rr.type_id
            WHERE rr.user_id = p_user_id AND rt.code = 'lived_at';
            UPDATE relationships
            SET type_id = v_new_type_id, sort_order = v_order,
                anchor_residence_id = NULL,
                -- Stash the prior anchor so a revert can default back to it.
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
            -- A. This pin is no longer a primary — orphan any markers that
            --    were anchored to it (they become standalone), since the
            --    FK SET NULL only fires on delete, not on this type change.
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

-- ── 2. Surface the stash from get_residence_pins ──────────────────────
-- Return shape changes (one added column) → DROP + recreate.
DROP FUNCTION IF EXISTS get_residence_pins(UUID);
CREATE FUNCTION get_residence_pins(p_user_id UUID)
RETURNS TABLE (
    relationship_id            UUID,
    place_entity_id            UUID,
    name                       TEXT,
    place_subtype              TEXT,
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
                      'lived_briefly_at','vacationed_at','traveled_for_work_to')
      AND (rt.code = 'lived_at' OR r.metadata->>'globe_pin' = 'true')
    ORDER BY r.sort_order ASC NULLS LAST, r.created_at ASC;
$$;
