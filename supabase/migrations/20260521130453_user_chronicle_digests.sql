-- 2026-05-21 — user_chronicle_digests table (Step 6c)
--
-- Caches the per-user chronicle context digest produced by
-- lib/agents/orchestrator/digest.ts. One row per user. The orchestrator
-- reads this table (via getChronicleDigest) instead of regenerating
-- the digest from live queries on every submission.
--
-- Two invalidation signals:
--   - Event-driven: the chronicle-digester Inngest function listens to
--     memory/ingested + entity/merged and flips is_stale=true
--   - Time-based: rows older than MAX_AGE_MS (5 min, matches Anthropic
--     prompt cache TTL) regenerate lazily on next read
--
-- The digest_hash field gives a stable cache key for Anthropic prompt
-- caching — identical hash = identical Layer B prompt block = cache hit.
--
-- Reference: documentation/feature_capture_assistant.md §4.6.

CREATE TABLE user_chronicle_digests (
    user_id              UUID PRIMARY KEY,
    digest_text          TEXT NOT NULL,
    digest_hash          TEXT NOT NULL,
    generated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generation_version   SMALLINT NOT NULL DEFAULT 1,
    stats                JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_stale             BOOLEAN NOT NULL DEFAULT false
);

COMMENT ON TABLE user_chronicle_digests IS
    'Cached per-user chronicle digest used as Layer B of the Orchestrator Agent prompt. Read-or-regenerate semantics via lib/agents/orchestrator/digest-cache.ts.';

COMMENT ON COLUMN user_chronicle_digests.digest_hash IS
    'Stable hash of the digest_text; used as the prompt-cache key in Anthropic API calls.';

COMMENT ON COLUMN user_chronicle_digests.generation_version IS
    'Bumped when the digest output format changes (forces regeneration of all rows).';

COMMENT ON COLUMN user_chronicle_digests.is_stale IS
    'Set by event-driven invalidation. The next getChronicleDigest call regenerates.';

-- Sweeper-friendly index: scans for rows the cron should regenerate.
CREATE INDEX idx_user_chronicle_digests_stale
    ON user_chronicle_digests (generated_at)
    WHERE is_stale = true;
