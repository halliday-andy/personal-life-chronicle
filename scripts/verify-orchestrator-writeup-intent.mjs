#!/usr/bin/env node
/**
 * Behavioral proof for the write-up bridge (R1, 2026-07-09) — a REAL
 * orchestrator run carrying a seeded WRITE-UP INTENT.
 *
 * Simulates the ✍ click: the intent (exact stub_id + host entity) rides
 * the submission; the user's message is the story itself.
 *
 * Asserts on structured payloads + live rows:
 *   1. create_memory persisted the story as a draft.
 *   2. The seeded stub ends CONSUMED with consumed_by_memory_id = the new
 *      memory — whether the model called consume_memory_stub or the core
 *      backstop did (which path fired is reported).
 *   3. list_memory_stubs was NOT needed — the intent made re-finding the
 *      stub unnecessary (reported, not asserted; calling it is waste, not
 *      wrongness).
 *
 * WRITES REAL ROWS, then sweeps. Costs one orchestrator run (~30-60s):
 *   node scripts/verify-orchestrator-writeup-intent.mjs
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

  const FIXTURE_NAME = 'TESTINTENT Elena Brandt'
  let entityId: string | null = null
  let stubId: string | null = null

  try {
    const { data: ent, error: entErr } = await supabase.from('entities')
      .insert({ user_id: user.id, type: 'person', canonical_name: FIXTURE_NAME, aliases: [] })
      .select('id').single()
    if (entErr || !ent) throw new Error('fixture entity failed: ' + entErr?.message)
    entityId = ent.id
    const { data: stub, error: stubErr } = await supabase.from('memory_stubs')
      .insert({ user_id: user.id, host_entity_id: ent.id, body: 'the rooftop eclipse', created_by: 'owner' })
      .select('id').single()
    if (stubErr || !stub) throw new Error('fixture stub failed: ' + stubErr?.message)
    stubId = stub.id

    const submission =
      'Here it is: in August 1999 ' + FIXTURE_NAME + ' dragged me up to the roof of her ' +
      'apartment block in Stuttgart to watch the total eclipse. We shared one pair of ' +
      'cardboard glasses, passing them back and forth, and when totality hit the whole ' +
      'city went quiet — birds stopped, streetlights flickered on, and she grabbed my arm ' +
      'and neither of us said anything for two minutes.'

    console.log('Running orchestrator with a seeded write-up intent (real run, ~30-60s)\\u2026')
    const res = await runOrchestrator({
      user_id: user.id,
      submission_text: submission,
      input_type: 'typed',
      intent: {
        kind: 'consume_stub',
        stub_id: stubId!,
        stub_body: 'the rooftop eclipse',
        entity_id: entityId!,
        entity_name: FIXTURE_NAME,
      },
      supabase,
    })

    console.log('\\nReply: ' + JSON.stringify(res.reply))
    console.log('Tools called: ' + res.proposals.map((p: any) => p.tool).join(', '))

    // ── 1. The story became a draft memory ──
    const creates = res.proposals.filter((p: any) => p.tool === 'create_memory' && p.persisted)
    const memoryId = creates.length ? ((creates[0].data as any).memory_id as string) : null
    if (memoryId) ok('create_memory persisted the story')
    else bad('create_memory never persisted')

    // ── 2. Stub consumed with lineage — model or backstop ──
    const consumes = res.proposals.filter(
      (p: any) => p.tool === 'consume_memory_stub' && p.persisted && (p.data as any).stub_id === stubId,
    )
    if (consumes.length > 0) {
      const viaBackstop = consumes.some((p: any) => String(p.rationale).startsWith('Backstop:'))
      info(viaBackstop ? 'consumed via the mechanical BACKSTOP (model forgot)' : 'consumed by the MODEL itself')
    }
    const { data: stubAfter } = await supabase.from('memory_stubs')
      .select('status, consumed_by_memory_id').eq('id', stubId!).single()
    if (stubAfter?.status === 'consumed' && (!memoryId || stubAfter.consumed_by_memory_id === memoryId))
      ok('seeded stub is consumed with lineage to the new recollection')
    else bad('stub state wrong: ' + JSON.stringify(stubAfter))

    // ── 3. No re-finding needed ──
    if (!res.proposals.some((p: any) => p.tool === 'list_memory_stubs'))
      ok('list_memory_stubs not called — the intent made re-finding unnecessary')
    else info('model called list_memory_stubs anyway — wasteful but not wrong')

    // ── Intent provenance on the submission row ──
    const { data: subRow } = await supabase.from('capture_submissions')
      .select('metadata').eq('id', res.meta.submission_id).single()
    if ((subRow?.metadata as any)?.intent?.stub_id === stubId) ok('intent recorded on capture_submissions metadata')
    else bad('intent missing from submission metadata')
  } catch (e) {
    bad(e instanceof Error ? e.message : String(e))
  } finally {
    const { data: subs } = await supabase.from('capture_submissions')
      .select('id').eq('user_id', user.id).gte('created_at', startedAt)
    const subIds = (subs ?? []).map((s: any) => s.id)
    if (subIds.length) {
      const { data: mems } = await supabase.from('memories').select('id').in('source_submission_id', subIds)
      const memIds = (mems ?? []).map((m: any) => m.id)
      if (memIds.length) {
        await supabase.from('assumption_log').delete().in('memory_id', memIds)
        await supabase.from('memory_entities').delete().in('memory_id', memIds)
        await supabase.from('memory_stubs').update({ consumed_by_memory_id: null }).in('consumed_by_memory_id', memIds)
        await supabase.from('memories').delete().in('id', memIds)
      }
      await supabase.from('review_queue').delete().in('source_submission_id', subIds).then(() => {}, () => {})
      await supabase.from('capture_submissions').delete().in('id', subIds)
    }
    const { data: strays } = await supabase.from('entities')
      .select('id').eq('user_id', user.id).ilike('canonical_name', '%TESTINTENT%')
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
      .select('id').eq('user_id', user.id).ilike('canonical_name', '%TESTINTENT%')
    if ((left ?? []).length === 0) ok('cleanup complete — no TESTINTENT residue')
    else bad('TESTINTENT residue remains: ' + JSON.stringify(left))
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.writeup-intent-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
