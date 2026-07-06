-- Journey J2 — surface move_reason from get_residence_pins (2026-07-06).
--
-- The Slice-2c extraction agent has written metadata->>'move_reason' on
-- every pin since June (career_relocation, military_posting, education,
-- adventure, …) but it was visible only as a fact chip on the detail
-- card. The Journey view's transition narration renders it BETWEEN
-- consecutive stops ("moved for education ↓"), so the list RPC now
-- returns it. Design: docs/plans/2026-07-05-journey-view-design.md §3.
--
-- Return-shape change (one added column) → DROP + recreate, per the
-- established pattern. Additive; no data touched. Clears the gate.

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
    move_reason                TEXT,
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
        r.metadata->>'move_reason',
        r.created_at
    FROM relationships r
    JOIN entities e            ON e.id = r.object_id
    JOIN relationship_types rt ON rt.id = r.type_id
    WHERE r.user_id = p_user_id
      AND e.type = 'place'
      AND rt.code IN ('lived_at','worked_at','owned_residence_at',
                      'lived_briefly_at','vacationed_at','traveled_for_work_to','logged_at')
      AND (rt.code = 'lived_at' OR r.metadata->>'globe_pin' = 'true')
    ORDER BY r.sort_order ASC NULLS LAST, r.created_at ASC;
$$;
