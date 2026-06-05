# Step 7 prep checklist — what to do before tomorrow's UI build

**Date written:** 2026-06-04 (Andy stepping away; Claude wrapped prep solo)
**For:** tomorrow's session when we start the residential globe UI build (substep 7a)
**Time required to complete this checklist:** ~10 minutes

---

## 1. Apply the two prep migrations via the Supabase SQL editor

Open `https://supabase.com/dashboard/project/delzsmzovxwfgwetgooi/sql/new` and run each in turn. Both committed to the repo today.

### Migration 1: `20260604215338_step7_prep_lookup_values.sql`

Adds `lived_briefly_at` + `owned_residence_at` to `relationship_types`, and expands `memories.capture_mode` CHECK to allow `'globe_onboarding'`.

```sql
BEGIN;

INSERT INTO relationship_types (code, name, inverse_code, category) VALUES
    ('lived_briefly_at',       'Lived briefly at',       'was_briefly_home_to',     'spatial'),
    ('was_briefly_home_to',    'Was briefly home to',    'lived_briefly_at',        'spatial'),
    ('owned_residence_at',     'Owned residence at',     'was_owned_residence_of',  'spatial'),
    ('was_owned_residence_of', 'Was owned residence of', 'owned_residence_at',      'spatial')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_capture_mode_check;
ALTER TABLE memories ADD CONSTRAINT memories_capture_mode_check
    CHECK (capture_mode IS NULL OR capture_mode IN (
        'stroll', 'interview', 'freeform', 'globe_onboarding'
    ));

COMMIT;
```

**Verify** with:

```sql
SELECT code FROM relationship_types WHERE code LIKE '%resid%' OR code LIKE 'lived%';
-- expect: lived_at, lived_briefly_at, owned_residence_at, plus inverses
```

### Migration 2: `20260604215406_step7_prep_authored_by_actor.sql`

Closes the attribution gap from the Apollo 11 investigation.

```sql
BEGIN;

ALTER TABLE memories
    ADD COLUMN authored_by_actor TEXT
    NOT NULL
    DEFAULT 'owner'
    CHECK (authored_by_actor IN ('owner', 'assistant_test', 'contributor', 'import'));

COMMENT ON COLUMN memories.authored_by_actor IS
    'Who authored the source text. owner = chronicle owner (default); assistant_test = Claude during dev; contributor = Phase 2 contribution-access path; import = bulk import.';

CREATE INDEX IF NOT EXISTS idx_memories_owner_authored
    ON memories(user_id, created_at DESC)
    WHERE authored_by_actor = 'owner';

COMMIT;
```

**Verify** with:

```sql
SELECT authored_by_actor, COUNT(*) FROM memories GROUP BY 1;
-- expect: owner | 9   (all your remaining memories backfilled to owner)
```

The "destructive operations" warning will appear because of the ALTER and DROP CONSTRAINT keywords. Same false positive as past sessions — neither migration touches your memory data.

---

## 2. Provision a Mapbox access token

Required for substep 7a (the Globe base layer).

1. Sign up or log in at `https://account.mapbox.com/`
2. Free tier covers 50,000 map loads/month — well under your usage envelope
3. Create a new public token: `https://account.mapbox.com/access-tokens/` → "Create a token"
4. Default scopes are fine for our use (`styles:read`, `fonts:read`, `tiles:read`, `geocoding:read`)
5. Set a URL restriction to `http://localhost:3001` for development; add `https://<your-prod-domain>` later
6. Add to `.env.local`:
   ```
   NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
   ```
7. Append a trailing newline to `.env.local` (we hit this footgun before — last line gets dropped if there's no newline)

Cost note: free tier covers everything for MVP. If Globe usage explodes past 50k loads/month (≈ 1,700 unique visitors/day for casual viewing), we'd move to a paid tier — but that's a happy problem for later.

---

## 3. Create a Supabase Storage bucket for pin images

Required for substep 7b (the per-pin modal image upload, per PRD v1.1 §4.2 NAV SURFACES MVP).

Dashboard path: `https://supabase.com/dashboard/project/delzsmzovxwfgwetgooi/storage/buckets`

1. Click "New bucket"
2. Name: `pin_images`
3. Public: **off** (we'll serve via signed URLs)
4. File size limit: `5 MB` (matches §10.4 cost envelope)
5. Allowed MIME types: `image/jpeg,image/png,image/webp`
6. Click "Create bucket"

Then add the RLS policies for owner-only access. Open `https://supabase.com/dashboard/project/delzsmzovxwfgwetgooi/sql/new` and run:

```sql
-- Owner can read their own pin images
CREATE POLICY "Owner can read own pin images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'pin_images'
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Owner can upload to their own folder
CREATE POLICY "Owner can upload own pin images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pin_images'
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Owner can delete their own pin images
CREATE POLICY "Owner can delete own pin images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pin_images'
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
```

The path convention these policies enforce: every uploaded object MUST live under `users/<auth.uid()>/...`. The 7b upload code will write to `users/<user_id>/pins/<entity_id>/<filename>` so this matches naturally.

---

## 4. Confirm Claude can read what you've done

When you're back tomorrow, just paste these two outputs into chat and we'll start 7a immediately:

```
[Migration 1 result]: <whatever the dashboard says>
[Migration 2 result]: <whatever the dashboard says>
[Mapbox token added]: yes/no
[Storage bucket created]: yes/no
[Storage policies created]: yes/no
```

You don't need to share the actual token — just confirm it's in `.env.local`. Claude reads it from disk when the dev server starts.

---

## 5. What Claude already did during this session

| Done | Where |
|---|---|
| Wrote both prep migrations as SQL files | `supabase/migrations/2026060421533*` |
| Wrote this checklist | `memory/decision_step7_prep_checklist_2026-06-04.md` (mirror in auto-memory) |
| Pre-created Step 7 substep tasks #87–#96 in the task tracker | Visible at session start tomorrow |
| Verified `entity_media.is_primary` schema (no migration needed for pin images) | `memory/decision_step7_image_storage_2026-06-04.md` |
| Confirmed `residence_type` + `move_reason` live in `relationships.metadata` JSONB (no column add needed) | Schema inspection; matches `life_journey` view convention |
| Updated `LC_Development_Sequence.md` Step 7 with the prep-substep notes | (will be visible at session start) |

---

## Cross-references

- `documentation/feature_residential_globe_onboarding.md` v1.1 — canonical UX spec
- `documentation/Life_Chronicle_PRD.md` v1.1 §3.2, §4.2, §5 Journey 1, §9.2 — product spec
- `memory/decision_step7_image_storage_2026-06-04.md` — schema verification for pin images
- Task #86 (closed by migration 2) — authored_by_actor design rationale
- `LC_Development_Sequence.md` Step 7 — overall build sequence
