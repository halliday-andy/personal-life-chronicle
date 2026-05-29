-- 2026-05-28 — Step 6g-4 infrastructure: merge_entities() PL/pgSQL function.
--
-- An entity merge re-points every FK that references the source entity
-- to the target, harmonises aliases, resolves any open review_queue
-- rows still pointing at the source, and deletes the source row. All
-- in one transaction.
--
-- The Supabase JS client cannot wrap multiple statements in a single
-- transaction from outside, and partial-failure on a merge would be
-- nasty (orphan memory_entities, dangling review_queue rows, etc.).
-- A SECURITY DEFINER function gives us atomicity and is invoked via
-- supabase.rpc('merge_entities', { ... }) from the merge route.
--
-- Tables touched (entity FK columns repointed):
--   memory_entities.entity_id     — UNIQUE on (memory_id, entity_id), conflict-safe
--   entity_media.entity_id        — UNIQUE on (entity_id, media_id), conflict-safe
--   relationships.subject_id      — drop relationship if it would self-loop
--   relationships.object_id       — drop relationship if it would self-loop
--   entities.location_entity_id   — self-FK (place hierarchy)
--   interview_sessions.focus_entity_id
--   syntheses.entity_id
--   coverage.entity_id
--   contacts.person_entity_id
--   assumption_log.entity_id
--
-- Alias merge: source.canonical_name + source.aliases get appended to
-- target.aliases (case-insensitive dedupe), preserving target's
-- existing order and the source's order within the appended block.
-- The target's canonical_name is never duplicated into its own alias
-- list.
--
-- review_queue handling: every still-open row where item_id =
-- p_source_id is closed with resolution='merged',
-- resolution_payload={merged_into_id}, resolved_by=p_resolved_by.
-- This covers both the row that triggered this merge (entity_merge_proposal
-- where item_id = duplicate, or entity_confirmation_needed where the
-- user chose to merge the new entity into an existing one) and any
-- stale rows that pointed at the now-deleted source.
--
-- Errors raised (caller maps to HTTP):
--   'source entity not found'
--   'target entity not found'
--   'entity does not belong to user'
--   'cannot merge entity into itself'
--   'cannot merge entities of different types: X vs Y'

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
        RAISE EXCEPTION 'cannot merge entities of different types: % vs %',
            v_source.type, v_target.type;
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
    UPDATE entities           SET location_entity_id = p_target_id
        WHERE location_entity_id = p_source_id;
    UPDATE interview_sessions SET focus_entity_id    = p_target_id
        WHERE focus_entity_id    = p_source_id;
    UPDATE syntheses          SET entity_id          = p_target_id
        WHERE entity_id          = p_source_id;
    UPDATE coverage           SET entity_id          = p_target_id
        WHERE entity_id          = p_source_id;
    UPDATE contacts           SET person_entity_id   = p_target_id
        WHERE person_entity_id   = p_source_id;
    UPDATE assumption_log     SET entity_id          = p_target_id
        WHERE entity_id          = p_source_id;

    -- 6. Merge aliases: target keeps its canonical_name + existing aliases,
    --    then append source's canonical_name + aliases (case-insensitive
    --    dedupe, source order preserved within the appended block).
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

COMMENT ON FUNCTION merge_entities(UUID, UUID, UUID, TEXT) IS
    'Atomically merge p_source_id into p_target_id (same user, same type). Repoints all FKs, harmonises aliases, closes open review_queue rows for the source, deletes the source row. Returns a JSONB summary of what moved.';
