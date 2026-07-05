#!/usr/bin/env node
/**
 * Proof for Hopper 5a — the memory_stubs data layer
 * (migration 20260705120000_memory_stubs.sql).
 *
 * Asserts (relative-only, against this script's OWN fixtures — the live
 * shared DB has real data):
 *   1. A stub inserts with default status='open'.
 *   2. Consuming sets status='consumed' + consumed_at; reopening clears it.
 *   3. The status CHECK rejects invalid values.
 *   4. merge_entities repoints stubs from source → survivor (the invariant
 *      the migration adds) — no stubs lost on merge.
 *   5. Deleting the host entity cascades its stubs (ON DELETE CASCADE).
 *
 * Creates two TESTSTUB entities + stubs; deletes everything in a finally
 * block. Run: node scripts/verify-memory-stubs.mjs
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

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

async function main() {
  const supabase = createAdminClient()
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com')
  if (!user) { console.error('test user not found'); process.exit(1) }

  const ids: { entities: string[] } = { entities: [] }

  try {
    // ── Fixtures: two host entities ──
    const mk = async (name: string) => {
      const { data, error } = await supabase
        .from('entities')
        .insert({ user_id: user.id, type: 'place', canonical_name: name })
        .select('id')
        .single()
      if (error || !data) throw new Error('fixture insert failed: ' + error?.message)
      ids.entities.push(data.id)
      return data.id as string
    }
    const hostA = await mk('TESTSTUB Host A')
    const hostB = await mk('TESTSTUB Host B (survivor)')

    // ── 1. Insert defaults ──
    const { data: stub, error: insErr } = await supabase
      .from('memory_stubs')
      .insert({ user_id: user.id, host_entity_id: hostA, body: 'the ice-cream truck summer', created_by: 'owner' })
      .select('id, status, consumed_at')
      .single()
    if (insErr || !stub) { bad('stub insert failed: ' + insErr?.message); throw new Error('abort') }
    if (stub.status === 'open' && stub.consumed_at === null) ok("stub inserts open with no consumed_at")
    else bad('unexpected defaults: ' + JSON.stringify(stub))

    // ── 2. Consume + reopen ──
    const { data: consumed } = await supabase
      .from('memory_stubs')
      .update({ status: 'consumed', consumed_at: new Date().toISOString() })
      .eq('id', stub.id)
      .select('status, consumed_at')
      .single()
    if (consumed?.status === 'consumed' && consumed.consumed_at) ok('consume sets status + consumed_at')
    else bad('consume failed: ' + JSON.stringify(consumed))

    const { data: reopened } = await supabase
      .from('memory_stubs')
      .update({ status: 'open', consumed_at: null })
      .eq('id', stub.id)
      .select('status, consumed_at')
      .single()
    if (reopened?.status === 'open' && reopened.consumed_at === null) ok('reopen clears consumed state')
    else bad('reopen failed: ' + JSON.stringify(reopened))

    // ── 3. CHECK constraint ──
    const { error: checkErr } = await supabase
      .from('memory_stubs')
      .insert({ user_id: user.id, host_entity_id: hostA, body: 'x', created_by: 'owner', status: 'someday' })
    if (checkErr) ok('status CHECK rejects invalid values')
    else bad('invalid status was accepted')

    // ── 4. merge_entities repoints stubs ──
    const { error: mergeErr } = await supabase.rpc('merge_entities', {
      p_source_id: hostA,
      p_target_id: hostB,
      p_user_id: user.id,
    })
    if (mergeErr) bad('merge_entities failed: ' + mergeErr.message)
    const { data: afterMerge } = await supabase
      .from('memory_stubs')
      .select('id, host_entity_id')
      .eq('id', stub.id)
      .maybeSingle()
    if (afterMerge?.host_entity_id === hostB) ok('merge repointed the stub onto the survivor')
    else bad('stub lost or unrepointed after merge: ' + JSON.stringify(afterMerge))

    // ── 5. Cascade on host delete ──
    await supabase.from('entities').delete().eq('id', hostB)
    const { data: afterDelete } = await supabase
      .from('memory_stubs')
      .select('id')
      .eq('id', stub.id)
      .maybeSingle()
    if (afterDelete === null) ok('deleting the host entity cascades its stubs')
    else bad('stub survived host deletion')
  } finally {
    // hostA is deleted by the merge, hostB by step 5 — this sweeps any
    // residue if an assertion aborted early.
    await supabase.from('entities').delete().in('id', ids.entities)
    const { data: left } = await supabase
      .from('entities')
      .select('id')
      .ilike('canonical_name', 'TESTSTUB%')
    if ((left ?? []).length === 0) ok('cleanup complete — no TESTSTUB residue')
    else bad('TESTSTUB residue remains: ' + JSON.stringify(left))
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.memory-stubs-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
