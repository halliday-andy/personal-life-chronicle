-- 2026-05-26 — Allow draft-memory deletion despite assumption_log audit trail.
--
-- assumption_log.memory_id has a FK to memories(id) with no ON DELETE rule,
-- which means the default NO ACTION blocks any attempt to delete a memory
-- that has audit entries pointing at it. Every orchestrator-created
-- memory has at least the orchestrator_reasoning row (and often Tagger
-- and Entity entries too) — so the Decline action on a draft proposal
-- card (Step 6f-4) returns 500 in practice.
--
-- Fix: change the FK to ON DELETE SET NULL. The audit row stays — the
-- reasoning trace, model version, prompt hash, and decision_json are
-- preserved for posterity — but its memory_id link is nulled when the
-- referenced memory is deleted. This matches typical audit-log
-- semantics (preserve the record of decisions even if the artifact
-- they were about is gone).
--
-- Found end-to-end during Step 6f verification, 2026-05-26.
-- Reference: app/api/memory/[id]/route.ts DELETE handler.

ALTER TABLE assumption_log
    DROP CONSTRAINT IF EXISTS assumption_log_memory_id_fkey;

ALTER TABLE assumption_log
    ADD CONSTRAINT assumption_log_memory_id_fkey
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE SET NULL;

-- Note: other FKs into memories(id) without ON DELETE rules
-- (temporal_constraints.anchor_memory_id, memory_revisions.source_memory_id,
--  stroll_sessions.origin_memory_id, reflections.source_memory_id,
--  temporal_resolution_queue.memory_id, memory_periods.memory_id,
--  memories.triggered_by_memory_id) will block deletion in other scenarios.
-- They are left alone here because they don't block the Step 6f draft-
-- Decline path. When the user later wants to delete a memory that has
-- those references, we will revisit each case and decide SET NULL vs
-- CASCADE per relationship semantics.
