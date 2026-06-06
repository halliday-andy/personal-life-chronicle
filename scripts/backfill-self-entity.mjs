#!/usr/bin/env node
/**
 * One-time backfill: create the "self" person entity for existing users
 * who predate the registration-time self-entity creation (i.e. Andy's
 * dev account, which bypassed the normal sign-up flow).
 *
 * Idempotent — safe to re-run. Mirrors lib/globe/self-entity.ts
 * ensureSelfEntity (replicated here because this is plain .mjs).
 *
 * Run: node scripts/backfill-self-entity.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(projectRoot, '.env.local'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i).trim()
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// Fallback display name for the dev account if no metadata name is set.
const FALLBACK_NAME = 'Andy Halliday'

const { data: list, error: listErr } = await admin.auth.admin.listUsers()
if (listErr) { console.error('listUsers failed:', listErr.message); process.exit(1) }

if (!list.users.length) { console.log('No users found.'); process.exit(0) }

let created = 0, existed = 0
for (const u of list.users) {
  const displayName =
    u.user_metadata?.full_name?.trim() ||
    u.user_metadata?.name?.trim() ||
    (u.email === 'andrewsbox@gmail.com' ? FALLBACK_NAME : u.email?.split('@')[0]) ||
    'You'

  const { data: existing, error: findErr } = await admin
    .from('entities')
    .select('id, canonical_name')
    .eq('user_id', u.id)
    .eq('type', 'person')
    .eq('metadata->>is_self', 'true')
    .limit(1)
    .maybeSingle()
  if (findErr) { console.error(`find failed for ${u.email}:`, findErr.message); process.exit(1) }

  if (existing) {
    existed++
    console.log(`  • ${u.email} — self entity already exists (${existing.canonical_name}, ${existing.id.slice(0, 8)})`)
    continue
  }

  const { data: ins, error: insErr } = await admin
    .from('entities')
    .insert({ user_id: u.id, type: 'person', canonical_name: displayName, metadata: { is_self: true } })
    .select('id, canonical_name')
    .single()
  if (insErr) { console.error(`insert failed for ${u.email}:`, insErr.message); process.exit(1) }
  created++
  console.log(`  ✓ ${u.email} — created self entity "${ins.canonical_name}" (${ins.id.slice(0, 8)})`)
}

console.log(`\nDone. ${created} created, ${existed} already present.`)
