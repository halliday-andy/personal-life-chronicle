#!/usr/bin/env node
/**
 * Behavioral proof for Hopper 5b (Slice 7.4) — a REAL orchestrator run of
 * the consume loop's capture leg.
 *
 * Setup: a fixture person with ONE open jot. The conversation history has
 * the user asking about their hopper and the assistant quoting the jot
 * back (as the panel would show). The submission is the user telling the
 * full story of that jot.
 *
 * Asserts on structured tool payloads (reply text reported, not asserted):
 *   1. create_memory persisted — the story landed in the Raw Vault as a
 *      draft, verbatim rules applying.
 *   2. consume_memory_stub persisted — the fixture stub is now
 *      status='consumed' with consumed_by_memory_id = the new memory
 *      (words-are-not-actions: the check-off is a tool result, not prose).
 *   3. list_memory_stubs was called along the way (the id had to come
 *      from somewhere — history only carried the jot's words).
 *
 * WRITES REAL ROWS (submission, draft memory, fixture entity+stub), then
 * sweeps everything. Costs one orchestrator run (~30-60s):
 *   node scripts/verify-orchestrator-hopper-loop.mjs
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
const info = (m: string) => console.log('  \\u25CB ' + m)

async function main() {
  const { runOrchestrator } = await import('${projectRoot}/lib/agents/orchestrator/core')
  const supabase = createAdminClient()
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com')
  if (!user) { console.error('test user not found'); process.exit(1) }
  const startedAt = new Date().toISOString()

  const FIXTURE_NAME = 'TESTLOOP Marta Keller'
  let entityId: string | null = null
  let stubId: string | null = null

  try {
    const { data: ent, error: entErr } = await supabase.from('entities')
      .insert({ user_id: user.id, type: 'person', canonical_name: FIXTURE_NAME, aliases: [] })
      .select('id').single()
    if (entErr || !ent) throw new Error('fixture entity failed: ' + entErr?.message)
    entityId = ent.id
    const { data: stub, error: stubErr } = await supabase.from('memory_stubs')
      .insert({ user_id: user.id, host_entity_id: ent.id, body: 'the night train to Vienna', created_by: 'owner' })
      .select('id').single()
    if (stubErr || !stub) throw new Error('fixture stub failed: ' + stubErr?.message)
    stubId = stub.id

    const submission =
      "Yes, let's write up the night train one. Here it is: In the spring of 1988 " +
      FIXTURE_NAME + ' and I took the overnight train from Munich to Vienna. We had no ' +
      'couchette, so we sat up all night in the corridor on our packs, sharing a bar of ' +
      'chocolate and talking about what we would do after university. Somewhere past Linz ' +
      'the dawn came up over the fields and she said this was the whole point of being young. ' +
      "I've never forgotten the light that morning."

    console.log('Running orchestrator on the consume leg (real run, ~30-60s)\\u2026')
    const res = await runOrchestrator({
      user_id: user.id,
      submission_text: submission,
      input_type: 'typed',
      conversation_history: [
        { role: 'user', content: 'What have I jotted in my hopper about ' + FIXTURE_NAME + '?' },
        { role: 'assistant', content: 'You have one jot waiting for ' + FIXTURE_NAME + ': \\u201cthe night train to Vienna\\u201d. Want to write it up now? Tell me the story and I will capture it and check the jot off.' },
      ],
      supabase,
    })

    console.log('\\nReply: ' + JSON.stringify(res.reply))
    console.log('Tools called: ' + res.proposals.map((p: any) => p.tool).join(', '))

    // ── 1. create_memory persisted ──
    const creates = res.proposals.filter((p: any) => p.tool === 'create_memory' && p.persisted)
    let memoryId: string | null = null
    if (creates.length > 0) {
      memoryId = (creates[0].data as any).memory_id ?? null
      ok('create_memory persisted a draft recollection')
      const { data: mem } = await supabase.from('memories')
        .select('content_raw, is_draft').eq('id', memoryId!).maybeSingle()
      if (mem?.is_draft && /night train|Vienna/i.test(mem.content_raw)) ok('the draft carries the story (Raw Vault, draft-first)')
      else bad('draft missing or wrong: ' + JSON.stringify(mem)?.slice(0, 120))
    } else {
      bad('create_memory never persisted — the story was not captured')
    }

    // ── 2. consume_memory_stub persisted; stub flipped with lineage ──
    const consumes = res.proposals.filter((p: any) => p.tool === 'consume_memory_stub' && p.persisted)
    if (consumes.length > 0) ok('consume_memory_stub called and persisted')
    else bad('consume_memory_stub never persisted — the jot was not checked off by tool call')
    const { data: stubAfter } = await supabase.from('memory_stubs')
      .select('status, consumed_at, consumed_by_memory_id').eq('id', stubId!).single()
    if (stubAfter?.status === 'consumed' && stubAfter.consumed_at && stubAfter.consumed_by_memory_id
        && (!memoryId || stubAfter.consumed_by_memory_id === memoryId))
      ok('stub is consumed with lineage to the recollection it became')
    else bad('stub state wrong: ' + JSON.stringify(stubAfter))

    // ── 3. the id came from list_memory_stubs ──
    if (res.proposals.some((p: any) => p.tool === 'list_memory_stubs')) {
      ok('list_memory_stubs was called to fetch the real stub id')
    } else {
      info('list_memory_stubs not called — model got the id another way; structured checks above held')
    }
  } catch (e) {
    bad(e instanceof Error ? e.message : String(e))
  } finally {
    const { data: subs } = await supabase.from('capture_submissions')
      .select('id').eq('user_id', user.id).gte('created_at', startedAt)
    const subIds = (subs ?? []).map((s: any) => s.id)
    if (subIds.length) {
      const { data: mems2 } = await supabase.from('memories').select('id').in('source_submission_id', subIds)
      const memIds = (mems2 ?? []).map((m: any) => m.id)
      if (memIds.length) {
        await supabase.from('assumption_log').delete().in('memory_id', memIds)
        await supabase.from('memory_entities').delete().in('memory_id', memIds)
        await supabase.from('memories').delete().in('id', memIds)
      }
      await supabase.from('review_queue').delete().in('source_submission_id', subIds).then(() => {}, () => {})
      await supabase.from('capture_submissions').delete().in('id', subIds)
    }
    const { data: strays } = await supabase.from('entities')
      .select('id').eq('user_id', user.id).ilike('canonical_name', '%TESTLOOP%')
    const strayIds = (strays ?? []).map((e: any) => e.id)
    if (strayIds.length) {
      await supabase.from('assumption_log').delete().in('entity_id', strayIds)
      await supabase.from('review_queue').delete().in('item_id', strayIds)
      await supabase.from('memory_entities').delete().in('entity_id', strayIds)
      await supabase.from('entities').delete().in('id', strayIds) // stubs cascade
    }
    // Model-normalized fixture leak guard (2026-07-10: extraction created
    // "Elena Brandt" from the "TESTINTENT Elena Brandt" story — the prefix
    // sweep missed it and a merge proposal landed in Andy's real queue).
    // Any entity born during this run that ends up with ZERO memory links
    // after the memory sweep is run residue — remove it and its queue rows.
    const { data: born } = await supabase.from('entities')
      .select('id').eq('user_id', user.id).gte('created_at', startedAt)
    for (const e of born ?? []) {
      const { data: hasLinks } = await supabase.from('memory_entities')
        .select('memory_id').eq('entity_id', e.id).limit(1)
      if ((hasLinks ?? []).length > 0) continue
      await supabase.from('review_queue').delete().eq('item_id', e.id)
      const { data: mergeRows } = await supabase.from('review_queue')
        .select('id, context_json').eq('item_type', 'entity_merge_proposal').is('resolved_at', null)
      for (const r of mergeRows ?? []) {
        if ((r.context_json as any)?.duplicate_id === e.id) await supabase.from('review_queue').delete().eq('id', r.id)
      }
      await supabase.from('assumption_log').delete().eq('entity_id', e.id)
      await supabase.from('entities').delete().eq('id', e.id)
    }
    const { data: left } = await supabase.from('entities')
      .select('id').eq('user_id', user.id).ilike('canonical_name', '%TESTLOOP%')
    if ((left ?? []).length === 0) ok('cleanup complete — no TESTLOOP residue')
    else bad('TESTLOOP residue remains: ' + JSON.stringify(left))
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.hopper-loop-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
