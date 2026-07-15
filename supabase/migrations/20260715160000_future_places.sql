-- Future Places (Trips & Travel U8, KTD9 / R20).
--
-- The seventh pin type: wants_to_visit — somewhere the user WANTS to go
-- or maybe live, aspiration rather than history (resolves the deferred
-- bucket-list idea, memory/project_lc_future_pin_types.md). Non-spine,
-- anchor optional, distinct hollow styling; explicitly distinct from a
-- destination-only trip draft (unframed HISTORY). Promotion: re-type to
-- a historical type, or 'been there now' framing which re-types then
-- creates the trip.
--
-- Additive: two relationship_types rows + CREATE OR REPLACE of the three
-- pin RPCs with the new code admitted to their whitelists (bodies are
-- the live definitions, amended only in the type lists).

SET search_path TO public, extensions;

INSERT INTO relationship_types (code, name, inverse_code, category) VALUES
    ('wants_to_visit',           'Wants to visit',            'is_wished_destination_of', 'spatial'),
    ('is_wished_destination_of', 'Is wished destination of',  'wants_to_visit',           'spatial')
ON CONFLICT (code) DO NOTHING;


-- ── create_residence_pin (whitelist + new code) ────────────────────

CREATE OR REPLACE FUNCTION public.create_residence_pin(p_user_id uuid, p_self_entity_id uuid, p_lng double precision, p_lat double precision, p_name text, p_place_subtype text, p_country_code text, p_when_text text, p_body_text text, p_position integer DEFAULT NULL::integer, p_type_code text DEFAULT 'lived_at'::text, p_anchor_residence_id uuid DEFAULT NULL::uuid, p_entity_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(place_entity_id uuid, relationship_id uuid, memory_id uuid, sort_order integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_place_id UUID;
    v_rel_id   UUID;
    v_mem_id   UUID;
    v_type_id  SMALLINT;
    v_order    INTEGER;
    v_is_spine BOOLEAN := (p_type_code = 'lived_at');
    v_existing entities%ROWTYPE;
BEGIN
    SELECT id INTO v_type_id FROM relationship_types WHERE code = p_type_code;
    IF v_type_id IS NULL THEN
        RAISE EXCEPTION 'unknown relationship type code: %', p_type_code;
    END IF;
    IF p_type_code NOT IN ('lived_at','worked_at','owned_residence_at',
                           'lived_briefly_at','vacationed_at','traveled_for_work_to','logged_at','wants_to_visit') THEN
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

    IF p_entity_id IS NOT NULL THEN
        -- ── Adopt an existing entity as this pin's place ──────────────
        SELECT * INTO v_existing FROM entities WHERE id = p_entity_id FOR UPDATE;
        IF v_existing IS NULL OR v_existing.user_id <> p_user_id THEN
            RAISE EXCEPTION 'entity does not belong to user';
        END IF;
        IF v_existing.type NOT IN ('place', 'organization') THEN
            RAISE EXCEPTION 'only place/organization entities can become pins (got %)', v_existing.type;
        END IF;
        IF EXISTS (
            SELECT 1 FROM relationships r
            JOIN relationship_types rt ON rt.id = r.type_id
            WHERE r.object_id = p_entity_id
              AND (r.metadata->>'globe_pin' = 'true' OR rt.code = 'lived_at')
        ) THEN
            RAISE EXCEPTION 'entity already has a globe pin';
        END IF;

        UPDATE entities SET
            type          = 'place',                       -- physical location wins
            geom          = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
            place_subtype = COALESCE(place_subtype, NULLIF(p_place_subtype, '')::place_type),
            country_code  = COALESCE(country_code, NULLIF(p_country_code, '')),
            -- The modal name becomes an alias when it isn't already covered.
            aliases = CASE
                WHEN COALESCE(p_name, '') <> ''
                 AND lower(p_name) <> lower(canonical_name)
                 AND NOT EXISTS (
                     SELECT 1 FROM unnest(COALESCE(aliases, ARRAY[]::TEXT[])) a
                     WHERE lower(a) = lower(p_name))
                THEN COALESCE(aliases, ARRAY[]::TEXT[]) || p_name
                ELSE aliases
            END,
            updated_at = NOW()
        WHERE id = p_entity_id;

        v_place_id := p_entity_id;
    ELSE
        INSERT INTO entities (user_id, type, canonical_name, place_subtype, country_code, geom)
        VALUES (
            p_user_id, 'place', p_name,
            NULLIF(p_place_subtype, '')::place_type,
            NULLIF(p_country_code, ''),
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
        )
        RETURNING id INTO v_place_id;
    END IF;

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
$function$;



-- ── update_residence_pin (whitelist + new code) ────────────────────

CREATE OR REPLACE FUNCTION public.update_residence_pin(p_relationship_id uuid, p_user_id uuid, p_lng double precision, p_lat double precision, p_name text, p_place_subtype text, p_country_code text, p_when_text text, p_body text, p_type_code text DEFAULT NULL::text, p_anchor_residence_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(place_entity_id uuid, memory_id uuid, relocated boolean)
 LANGUAGE plpgsql
AS $function$
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
            ('lived_at','worked_at','owned_residence_at','lived_briefly_at','vacationed_at','traveled_for_work_to','logged_at','wants_to_visit') THEN
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
$function$;



-- ── get_residence_pins (whitelist + new code) ──────────────────────

CREATE OR REPLACE FUNCTION public.get_residence_pins(p_user_id uuid)
 RETURNS TABLE(relationship_id uuid, place_entity_id uuid, name text, place_subtype text, description text, lng double precision, lat double precision, when_text text, has_memory boolean, sort_order integer, type_code text, anchor_residence_id uuid, prior_anchor_residence_id uuid, move_reason text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
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
        r.metadata->>'move_reason',
        r.created_at
    FROM relationships r
    JOIN entities e            ON e.id = r.object_id
    JOIN relationship_types rt ON rt.id = r.type_id
    WHERE r.user_id = p_user_id
      AND e.type = 'place'
      AND rt.code IN ('lived_at','worked_at','owned_residence_at',
                      'lived_briefly_at','vacationed_at','traveled_for_work_to','logged_at','wants_to_visit')
      AND (rt.code = 'lived_at' OR r.metadata->>'globe_pin' = 'true')
    ORDER BY r.sort_order ASC NULLS LAST, r.created_at ASC;
$function$;

