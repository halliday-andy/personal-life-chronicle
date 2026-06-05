-- 2026-06-04 — Step 7 prep: relationship_types + capture_mode values
--
-- The residential globe onboarding flow (per
-- documentation/feature_residential_globe_onboarding.md) introduces
-- two new place-relationship semantics that aren't in the original
-- relationship_types seed, plus a new capture_mode value for memories
-- created via the pin modal.
--
-- This migration adds:
--
--   1. relationship_types rows:
--      - lived_briefly_at  (inverse: was_briefly_home_to)
--        Spec §4: "side trips" within a longer residency period.
--        Distinct from lived_at because it doesn't anchor primary
--        residential temporal constraints.
--      - owned_residence_at  (inverse: was_owned_residence_of)
--        Spec §4: vacation homes, second residences. Doesn't override
--        primary residence; rendered with distinct visual styling.
--
--      Existing 'lived_at' row is untouched.
--
--   2. memories.capture_mode CHECK expansion to allow
--      'globe_onboarding' alongside the existing 'stroll',
--      'interview', 'freeform'.
--
-- residence_type, residence_subtype, and move_reason are NOT added as
-- columns — they live in relationships.metadata JSONB per the
-- existing convention (see life_journey view in the initial schema,
-- which extracts r.metadata->>'move_reason' and r.metadata->>
-- 'housing_type'). Spec §9 noted "check if columns exist; add if
-- needed"; they don't exist as columns, but the data model already
-- supports them via metadata. Following the established pattern.

BEGIN;

-- ── 1. relationship_types additions ─────────────────────────────

INSERT INTO relationship_types (code, name, inverse_code, category) VALUES
    ('lived_briefly_at',    'Lived briefly at',    'was_briefly_home_to',   'spatial'),
    ('was_briefly_home_to', 'Was briefly home to', 'lived_briefly_at',      'spatial'),
    ('owned_residence_at',  'Owned residence at',  'was_owned_residence_of','spatial'),
    ('was_owned_residence_of', 'Was owned residence of', 'owned_residence_at', 'spatial')
ON CONFLICT (code) DO NOTHING;

-- ── 2. memories.capture_mode CHECK expansion ────────────────────

ALTER TABLE memories
    DROP CONSTRAINT IF EXISTS memories_capture_mode_check;

ALTER TABLE memories
    ADD CONSTRAINT memories_capture_mode_check
    CHECK (capture_mode IS NULL OR capture_mode IN (
        'stroll',
        'interview',
        'freeform',
        'globe_onboarding'   -- NEW: memories created via the residential pin modal
    ));

COMMIT;
