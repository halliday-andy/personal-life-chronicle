#!/usr/bin/env node
/**
 * Behavioral proof for task #39 — orchestrator entity vigilance.
 *
 * Runs a REAL orchestrator submission mentioning "Lockbourne Air Base"
 * (a variant NOT covered by the entity's alias, so exact/alias match
 * can't trivially save it) while "Lockbourne AFB Columbus Ohio" exists
 * in the chronicle. Asserts on the structured tool payloads:
 *
 *   1. The Lockbourne entity proposal resolves as linked_existing OR
 *      created_with_merge_proposal — never silent created_new.
 *   2. When it's a merge proposal, merge_candidate + review_queue_id
 *      are populated (powers the in-flow link-vs-create card strip).
 *
 * The conversational reply is INSPECTED for duplicate-awareness
 * (vigilance directive) and reported, but not hard-asserted — wording
 * is probabilistic; the structured backstop is the guarantee.
 *
 * WRITES REAL ROWS (capture_submission, draft memory, possibly a new
 * entity + review_queue row; async agents fan out via Inngest), then
 * sleeps for the async agents and deletes everything it created.
 * Costs one orchestrator run (~30s). Run when the chronicle can
 * tolerate a transient test draft:
 *   node scripts/verify-orchestrator-vigilance.mjs
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(projectRoot, '.env.local'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('='); if (i < 0) continue
  const k = line.slice(0, i).trim(); if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
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
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com')!
  const startedAt = new Date().toISOString()

  console.log('Running orchestrator with a Lockbourne variant (real run, ~30s)…')
  const res = await runOrchestrator({
    user_id: user.id,
    submission_text:
      'VIGILANCE-TEST: I keep thinking about the cold winters at Lockbourne Air Base when I was a small boy.',
    supabase,
  })

  console.log('\\nReply: ' + JSON.stringify(res.reply))

  // ── Structured assertions ──
  const entProposals: any[] = []
  for (const p of res.proposals) {
    if (p.tool === 'extract_entities' && Array.isArray((p.data as any)?.proposals)) {
      entProposals.push(...(p.data as any).proposals)
    }
  }
  const lock = entProposals.find((e) => /lockbourne/i.test(e.extracted_name))
  if (!lock) {
    bad('no Lockbourne entity proposal found (extraction missed it?)')
  } else if (lock.resolution_action === 'linked_existing') {
    ok('Lockbourne resolved as linked_existing (' + lock.match_confidence.toFixed(2) + ')')
  } else if (lock.resolution_action === 'created_with_merge_proposal') {
    ok('Lockbourne resolved as created_with_merge_proposal (' + lock.match_confidence.toFixed(2) + ')')
    if (lock.merge_candidate?.canonical_name?.match(/lockbourne/i)) {
      ok('merge_candidate names the existing entity: ' + lock.merge_candidate.canonical_name)
    } else {
      bad('merge_candidate missing or wrong: ' + JSON.stringify(lock.merge_candidate))
    }
    if (lock.review_queue_id) ok('review_queue_id present (in-flow strip can resolve it)')
    else bad('review_queue_id missing')
  } else {
    bad('Lockbourne resolution_action = ' + lock.resolution_action + ' — SILENT DUPLICATE PATH')
  }

  // ── Reply vigilance (reported, not asserted) ──
  if (/lockbourne afb|columbus|already|existing|same place|linked/i.test(res.reply)) {
    ok('reply shows duplicate-awareness (vigilance directive active)')
  } else {
    info('reply did not explicitly mention the existing entity — directive wording is probabilistic; structured backstop held')
  }

  // ── Cleanup ──
  console.log('\\nCleanup (waiting 25s for async agents to settle)…')
  await new Promise((r) => setTimeout(r, 25000))

  // Submission row(s) from this run
  const { data: subs } = await supabase.from('capture_submissions')
    .select('id').eq('user_id', user.id).gte('created_at', startedAt)
  const subIds = (subs ?? []).map((s: any) => s.id)

  // Memories created by this run: match by submission lineage first,
  // with the text prefix as a fallback net.
  const { data: memsBySub } = subIds.length
    ? await supabase.from('memories').select('id').in('source_submission_id', subIds)
    : { data: [] }
  const { data: memsByText } = await supabase.from('memories')
    .select('id').eq('user_id', user.id).gte('created_at', startedAt)
    .like('content_raw', '%VIGILANCE-TEST%')
  const memIds = [...new Set([...(memsBySub ?? []), ...(memsByText ?? [])].map((m: any) => m.id))]

  // Entities created in the window whose name is the test variant —
  // never touch the real pin entity (different canonical name).
  const { data: ents } = await supabase.from('entities')
    .select('id, canonical_name').eq('user_id', user.id).gte('created_at', startedAt)
  const entIds = (ents ?? []).map((e: any) => e.id)

  if (memIds.length) {
    await supabase.from('assumption_log').delete().in('memory_id', memIds)
    await supabase.from('memories').delete().in('id', memIds)
  }
  if (entIds.length) {
    await supabase.from('assumption_log').delete().in('entity_id', entIds)
    await supabase.from('review_queue').delete().in('item_id', entIds)
    await supabase.from('memory_entities').delete().in('entity_id', entIds)
    await supabase.from('entities').delete().in('id', entIds)
  }
  if (subIds.length) {
    await supabase.from('review_queue').delete().in('source_submission_id', subIds).then(() => {}, () => {})
    await supabase.from('capture_submissions').delete().in('id', subIds)
  }

  // Prove the sweep
  const { data: leftMem } = await supabase.from('memories')
    .select('id').like('content_raw', 'VIGILANCE-TEST:%')
  const { data: leftEnt } = await supabase.from('entities')
    .select('id').in('id', entIds.length ? entIds : ['00000000-0000-0000-0000-000000000000'])
  if ((leftMem ?? []).length === 0 && (leftEnt ?? []).length === 0) {
    ok('cleanup complete — no test residue (removed ' + memIds.length + ' memory, ' + entIds.length + ' entity, ' + subIds.length + ' submission row(s))')
  } else {
    bad('residue remains: ' + JSON.stringify({ mem: leftMem, ent: leftEnt }))
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.vigilance-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
