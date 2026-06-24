-- Slice 3 close-out — item 1: pin placard.
--
-- The placard is a short user-written one-line description of a place,
-- shown in the globe hover card. It reuses the existing entities.description
-- column (no new column). The hover card needs it for every pin without a
-- per-pin fetch, so get_residence_pins now surfaces description.
--
-- Additive (one added output column) — DROP + recreate, no data rewrite.

SET search_path TO public, extensions;

DROP FUNCTION IF EXISTS get_residence_pins(UUID);
CREATE FUNCTION get_residence_pins(p_user_id UUID)
RETURNS TABLE (
    relationship_id            UUID,
    place_entity_id            UUID,
    name                       TEXT,
    place_subtype              TEXT,
    description                TEXT,
    lng                        DOUBLE PRECISION,
    lat                        DOUBLE PRECISION,
    when_text                  TEXT,
    has_memory                 BOOLEAN,
    sort_order                 INTEGER,
    type_code                  TEXT,
    anchor_residence_id        UUID,
    prior_anchor_residence_id  UUID,
    created_at                 TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
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
        r.created_at
    FROM relationships r
    JOIN entities e            ON e.id = r.object_id
    JOIN relationship_types rt ON rt.id = r.type_id
    WHERE r.user_id = p_user_id
      AND e.type = 'place'
      AND rt.code IN ('lived_at','worked_at','owned_residence_at',
                      'lived_briefly_at','vacationed_at','traveled_for_work_to')
      AND (rt.code = 'lived_at' OR r.metadata->>'globe_pin' = 'true')
    ORDER BY r.sort_order ASC NULLS LAST, r.created_at ASC;
$$;
