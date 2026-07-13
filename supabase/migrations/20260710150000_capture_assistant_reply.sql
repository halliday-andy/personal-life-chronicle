-- 2026-07-10 — persist the assistant's reply on every capture submission
--
-- From Andy's Leola-thread QA: interview_sessions keeps full transcripts,
-- but the capture assistant (⌘K) persisted only the USER side — its own
-- replies lived in React state and died on reload, making conversation
-- threads half-reconstructible. Every future exchange keeps both sides.
--
-- Additive only (new nullable column). No data rewrite.

BEGIN;

ALTER TABLE capture_submissions
    ADD COLUMN IF NOT EXISTS assistant_reply TEXT;

COMMENT ON COLUMN capture_submissions.assistant_reply IS
    'The orchestrator''s conversational reply to this submission (2026-07-10). Makes capture threads fully reconstructible, like interview_sessions.transcript.';

COMMIT;
