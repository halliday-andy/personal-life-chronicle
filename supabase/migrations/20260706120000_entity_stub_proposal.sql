-- Globe stub resolution — review_queue item type (2026-07-06).
--
-- Globe pin recollections never flowed through the entity pipeline; the
-- extraction agent parks people/organisations as raw name strings in
-- relationships.metadata.globe_extraction (the Slice 2 deferral). The
-- stub-resolution sweep turns each unmatched name into a review-queue
-- proposal ("Rick Toll is mentioned at your Queenstown pin — add him?")
-- with Accept / Link-to-existing / Dismiss — propose-and-confirm, never
-- silent entity creation from finalized memories. Exact canonical/alias
-- matches link directly (a confirmed identity needs no proposal).
--
-- Additive: CHECK-constraint extension only (constraint replacement, no
-- data rewrite — same pattern as the 6d migration). Clears the gate.

SET search_path TO public, extensions;

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
        'orchestrator_proposal',
        'entity_stub_proposal'
    ));
