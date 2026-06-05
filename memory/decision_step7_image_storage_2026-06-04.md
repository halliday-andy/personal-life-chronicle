# Decision: Step 7 image-on-pin storage — schema verification

**Date:** 2026-06-04
**Status:** Schema ready. No migration needed. Storage bucket setup deferred to Step 7 build itself.
**Closes:** Task #71 (Step 7 pre-work: verify pin image storage schema).
**Source of requirement:** PRD v1.1 §4.2 NAV SURFACES MVP — "single image attachable per residence pin, rendered in the pin card and shown in a modal mini-card that overlays the Globe on pin click."

---

## Findings

### `entity_media` — already has everything we need

```sql
CREATE TABLE entity_media (
    entity_id   UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    media_id    UUID NOT NULL REFERENCES media(id),
    caption     TEXT,
    is_primary  BOOLEAN DEFAULT false,
    PRIMARY KEY (entity_id, media_id)
);
```

The `is_primary` column already exists from the original schema (April 2026). It's exactly the affordance the residence-pin spec needs: a single pin can have multiple linked media rows over time, with one flagged as the primary that the Globe modal renders. No schema change required.

The CASCADE on `entity_id` (added in the FK audit migration `20260530144509`) means deleting a pin auto-clears its media links. The `media` rows themselves survive — the same image could be linked to other entities (e.g. a family portrait that's the primary for several person entities).

### `media` table covers every metadata field Step 7 needs

```sql
CREATE TABLE media (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    type            media_type NOT NULL,    -- 'photo' is in the enum
    uri             TEXT NOT NULL,          -- Supabase Storage URL
    thumbnail_uri   TEXT,                   -- optional, can be lazy-generated
    filename        TEXT,
    mime_type       TEXT,
    file_size_bytes BIGINT,
    duration_secs   INTEGER,                -- (NULL for stills)
    captured_at     DATE,                   -- can be EXIF-extracted
    location_text   TEXT,
    location_lat    FLOAT,
    location_lng    FLOAT,
    transcription   TEXT,
    ocr_text        TEXT,
    embedding       VECTOR(1536),           -- visual semantic search (Phase 2)
    faces_detected  JSONB,                  -- facial recognition (Phase 2)
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

`media_type` enum already includes `'photo'`. All MVP fields covered.

### MVP write pattern (Step 7 will implement)

For each pin image upload:
1. Client uploads file to Supabase Storage bucket at `users/<user_id>/pins/<entity_id>/<filename>` (path convention for natural RLS scoping)
2. Server inserts `media` row: `type='photo'`, `uri=<storage_url>`, `mime_type`, `file_size_bytes`
3. Server inserts `entity_media` row: `(entity_id, media_id, is_primary=true)`

If a second image is uploaded to the same pin, set the new row's `is_primary=true` and update the previous primary to `false` — or, simpler for MVP: enforce one image per pin in the UI, and use the existing `(entity_id, media_id)` primary key to prevent dups.

### Cleanup behaviour confirmed

- Delete pin entity → CASCADE on `entity_media.entity_id` drops the link row; the `media` row survives (could be referenced elsewhere). No orphaned bytes in Storage unless the client deletes the object too.
- Delete a memory that mentioned the pin → no effect on the image; the pin entity persists, the image persists.

---

## Still to do at Step 7 build time (not blocking now)

1. **Storage bucket configuration.** `supabase/config.toml` has the commented-out `[storage.buckets.images]` template; needs uncommenting plus equivalent setup on the cloud instance. Bucket name: `pin_images` (or similar). Public-read off; access via signed URLs or RLS-scoped fetches.

2. **Storage RLS policies.** Two policies needed:
   - Owner can SELECT objects in `users/<their_id>/...`
   - Owner can INSERT objects under `users/<their_id>/...`
   - Owner can DELETE objects under `users/<their_id>/...`

   Cleanest approach: derive the user_id from the `auth.uid()` at policy time, restrict the path prefix to `'users/' || auth.uid()::text || '/'`.

3. **Upload endpoint or direct-upload pattern.** Two options:
   - **Server-side proxy:** `POST /api/entity/[id]/image` accepts multipart, validates ownership, uploads to Storage, inserts media + entity_media rows. Simpler to reason about; one source of truth for validation.
   - **Client-side direct upload:** Client uses the Supabase JS client to upload directly to Storage (RLS-policy-gated), then POSTs to a lightweight `/api/entity/[id]/image` endpoint with just the storage path so the server can insert the `media` and `entity_media` rows.

   Recommend direct upload for performance (no double byte transfer through our server) but the server-proxy version is fine for MVP and gives us one place to enforce file-size and MIME limits.

4. **Image size cap.** Match the §10.4 cost envelope. Suggested limits: 5MB hard cap, with client-side compression targeting 2MB JPEG quality 85.

5. **The Globe modal mini-card.** Separate UI work in Step 7 itself — render the image plus a fact strip on pin click. Reuses the existing `entity_biography` lookup pattern for the place's prose (Phase 2 enrichment).

---

## Cross-reference

- PRD v1.1 §4.2 NAV SURFACES (the requirement)
- `documentation/feature_residential_globe_onboarding.md` §3.2 (per-pin modal UX, dates inline)
- Schema: `supabase/migrations/20260505000000_initial_schema.sql` lines 215–246 (media) and 415–421 (entity_media)
- FK migration: `supabase/migrations/20260530144509_fk_on_delete_audit.sql` (CASCADE rules that handle pin-deletion ripple)
