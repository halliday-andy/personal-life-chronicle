-- 2026-06-17 — Allow merge_entities() to merge a place and an organization.
--
-- Root cause (Andy's QA, 2026-06-17): entity resolution deliberately treats
-- `place` and `organization` as interchangeable for institutions — military
-- bases extract as either type from one run to the next, so resolution
-- searches both types (lib/agents/entity/core.ts → candidateTypes) and
-- queues a cross-type merge proposal when it finds a duplicate. But the
-- original merge_entities() (20260528222311) hard-rejected EVERY cross-type
-- merge, so the proposal it raised could never be executed:
--   "cannot merge entities of different types: organization vs place"
-- Andy hit this merging an extracted "Loring Air Force Base" (organization)
-- into his "Loring AFB, Limestone Maine" globe pin (place).
--
-- Fix: permit a merge when BOTH entities are within {place, organization};
-- keep the hard guard for every other cross-type pair. When the two differ,
-- the PLACE is always the survivor, because only the place row carries the
-- globe identity (geom, place_subtype, country_code) and the residence
-- relationship — merge_entities does not copy those columns, so the place
-- must never be the deleted side. If the caller passed the place as the
-- source, we swap source/target so the pin is protected regardless of the
-- direction the caller chose (the merge-proposal flow already merges the new
-- org INTO the existing place; the manual merge-into route could go either
-- way).
--
-- CREATE OR REPLACE only — additive/reversible, no data rewrite.
-- Body is identical to 20260528222311 except the type-guard block below.

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
        -- Place and organization name the same real-world institution
        -- (e.g. a military base). Honour cross-type merges within that pair;
        -- reject every other cross-type combination.
        IF v_source.type IN ('place', 'organization')
           AND v_target.type IN ('place', 'organization') THEN
            -- The place must survive (it owns the globe identity columns and
            -- the residence relationship). If the place was passed as the
            -- source, swap so the deleted row is always the organization.
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
    'Atomically merge p_source_id into p_target_id (same user). Same-type pairs always; place/organization may merge cross-type with the place kept as survivor (it owns the globe identity columns); all other cross-type pairs are rejected. Repoints all FKs, harmonises aliases, closes open review_queue rows for the source, deletes the source row. Returns a JSONB summary of what moved.';
