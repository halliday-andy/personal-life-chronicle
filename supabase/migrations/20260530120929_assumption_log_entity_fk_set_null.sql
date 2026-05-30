-- 2026-05-30 — Allow spurious-entity reject despite assumption_log audit rows.
--
-- Same class of bug as 20260526211857_assumption_log_memory_fk_set_null.sql:
-- assumption_log.entity_id has a FK to entities(id) with no ON DELETE rule,
-- so the default NO ACTION blocks any attempt to delete an entity that has
-- audit-log entries pointing at it. The Entity Agent writes at least one
-- assumption_log row for every entity it creates (entity_disambiguation
-- typically, plus a relationship_inference row when a new relationship
-- is proposed). That means rejecting a spurious newly-extracted entity
-- via the /review page's "Reject (delete)" action always fails 500
-- against any entity the orchestrator created — i.e., every entity in
-- the system today.
--
-- Fix: change the FK to ON DELETE SET NULL, matching the memory_id fix.
-- The audit row stays — the reasoning trace, model_version, prompt_hash,
-- and decision_json are preserved for posterity — but its entity_id
-- link is nulled when the referenced entity is deleted. This is
-- standard audit-log semantics: preserve the record of decisions even
-- if the artifact they were about is gone.
--
-- Found end-to-end during Step 6g-7 verification, 2026-05-30. Andy
-- attempted to reject the spurious "Leo" entity via the /review page
-- and got a 500 with "Failed to delete entity" three times in a row.
-- The diagnostic script in scripts/diag_reject.mjs confirmed
-- assumption_log was the sole blocker.
--
-- Reference: app/api/review-queue/[id]/resolve/route.ts deleteEntity().
--
-- The broader FK audit (relationships, syntheses, coverage, contacts,
-- interview_sessions all reference entities(id) without ON DELETE
-- rules) is captured as a follow-up task — for MVP no rows in those
-- tables reference user-created entities yet, so they don't block.

ALTER TABLE assumption_log
    DROP CONSTRAINT IF EXISTS assumption_log_entity_id_fkey;

ALTER TABLE assumption_log
    ADD CONSTRAINT assumption_log_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE SET NULL;
