-- 2026-06-05 — Step 7 Slice 4a: edit / relocate / delete a residence pin
--
-- - create_residence_pin: new globe recollections are now drafts
--   (is_draft=true) so they are editable in place until finalized.
-- - update_residence_pin: edit name/subtype/country/geom (relocate),
--   when_text, and the recollection. Draft text edits in place;
--   finalized text edits write the prior content_raw into
--   memory_revisions first (owner-edit revision backstop) — Raw Vault
--   stays intact (immutable to agents/synthesis; owner corrections are
--   revision-backed).
-- - delete_residence_pin: atomic, ownership-guarded removal of the pin
--   (memory -> relationship -> place entity, place only if unreferenced).

SET search_path TO public, extensions;

-- ── CREATE (drafts on create) ─────────────────────────────────────────
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
        p_user_id, 'place', p_name,
        NULLIF(p_place_subtype, '')::place_type,
        NULLIF(p_country_code, ''),
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )
    RETURNING id INTO v_place_id;

    INSERT INTO relationships (user_id, subject_id, object_id, type_id, is_ongoing, metadata)
    VALUES (
        p_user_id, p_self_entity_id, v_place_id, v_type_id, false,
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
            'owner', NULLIF(p_when_text, ''), true   -- draft on create
        )
        RETURNING id INTO v_mem_id;

        INSERT INTO memory_entities (memory_id, entity_id, role, is_primary)
        VALUES (v_mem_id, v_place_id, 'location', true);
    END IF;

    RETURN QUERY SELECT v_place_id, v_rel_id, v_mem_id;
END;
$$;

-- ── UPDATE (edit / relocate) ──────────────────────────────────────────
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

    SELECT me.memory_id INTO v_mem_id
    FROM memory_entities me
    WHERE me.entity_id = v_place_id AND me.role = 'location'
    LIMIT 1;

    IF COALESCE(p_body, '') <> '' THEN
        IF v_mem_id IS NULL THEN
            INSERT INTO memories (user_id, content_raw, source, capture_mode, authored_by_actor, occurred_at_fuzzy, is_draft)
            VALUES (p_user_id, p_body, 'text_entry', 'globe_onboarding', 'owner', NULLIF(p_when_text, ''), true)
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
            UPDATE memories
            SET content_raw = p_body, occurred_at_fuzzy = NULLIF(p_when_text, ''), updated_at = NOW()
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

-- ── DELETE ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION delete_residence_pin(
    p_relationship_id UUID,
    p_user_id         UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
    v_place_id UUID;
    v_other    INTEGER;
BEGIN
    SELECT object_id INTO v_place_id
    FROM relationships
    WHERE id = p_relationship_id AND user_id = p_user_id;
    IF v_place_id IS NULL THEN
        RAISE EXCEPTION 'relationship % not found for user', p_relationship_id;
    END IF;

    -- memories linked to this place (cascades memory_entities)
    DELETE FROM memories m
    USING memory_entities me
    WHERE me.memory_id = m.id
      AND me.entity_id = v_place_id
      AND me.role = 'location'
      AND m.user_id = p_user_id;

    DELETE FROM relationships WHERE id = p_relationship_id;

    -- drop the place entity only if nothing else references it
    SELECT COUNT(*) INTO v_other FROM relationships
    WHERE object_id = v_place_id OR subject_id = v_place_id;
    IF v_other = 0 THEN
        DELETE FROM memory_entities WHERE entity_id = v_place_id;
        DELETE FROM entities WHERE id = v_place_id;
    END IF;

    RETURN true;
END;
$$;
