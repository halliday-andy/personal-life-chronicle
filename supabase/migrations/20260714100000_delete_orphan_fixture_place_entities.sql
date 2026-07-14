-- Delete four orphaned place entities left behind by orchestrator verify
-- scripts before the zero-links cleanup guard existed (added 2026-07-10):
--   Munich, Vienna, Linz  — verify-orchestrator-hopper-loop.mjs, 2026-07-07
--   Stuttgart             — verify-orchestrator-writeup-intent.mjs, 2026-07-09
-- Verified 2026-07-14: zero references in every FK table (memory_entities,
-- assumption_log, review_queue, relationships, entities.location_entity_id,
-- entity_context_notes, entity_media, memory_stubs, interview_sessions,
-- syntheses, coverage, contacts). Approved by Andy 2026-07-14.

DELETE FROM entities
WHERE id IN (
  '05a545f9-4be1-48a8-b722-21ae24a15db1', -- Munich
  '024b8a60-c4eb-4690-b093-d4d9be1d6281', -- Vienna
  '192a6aa6-e261-4d8d-90c7-ed2b1535e42b', -- Linz
  'e2bbacd0-f244-49b1-bbbe-583473deaa48'  -- Stuttgart
);
