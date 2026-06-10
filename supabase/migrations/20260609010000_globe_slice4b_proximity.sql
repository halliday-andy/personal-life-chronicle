-- 2026-06-09 — Step 7 Slice 4b: nearest-residence proximity probe
--
-- When a pin is placed or relocated, the app wants to recognise two
-- common cases and surface a gentle, non-blocking hint:
--   - "returning" — the new spot is essentially a place lived before
--   - "intra-metro" — a different home within the same metro area
--
-- Both reduce to "how far is the nearest OTHER residence?", which PostGIS
-- answers exactly on the geography we already store. Classification
-- (the distance thresholds) lives in the API route; this function just
-- returns the nearest other residence and its distance in metres.

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION nearest_residence(
    p_user_id      UUID,
    p_lng          DOUBLE PRECISION,
    p_lat          DOUBLE PRECISION,
    p_exclude_rel  UUID DEFAULT NULL
)
RETURNS TABLE (relationship_id UUID, name TEXT, distance_m DOUBLE PRECISION)
LANGUAGE sql STABLE AS $$
    SELECT
        r.id,
        e.canonical_name,
        ST_Distance(e.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
    FROM relationships r
    JOIN entities e            ON e.id = r.object_id
    JOIN relationship_types rt ON rt.id = r.type_id
    WHERE r.user_id = p_user_id
      AND rt.code = 'lived_at'
      AND e.type = 'place'
      AND (p_exclude_rel IS NULL OR r.id <> p_exclude_rel)
    ORDER BY e.geom <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    LIMIT 1;
$$;
