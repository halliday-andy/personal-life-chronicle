-- Unsequenced residences (Trips & Travel U9, KTD10 / R21-R22).
--
-- A primary residence may exist OFF the spine: lived_at with
-- sort_order NULL — fully embellishable, excluded from the thread and
-- every spine-derived path until the user places it. Backs the trip
-- origin that predates the spine (AE5) and Andy's embellish-first
-- capture. Additive: create_residence_pin gains a defaulted param
-- (DROP + recreate); place/unsequence are new; nearest_residence and
-- reorder_residence_pins are recreated from live definitions amended
-- to sequenced-primaries-only.

SET search_path TO public, extensions;

-- ── create_residence_pin + p_unsequenced ──────────────────────────────
DROP FUNCTION IF EXISTS create_residence_pin(
    UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION,
    TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, UUID, UUID);

CREATE OR REPLACE FUNCTION public.create_residence_pin(p_user_id uuid, p_self_entity_id uuid, p_lng double precision, p_lat double precision, p_name text, p_place_subtype text, p_country_code text, p_when_text text, p_body_text text, p_position integer DEFAULT NULL::integer, p_type_code text DEFAULT 'lived_at'::text, p_anchor_residence_id uuid DEFAULT NULL::uuid, p_entity_id uuid DEFAULT NULL::uuid, p_unsequenced boolean DEFAULT false)
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
        IF p_unsequenced THEN
            -- Unsequenced residence (KTD10): a home to embellish now and
            -- place in the spine later. No slot, no shift.
            v_order := NULL;
        ELSIF p_position IS NULL THEN
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

-- ── place_residence_in_spine (the "Place in sequence" action) ────────
CREATE OR REPLACE FUNCTION place_residence_in_spine(
    p_user_id         UUID,
    p_relationship_id UUID,
    p_position        INTEGER DEFAULT NULL  -- NULL = append at the end
) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    v_rel  relationships%ROWTYPE;
    v_code TEXT;
    v_pos  INTEGER;
BEGIN
    SELECT * INTO v_rel FROM relationships WHERE id = p_relationship_id;
    IF v_rel IS NULL OR v_rel.user_id <> p_user_id THEN
        RAISE EXCEPTION 'pin does not belong to user';
    END IF;
    SELECT rt.code INTO v_code FROM relationship_types rt WHERE rt.id = v_rel.type_id;
    IF v_code <> 'lived_at' THEN
        RAISE EXCEPTION 'only a primary residence can join the spine';
    END IF;
    IF v_rel.sort_order IS NOT NULL THEN
        RAISE EXCEPTION 'pin is already in the spine (reorder instead)';
    END IF;

    IF p_position IS NULL THEN
        SELECT COALESCE(MAX(rr.sort_order), -1) + 1 INTO v_pos
        FROM relationships rr
        JOIN relationship_types rt ON rt.id = rr.type_id
        WHERE rr.user_id = p_user_id AND rt.code = 'lived_at' AND rr.sort_order IS NOT NULL;
    ELSE
        v_pos := GREATEST(p_position, 0);
        UPDATE relationships rr
        SET sort_order = rr.sort_order + 1
        FROM relationship_types rt
        WHERE rt.id = rr.type_id
          AND rr.user_id = p_user_id
          AND rt.code = 'lived_at'
          AND rr.sort_order >= v_pos;
    END IF;

    UPDATE relationships SET sort_order = v_pos WHERE id = p_relationship_id;
    RETURN v_pos;
END;
$$;

-- ── unsequence_residence (demote from the sequence picker) ────────────
-- The pin keeps everything — recollection, photos, tethered markers,
-- trips — it just leaves the thread; the remainder closes up.
CREATE OR REPLACE FUNCTION unsequence_residence(
    p_user_id         UUID,
    p_relationship_id UUID
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_rel  relationships%ROWTYPE;
    v_code TEXT;
BEGIN
    SELECT * INTO v_rel FROM relationships WHERE id = p_relationship_id;
    IF v_rel IS NULL OR v_rel.user_id <> p_user_id THEN
        RAISE EXCEPTION 'pin does not belong to user';
    END IF;
    SELECT rt.code INTO v_code FROM relationship_types rt WHERE rt.id = v_rel.type_id;
    IF v_code <> 'lived_at' OR v_rel.sort_order IS NULL THEN
        RAISE EXCEPTION 'pin is not a sequenced primary residence';
    END IF;

    UPDATE relationships SET sort_order = NULL WHERE id = p_relationship_id;
    UPDATE relationships rr
    SET sort_order = rr.sort_order - 1
    FROM relationship_types rt
    WHERE rt.id = rr.type_id
      AND rr.user_id = p_user_id
      AND rt.code = 'lived_at'
      AND rr.sort_order > v_rel.sort_order;
END;
$$;

-- ── nearest_residence: sequenced only ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.nearest_residence(p_user_id uuid, p_lng double precision, p_lat double precision, p_exclude_rel uuid DEFAULT NULL::uuid)
 RETURNS TABLE(relationship_id uuid, name text, distance_m double precision)
 LANGUAGE sql
 STABLE
AS $function$
    SELECT
        r.id,
        e.canonical_name,
        ST_Distance(e.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
    FROM relationships r
    JOIN entities e            ON e.id = r.object_id
    JOIN relationship_types rt ON rt.id = r.type_id
    WHERE r.user_id = p_user_id
      AND rt.code = 'lived_at'
      AND r.sort_order IS NOT NULL -- unsequenced homes are placeless until placed (U9)
      AND e.type = 'place'
      AND (p_exclude_rel IS NULL OR r.id <> p_exclude_rel)
    ORDER BY e.geom <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    LIMIT 1;
$function$;

-- ── reorder_residence_pins: the spine is the sequenced primaries ──────
CREATE OR REPLACE FUNCTION public.reorder_residence_pins(p_user_id uuid, p_ordered_ids uuid[])
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total INTEGER;
    v_owned INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM relationships r
    JOIN relationship_types rt ON rt.id = r.type_id
    WHERE r.user_id = p_user_id AND rt.code = 'lived_at' AND r.sort_order IS NOT NULL;

    SELECT COUNT(*) INTO v_owned
    FROM relationships r
    JOIN relationship_types rt ON rt.id = r.type_id
    WHERE r.user_id = p_user_id
      AND rt.code = 'lived_at'
      AND r.sort_order IS NOT NULL -- an unsequenced id is rejected, not placed (U9)
      AND r.id = ANY (p_ordered_ids);

    IF v_owned <> array_length(p_ordered_ids, 1) THEN
        RAISE EXCEPTION 'reorder list contains ids not owned by user or not residences';
    END IF;
    IF v_owned <> v_total THEN
        RAISE EXCEPTION 'reorder list must cover all % residences (got %)', v_total, v_owned;
    END IF;

    UPDATE relationships r
    SET sort_order = idx.ord
    FROM (
        SELECT t.id, t.ord - 1 AS ord
        FROM unnest(p_ordered_ids) WITH ORDINALITY AS t(id, ord)
    ) idx
    WHERE r.id = idx.id AND r.user_id = p_user_id;

    RETURN true;
END;
$function$;
