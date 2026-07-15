-- Trips & Travel Journal — data layer (plan U1, KTD1–KTD5).
--
-- Trips are first-class chronicle objects layered over existing globe
-- pins: origin (nullable — a destination-only draft), required
-- destination, ordered leg-aware itinerary stops, subtype, free-text
-- timeframe plus an optional user-entered year_hint (never parsed from
-- when_text — invariant #5). Every trip gets a backing entity (new
-- entity_type value 'trip') so recollections (memory_entities), jots
-- (memory_stubs), and context notes attach through existing machinery.
--
-- Additive only: one enum value, two new tables, new functions. No
-- existing rows touched. CAUTION honored below: the just-added enum
-- value is never USED inside this migration (db-apply wraps the file in
-- one transaction; PG forbids using a value added in the same txn) —
-- 'trip'::entity_type appears only inside function bodies, which are
-- not evaluated at CREATE time.

SET search_path TO public, extensions;

-- ── 1. Enum value for the backing entity ──────────────────────────────
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'trip';

-- ── 2. Tables ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trips (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL,
    trip_entity_id              UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    subtype                     TEXT NOT NULL CHECK (subtype IN ('professional','vacation','road_trip')),
    title                       TEXT,
    when_text                   TEXT,
    year_hint                   INTEGER,
    -- Draft = origin IS NULL. A deleted origin pin demotes to draft;
    -- a destination pin cannot be deleted while a trip references it
    -- (Andy's call 2026-07-15: unframe or delete the trip first).
    origin_relationship_id      UUID REFERENCES relationships(id) ON DELETE SET NULL,
    destination_relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE RESTRICT,
    return_to_origin            BOOLEAN NOT NULL DEFAULT true,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_user        ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_destination ON trips(destination_relationship_id);
CREATE INDEX IF NOT EXISTS idx_trips_origin      ON trips(origin_relationship_id);

CREATE TABLE IF NOT EXISTS trip_stops (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id         UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
    leg             TEXT NOT NULL CHECK (leg IN ('outbound','return')),
    position        INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_stops_trip ON trip_stops(trip_id, leg, position);

-- ── 3. Pin validation helper ──────────────────────────────────────────
-- A trip endpoint/stop must be the user's own globe pin. Destinations
-- must be non-spine (a home is where a trip starts, not where it turns);
-- origins and stops may be any own pin, including a residence.
CREATE OR REPLACE FUNCTION validate_trip_pin(
    p_relationship_id UUID,
    p_user_id         UUID,
    p_allow_spine     BOOLEAN
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
    IF COALESCE(v_rel.metadata->>'globe_pin', 'false') <> 'true' AND v_code <> 'lived_at' THEN
        RAISE EXCEPTION 'relationship is not a globe pin';
    END IF;
    IF NOT p_allow_spine AND v_code = 'lived_at' THEN
        RAISE EXCEPTION 'a primary residence cannot be a trip destination';
    END IF;
END;
$$;

-- ── 4. create_trip ────────────────────────────────────────────────────
-- Destination-first: a destination pin id + subtype is enough (R5).
-- Also serves "frame this pin as a trip" (R14) — the pin itself is
-- untouched. Mints the backing 'trip' entity.
CREATE OR REPLACE FUNCTION create_trip(
    p_user_id                     UUID,
    p_destination_relationship_id UUID,
    p_subtype                     TEXT,
    p_title                       TEXT    DEFAULT NULL,
    p_when_text                   TEXT    DEFAULT NULL,
    p_year_hint                   INTEGER DEFAULT NULL,
    p_origin_relationship_id      UUID    DEFAULT NULL
)
RETURNS TABLE (trip_id UUID, trip_entity_id UUID)
LANGUAGE plpgsql AS $$
DECLARE
    v_entity_id UUID;
    v_trip_id   UUID;
    v_dest_name TEXT;
BEGIN
    IF p_subtype NOT IN ('professional','vacation','road_trip') THEN
        RAISE EXCEPTION 'unknown trip subtype: %', p_subtype;
    END IF;
    PERFORM validate_trip_pin(p_destination_relationship_id, p_user_id, false);
    IF p_origin_relationship_id IS NOT NULL THEN
        PERFORM validate_trip_pin(p_origin_relationship_id, p_user_id, true);
    END IF;

    SELECT e.canonical_name INTO v_dest_name
    FROM relationships r JOIN entities e ON e.id = r.object_id
    WHERE r.id = p_destination_relationship_id;

    INSERT INTO entities (user_id, type, canonical_name)
    VALUES (p_user_id, 'trip',
            COALESCE(NULLIF(p_title, ''), 'Trip to ' || v_dest_name))
    RETURNING id INTO v_entity_id;

    INSERT INTO trips (user_id, trip_entity_id, subtype, title, when_text,
                       year_hint, origin_relationship_id, destination_relationship_id)
    VALUES (p_user_id, v_entity_id, p_subtype, NULLIF(p_title, ''),
            NULLIF(p_when_text, ''), p_year_hint,
            p_origin_relationship_id, p_destination_relationship_id)
    RETURNING id INTO v_trip_id;

    RETURN QUERY SELECT v_trip_id, v_entity_id;
END;
$$;

-- ── 5. frame_trip ─────────────────────────────────────────────────────
-- Deferred completion (R7): confirm/replace the origin, set title,
-- timeframe, year hint, subtype. NULL params leave fields unchanged;
-- p_clear_origin demotes back to draft. Title changes rename the
-- backing entity.
CREATE OR REPLACE FUNCTION frame_trip(
    p_user_id                UUID,
    p_trip_id                UUID,
    p_origin_relationship_id UUID    DEFAULT NULL,
    p_title                  TEXT    DEFAULT NULL,
    p_when_text              TEXT    DEFAULT NULL,
    p_year_hint              INTEGER DEFAULT NULL,
    p_subtype                TEXT    DEFAULT NULL,
    p_return_to_origin       BOOLEAN DEFAULT NULL,
    p_clear_origin           BOOLEAN DEFAULT false
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_trip trips%ROWTYPE;
BEGIN
    SELECT * INTO v_trip FROM trips WHERE id = p_trip_id;
    IF v_trip IS NULL OR v_trip.user_id <> p_user_id THEN
        RAISE EXCEPTION 'trip does not belong to user';
    END IF;
    IF p_subtype IS NOT NULL AND p_subtype NOT IN ('professional','vacation','road_trip') THEN
        RAISE EXCEPTION 'unknown trip subtype: %', p_subtype;
    END IF;
    IF p_origin_relationship_id IS NOT NULL THEN
        PERFORM validate_trip_pin(p_origin_relationship_id, p_user_id, true);
    END IF;

    UPDATE trips SET
        origin_relationship_id = CASE
            WHEN p_clear_origin THEN NULL
            ELSE COALESCE(p_origin_relationship_id, origin_relationship_id) END,
        title            = COALESCE(NULLIF(p_title, ''), title),
        when_text        = COALESCE(NULLIF(p_when_text, ''), when_text),
        year_hint        = COALESCE(p_year_hint, year_hint),
        subtype          = COALESCE(p_subtype, subtype),
        return_to_origin = COALESCE(p_return_to_origin, return_to_origin),
        updated_at       = NOW()
    WHERE id = p_trip_id;

    IF COALESCE(NULLIF(p_title, ''), '') <> '' THEN
        UPDATE entities SET canonical_name = p_title, updated_at = NOW()
        WHERE id = v_trip.trip_entity_id;
    END IF;
END;
$$;

-- ── 6. Stops ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION add_trip_stop(
    p_user_id         UUID,
    p_trip_id         UUID,
    p_relationship_id UUID,
    p_leg             TEXT    DEFAULT 'outbound',
    p_position        INTEGER DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
    v_trip trips%ROWTYPE;
    v_pos  INTEGER;
    v_id   UUID;
BEGIN
    IF p_leg NOT IN ('outbound','return') THEN
        RAISE EXCEPTION 'unknown leg: %', p_leg;
    END IF;
    SELECT * INTO v_trip FROM trips WHERE id = p_trip_id;
    IF v_trip IS NULL OR v_trip.user_id <> p_user_id THEN
        RAISE EXCEPTION 'trip does not belong to user';
    END IF;
    IF p_relationship_id = v_trip.destination_relationship_id THEN
        RAISE EXCEPTION 'the destination is the turnaround, not an itinerary stop';
    END IF;
    PERFORM validate_trip_pin(p_relationship_id, p_user_id, true);

    IF p_position IS NULL THEN
        SELECT COALESCE(MAX(position), -1) + 1 INTO v_pos
        FROM trip_stops WHERE trip_id = p_trip_id AND leg = p_leg;
    ELSE
        v_pos := GREATEST(p_position, 0);
        UPDATE trip_stops SET position = position + 1
        WHERE trip_id = p_trip_id AND leg = p_leg AND position >= v_pos;
    END IF;

    INSERT INTO trip_stops (trip_id, relationship_id, leg, position)
    VALUES (p_trip_id, p_relationship_id, p_leg, v_pos)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- Reorder within one leg. The id array must be an exact permutation of
-- that leg's stops — ids from another leg or trip are rejected (the
-- destination divider is fixed; cross-leg moves are a remove + add).
CREATE OR REPLACE FUNCTION reorder_trip_stops(
    p_user_id         UUID,
    p_trip_id         UUID,
    p_leg             TEXT,
    p_ordered_stop_ids UUID[]
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_trip     trips%ROWTYPE;
    v_existing UUID[];
    i          INTEGER;
BEGIN
    SELECT * INTO v_trip FROM trips WHERE id = p_trip_id;
    IF v_trip IS NULL OR v_trip.user_id <> p_user_id THEN
        RAISE EXCEPTION 'trip does not belong to user';
    END IF;
    SELECT ARRAY(SELECT id FROM trip_stops
                 WHERE trip_id = p_trip_id AND leg = p_leg ORDER BY id)
    INTO v_existing;
    IF v_existing IS DISTINCT FROM
       (SELECT ARRAY(SELECT unnest(p_ordered_stop_ids) ORDER BY 1)) THEN
        RAISE EXCEPTION 'stop ids must be exactly the % leg of this trip', p_leg;
    END IF;
    FOR i IN 1 .. COALESCE(array_length(p_ordered_stop_ids, 1), 0) LOOP
        UPDATE trip_stops SET position = i - 1
        WHERE id = p_ordered_stop_ids[i];
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION remove_trip_stop(
    p_user_id UUID,
    p_stop_id UUID
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_stop trip_stops%ROWTYPE;
BEGIN
    SELECT ts.* INTO v_stop
    FROM trip_stops ts JOIN trips t ON t.id = ts.trip_id
    WHERE ts.id = p_stop_id AND t.user_id = p_user_id;
    IF v_stop IS NULL THEN
        RAISE EXCEPTION 'stop does not belong to user';
    END IF;
    DELETE FROM trip_stops WHERE id = p_stop_id;
    UPDATE trip_stops SET position = position - 1
    WHERE trip_id = v_stop.trip_id AND leg = v_stop.leg AND position > v_stop.position;
END;
$$;

-- ── 7. delete_trip (un-framing, R14) ──────────────────────────────────
-- Deletes the trip + stops; destination/origin pins are untouched. The
-- backing entity is deleted only when nothing references it — a trip
-- entity carrying recollections, jots, or context notes survives as a
-- plain entity so no Raw Vault link is ever lost (and no zero-link
-- orphan is ever left).
CREATE OR REPLACE FUNCTION delete_trip(
    p_user_id UUID,
    p_trip_id UUID
) RETURNS TABLE (entity_deleted BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
    v_trip     trips%ROWTYPE;
    v_has_refs BOOLEAN;
BEGIN
    SELECT * INTO v_trip FROM trips WHERE id = p_trip_id;
    IF v_trip IS NULL OR v_trip.user_id <> p_user_id THEN
        RAISE EXCEPTION 'trip does not belong to user';
    END IF;

    DELETE FROM trips WHERE id = p_trip_id;

    SELECT EXISTS (SELECT 1 FROM memory_entities      WHERE entity_id = v_trip.trip_entity_id)
        OR EXISTS (SELECT 1 FROM memory_stubs         WHERE host_entity_id = v_trip.trip_entity_id)
        OR EXISTS (SELECT 1 FROM entity_context_notes WHERE entity_id = v_trip.trip_entity_id)
    INTO v_has_refs;

    IF NOT v_has_refs THEN
        DELETE FROM entities WHERE id = v_trip.trip_entity_id;
    END IF;
    RETURN QUERY SELECT NOT v_has_refs;
END;
$$;

-- ── 8. get_trips ──────────────────────────────────────────────────────
-- One call paints the Travel Journal and the globe route layer: trip
-- fields, origin/destination names + coordinates, and the ordered stops
-- as JSON. Travel Journal order: year_hint (unhinted last), created_at.
CREATE OR REPLACE FUNCTION get_trips(p_user_id UUID)
RETURNS TABLE (
    trip_id                     UUID,
    trip_entity_id              UUID,
    subtype                     TEXT,
    title                       TEXT,
    when_text                   TEXT,
    year_hint                   INTEGER,
    return_to_origin            BOOLEAN,
    created_at                  TIMESTAMPTZ,
    is_draft                    BOOLEAN,
    origin_relationship_id      UUID,
    origin_name                 TEXT,
    origin_lng                  DOUBLE PRECISION,
    origin_lat                  DOUBLE PRECISION,
    destination_relationship_id UUID,
    destination_name            TEXT,
    destination_lng             DOUBLE PRECISION,
    destination_lat             DOUBLE PRECISION,
    stops                       JSONB
)
LANGUAGE sql STABLE AS $$
    SELECT
        t.id, t.trip_entity_id, t.subtype, t.title, t.when_text, t.year_hint,
        t.return_to_origin, t.created_at,
        (t.origin_relationship_id IS NULL) AS is_draft,
        t.origin_relationship_id,
        oe.canonical_name,
        ST_X(oe.geom::geometry), ST_Y(oe.geom::geometry),
        t.destination_relationship_id,
        de.canonical_name,
        ST_X(de.geom::geometry), ST_Y(de.geom::geometry),
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'stop_id', ts.id,
                'relationship_id', ts.relationship_id,
                'name', se.canonical_name,
                'lng', ST_X(se.geom::geometry),
                'lat', ST_Y(se.geom::geometry),
                'leg', ts.leg,
                'position', ts.position
            ) ORDER BY CASE ts.leg WHEN 'outbound' THEN 0 ELSE 1 END, ts.position)
            FROM trip_stops ts
            JOIN relationships sr ON sr.id = ts.relationship_id
            JOIN entities se ON se.id = sr.object_id
            WHERE ts.trip_id = t.id
        ), '[]'::jsonb) AS stops
    FROM trips t
    JOIN relationships dr ON dr.id = t.destination_relationship_id
    JOIN entities de ON de.id = dr.object_id
    LEFT JOIN relationships orr ON orr.id = t.origin_relationship_id
    LEFT JOIN entities oe ON oe.id = orr.object_id
    WHERE t.user_id = p_user_id
    ORDER BY t.year_hint NULLS LAST, t.created_at;
$$;
