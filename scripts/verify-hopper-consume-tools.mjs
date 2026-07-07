#!/usr/bin/env node
/**
 * Proof for Hopper 5b tool handlers (Slice 7.4) — direct dispatch through
 * the REAL executeTool registry (list_memory_stubs / add_memory_stub /
 * consume_memory_stub).
 *
 * Asserts (own fixtures; live shared DB; self-cleaning):
 *   1. list scoped by entity name returns the host's open stubs with ids.
 *   2. list with an unresolvable name errors with candidates — no guess.
 *   3. add persists created_by='assistant' onto the resolved host.
 *   4. add with an unresolvable name persists NOTHING and mints no entity.
 *   5. consume with a bogus memory_id fails; the stub stays open
 *      (words-are-not-actions backing: no recollection, no check-off).
 *   6. consume with a real draft memory flips the stub: status='consumed',
 *      consumed_at set, consumed_by_memory_id = the recollection.
 *   7. double-consume fails (already consumed).
 *
 * Run: node scripts/verify-hopper-consume-tools.mjs
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
import { executeTool } from '${projectRoot}/lib/agents/orchestrator/tools'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

async function main() {
  const supabase = createAdminClient()
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
  const ctx = { user_id: user.id, supabase }

  const entities: string[] = []
  const memories: string[] = []

  try {
    // ── Fixtures: a person with two open jots ──
    const { data: person, error: pe } = await supabase.from('entities')
      .insert({ user_id: user.id, type: 'person', canonical_name: 'TESTHOP Friend' })
      .select('id').single()
    if (pe || !person) throw new Error('person fixture failed: ' + pe?.message)
    entities.push(person.id)
    const { data: stubA } = await supabase.from('memory_stubs')
      .insert({ user_id: user.id, host_entity_id: person.id, body: 'the boat-painting July', created_by: 'owner' })
      .select('id').single()
    await supabase.from('memory_stubs')
      .insert({ user_id: user.id, host_entity_id: person.id, body: 'the midnight diner run', created_by: 'owner' })

    // ── 1. list scoped ──
    const list = await executeTool('list_memory_stubs', { entity_name: 'TESTHOP Friend' }, ctx)
    const stubs = (list.data.stubs ?? []) as any[]
    if (!list.persisted && stubs.length === 2 && stubs.every((s) => s.host_name === 'TESTHOP Friend' && s.stub_id))
      ok('list (scoped) returns the host\\u2019s open stubs with ids')
    else bad('list wrong: ' + JSON.stringify(list.data))

    // ── 2. list unresolvable ──
    const listBad = await executeTool('list_memory_stubs', { entity_name: 'TESTHOP Nobody Whatsoever' }, ctx)
    if (!listBad.persisted && listBad.data.error) ok('list with unresolvable name errors instead of guessing')
    else bad('unresolvable list did not error: ' + JSON.stringify(listBad.data))

    // ── 3. add (resolved) ──
    const add = await executeTool('add_memory_stub', {
      entity_name: 'TESTHOP Friend', body: 'the day the kite got away', rationale: 'user agreed in conversation',
    }, ctx)
    if (add.persisted && add.data.stub_id) {
      const { data: row } = await supabase.from('memory_stubs')
        .select('created_by, host_entity_id, status').eq('id', add.data.stub_id as string).single()
      if (row?.created_by === 'assistant' && row.host_entity_id === person.id && row.status === 'open')
        ok("add persists created_by='assistant' on the resolved host")
      else bad('added stub wrong shape: ' + JSON.stringify(row))
    } else bad('add failed: ' + JSON.stringify(add.data))

    // ── 4. add unresolvable mints nothing ──
    const before = await supabase.from('entities').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    const addBad = await executeTool('add_memory_stub', {
      entity_name: 'TESTHOP Nobody Whatsoever', body: 'x', rationale: 'r',
    }, ctx)
    const after = await supabase.from('entities').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    if (!addBad.persisted && addBad.data.error && before.count === after.count)
      ok('add with unresolvable name persists nothing and mints no entity')
    else bad('unresolvable add misbehaved: ' + JSON.stringify(addBad.data))

    // ── 5. consume with bogus memory_id ──
    const bogus = await executeTool('consume_memory_stub', {
      stub_id: stubA!.id, memory_id: '00000000-0000-0000-0000-000000000002', rationale: 'r',
    }, ctx)
    const { data: stillOpen } = await supabase.from('memory_stubs').select('status').eq('id', stubA!.id).single()
    if (!bogus.persisted && stillOpen?.status === 'open')
      ok('consume without a real recollection fails; stub stays open')
    else bad('bogus consume misbehaved: ' + JSON.stringify(bogus.data))

    // ── 6. consume with a real recollection ──
    const { data: mem } = await supabase.from('memories')
      .insert({ user_id: user.id, content_raw: 'TESTHOP the whole July, written up', source: 'text_entry', is_draft: true })
      .select('id').single()
    memories.push(mem!.id)
    const consume = await executeTool('consume_memory_stub', {
      stub_id: stubA!.id, memory_id: mem!.id, rationale: 'interviewed into a recollection',
    }, ctx)
    const { data: consumed } = await supabase.from('memory_stubs')
      .select('status, consumed_at, consumed_by_memory_id').eq('id', stubA!.id).single()
    if (consume.persisted && consumed?.status === 'consumed' && consumed.consumed_at && consumed.consumed_by_memory_id === mem!.id)
      ok('consume flips the stub and records the recollection it became')
    else bad('consume wrong: ' + JSON.stringify({ payload: consume.data, row: consumed }))

    // ── 7. double-consume ──
    const again = await executeTool('consume_memory_stub', {
      stub_id: stubA!.id, memory_id: mem!.id, rationale: 'r',
    }, ctx)
    if (!again.persisted && again.data.error) ok('double-consume rejected (already consumed)')
    else bad('double-consume was accepted')
  } catch (e) {
    bad(e instanceof Error ? e.message : String(e))
  } finally {
    for (const id of memories) await supabase.from('memories').delete().eq('id', id)
    for (const id of entities) await supabase.from('entities').delete().eq('id', id) // stubs cascade
    const { data: left } = await supabase.from('entities').select('id').ilike('canonical_name', 'TESTHOP%')
    if ((left ?? []).length === 0) ok('cleanup complete — no TESTHOP residue')
    else bad('TESTHOP residue remains')
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.hopper-tools-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
