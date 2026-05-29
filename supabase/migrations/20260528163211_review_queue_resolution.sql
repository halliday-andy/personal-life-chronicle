-- 2026-05-28 — Step 6g-1: Enrich review_queue resolution vocabulary.
--
-- The base schema (initial_schema.sql) shipped review_queue with the
-- PRD §6.3 vocabulary:
--   resolution IN ('accepted', 'modified', 'rejected', 'snoozed')
--
-- That four-value set conflates meaningfully distinct user actions.
-- For an entity_confirmation_needed row, "modified" could mean the
-- user renamed the canonical name, or merged the entity into another
-- one — both legitimate resolutions with very different downstream
-- effects (rename touches one entities row, merge rewires the entity
-- graph). Eval needs to distinguish them.
--
-- This migration replaces the CHECK with a richer six-value vocabulary
-- and adds two columns to capture action-specific payload and the
-- resolution channel.
--
--   resolution            confirmed | renamed | rejected | merged
--                         | deferred | dismissed
--   resolution_payload    JSONB — action-specific data:
--                         confirmed → {}
--                         renamed   → { canonical_name: "...", aliases?: [...] }
--                         merged    → { merged_into_id: uuid }
--                         rejected  → {}
--                         deferred  → { resurface_at: timestamptz }
--                         dismissed → {}
--   resolved_by           TEXT — 'user' | 'system' | 'agent:<name>'
--                         distinguishes a UI click from an automated cleanup
--                         and an agent-proposed auto-resolution
--
-- Vocabulary mapping (old → new) is documented for posterity; no rows
-- carry the old values today so a hard CHECK swap is safe:
--   accepted  → confirmed   (the most common positive resolution)
--   modified  → renamed | merged   (split into two distinct verbs)
--   rejected  → rejected    (unchanged)
--   snoozed   → deferred    (clearer English; same semantics)
--   dismissed is NEW: "this isn't actually a review item, just close it"
--                    distinct from rejected ("no, this is wrong")
--
-- PRD §6.3 (Life_Chronicle_PRD_v1.docx) will be updated in a follow-up
-- task (#64) to reflect this expanded vocabulary alongside the broader
-- Phase 0 reframing.

BEGIN;

-- 1. Swap the resolution CHECK constraint to the richer vocabulary.
ALTER TABLE review_queue DROP CONSTRAINT IF EXISTS review_queue_resolution_check;
ALTER TABLE review_queue ADD CONSTRAINT review_queue_resolution_check
    CHECK (resolution IS NULL OR resolution IN (
        'confirmed',
        'renamed',
        'rejected',
        'merged',
        'deferred',
        'dismissed'
    ));

-- 2. Add resolution_payload for action-specific structured data.
ALTER TABLE review_queue
    ADD COLUMN IF NOT EXISTS resolution_payload JSONB NOT NULL DEFAULT '{}';

-- 3. Add resolved_by to record the resolution channel.
ALTER TABLE review_queue
    ADD COLUMN IF NOT EXISTS resolved_by TEXT;

COMMENT ON COLUMN review_queue.resolution IS
    'Outcome of user review: confirmed | renamed | rejected | merged | deferred | dismissed. NULL while still pending.';
COMMENT ON COLUMN review_queue.resolution_payload IS
    'Action-specific JSON: e.g. {merged_into_id} for merged, {canonical_name, aliases} for renamed, {resurface_at} for deferred. Empty object for confirmed/rejected/dismissed.';
COMMENT ON COLUMN review_queue.resolved_by IS
    'Channel that resolved the item: user (UI click) | system (auto cleanup) | agent:<name> (agent auto-resolution).';

-- 4. Partial index tuned for the /review page list query.
--    The list endpoint groups by item_type and shows newest-surfaced
--    first within each group. The existing idx_review_queue_pending
--    is (user_id, priority) which is good for "what's most urgent
--    overall" but not for the grouped UI.
CREATE INDEX IF NOT EXISTS idx_review_queue_open_by_type
    ON review_queue(user_id, item_type, surfaced_at DESC)
    WHERE resolved_at IS NULL;

COMMIT;
