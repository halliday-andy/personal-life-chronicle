#!/usr/bin/env node
/**
 * Create (or align) the private `pin_images` Storage bucket — Step 7
 * Slice 2 infra. Idempotent: safe to re-run; updates limits if the
 * bucket already exists.
 *
 * Bucket config follows decision_step7_image_storage_2026-06-04.md:
 * private (no public read — images served via signed URLs), 5MB cap,
 * image MIME types only. Storage RLS policies are NOT needed yet:
 * uploads go through the server proxy (service role) and reads use
 * signed URLs. Add owner-scoped policies if/when client-direct upload
 * lands.
 *
 * Run: node scripts/setup-pin-images-bucket.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(projectRoot, '.env.local'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('='); if (i < 0) continue
  const k = line.slice(0, i).trim(); if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// Keep in sync with lib/globe/pin-image.ts
const BUCKET = 'pin_images'
const config = {
  public: false,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'],
}

const { data: buckets, error: listErr } = await admin.storage.listBuckets()
if (listErr) {
  console.error('Could not list buckets:', listErr.message)
  process.exit(1)
}

if (buckets.some((b) => b.name === BUCKET)) {
  const { error } = await admin.storage.updateBucket(BUCKET, config)
  if (error) {
    console.error(`Bucket "${BUCKET}" exists but update failed:`, error.message)
    process.exit(1)
  }
  console.log(`Bucket "${BUCKET}" already existed — config aligned (private, 5MB, image MIME types).`)
} else {
  const { error } = await admin.storage.createBucket(BUCKET, config)
  if (error) {
    console.error(`Bucket create failed:`, error.message)
    process.exit(1)
  }
  console.log(`Bucket "${BUCKET}" created (private, 5MB, image MIME types).`)
}
