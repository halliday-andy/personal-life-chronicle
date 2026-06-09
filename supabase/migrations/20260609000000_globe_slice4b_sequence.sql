-- 2026-06-09 — Step 7 Slice 4b: explicit residence sequence
--
-- Until now residence pin order was derived purely from
-- relationships.created_at (placement order), so a pin added later could
-- never sit earlier in the life timeline. Slice 4b adds an explicit
-- sort_order so the user can insert a new pin before/after an existing
-- one and re-sequence pins after the fact.
--
--   - relationships.sort_order: 0-based position within a user's
--     residence chain (lived_at). NULL for non-residence relationships.
--   - get_residence_pins: now ORDER BY sort_order (created_at as the
--     stable tiebreak) and returns sort_order.
--   - create_residence_pin: gains p_position. NULL = append at the end;
--     k = insert at index k, shifting existing pins at >= k up by one.
--   - reorder_residence_pins: rewrite the whole chain's order atomically
--     from an ordered array of relationship ids (ownership-guarded).

SET search_path TO public, extensions;

-- ── COLUMN + BACKFILL ─────────────────────────────────────────────────
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS sort_order INTEGER;

CREATE INDEX IF NOT EXISTS idx_relationships_user_sort
    ON relationships(user_id, sort_order);

-- Seed sort_order for existing residences from current placement order.
WITH ranked AS (
    SELECT r.id,
           ROW_NUMBER() OVER (PARTITION BY r.user_id ORDER BY r.created_at) - 1 AS rn
    FROM relationships r
    JOIN relationship_types rt ON rt.id = r.type_id
    WHERE rt.code = 'lived_at'
)
UPDATE relationships r
SET sort_order = ranked.rn
FROM ranked
WHERE r.id = ranked.id
  AND r.sort_order IS DISTINCT FROM ranked.rn;

-- ── READ: residence pins in explicit sequence ─────────────────────────
DROP FUNCTION IF EXISTS get_residence_pins(UUID);
CREATE FUNCTION get_residence_pins(p_user_id UUID)
RETURNS TABLE (
    relationship_id UUID,
    place_entity_id UUID,
    name            TEXT,
    place_subtype   TEXT,
    lng             DOUBLE PRECISION,
    lat             DOUBLE PRECISION,
    when_text       TEXT,
    has_memory      BOOLEAN,
    sort_order      INTEGER,
    created_at      TIMESTAMPTZ
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
        r.created_at
    FROM relationships r
    JOIN entities e            ON e.id = r.object_id
    JOIN relationship_types rt ON rt.id = r.type_id
    WHERE r.user_id = p_user_id
      AND rt.code = 'lived_at'
      AND e.type = 'place'
    ORDER BY r.sort_order ASC NULLS LAST, r.created_at ASC;
$$;

-- ── CREATE: drafts-on-create (Slice 4a) + positional insert (Slice 4b) ─
DROP FUNCTION IF EXISTS create_residence_pin(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE FUNCTION create_residence_pin(
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
            'owner', NULLIF(p_when_text, ''), true   -- draft on create (Slice 4a)
        )
        RETURNING id INTO v_mem_id;

        INSERT INTO memory_entities (memory_id, entity_id, role, is_primary)
        VALUES (v_mem_id, v_place_id, 'location', true);
    END IF;

    RETURN QUERY SELECT v_place_id, v_rel_id, v_mem_id, v_order;
END;
$$;

-- ── REORDER: rewrite the whole residence chain order atomically ────────
-- p_ordered_ids is the full set of the user's residence relationship ids
-- in the desired order. Ownership-guarded: every id must be one of the
-- user's lived_at residences, and the array must cover them all.
CREATE OR REPLACE FUNCTION reorder_residence_pins(
    p_user_id      UUID,
    p_ordered_ids  UUID[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
    v_total INTEGER;
    v_owned INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM relationships r
    JOIN relationship_types rt ON rt.id = r.type_id
    WHERE r.user_id = p_user_id AND rt.code = 'lived_at';

    SELECT COUNT(*) INTO v_owned
    FROM relationships r
    JOIN relationship_types rt ON rt.id = r.type_id
    WHERE r.user_id = p_user_id
      AND rt.code = 'lived_at'
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
$$;
