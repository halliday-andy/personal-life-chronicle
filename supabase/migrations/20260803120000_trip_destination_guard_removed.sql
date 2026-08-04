-- ─────────────────────────────────────────────────────────────────────
-- Remove the "a primary residence cannot be a trip destination" guard
-- (R6 / finding F6, 2026-08-03 — Andy's call)
--
-- The guard refused any trip whose destination was a spine pin, on the
-- reasoning that "a home is where a trip STARTS, not where it TURNS."
--
-- The premise is unsound: **pin types describe the PRESENT, trips
-- describe the PAST.** Any rule keyed on a destination's current type
-- will misjudge a life in which places change role — which in a
-- residential chronicle is the normal case, not the exception.
--
-- Andy's scenario, which no version of the guard survives:
--
--   1. Living at primary residence A, take a ROUND trip to view a house
--      under construction. Valid — the house is not a home yet.
--   2. Six months later, move in. That pin becomes primary residence B.
--   3. The pre-existing round trip's destination is now a spine pin.
--
-- Nothing about the journey changed; the world did. Under the guard,
-- that trip could no longer be saved — and recording it AFTER the move
-- was refused outright, because `create_trip` applied the same test.
--
-- The distinction the guard was reaching for is already carried, exactly
-- and by the owner, in `return_to_origin`:
--
--   one-way ending at a home  → a relocation
--   round trip ending at home → a visit somewhere that is, or became, home
--
-- Both are legitimate history. A hard refusal keyed on present type is
-- the system overruling the owner about their own past, which this
-- project avoids everywhere else — ordering, significance and time are
-- all owner assertions. If a mis-picked destination is a concern, that
-- is a CONFIRMATION in the UI, not a database exception.
--
-- WHAT REMAINS ENFORCED — the integrity checks, untouched:
--   * the pin must belong to the user
--   * it must be a globe pin (or a `lived_at` relationship)
--   * `add_trip_stop` still refuses the destination as an itinerary stop
--     ("the destination is the turnaround, not an itinerary stop") — that
--     is about a trip's own internal shape, not about a pin's type, and
--     it stays correct.
--
-- SAFETY
--   * `p_allow_spine` existed ONLY for this rule. Exactly one of four
--     call sites ever passed `false`. It is removed rather than left
--     inert, so no reader later mistakes it for a live control.
--   * Removing it changes `validate_trip_pin`'s signature, so it is
--     DROPped and recreated. Its three callers keep THEIR signatures, so
--     they are plain replaces — no orphan-overload risk for them, and
--     the proof asserts one `validate_trip_pin` remains.
--   * NO existing row is read or written. This migration redefines
--     functions only. The Fiat 128 remodel is a separate, separately
--     approved step.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. validate_trip_pin — signature change, so DROP first ────────────
DROP FUNCTION IF EXISTS validate_trip_pin(UUID, UUID, BOOLEAN);

CREATE FUNCTION validate_trip_pin(
    p_relationship_id UUID,
    p_user_id         UUID
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
    -- The spine refusal that used to live here is gone. A trip may end at
    -- a home: one-way makes it a relocation, round trip makes it a visit
    -- to a place that is or became home. `return_to_origin` carries the
    -- distinction, asserted by the owner.
END;
$$;

-- ── 2. Callers — signatures unchanged, plain replaces ─────────────────

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
    PERFORM validate_trip_pin(p_destination_relationship_id, p_user_id);
    IF p_origin_relationship_id IS NOT NULL THEN
        PERFORM validate_trip_pin(p_origin_relationship_id, p_user_id);
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
        PERFORM validate_trip_pin(p_origin_relationship_id, p_user_id);
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
    -- Retained: this is about the trip's OWN shape, not a pin's type.
    IF p_relationship_id = v_trip.destination_relationship_id THEN
        RAISE EXCEPTION 'the destination is the turnaround, not an itinerary stop';
    END IF;
    PERFORM validate_trip_pin(p_relationship_id, p_user_id);

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
