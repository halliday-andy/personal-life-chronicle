-- 2026-06-04 — Step 7 prep (Task #86): memories.authored_by_actor
--
-- Found 2026-06-04 during Andy's investigation of an unfamiliar
-- Apollo 11 entity on /entities. The underlying memory was a typed
-- submission from 2026-05-26 during Step 6f verification that Andy
-- didn't recall writing — most likely a test submission Claude made
-- while demonstrating the capture flow.
--
-- The schema had no way to distinguish owner-authored text from
-- agent-authored-on-behalf text:
--   memories.source              → input modality (text/audio/SMS)
--   memories.metadata.created_by → which agent ran create_memory tool
--   neither attributes the authoring actor
--
-- This column closes the gap. Step 7 will inevitably generate
-- additional test traffic during dev (Claude pinning places, typing
-- modal narratives, exercising the sidekick chat). Without this
-- column, that test data would be indistinguishable from real entries
-- — repeating the Apollo 11 situation at scale.
--
--   'owner'           — the chronicle owner authored this text.
--                       Default for all existing rows and for any
--                       genuine user submission.
--   'assistant_test'  — Claude submitted this during dev (testing
--                       a flow end-to-end, demonstrating UX). MUST
--                       be set explicitly by test-driving code.
--   'contributor'     — Phase 2 contribution-access feature: a card
--                       holder added a memory to the chronicle.
--   'import'          — bulk import from an external source (Phase 2/3).
--
-- All existing rows get backfilled to 'owner'. Andy will re-flag the
-- handful of known-test entries to 'assistant_test' via /memories
-- once the column lands (or we backfill known cases proactively in
-- a follow-up).

BEGIN;

ALTER TABLE memories
    ADD COLUMN authored_by_actor TEXT
    NOT NULL
    DEFAULT 'owner'
    CHECK (authored_by_actor IN ('owner', 'assistant_test', 'contributor', 'import'));

COMMENT ON COLUMN memories.authored_by_actor IS
    'Who authored the source text. owner = chronicle owner (default); assistant_test = Claude during dev; contributor = Phase 2 contribution-access path; import = bulk import. Distinct from source (input modality) and metadata.created_by (which agent ran the tool).';

-- Helpful index for the future /memories UI filter "show only owner-authored"
CREATE INDEX IF NOT EXISTS idx_memories_owner_authored
    ON memories(user_id, created_at DESC)
    WHERE authored_by_actor = 'owner';

COMMIT;
