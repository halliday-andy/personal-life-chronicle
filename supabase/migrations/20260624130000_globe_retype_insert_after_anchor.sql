-- Re-type-to-primary insert position (QA §12 follow-up, 2026-06-24).
--
-- When a marker is re-typed to a primary residence it was appending at the END
-- of the spine. It should instead join the spine RIGHT AFTER the home it was
-- anchored to (its temporal neighbour) — shifting later primaries down. Falls
-- back to append when the marker had no primary anchor.
--
-- CREATE OR REPLACE of update_residence_pin (signature unchanged), re-stated
-- from 20260624140000_globe_log_pin.sql with the marker→primary branch changed.
-- Additive logic; no data rewrite. Clears the gate.

SET search_path TO public, extensions;

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

        IF p_type_code <> 'lived_at' THEN
            PERFORM validate_pin_anchor(p_anchor_residence_id, p_user_id);
        END IF;

        IF p_type_code = 'lived_at' AND v_old_code <> 'lived_at' THEN
            -- Insert RIGHT AFTER the primary home this marker was anchored to,
            -- if any; otherwise append at the end of the spine.
            SELECT rr.sort_order + 1 INTO v_order
            FROM relationships rr JOIN relationship_types rt ON rt.id = rr.type_id
            WHERE rr.id = v_old_anchor AND rr.user_id = p_user_id AND rt.code = 'lived_at';

            IF v_order IS NULL THEN
                SELECT COALESCE(MAX(rr.sort_order), -1) + 1 INTO v_order
                FROM relationships rr JOIN relationship_types rt ON rt.id = rr.type_id
                WHERE rr.user_id = p_user_id AND rt.code = 'lived_at';
            ELSE
                UPDATE relationships rr
                SET sort_order = rr.sort_order + 1
                FROM relationship_types rt
                WHERE rt.id = rr.type_id AND rr.user_id = p_user_id
                  AND rt.code = 'lived_at' AND rr.sort_order >= v_order
                  AND rr.id <> p_relationship_id;
            END IF;

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
