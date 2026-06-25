#!/usr/bin/env node
/**
 * Proof for the entity_context_notes data layer (Slice 6.1).
 *
 *   - the table exists; a note can be created, read, and listed per entity;
 *   - merge_entities REPOINTS context notes onto the survivor (the design
 *     flagged that notes would otherwise orphan/disappear on a merge).
 *
 * Relative-only against this script's own fixtures; self-cleaning.
 * Run: node scripts/verify-entity-context-notes.mjs
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

console.log('Entity context notes proof\n')

const { data: users } = await admin.auth.admin.listUsers()
const user = users.users.find((u) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]

const mkEntity = (name) => admin.from('entities')
  .insert({ user_id: user.id, type: 'person', canonical_name: name }).select('id').single()

let A, B, noteId
try {
  A = (await mkEntity('TESTENT ctx A')).data?.id
  B = (await mkEntity('TESTENT ctx B')).data?.id
  if (!A || !B) throw new Error('could not create test entities')

  const { data: note, error: en } = await admin.from('entity_context_notes')
    .insert({ user_id: user.id, entity_id: A, body: 'Founded in 1925; notable for X.', source_label: 'Wikipedia', source_url: 'https://example.org', created_by: 'owner', visibility: 'private' })
    .select('id').single()
  if (en) throw new Error('insert note: ' + en.message)
  noteId = note.id
  ok('context note created on entity A')

  const { data: list } = await admin.from('entity_context_notes').select('id').eq('entity_id', A)
  if ((list ?? []).length === 1) ok('note lists for its entity')
  else bad('expected 1 note for A, got ' + (list ?? []).length)

  // Merge A → B. The note must repoint to B, not orphan/vanish.
  const { error: em } = await admin.rpc('merge_entities', { p_source_id: A, p_target_id: B, p_user_id: user.id })
  if (em) throw new Error('merge: ' + em.message)
  A = null // deleted by the merge

  const { data: after } = await admin.from('entity_context_notes').select('entity_id').eq('id', noteId).maybeSingle()
  if (!after) bad('note vanished after merge (orphaned/deleted)')
  else if (after.entity_id === B) ok('merge repointed the note onto the survivor (B)')
  else bad('note entity_id not repointed: ' + after.entity_id)
} catch (e) {
  bad(e.message)
} finally {
  if (noteId) await admin.from('entity_context_notes').delete().eq('id', noteId)
  // belt-and-suspenders: clear any notes on the fixtures, then the fixtures
  const { data: ents } = await admin.from('entities').select('id').eq('user_id', user.id).like('canonical_name', 'TESTENT ctx %')
  for (const e of ents ?? []) {
    await admin.from('entity_context_notes').delete().eq('entity_id', e.id)
    await admin.from('entities').delete().eq('id', e.id)
  }
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
