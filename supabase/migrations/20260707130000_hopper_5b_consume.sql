-- 2026-07-07 — Hopper 5b: consume lineage (Slice 7.4)
--
-- When the capture assistant consumes a stub by interviewing it into a
-- real recollection, the stub records WHICH memory it became. Pure
-- lineage: the hopper UI can link "written ✓" to the recollection, and a
-- reopened stub keeps its history. ON DELETE SET NULL — deleting the
-- memory never resurrects or destroys the stub.
--
-- Additive only (new nullable column). No data rewrite.

BEGIN;

ALTER TABLE memory_stubs
    ADD COLUMN IF NOT EXISTS consumed_by_memory_id UUID
        REFERENCES memories(id) ON DELETE SET NULL;

COMMENT ON COLUMN memory_stubs.consumed_by_memory_id IS
    'The memory this stub was written up into when the assistant consumed it (Hopper 5b). NULL for open stubs and manual check-offs.';

COMMIT;
