#!/usr/bin/env node
/**
 * Proof for convert-memory-to-context (2026-07-10) —
 * lib/memory/convert-context.ts, via the REAL function.
 *
 * Asserts (own fixtures; live shared DB; self-cleaning):
 *   1. Happy path: verbatim text becomes an entity_context_notes row with
 *      the chosen visibility; the memory row (and its links) are gone.
 *   2. A globe pin's own overview (capture_mode='globe_onboarding') is
 *      REFUSED — converting it would strip the pin.
 *   3. A memory carrying private_notes is REFUSED — no silent destruction
 *      of the owner-only layer.
 *   4. Wrong-owner call refused; nothing persisted in any refusal case.
 *
 * Run: node scripts/verify-convert-memory-context.mjs
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
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

const runnerSrc = `
import { createAdminClient } from '${projectRoot}/lib/supabase/admin'
import { convertMemoryToContext } from '${projectRoot}/lib/memory/convert-context'
import { OwnerEditError } from '${projectRoot}/lib/memory/owner-edit'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

const RESEARCH = 'TESTCONV During the time of the clan, historical references describe the region as contested borderland.'

async function main() {
  const admin = createAdminClient()
  const { data: users } = await admin.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
  const { data: self } = await admin.from('entities').select('id')
    .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
  const rel = (row: any) => (Array.isArray(row) ? row[0] : row)

  const entities: string[] = []
  const memories: string[] = []
  const pins: string[] = []
  const notes: string[] = []

  try {
    const { data: place } = await admin.from('entities')
      .insert({ user_id: user.id, type: 'place', canonical_name: 'TESTCONV Castle' })
      .select('id').single()
    entities.push(place!.id)

    // ── 1. Happy path ──
    const { data: mem } = await admin.from('memories')
      .insert({ user_id: user.id, content_raw: RESEARCH, source: 'text_entry', is_draft: false })
      .select('id').single()
    memories.push(mem!.id)
    await admin.from('memory_entities').insert({ memory_id: mem!.id, entity_id: place!.id, role: 'subject' })

    const res = await convertMemoryToContext(admin, user.id, mem!.id, place!.id, 'shareable')
    notes.push(res.note.id)
    const { data: noteRow } = await admin.from('entity_context_notes')
      .select('body, visibility, created_by').eq('id', res.note.id).single()
    if (noteRow?.body === RESEARCH && noteRow.visibility === 'shareable' && noteRow.created_by === 'owner')
      ok('verbatim text became a shareable owner context note')
    else bad('note wrong: ' + JSON.stringify(noteRow)?.slice(0, 100))
    const { data: memGone } = await admin.from('memories').select('id').eq('id', mem!.id).maybeSingle()
    const { data: linksGone } = await admin.from('memory_entities').select('memory_id').eq('memory_id', mem!.id)
    if (!memGone && (linksGone ?? []).length === 0) ok('memory row and its links are gone')
    else bad('memory or links survived conversion')

    // ── 2. Pin overview refused ──
    const { data: pd } = await admin.rpc('create_residence_pin', {
      p_user_id: user.id, p_self_entity_id: self!.id, p_lng: 5, p_lat: 44,
      p_name: 'TESTCONV Pin', p_place_subtype: 'city', p_country_code: 'XX',
      p_when_text: null, p_body_text: 'TESTCONV the pin overview text', p_position: null,
      p_type_code: 'logged_at', p_anchor_residence_id: null,
    })
    pins.push(rel(pd).relationship_id)
    try {
      await convertMemoryToContext(admin, user.id, rel(pd).memory_id, place!.id, 'shareable')
      bad('pin overview was converted — the pin would be stripped')
    } catch (e) {
      if (e instanceof OwnerEditError && e.status === 400) ok('pin overview refused (400)')
      else bad('pin overview wrong error: ' + (e as Error).message)
    }

    // ── 3. private_notes refused ──
    const { data: mem2 } = await admin.from('memories')
      .insert({ user_id: user.id, content_raw: 'TESTCONV research two', source: 'text_entry', is_draft: false, private_notes: 'secret' })
      .select('id').single()
    memories.push(mem2!.id)
    try {
      await convertMemoryToContext(admin, user.id, mem2!.id, place!.id, 'private')
      bad('memory with private_notes was converted')
    } catch (e) {
      if (e instanceof OwnerEditError && e.status === 400) ok('private_notes memory refused (400)')
      else bad('private_notes wrong error: ' + (e as Error).message)
    }

    // ── 4. Wrong owner ──
    try {
      await convertMemoryToContext(admin, '00000000-0000-0000-0000-000000000001', mem2!.id, place!.id, 'shareable')
      bad('wrong-owner call was accepted')
    } catch (e) {
      if (e instanceof OwnerEditError && e.status === 403) ok('wrong-owner refused (403)')
      else bad('wrong-owner wrong error: ' + (e as Error).message)
    }
    const { data: noteCount } = await admin.from('entity_context_notes').select('id').eq('entity_id', place!.id)
    if ((noteCount ?? []).length === 1) ok('refusals persisted nothing — exactly one note exists')
    else bad('unexpected note count: ' + (noteCount ?? []).length)
  } catch (e) {
    bad(e instanceof Error ? e.message : String(e))
  } finally {
    for (const id of pins) {
      try { await admin.rpc('delete_residence_pin', { p_relationship_id: id, p_user_id: user.id }) } catch { /* */ }
    }
    for (const id of memories) {
      await admin.from('memory_entities').delete().eq('memory_id', id)
      await admin.from('memories').delete().eq('id', id)
    }
    for (const id of notes) await admin.from('entity_context_notes').delete().eq('id', id)
    const { data: strays } = await admin.from('entities').select('id').ilike('canonical_name', 'TESTCONV%')
    for (const e of strays ?? []) {
      await admin.from('entity_context_notes').delete().eq('entity_id', e.id)
      await admin.from('memory_entities').delete().eq('entity_id', e.id)
      await admin.from('relationships').delete().eq('object_id', e.id)
      await admin.from('entities').delete().eq('id', e.id)
    }
    const { data: left } = await admin.from('entities').select('id').ilike('canonical_name', 'TESTCONV%')
    if ((left ?? []).length === 0) ok('cleanup complete — no TESTCONV residue')
    else bad('TESTCONV residue remains')
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.convert-context-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
