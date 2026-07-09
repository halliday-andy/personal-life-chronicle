#!/usr/bin/env node
/**
 * Behavioral proof for the one-jot-per-memory directive (2026-07-09,
 * SYSTEM_PROMPT_VERSION 2026-07-09.0) — a REAL orchestrator run.
 *
 * The user hands the assistant THREE memories in one breath, one of which
 * contains an internal comma ("…Vienna, spring 1988") that naive
 * punctuation-splitting would shred. Asserts on structured tool payloads:
 *
 *   1. add_memory_stub persisted THREE times — one call per memory, not
 *      one compound stub for the run-on.
 *   2. No stub body compounds two memories (the atomicity the consume
 *      loop depends on: one stub → one recollection → one check-off).
 *   3. All three stubs landed on the fixture person's hopper.
 *   4. (reported, not asserted) the Vienna stub kept its internal comma
 *      phrase intact — semantic splitting, not punctuation splitting.
 *
 * WRITES REAL ROWS (submission + fixture entity + stubs), then sweeps.
 * Costs one orchestrator run (~30s):
 *   node scripts/verify-orchestrator-jot-split.mjs
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

  const FIXTURE_NAME = 'TESTSPLIT Nora Winter'
  let entityId: string | null = null

  try {
    const { data: ent, error: entErr } = await supabase.from('entities')
      .insert({ user_id: user.id, type: 'person', canonical_name: FIXTURE_NAME, aliases: [] })
      .select('id').single()
    if (entErr || !ent) throw new Error('fixture entity failed: ' + entErr?.message)
    entityId = ent.id

    // Explicit agreement is IN the submission ("yes please — jot these"),
    // honoring the only-on-yes rule; the split granularity is what's under test.
    const submission =
      'Yes please — jot these down for ' + FIXTURE_NAME + ' before I lose them: ' +
      'the night train to Vienna, spring 1988. The borrowed bicycle in Amsterdam. ' +
      'And the kitchen concert after her exams.'

    console.log('Running orchestrator with a three-memory run-on (real run, ~30s)\\u2026')
    const res = await runOrchestrator({
      user_id: user.id,
      submission_text: submission,
      input_type: 'typed',
      conversation_history: [
        { role: 'user', content: 'I keep remembering little moments with ' + FIXTURE_NAME + ' while doing other things.' },
        { role: 'assistant', content: 'Those flashes are worth keeping — want me to jot them into ' + FIXTURE_NAME + "'s hopper as they come? Just list them and I'll add each one." },
      ],
      supabase,
    })

    console.log('\\nReply: ' + JSON.stringify(res.reply))
    console.log('Tools called: ' + res.proposals.map((p: any) => p.tool).join(', '))

    // ── 1. Three add_memory_stub calls, all persisted ──
    const adds = res.proposals.filter((p: any) => p.tool === 'add_memory_stub' && p.persisted)
    if (adds.length === 3) ok('add_memory_stub persisted 3x — one call per memory')
    else bad('expected 3 persisted add_memory_stub calls, got ' + adds.length)

    // ── 2 + 3. Stub shapes on the live rows ──
    const { data: stubs } = await supabase.from('memory_stubs')
      .select('body, host_entity_id, created_by')
      .eq('user_id', user.id).eq('host_entity_id', entityId!)
    const bodies = (stubs ?? []).map((s: any) => String(s.body))
    console.log('Stub bodies: ' + JSON.stringify(bodies))
    if (bodies.length === 3) ok('three stubs live on the fixture hopper')
    else bad('expected 3 stubs on the hopper, found ' + bodies.length)
    const markers = ['vienna', 'bicycle', 'kitchen']
    const compound = bodies.filter((b: string) => markers.filter((m) => b.toLowerCase().includes(m)).length > 1)
    if (compound.length === 0) ok('no stub compounds two memories (atomicity holds)')
    else bad('compound stub(s): ' + JSON.stringify(compound))
    if ((stubs ?? []).every((s: any) => s.created_by === 'assistant')) ok("all created_by='assistant'")
    else bad('unexpected created_by on assistant jots')

    // ── 4. Semantic (not punctuation) splitting — reported ──
    const vienna = bodies.find((b: string) => b.toLowerCase().includes('vienna'))
    if (vienna && /1988/.test(vienna)) ok('Vienna stub kept its internal comma phrase ("spring 1988") intact')
    else info('Vienna stub dropped the year — acceptable phrasing variance; atomicity checks above held')
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
        await supabase.from('memories').delete().in('id', memIds)
      }
      await supabase.from('review_queue').delete().in('source_submission_id', subIds).then(() => {}, () => {})
      await supabase.from('capture_submissions').delete().in('id', subIds)
    }
    const { data: strays } = await supabase.from('entities')
      .select('id').eq('user_id', user.id).ilike('canonical_name', '%TESTSPLIT%')
    const strayIds = (strays ?? []).map((e: any) => e.id)
    if (strayIds.length) {
      await supabase.from('assumption_log').delete().in('entity_id', strayIds)
      await supabase.from('review_queue').delete().in('item_id', strayIds)
      await supabase.from('memory_entities').delete().in('entity_id', strayIds)
      await supabase.from('entities').delete().in('id', strayIds) // stubs cascade
    }
    const { data: left } = await supabase.from('entities')
      .select('id').eq('user_id', user.id).ilike('canonical_name', '%TESTSPLIT%')
    if ((left ?? []).length === 0) ok('cleanup complete — no TESTSPLIT residue')
    else bad('TESTSPLIT residue remains: ' + JSON.stringify(left))
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.jot-split-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
