-- Pin creation can adopt an existing entity (2026-07-07).
--
-- The pin-placement path minted a fresh place entity unconditionally —
-- even on an exact name match — which produced live duplicate twins
-- ("Phillips Exeter Academy" extraction-born vs pin-born; the cross-name
-- Hanover/Dartmouth pair). create_residence_pin now accepts an optional
-- p_entity_id: the pin ADOPTS that entity (the user's own, place or
-- organization, not already pinned) instead of inserting a new one —
-- the entity gains the placed coordinates, becomes a place (physical
-- location wins), keeps its links/context/aliases, and folds the modal
-- name in as an alias when it differs. The UI offers this when the pin
-- name matches an existing unpinned entity; declining creates fresh as
-- before.
--
-- Additive: signature gains one defaulted param (DROP + recreate per the
-- established pattern); no data touched. Clears the gate.

SET search_path TO public, extensions;

DROP FUNCTION IF EXISTS create_residence_pin(
    UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION,
    TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, UUID);

CREATE FUNCTION create_residence_pin(
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
    p_anchor_residence_id UUID   DEFAULT NULL,
    p_entity_id          UUID    DEFAULT NULL
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
    v_existing entities%ROWTYPE;
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
$$;
