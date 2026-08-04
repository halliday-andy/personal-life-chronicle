-- ─────────────────────────────────────────────────────────────────────
-- retarget_trip — change where a trip ENDED (R6 part 2 / finding F6)
--
-- A trip's destination was immutable from creation. `frame_trip` accepts
-- origin, title, when_text, year_hint, subtype, return_to_origin and
-- clear_origin — no destination — and no sibling function supplied one.
--
-- That is severe precisely BECAUSE capture is destination-first (R5): the
-- destination is the very first thing chosen, when the user knows least
-- about the journey's shape. Andy's October 1978 drive was recorded as
-- ending at Wendy's shared apartment because the model would not let it
-- end where it actually ended — SSV Day Lodge Room, with Wendy's as a
-- stop along the way.
--
-- ADDITIVE: a new function, no existing signature touched, nothing
-- dropped. Ungated under CLAUDE.md's migration policy, and shown with its
-- proof regardless.
--
-- ORDER IS LOAD-BEARING. `add_trip_stop` raises "the destination is the
-- turnaround, not an itinerary stop", so the old destination can only
-- become a stop AFTER the repoint has landed. Doing it the other way
-- round fails.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION retarget_trip(
    p_user_id                         UUID,
    p_trip_id                         UUID,
    p_new_destination_relationship_id UUID,
    -- The old destination usually IS the story of the journey — Wendy's
    -- apartment is where the Fiat 128 stopped, not somewhere to discard —
    -- so keeping it as a stop is the default.
    p_demote_old_to_stop              BOOLEAN DEFAULT true
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_trip     trips%ROWTYPE;
    v_old_dest UUID;
    v_new_name TEXT;
BEGIN
    SELECT * INTO v_trip FROM trips WHERE id = p_trip_id;
    IF v_trip IS NULL OR v_trip.user_id <> p_user_id THEN
        RAISE EXCEPTION 'trip does not belong to user';
    END IF;

    -- Ownership + globe-pin integrity. Since 20260803120000 this no
    -- longer refuses a primary residence: a trip may END at a home.
    PERFORM validate_trip_pin(p_new_destination_relationship_id, p_user_id);

    v_old_dest := v_trip.destination_relationship_id;

    -- Idempotent: retargeting to where it already ends changes nothing,
    -- and must not append the destination to its own itinerary.
    IF v_old_dest = p_new_destination_relationship_id THEN
        RETURN;
    END IF;

    -- Promoting an existing STOP to destination: it cannot be both, and
    -- `add_trip_stop` forbids that pairing, so drop the stop row first.
    DELETE FROM trip_stops
    WHERE trip_id = p_trip_id
      AND relationship_id = p_new_destination_relationship_id;

    UPDATE trips
       SET destination_relationship_id = p_new_destination_relationship_id,
           updated_at = NOW()
     WHERE id = p_trip_id;

    -- Now — and only now — the former destination may become a stop.
    -- Routed through add_trip_stop rather than a bare INSERT so the
    -- validation and positioning stay in ONE place.
    IF p_demote_old_to_stop AND v_old_dest IS NOT NULL THEN
        PERFORM add_trip_stop(p_user_id, p_trip_id, v_old_dest, 'outbound', NULL);
    END IF;

    -- An UNTITLED trip's name is derived from its destination, so it
    -- follows the move. A trip the owner titled keeps that title
    -- untouched — "The epic solo road trip in the overloaded Fiat 128"
    -- is Andy's sentence, and a retarget must not overwrite it.
    IF v_trip.title IS NULL THEN
        SELECT e.canonical_name INTO v_new_name
        FROM relationships r JOIN entities e ON e.id = r.object_id
        WHERE r.id = p_new_destination_relationship_id;

        UPDATE entities
           SET canonical_name = 'Trip to ' || v_new_name,
               updated_at     = NOW()
         WHERE id = v_trip.trip_entity_id;
    END IF;
END;
$$;
