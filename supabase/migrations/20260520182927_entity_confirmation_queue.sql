-- 2026-05-20 — Add 'entity_confirmation_needed' as a review_queue item_type.
--
-- Pattern parallel to face recognition's "Is this Alice?" tap-to-confirm.
-- When the Entity Agent creates a new person entity, it queues a card here
-- so the owner can verify the captured name, edit it, add aliases, or
-- soft-delete a spurious extraction. The Review Queue UI (Step 6g) surfaces
-- these alongside merge proposals and other queue items.
--
-- Reference: documentation/feature_capture_assistant.md substep 6g and
-- memory/project_lc_capture_assistant.md.

ALTER TABLE review_queue DROP CONSTRAINT IF EXISTS review_queue_item_type_check;

ALTER TABLE review_queue ADD CONSTRAINT review_queue_item_type_check
    CHECK (item_type IN (
        'entity_merge_proposal',
        'entity_confirmation_needed',
        'temporal_constraint',
        'sensitive_promotion',
        'synthesis_stale',
        'contribution_review',
        'assumption_review'
    ));

-- Comment for documentation consumers; harmless if it already exists.
COMMENT ON COLUMN review_queue.item_type IS
    'Polymorphic item type. entity_confirmation_needed → item_id references the entities.id row awaiting owner confirmation; context_json carries source memory id, extracted name, and a context quote.';
