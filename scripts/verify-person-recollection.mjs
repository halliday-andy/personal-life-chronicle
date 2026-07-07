#!/usr/bin/env node
/**
 * Proof for Slice 7.3 — person-anchored recollections without a pin.
 *
 * Runs the REAL createPersonAnchoredRecollection from
 * lib/memory/person-recollection.ts against live fixtures.
 *
 * Asserts (own fixtures; live shared DB; self-cleaning):
 *   1. Happy path: memory saves FINAL, content_raw and the when-phrase
 *      stored VERBATIM (never parsed), link role='participant' — never the
 *      load-bearing 'location' (2026-07-07 rule).
 *   2. Empty body rejected (400).
 *   3. Non-person host rejected (400) with no orphan memory left behind.
 *   4. Wrong-owner call rejected (403).
 *   5. The new memory surfaces through the Entity View mention query and
 *      maps to NO pin (→ /memories row anchor fallback).
 *
 * Run: node scripts/verify-person-recollection.mjs
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
import { createPersonAnchoredRecollection } from '${projectRoot}/lib/memory/person-recollection'
import { OwnerEditError } from '${projectRoot}/lib/memory/owner-edit'
import { mapMentionsToPins, PIN_TYPE_CODES } from '${projectRoot}/lib/entity/mention-pins'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

const WHEN = 'the summer we painted the boat, maybe 1982?'
const BODY = 'TESTPREC we spent a whole July sanding the hull and talking.'

async function main() {
  const admin = createAdminClient()
  const { data: users } = await admin.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]

  const memories: string[] = []
  const entities: string[] = []

  try {
    const { data: person, error: pe } = await admin.from('entities')
      .insert({ user_id: user.id, type: 'person', canonical_name: 'TESTPREC Friend' })
      .select('id').single()
    if (pe || !person) throw new Error('person fixture failed: ' + pe?.message)
    entities.push(person.id)

    // ── 1. Happy path ──
    const res = await createPersonAnchoredRecollection(admin, user.id, person.id, BODY, WHEN)
    memories.push(res.memory.id)
    if (res.memory.content_raw === BODY && res.memory.occurred_at_fuzzy === WHEN)
      ok('content and when-phrase stored verbatim (never parsed)')
    else bad('verbatim violated: ' + JSON.stringify(res.memory))
    if (res.memory.is_draft === false) ok('saves FINAL (owner-authored; edits go through revisions)')
    else bad('saved as draft')
    if (res.link.role === 'participant') ok("link role='participant' — never the pin discriminator 'location'")
    else bad('wrong link role: ' + res.link.role)

    // ── 2. Empty body ──
    try {
      await createPersonAnchoredRecollection(admin, user.id, person.id, '   ', null)
      bad('empty body was accepted')
    } catch (e) {
      if (e instanceof OwnerEditError && e.status === 400) ok('empty body rejected (400)')
      else bad('empty body wrong error: ' + (e as Error).message)
    }

    // ── 3. Non-person host + no orphan ──
    const { data: place, error: ple } = await admin.from('entities')
      .insert({ user_id: user.id, type: 'place', canonical_name: 'TESTPREC Place' })
      .select('id').single()
    if (ple || !place) throw new Error('place fixture failed: ' + ple?.message)
    entities.push(place.id)
    try {
      await createPersonAnchoredRecollection(admin, user.id, place.id, 'TESTPREC should not save', null)
      bad('non-person host was accepted')
    } catch (e) {
      if (e instanceof OwnerEditError && e.status === 400) ok('non-person host rejected (400)')
      else bad('non-person host wrong error: ' + (e as Error).message)
    }
    const { data: orphans } = await admin.from('memories')
      .select('id').eq('user_id', user.id).ilike('content_raw', 'TESTPREC should not save%')
    if ((orphans ?? []).length === 0) ok('no orphan memory left by the rejected call')
    else { bad('orphan memory persisted'); for (const o of orphans!) memories.push(o.id) }

    // ── 4. Wrong owner ──
    try {
      await createPersonAnchoredRecollection(admin, '00000000-0000-0000-0000-000000000001', person.id, 'x', null)
      bad('wrong-owner call was accepted')
    } catch (e) {
      if (e instanceof OwnerEditError && e.status === 403) ok('wrong-owner call rejected (403)')
      else bad('wrong-owner wrong error: ' + (e as Error).message)
    }

    // ── 5. Mention query surfaces it; maps to NO pin ──
    const { data: linkRows } = await admin.from('memory_entities')
      .select('memory_id').eq('entity_id', person.id)
    const mentioned = (linkRows ?? []).some((l: any) => l.memory_id === res.memory.id)
    const { data: locLinks } = await admin.from('memory_entities')
      .select('memory_id, entity_id').eq('memory_id', res.memory.id).eq('role', 'location')
    const map = mapMentionsToPins((locLinks ?? []) as any, [])
    if (mentioned && !map.has(res.memory.id))
      ok('surfaces as a mention and maps to no pin (→ /memories row anchor)')
    else bad('mention/pin mapping wrong: mentioned=' + mentioned + ' pinned=' + map.has(res.memory.id))
  } catch (e) {
    bad(e instanceof Error ? e.message : String(e))
  } finally {
    for (const id of memories) {
      await admin.from('memory_entities').delete().eq('memory_id', id)
      await admin.from('memories').delete().eq('id', id)
    }
    for (const id of entities) {
      await admin.from('memory_entities').delete().eq('entity_id', id)
      await admin.from('entities').delete().eq('id', id)
    }
    const { data: leftE } = await admin.from('entities').select('id').ilike('canonical_name', 'TESTPREC%')
    const { data: leftM } = await admin.from('memories').select('id').eq('user_id', user.id).ilike('content_raw', 'TESTPREC%')
    if ((leftE ?? []).length === 0 && (leftM ?? []).length === 0) ok('cleanup complete — no TESTPREC residue')
    else bad('TESTPREC residue remains')
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.person-recollection-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
