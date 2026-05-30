-- 2026-05-30 — Task #65: FK audit for entities(id) and memories(id).
--
-- We've hit the "no ON DELETE rule = silent block" bug twice in three
-- weeks:
--
--   2026-05-26: assumption_log.memory_id blocked draft Decline.
--               (migration 20260526211857_assumption_log_memory_fk_set_null)
--   2026-05-30: assumption_log.entity_id blocked entity Reject.
--               (migration 20260530120929_assumption_log_entity_fk_set_null)
--
-- Each FK that lacks an ON DELETE rule is a future 500 the first time
-- real data flows through it. This migration sweeps every remaining
-- unrooted FK to entities(id) or memories(id) and assigns a deliberate
-- rule per relationship semantics:
--
--   CASCADE   — row is meaningless without its parent (junction rows,
--               edges that lose meaning when an endpoint dies).
--   SET NULL  — row stands alone but had a useful link; preserve the
--               row for audit/synthesis value, null the broken link.
--   (NO ACTION) — would be the right answer if we genuinely wanted to
--               block parent deletion until children are cleaned up
--               first, but in this schema "delete the parent" is
--               always the user's intentional action; blocking is
--               surprising, not protective.
--
-- The two FKs already fixed (assumption_log.memory_id, assumption_log.
-- entity_id) are NOT re-altered here. The two FKs that already had
-- the right rule shipped (CASCADE on memory_dimensions, memory_entities.
-- memory_id, memory_media, temporal_constraints.subject_memory_id,
-- temporal_resolution_queue.memory_id, memory_periods, entity_media)
-- are also untouched.
--
-- Behaviour change to flag: memory_entities.entity_id moves to CASCADE.
-- This makes the manual `DELETE FROM memory_entities WHERE entity_id = X`
-- in app/api/review-queue/[id]/resolve/route.ts deleteEntity() redundant.
-- That cleanup is removed in the same commit as this migration (since
-- pre-migration the app needed it; post-migration the DB does it).
--
-- Bug found mid-flight 2026-05-30: an earlier draft of this migration
-- listed `stroll_sessions.triggered_by_memory_id` as an FK needing a
-- rule. The column doesn't exist on stroll_sessions — it's
-- `memories.triggered_by_memory_id` (a self-FK from the Stroll feature
-- where new memories link back to the memory that triggered them).
-- The enumeration script's table-tracker drifted across an ALTER
-- TABLE memories block and assigned the column to the wrong parent.
-- Fixed by replacing the bogus stroll_sessions line with the correct
-- memories self-FK ALTER. The transaction wrapper meant the failed
-- attempt left zero schema state behind.

BEGIN;

-- ============================================================
-- ENTITIES(id) referrers
-- ============================================================

-- entities.location_entity_id — self-FK for place hierarchy. Child
-- place (e.g. "Aptos") survives parent place ("California") deletion;
-- it just loses the location_in link.
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_location_entity_id_fkey;
ALTER TABLE entities ADD CONSTRAINT entities_location_entity_id_fkey
    FOREIGN KEY (location_entity_id) REFERENCES entities(id) ON DELETE SET NULL;

-- relationships.subject_id, .object_id — directed edges. An edge with
-- a missing endpoint is broken; remove it.
ALTER TABLE relationships DROP CONSTRAINT IF EXISTS relationships_subject_id_fkey;
ALTER TABLE relationships ADD CONSTRAINT relationships_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES entities(id) ON DELETE CASCADE;

ALTER TABLE relationships DROP CONSTRAINT IF EXISTS relationships_object_id_fkey;
ALTER TABLE relationships ADD CONSTRAINT relationships_object_id_fkey
    FOREIGN KEY (object_id) REFERENCES entities(id) ON DELETE CASCADE;

-- interview_sessions.focus_entity_id — the session log records that an
-- interview happened; the focus entity is metadata. Lose the link,
-- preserve the session record.
ALTER TABLE interview_sessions DROP CONSTRAINT IF EXISTS interview_sessions_focus_entity_id_fkey;
ALTER TABLE interview_sessions ADD CONSTRAINT interview_sessions_focus_entity_id_fkey
    FOREIGN KEY (focus_entity_id) REFERENCES entities(id) ON DELETE SET NULL;

-- memory_entities.entity_id — junction row. Without both ends, it's
-- noise. CASCADE means the app no longer needs to clean memory_entities
-- manually before deleting an entity (the trigger for this migration
-- was exactly that app-level cleanup turning out to be insufficient
-- when assumption_log was the actual blocker).
ALTER TABLE memory_entities DROP CONSTRAINT IF EXISTS memory_entities_entity_id_fkey;
ALTER TABLE memory_entities ADD CONSTRAINT memory_entities_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;

