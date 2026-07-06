-- merge_entities: preserve entity-level substance from the source (2026-07-06).
--
-- Live incident: Andy merged the Hanover PIN entity INTO the Dartmouth
-- extraction entity (reverse of the advised direction). merge_entities
-- repointed every link and folded the alias — but entity-level columns
-- (geom, place_subtype, description, location_entity_id) died with the
-- source row, so the residence pin vanished from the globe (restored
-- manually at the Dartmouth green). Root cause: merge direction could
-- silently destroy globe identity.
--
-- Fix: before deleting the source, COALESCE its geom / place_subtype /
-- description / location_entity_id / born_at / died_at / founded_at onto
-- the target wherever the target is NULL — a merge now keeps the union
-- of substance regardless of direction. Restated from
-- 20260705120000_memory_stubs.sql with the one added step (5c).
--
-- Additive (CREATE OR REPLACE, logic only — no data rewrite). No gate.

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION merge_entities(
    p_source_id  UUID,
    p_target_id  UUID,
    p_user_id    UUID,
    p_resolved_by TEXT DEFAULT 'user'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_source             entities%ROWTYPE;
    v_target             entities%ROWTYPE;
    v_target_aliases     TEXT[];
    v_alias              TEXT;
    v_count_me           INT := 0;
    v_count_em           INT := 0;
    v_count_rq           INT := 0;
    v_tmp_id             UUID;
    v_tmp_row            entities%ROWTYPE;
BEGIN
    -- 1. Lock + validate both rows.
    SELECT * INTO v_source FROM entities WHERE id = p_source_id FOR UPDATE;
    IF v_source IS NULL THEN
        RAISE EXCEPTION 'source entity not found';
    END IF;

    SELECT * INTO v_target FROM entities WHERE id = p_target_id FOR UPDATE;
    IF v_target IS NULL THEN
        RAISE EXCEPTION 'target entity not found';
    END IF;

    IF v_source.user_id <> p_user_id OR v_target.user_id <> p_user_id THEN
        RAISE EXCEPTION 'entity does not belong to user';
    END IF;
    IF v_source.id = v_target.id THEN
        RAISE EXCEPTION 'cannot merge entity into itself';
    END IF;
    IF v_source.type <> v_target.type THEN
        IF v_source.type IN ('place', 'organization')
           AND v_target.type IN ('place', 'organization') THEN
            IF v_target.type = 'organization' THEN
                v_tmp_id  := p_source_id; p_source_id := p_target_id; p_target_id := v_tmp_id;
                v_tmp_row := v_source;     v_source    := v_target;    v_target    := v_tmp_row;
            END IF;
        ELSE
            RAISE EXCEPTION 'cannot merge entities of different types: % vs %',
                v_source.type, v_target.type;
        END IF;
    END IF;

    -- 2. memory_entities: drop source rows where target already linked
    --    to the same memory; repoint the rest.
    DELETE FROM memory_entities me_src
    USING memory_entities me_tgt
    WHERE me_src.entity_id = p_source_id
      AND me_tgt.entity_id = p_target_id
      AND me_src.memory_id = me_tgt.memory_id;

    UPDATE memory_entities SET entity_id = p_target_id
        WHERE entity_id = p_source_id;
    GET DIAGNOSTICS v_count_me = ROW_COUNT;

    -- 3. entity_media: same conflict-then-repoint pattern.
    DELETE FROM entity_media em_src
    USING entity_media em_tgt
    WHERE em_src.entity_id = p_source_id
      AND em_tgt.entity_id = p_target_id
      AND em_src.media_id  = em_tgt.media_id;

    UPDATE entity_media SET entity_id = p_target_id
        WHERE entity_id = p_source_id;
    GET DIAGNOSTICS v_count_em = ROW_COUNT;

    -- 4. relationships: drop any A<->B edges that would self-loop, repoint the rest.
    DELETE FROM relationships
        WHERE (subject_id = p_source_id AND object_id = p_target_id)
           OR (subject_id = p_target_id AND object_id = p_source_id);
    UPDATE relationships SET subject_id = p_target_id WHERE subject_id = p_source_id;
    UPDATE relationships SET object_id  = p_target_id WHERE object_id  = p_source_id;

    -- 5. Other FKs (no unique constraints; straight repoint).
    UPDATE entities             SET location_entity_id = p_target_id
        WHERE location_entity_id = p_source_id;
    UPDATE interview_sessions   SET focus_entity_id    = p_target_id
        WHERE focus_entity_id    = p_source_id;
    UPDATE syntheses            SET entity_id          = p_target_id
        WHERE entity_id          = p_source_id;
    UPDATE coverage             SET entity_id          = p_target_id
        WHERE entity_id          = p_source_id;
    UPDATE contacts             SET person_entity_id   = p_target_id
        WHERE person_entity_id   = p_source_id;
    UPDATE assumption_log       SET entity_id          = p_target_id
        WHERE entity_id          = p_source_id;
    UPDATE entity_context_notes SET entity_id          = p_target_id
        WHERE entity_id          = p_source_id;
    -- NEW: hopper stubs must follow the survivor (else they cascade-delete
    -- when the source entity is removed in step 8).
    UPDATE memory_stubs         SET host_entity_id     = p_target_id
        WHERE host_entity_id     = p_source_id;

    -- 5c. Preserve entity-level substance: the survivor takes anything it
    --     lacks from the row about to be deleted (geom = globe identity).
    UPDATE entities t SET
        geom               = COALESCE(t.geom, s.geom),
        place_subtype      = COALESCE(t.place_subtype, s.place_subtype),
        description        = COALESCE(t.description, s.description),
        location_entity_id = COALESCE(t.location_entity_id, s.location_entity_id),
        born_at            = COALESCE(t.born_at, s.born_at),
        died_at            = COALESCE(t.died_at, s.died_at),
        founded_at         = COALESCE(t.founded_at, s.founded_at)
    FROM entities s
    WHERE t.id = p_target_id AND s.id = p_source_id;

    -- 6. Merge aliases.
    v_target_aliases := COALESCE(v_target.aliases, ARRAY[]::TEXT[]);
    FOREACH v_alias IN ARRAY (
        ARRAY[v_source.canonical_name] || COALESCE(v_source.aliases, ARRAY[]::TEXT[])
    ) LOOP
        IF lower(v_alias) = lower(v_target.canonical_name) THEN CONTINUE; END IF;
        IF EXISTS (
            SELECT 1 FROM unnest(v_target_aliases) AS a WHERE lower(a) = lower(v_alias)
        ) THEN CONTINUE; END IF;
        v_target_aliases := v_target_aliases || v_alias;
    END LOOP;

    UPDATE entities
       SET aliases = CASE
                       WHEN array_length(v_target_aliases, 1) IS NULL THEN NULL
                       ELSE v_target_aliases
                     END,
           updated_at = NOW()
     WHERE id = p_target_id;

    -- 7. Resolve any open review_queue rows still pointing at the source.
    UPDATE review_queue
       SET resolved_at         = NOW(),
           resolution          = 'merged',
           resolution_payload  = jsonb_build_object('merged_into_id', p_target_id),
           resolved_by         = p_resolved_by
     WHERE user_id    = p_user_id
       AND item_id    = p_source_id
       AND resolved_at IS NULL;
    GET DIAGNOSTICS v_count_rq = ROW_COUNT;

    -- 8. Delete the source entity.
    DELETE FROM entities WHERE id = p_source_id;

    RETURN jsonb_build_object(
        'merged_into',           p_target_id,
        'source',                p_source_id,
        'memory_entities_moved', v_count_me,
        'entity_media_moved',    v_count_em,
        'review_queue_closed',   v_count_rq,
        'target_aliases',        v_target_aliases
    );
END;
$$;
