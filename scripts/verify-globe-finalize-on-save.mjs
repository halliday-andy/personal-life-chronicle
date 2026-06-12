#!/usr/bin/env node
/**
 * Proof for 20260613120000_globe_finalize_on_save.sql — globe
 * recollections finalize on save (Andy's option 1, 2026-06-13).
 *
 * Asserts on a temp pin:
 *   1. create_residence_pin writes the memory final (is_draft=false)
 *   2. an edit on the finalized memory writes a memory_revisions row
 *      (Raw Vault path unchanged)
 *   3. legacy-draft path: a draft memory saved via update_residence_pin
 *      finalizes in place WITHOUT a revision for the finalizing save
 *   4. backfill check: no globe_onboarding drafts remain anywhere
 *      (relative-safe: asserts a property the migration guarantees)
 *
 * Non-destructive: temp pin deleted at the end.
 * Run: node scripts/verify-globe-finalize-on-save.mjs
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
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let failures = 0
const ok = (m) => console.log(`  ✓ ${m}`)
const bad = (m) => { console.error(`  ✗ ${m}`); failures++ }

console.log('Globe finalize-on-save proof\n')

const { data: users } = await admin.auth.admin.listUsers()
const user = users.users.find((u) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
const { data: self } = await admin.from('entities').select('id')
  .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
if (!self) { bad('no self entity'); process.exit(1) }

let relId = null
try {
  // 1. Create → final
  const { data: pin, error: ce } = await admin.rpc('create_residence_pin', {
    p_user_id: user.id, p_self_entity_id: self.id, p_lng: 24.94, p_lat: 60.17,
    p_name: 'TESTPIN finalize', p_place_subtype: 'city', p_country_code: 'XX',
    p_when_text: 'test era', p_body_text: 'FINALIZE-TEST original recollection.', p_position: null,
  })
  if (ce) throw new Error('create: ' + ce.message)
  const row = Array.isArray(pin) ? pin[0] : pin
  relId = row.relationship_id
  const memId = row.memory_id

  const { data: m1 } = await admin.from('memories').select('is_draft').eq('id', memId).single()
  if (m1.is_draft === false) ok('created memory is final (is_draft=false)')
  else bad('created memory is still a draft')

  // 2. Edit finalized → revision written
  const { error: u1 } = await admin.rpc('update_residence_pin', {
    p_relationship_id: relId, p_user_id: user.id, p_lng: null, p_lat: null,
    p_name: null, p_place_subtype: null, p_country_code: null,
    p_when_text: 'test era', p_body: 'FINALIZE-TEST edited recollection.',
  })
  if (u1) throw new Error('update1: ' + u1.message)
  const { data: revs1 } = await admin.from('memory_revisions')
    .select('id').eq('source_memory_id', memId)
  if ((revs1 ?? []).length === 1) ok('edit on finalized memory wrote exactly one revision')
  else bad(`expected 1 revision, found ${(revs1 ?? []).length}`)

  // 3. Legacy-draft path: force draft, save → finalized in place, no new revision
  await admin.from('memories').update({ is_draft: true }).eq('id', memId)
  const { error: u2 } = await admin.rpc('update_residence_pin', {
    p_relationship_id: relId, p_user_id: user.id, p_lng: null, p_lat: null,
    p_name: null, p_place_subtype: null, p_country_code: null,
    p_when_text: 'test era', p_body: 'FINALIZE-TEST draft-finalizing save.',
  })
  if (u2) throw new Error('update2: ' + u2.message)
  const { data: m2 } = await admin.from('memories').select('is_draft, content_raw').eq('id', memId).single()
  const { data: revs2 } = await admin.from('memory_revisions')
    .select('id').eq('source_memory_id', memId)
  if (m2.is_draft === false && m2.content_raw === 'FINALIZE-TEST draft-finalizing save.') {
    ok('legacy draft finalized in place on save')
  } else bad('legacy draft not finalized correctly: ' + JSON.stringify(m2))
  if ((revs2 ?? []).length === 1) ok('finalizing save wrote NO additional revision')
  else bad(`expected revisions to stay at 1, found ${(revs2 ?? []).length}`)

  // 4. Backfill property: zero globe drafts exist
  const { count } = await admin.from('memories')
    .select('*', { count: 'exact', head: true })
    .eq('capture_mode', 'globe_onboarding').eq('is_draft', true)
  if ((count ?? 0) === 0) ok('no globe_onboarding drafts remain (backfill + new behavior)')
  else bad(`${count} globe drafts still exist`)
} catch (e) {
  bad(e.message)
} finally {
  if (relId) {
    await admin.rpc('delete_residence_pin', { p_relationship_id: relId, p_user_id: user.id })
  }
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
