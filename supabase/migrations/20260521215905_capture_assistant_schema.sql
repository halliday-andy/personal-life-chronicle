-- 2026-05-21 — Step 6d schema deltas for the Capture Assistant + Orchestrator.
--
-- Six related changes that together make the orchestrator's output
-- traceable, the private-notes layer real, and the followup tools
-- (add_to_backlog, flag_for_private_notes, orchestrator_reasoning audit
-- logging) work against actual persistence targets.
--
-- Reference:
--   documentation/feature_capture_assistant.md §10
--   memory/project_lc_build_progress.md (Step 6a + 6b verification followups)

-- ────────────────────────────────────────────────────────────────────────
-- 1. capture_submissions — every distinct submission to the orchestrator.
--    Orchestrator writes one row at the start of each run (status =
--    'processing'), flips it to 'awaiting_review' when it returns
--    proposals, and the eventual Review Queue UI flips it to 'integrated'
--    or 'declined' once the user resolves the proposals.
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE capture_submissions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL,
    submitted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    input_type           TEXT NOT NULL
        CHECK (input_type IN ('typed', 'dictated', 'pasted', 'file_upload', 'voice')),
    input_text           TEXT NOT NULL,
    user_guidance        TEXT,
        -- Optional "what is this?" context provided by the user (spec §4.2)

    source_file_id       UUID,
        -- Forward-anticipated. Nullable until file upload ships post-MVP.
        -- Will FK to media(id) when that link is appropriate.

    orchestrator_run_id  UUID,
        -- Correlates with assumption_log entries from this submission's run.
        -- For MVP we set this equal to capture_submissions.id for simplicity.

    status               TEXT NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'awaiting_review', 'integrated', 'declined')),

    metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_capture_submissions_user_recent
    ON capture_submissions (user_id, submitted_at DESC);
CREATE INDEX idx_capture_submissions_status
    ON capture_submissions (user_id, status)
    WHERE status IN ('processing', 'awaiting_review');

COMMENT ON TABLE capture_submissions IS
    'Every user submission to the orchestrator. Lineage anchor for memories, entity proposals, and constraints produced from a single input.';

-- ────────────────────────────────────────────────────────────────────────
-- 2. memories.private_notes — owner-only commentary layer.
--    Per Andy 2026-05-17: a card shared via the Family card may still
--    contain things the user wants kept private (honest assessments,
--    drafts, second thoughts). This is a content-layer split, NOT
--    another Access Card tier.
--
--    Enforcement happens in viewer_can_access() (Step 13) — column-level
--    filter that omits private_notes for non-owner viewers regardless of
--    Access Card grants.
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE memories ADD COLUMN private_notes TEXT;

COMMENT ON COLUMN memories.private_notes IS
    'Owner-only commentary on this memory. Filtered out of non-owner projections by viewer_can_access() regardless of Access Card grants. Append-only in practice — the orchestrator appends, never overwrites.';

-- ────────────────────────────────────────────────────────────────────────
-- 3. memories.source_submission_id — back-link to the capture submission
--    that produced this memory. Lets the Review Queue group all memories
--    from one paste, lets us audit "which submission produced what?"
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE memories
    ADD COLUMN source_submission_id UUID REFERENCES capture_submissions(id);

CREATE INDEX idx_memories_submission
    ON memories (source_submission_id)
    WHERE source_submission_id IS NOT NULL;

COMMENT ON COLUMN memories.source_submission_id IS
    'The capture_submissions row that produced this memory via the orchestrator.';

-- ────────────────────────────────────────────────────────────────────────
-- 4. memory_source enum — add 'external_witness_account' for future
--    source ingestion (third-party transcripts where the speaker is not
--    the chronicle owner). Forward-anticipated; reserved now to avoid a
--    future migration when source-ingestion lands.
-- ────────────────────────────────────────────────────────────────────────

ALTER TYPE memory_source ADD VALUE IF NOT EXISTS 'external_witness_account';

-- ────────────────────────────────────────────────────────────────────────
-- 5. assumption_log.assumption_type — extend CHECK with three new values
--    used by the orchestrator and the globe modal extractor.
--
--    Closes followup task #21.
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE assumption_log DROP CONSTRAINT IF EXISTS assumption_log_assumption_type_check;
ALTER TABLE assumption_log ADD CONSTRAINT assumption_log_assumption_type_check
    CHECK (assumption_type IN (
        'entity_disambiguation',
        'dimension_assignment',
        'temporal_inference',
        'entity_merge',
        'synthesis_source',
        'geocoding_resolution',
        'orchestrator_reasoning',
        'orchestrator_dispatch',
        'globe_modal_extraction',
        'other'
    ));

-- ────────────────────────────────────────────────────────────────────────
-- 6. review_queue.item_type — extend CHECK with two new values used by
--    the orchestrator (add_to_backlog tool and the broader proposal flow).
--
--    Closes followup task #24 (combined with the tools.ts update).
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE review_queue DROP CONSTRAINT IF EXISTS review_queue_item_type_check;
ALTER TABLE review_queue ADD CONSTRAINT review_queue_item_type_check
    CHECK (item_type IN (
        'entity_merge_proposal',
        'entity_confirmation_needed',
        'temporal_constraint',
        'sensitive_promotion',
        'synthesis_stale',
        'contribution_review',
        'assumption_review',
        'memory_elaboration_needed',
        'orchestrator_proposal'
    ));
