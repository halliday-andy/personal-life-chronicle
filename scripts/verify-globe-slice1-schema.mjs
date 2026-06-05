#!/usr/bin/env node
/**
 * Slice 1 schema proof — confirms the two Step 7 prep migrations are
 * actually applied to the live DB before any globe code is built.
 *
 * Proves functionally (not by introspection):
 *   1. memories.capture_mode accepts 'globe_onboarding'
 *      (migration 20260604215338) — the insert would fail the CHECK
 *      constraint otherwise.
 *   2. memories.authored_by_actor exists and defaults to 'owner'
 *      (migration 20260604215406) — read back from the inserted row.
 *   3. relationship_types has the new spatial codes
 *      (used from Slice 3, but the migration adds them now).
 *
 * Inserts one throwaway memory row, asserts, then hard-deletes it.
 *
 * Run: node scripts/verify-globe-slice1-schema.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

// Hand-load .env.local (same pattern as the other verify-*.mjs scripts).
for (const line of readFileSync(join(projectRoot, '.env.local'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i).trim()
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// Andy's alpha user id (same constant the other verify scripts use).
const USER_ID = 'b957ab56-8926-4749-b44f-e67831d0afcc'

let failures = 0
const ok = (m) => console.log(`  ✓ ${m}`)
const bad = (m) => { console.error(`  ✗ ${m}`); failures++ }

console.log('Slice 1 schema proof\n')

// ── 1 + 2: functional insert exercising both migrations ───────────────
const { data: inserted, error: insErr } = await supabase
  .from('memories')
  .insert({
    user_id: USER_ID,
    content_raw: 'SLICE1 SCHEMA PROOF — safe to delete',
    source: 'text_entry',
    capture_mode: 'globe_onboarding',
    is_draft: true,
  })
  .select('id, capture_mode, authored_by_actor')
  .single()

if (insErr) {
  bad(`insert with capture_mode='globe_onboarding' failed: ${insErr.message}`)
  bad('→ migration 20260604215338 (capture_mode) likely NOT applied')
} else {
  ok("memories.capture_mode accepts 'globe_onboarding'")
  if (inserted.authored_by_actor === 'owner') {
    ok("memories.authored_by_actor exists and defaults to 'owner'")
  } else {
    bad(`authored_by_actor = ${JSON.stringify(inserted.authored_by_actor)} (expected 'owner')`)
  }
  // Cleanup — hard delete the throwaway row.
  const { error: delErr } = await supabase.from('memories').delete().eq('id', inserted.id)
  if (delErr) bad(`cleanup delete failed (row ${inserted.id} left behind): ${delErr.message}`)
  else ok('throwaway row cleaned up')
}

// ── 3: relationship_types spatial codes (used from Slice 3) ───────────
const { data: relTypes, error: relErr } = await supabase
  .from('relationship_types')
  .select('code')
  .in('code', ['lived_briefly_at', 'owned_residence_at'])

if (relErr) bad(`relationship_types query failed: ${relErr.message}`)
else if (relTypes.length === 2) ok('relationship_types has lived_briefly_at + owned_residence_at')
else bad(`expected 2 spatial relationship_types, found ${relTypes.length}`)

console.log(`\n${failures === 0 ? 'PASS — schema ready for Slice 1' : `FAIL — ${failures} problem(s)`}`)
process.exit(failures === 0 ? 0 : 1)
