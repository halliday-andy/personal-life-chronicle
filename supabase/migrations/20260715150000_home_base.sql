-- Home Base (Trips & Travel U7, KTD8 / R16).
--
-- A user with one long-term home designates it as their Home Base so
-- new trips suggest it as origin automatically. A metadata flag on one
-- lived_at relationship — never a pin type, never spine semantics.
-- Additive: one new function; flag writes are scoped to the user's own
-- primaries.

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION set_home_base(
    p_user_id         UUID,
    p_relationship_id UUID  -- NULL clears the home base
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_rel  relationships%ROWTYPE;
    v_code TEXT;
BEGIN
    IF p_relationship_id IS NOT NULL THEN
        SELECT * INTO v_rel FROM relationships WHERE id = p_relationship_id;
        IF v_rel IS NULL OR v_rel.user_id <> p_user_id THEN
            RAISE EXCEPTION 'pin does not belong to user';
        END IF;
        SELECT rt.code INTO v_code FROM relationship_types rt WHERE rt.id = v_rel.type_id;
        IF v_code <> 'lived_at' THEN
            RAISE EXCEPTION 'home base must be a primary residence';
        END IF;
    END IF;

    -- One home base at a time: clear, then set.
    UPDATE relationships SET metadata = metadata - 'home_base'
    WHERE user_id = p_user_id AND metadata ? 'home_base';

    IF p_relationship_id IS NOT NULL THEN
        UPDATE relationships
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('home_base', true)
        WHERE id = p_relationship_id;
    END IF;
END;
$$;
