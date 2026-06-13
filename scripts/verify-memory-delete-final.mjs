#!/usr/bin/env node
/**
 * Proof for finalised-memory deletion (owner curation, 2026-06-13).
 *
 * The DELETE /api/memory/[id] route now permits removing a finalised
 * memory when ?confirm=final is passed. This proves the DB-level cascade
 * the route relies on: deleting a memory row removes its memory_entities,
 * memory_dimensions, and memory_revisions children, while the linked
 * ENTITIES survive (they may be referenced by other memories).
 *
 * Non-destructive to real data: builds its own throwaway finalised
 * memory with children, deletes it, asserts the cascade, cleans up the
 * fixture entity.
 *
 * Run: node scripts/verify-memory-delete-final.mjs
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

console.log('Finalised-memory delete cascade proof\n')

const { data: users } = await admin.auth.admin.listUsers()
const user = users.users.find((u) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]

let memId = null
let entId = null
try {
  // Fixture: a finalised memory + an entity link + a dimension link + a revision.
  const { data: mem, error: me } = await admin.from('memories').insert({
    user_id: user.id, content_raw: 'DELETE-FINAL-TEST throwaway recollection.',
    source: 'text_entry', is_draft: false,
  }).select('id').single()
  if (me) throw new Error('memory insert: ' + me.message)
  memId = mem.id

  const { data: ent, error: ee } = await admin.from('entities').insert({
    user_id: user.id, type: 'concept', canonical_name: 'DELETE-FINAL-TEST concept',
  }).select('id').single()
  if (ee) throw new Error('entity insert: ' + ee.message)
  entId = ent.id

  await admin.from('memory_entities').insert({ memory_id: memId, entity_id: entId, role: 'object', is_primary: false })
  const { data: dims } = await admin.from('dimensions').select('id').limit(1)
  if (dims?.[0]) await admin.from('memory_dimensions').insert({ memory_id: memId, dimension_id: dims[0].id, weight: 0.5 })
  await admin.from('memory_revisions').insert({
    user_id: user.id, source_memory_id: memId, revision_type: 'factual_correction',
    original_excerpt: 'old', revised_content: 'new', user_note: 'test',
  })

  // Count children before.
  const before = await Promise.all([
    admin.from('memory_entities').select('*', { count: 'exact', head: true }).eq('memory_id', memId),
    admin.from('memory_dimensions').select('*', { count: 'exact', head: true }).eq('memory_id', memId),
    admin.from('memory_revisions').select('*', { count: 'exact', head: true }).eq('source_memory_id', memId),
  ])
  if ((before[0].count ?? 0) >= 1 && (before[2].count ?? 0) >= 1) ok('fixture has entity-link + revision children')
  else bad('fixture children missing')

  // Delete the memory (what the route does after the confirm gate).
  const { error: de } = await admin.from('memories').delete().eq('id', memId)
  if (de) throw new Error('delete: ' + de.message)

  // Cascade assertions.
  const after = await Promise.all([
    admin.from('memory_entities').select('*', { count: 'exact', head: true }).eq('memory_id', memId),
    admin.from('memory_dimensions').select('*', { count: 'exact', head: true }).eq('memory_id', memId),
    admin.from('memory_revisions').select('*', { count: 'exact', head: true }).eq('source_memory_id', memId),
  ])
  if ((after[0].count ?? 0) === 0) ok('memory_entities cascaded')
  else bad('memory_entities survived: ' + after[0].count)
  if ((after[1].count ?? 0) === 0) ok('memory_dimensions cascaded')
  else bad('memory_dimensions survived: ' + after[1].count)
  if ((after[2].count ?? 0) === 0) ok('memory_revisions cascaded')
  else bad('memory_revisions survived: ' + after[2].count)

  const { data: entStill } = await admin.from('entities').select('id').eq('id', entId).maybeSingle()
  if (entStill) ok('linked entity survived the memory deletion')
  else bad('linked entity was wrongly deleted')

  const { data: memGone } = await admin.from('memories').select('id').eq('id', memId).maybeSingle()
  if (!memGone) { ok('memory row removed'); memId = null }
  else bad('memory row survived')
} catch (e) {
  bad(e.message)
} finally {
  if (memId) await admin.from('memories').delete().eq('id', memId)
  if (entId) await admin.from('entities').delete().eq('id', entId)
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
