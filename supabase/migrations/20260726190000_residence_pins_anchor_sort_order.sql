-- Carry anchor_sort_order through get_residence_pins (2026-07-26).
--
-- The Journey tree orders a stop's places by the owner's drag order
-- (relationships.anchor_sort_order, added 20260726180000). The tree is built
-- from get_residence_pins, so the column has to come through the RPC.
--
-- ⚠️ MIGRATION-SAFETY NOTE: this DROPs and recreates a function that is IN USE
-- (the Journey page's only pin source). Postgres cannot change a function's
-- RETURNS TABLE via CREATE OR REPLACE, so a drop is unavoidable. It is
-- additive in effect — one extra column, no signature change for callers, no
-- data touched — and db-apply.mjs runs each migration inside ONE transaction,
-- so a failure rolls back with the old function intact. Flagged for Andy's
-- explicit approval per the CLAUDE.md gate regardless, because the rule names
-- DROP FUNCTION and "when unsure, treat it as destructive and ask".
--
-- Body is byte-identical to 20260715160000_future_places.sql's definition
-- except for the two added lines marked below.

DROP FUNCTION IF EXISTS public.get_residence_pins(uuid);

CREATE FUNCTION public.get_residence_pins(p_user_id uuid)
 RETURNS TABLE(relationship_id uuid, place_entity_id uuid, name text, place_subtype text, description text, lng double precision, lat double precision, when_text text, has_memory boolean, sort_order integer, type_code text, anchor_residence_id uuid, prior_anchor_residence_id uuid, move_reason text, created_at timestamp with time zone, anchor_sort_order integer)  -- ← added
 LANGUAGE sql
 STABLE
AS $function$
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
        r.created_at,
        r.anchor_sort_order   -- ← added
    FROM relationships r
    JOIN entities e            ON e.id = r.object_id
    JOIN relationship_types rt ON rt.id = r.type_id
    WHERE r.user_id = p_user_id
      AND e.type = 'place'
      AND rt.code IN ('lived_at','worked_at','owned_residence_at',
                      'lived_briefly_at','vacationed_at','traveled_for_work_to','logged_at','wants_to_visit')
      AND (rt.code = 'lived_at' OR r.metadata->>'globe_pin' = 'true')
    ORDER BY r.sort_order ASC NULLS LAST, r.created_at ASC;
$function$;
