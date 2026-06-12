-- 2026-06-13 — Globe recollections finalize on save (Andy: option 1).
--
-- Slice 4a made globe memories drafts-on-create so they were editable
-- in place, but nothing ever finalized them — every new pin sat in
-- "awaiting review" limbo forever (the Zaragoza draft). Decision: the
-- globe save IS the owner's authorship; there is no reviewer.
--
--   - create_residence_pin: memories created final (is_draft=false).
--   - update_residence_pin: a body save on a (legacy) draft finalizes
--     it in place — no revision for the finalizing save itself; every
--     subsequent edit goes through memory_revisions as before.
--   - Backfill: finalize existing globe_onboarding drafts (1 row —
--     the Zaragoza recollection; explicitly approved by Andy
--     2026-06-13 under the Migration Safety Checkpoint).

SET search_path TO public, extensions;

-- ── CREATE (final on create; body otherwise identical to Slice 4b) ────
CREATE OR REPLACE FUNCTION create_residence_pin(
    p_user_id        UUID,
    p_self_entity_id UUID,
    p_lng            DOUBLE PRECISION,
    p_lat            DOUBLE PRECISION,
    p_name           TEXT,
    p_place_subtype  TEXT,
    p_country_code   TEXT,
    p_when_text      TEXT,
    p_body_text      TEXT,
    p_position       INTEGER DEFAULT NULL   -- NULL = append; k = insert at index k
)
RETURNS TABLE (place_entity_id UUID, relationship_id UUID, memory_id UUID, sort_order INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
    v_place_id UUID;
    v_rel_id   UUID;
    v_mem_id   UUID;
    v_type_id  SMALLINT;
    v_order    INTEGER;
BEGIN
    SELECT id INTO v_type_id FROM relationship_types WHERE code = 'lived_at';
    IF v_type_id IS NULL THEN
        RAISE EXCEPTION 'relationship_type code lived_at not found';
    END IF;

    -- Resolve the sequence position. Append by default; otherwise open a
    -- gap at p_position by shifting later residences up by one.
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

    INSERT INTO entities (user_id, type, canonical_name, place_subtype, country_code, geom)
    VALUES (
        p_user_id, 'place', p_name,
        NULLIF(p_place_subtype, '')::place_type,
        NULLIF(p_country_code, ''),
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )
    RETURNING id INTO v_place_id;

    INSERT INTO relationships (user_id, subject_id, object_id, type_id, is_ongoing, sort_order, metadata)
    VALUES (
        p_user_id, p_self_entity_id, v_place_id, v_type_id, false, v_order,
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
            'owner', NULLIF(p_when_text, ''), false   -- final on create (2026-06-13; was draft per Slice 4a)
        )
        RETURNING id INTO v_mem_id;

        INSERT INTO memory_entities (memory_id, entity_id, role, is_primary)
        VALUES (v_mem_id, v_place_id, 'location', true);
    END IF;

    RETURN QUERY SELECT v_place_id, v_rel_id, v_mem_id, v_order;
END;
$$;

-- ── UPDATE (edit / relocate; body save finalizes legacy drafts) ───────
CREATE OR REPLACE FUNCTION update_residence_pin(
    p_relationship_id UUID,
    p_user_id         UUID,
    p_lng             DOUBLE PRECISION,
    p_lat             DOUBLE PRECISION,
    p_name            TEXT,
    p_place_subtype   TEXT,
    p_country_code    TEXT,
    p_when_text       TEXT,
    p_body            TEXT
)
RETURNS TABLE (place_entity_id UUID, memory_id UUID, relocated BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
    v_place_id  UUID;
    v_mem_id    UUID;
    v_is_draft  BOOLEAN;
    v_old_raw   TEXT;
    v_relocated BOOLEAN := false;
BEGIN
    SELECT object_id INTO v_place_id
    FROM relationships
    WHERE id = p_relationship_id AND user_id = p_user_id;
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

    -- The pin's own recollection: the globe-authored memory only,
    -- oldest first (the original modal text) for determinism.
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
                -- finalized owner edit: preserve original, then overwrite
                INSERT INTO memory_revisions (user_id, source_memory_id, revision_type, original_excerpt, revised_content, user_note)
                VALUES (p_user_id, v_mem_id, 'factual_correction', v_old_raw, p_body, 'Owner edit via globe pin');
            END IF;
            -- Legacy draft: update in place and finalize (the save IS the
            -- authorship; no revision for the finalizing save itself).
            UPDATE memories
            SET content_raw = p_body,
                occurred_at_fuzzy = NULLIF(p_when_text, ''),
                is_draft = false,
                updated_at = NOW()
            WHERE id = v_mem_id;
        END IF;
    ELSE
        -- body emptied: remove only a draft memory; never vault-delete a finalized one
        IF v_mem_id IS NOT NULL THEN
            SELECT is_draft INTO v_is_draft FROM memories WHERE id = v_mem_id;
            IF v_is_draft THEN
                DELETE FROM memories WHERE id = v_mem_id;  -- cascades memory_entities
                v_mem_id := NULL;
            END IF;
        END IF;
    END IF;

    RETURN QUERY SELECT v_place_id, v_mem_id, v_relocated;
END;
$$;

-- ── Backfill: finalize existing globe drafts (approved by Andy) ───────
UPDATE memories
SET is_draft = false, updated_at = NOW()
WHERE capture_mode = 'globe_onboarding' AND is_draft = true;