-- syntheses.entity_id — synthesis is expensive computed content (place
-- portrait, relationship portrait, etc.). When the entity goes away,
-- the synthesis text is still valuable as a historical record. Mark
-- it orphaned (is_current=false is the existing staleness signal).
ALTER TABLE syntheses DROP CONSTRAINT IF EXISTS syntheses_entity_id_fkey;
ALTER TABLE syntheses ADD CONSTRAINT syntheses_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE SET NULL;

-- coverage.entity_id — tracks the (dimension, entity) coverage matrix.
-- Without the entity the row has no meaning; the dimension can still
-- be tracked against other entities.
ALTER TABLE coverage DROP CONSTRAINT IF EXISTS coverage_entity_id_fkey;
ALTER TABLE coverage ADD CONSTRAINT coverage_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;

-- contacts.person_entity_id — the contact (Access Cards holder)
-- exists independently; the entity link is enrichment. Lose the link
-- when the entity is deleted.
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_person_entity_id_fkey;
ALTER TABLE contacts ADD CONSTRAINT contacts_person_entity_id_fkey
    FOREIGN KEY (person_entity_id) REFERENCES entities(id) ON DELETE SET NULL;

-- ============================================================
-- MEMORIES(id) referrers
-- ============================================================

-- temporal_constraints.anchor_memory_id — a constraint can be anchored
-- by another memory ("event A was around the same time as event B").
-- If the anchor is deleted, the constraint loses its anchor but may
-- still be re-anchored later. Preserve the constraint metadata.
ALTER TABLE temporal_constraints DROP CONSTRAINT IF EXISTS temporal_constraints_anchor_memory_id_fkey;
ALTER TABLE temporal_constraints ADD CONSTRAINT temporal_constraints_anchor_memory_id_fkey
    FOREIGN KEY (anchor_memory_id) REFERENCES memories(id) ON DELETE SET NULL;

-- stroll_sessions.origin_memory_id — the Stroll session log records that
-- a reminiscence session happened. Preserve the session row, lose the
-- memory link.
ALTER TABLE stroll_sessions DROP CONSTRAINT IF EXISTS stroll_sessions_origin_memory_id_fkey;
ALTER TABLE stroll_sessions ADD CONSTRAINT stroll_sessions_origin_memory_id_fkey
    FOREIGN KEY (origin_memory_id) REFERENCES memories(id) ON DELETE SET NULL;

-- memories.triggered_by_memory_id — self-FK from the Stroll feature
-- (Pathway A: a new memory stub created because the user was reminded
-- of it while reading another memory). If the triggering memory is
-- deleted, the triggered memory survives — it's its own artifact
-- now. Just lose the provenance link.
ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_triggered_by_memory_id_fkey;
ALTER TABLE memories ADD CONSTRAINT memories_triggered_by_memory_id_fkey
    FOREIGN KEY (triggered_by_memory_id) REFERENCES memories(id) ON DELETE SET NULL;

-- reflections.source_memory_id — a reflection is a Pathway B (Stroll)
-- output that becomes wisdom_distillation input. The reflection's text
-- is the artifact; the source memory link is provenance. Preserve the
-- reflection.
ALTER TABLE reflections DROP CONSTRAINT IF EXISTS reflections_source_memory_id_fkey;
ALTER TABLE reflections ADD CONSTRAINT reflections_source_memory_id_fkey
    FOREIGN KEY (source_memory_id) REFERENCES memories(id) ON DELETE SET NULL;

-- memory_revisions.source_memory_id — a revision IS a correction to a
-- specific source memory. Without the source, the revision has nothing
-- to revise; it's not a standalone artifact. CASCADE matches that
-- conceptual ownership.
ALTER TABLE memory_revisions DROP CONSTRAINT IF EXISTS memory_revisions_source_memory_id_fkey;
ALTER TABLE memory_revisions ADD CONSTRAINT memory_revisions_source_memory_id_fkey
    FOREIGN KEY (source_memory_id) REFERENCES memories(id) ON DELETE CASCADE;

-- memory_shares.memory_id — the share event log records that the user
-- shared something on a date with N opens. That audit/analytics value
-- survives the deletion of the underlying memory. The public share
-- endpoint (Step 12) must return 410 Gone when the share's memory_id
-- is NULL — that's a UX requirement on the public surface, not a
-- schema concern.
ALTER TABLE memory_shares DROP CONSTRAINT IF EXISTS memory_shares_memory_id_fkey;
ALTER TABLE memory_shares ADD CONSTRAINT memory_shares_memory_id_fkey
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE SET NULL;

-- contribution_attachments.memory_id — Phase 2 contribution feature.
-- Attachments are auxiliary to the memory they're attached to; without
-- the memory they're contextless. CASCADE.
ALTER TABLE contribution_attachments DROP CONSTRAINT IF EXISTS contribution_attachments_memory_id_fkey;
ALTER TABLE contribution_attachments ADD CONSTRAINT contribution_attachments_memory_id_fkey
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE;

COMMIT;
