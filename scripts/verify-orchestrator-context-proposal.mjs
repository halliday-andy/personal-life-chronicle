#!/usr/bin/env node
/**
 * Behavioral proof for Slice 6.5b — the orchestrator routes pasted
 * research to propose_context_note instead of the Raw Vault or backlog.
 *
 * Runs a REAL orchestrator submission: an encyclopedic, third-person
 * blob about a fixture place entity (TESTCTX name so it can't collide
 * with real entities). Asserts on the structured tool payloads:
 *
 *   1. A propose_context_note proposal exists and resolves to the
 *      fixture entity.
 *   2. NO memory was written for this submission (research must never
 *      enter the Raw Vault).
 *   3. NO memory_elaboration_needed backlog row was queued (the 6.5a
 *      dead-end this slice closes at the source).
 *   4. Nothing was persisted to entity_context_notes (confirm-first).
 *
 * The conversational reply is inspected and reported, not asserted.
 *
 * WRITES REAL ROWS (capture_submission + fixture entity; possibly a
 * draft memory if the model misroutes — swept either way), then deletes
 * everything it created. Costs one orchestrator run (~30s):
 *   node scripts/verify-orchestrator-context-proposal.mjs
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

  const FIXTURE_NAME = 'TESTCTX Ellsworth Air Force Base'
  let entityId: string | null = null

  try {
    const { data: ent, error: entErr } = await supabase
      .from('entities')
      .insert({ user_id: user.id, type: 'place', canonical_name: FIXTURE_NAME, aliases: [] })
      .select('id')
      .single()
    if (entErr || !ent) throw new Error('fixture entity insert failed: ' + entErr?.message)
    entityId = ent.id

    const submission =
      'Some background I dug up about ' + FIXTURE_NAME + ':\\n\\n' +
      '## History\\n\\n' +
      FIXTURE_NAME + ' was established in 1942 as an Army Air Base and became a ' +
      'Strategic Air Command installation in 1948, hosting B-36 and later B-52 ' +
      'bomber wings through the Cold War [1]. The base was named for Brigadier ' +
      'General Richard E. Ellsworth after his death in a 1953 RB-36 crash.\\n\\n' +
      'Source: https://example.org/testctx-ellsworth-history'

    console.log('Running orchestrator with a research paste (real run, ~30s)\\u2026')
    const res = await runOrchestrator({
      user_id: user.id,
      submission_text: submission,
      input_type: 'pasted',
      supabase,
    })

    console.log('\\nReply: ' + JSON.stringify(res.reply))
    console.log('Tools called: ' + res.proposals.map((p: any) => p.tool).join(', '))

    // ── 1. propose_context_note fired and resolved ──
    const ctxProposals = res.proposals.filter((p: any) => p.tool === 'propose_context_note')
    if (ctxProposals.length === 0) {
      bad('orchestrator never called propose_context_note — research was not classified as context')
    } else {
      ok('propose_context_note called (' + ctxProposals.length + 'x)')
      const d = ctxProposals[0].data as any
      if (d.entity?.id === entityId) ok('proposal resolved to the fixture entity')
      else if (d.suggested_entity_name && d.suggested_entity_name.includes('TESTCTX')) {
        info('entity unresolved server-side but suggested_entity_name carries the fixture name (picker path)')
      } else {
        bad('proposal names the wrong entity: ' + JSON.stringify({ entity: d.entity, suggested: d.suggested_entity_name }))
      }
      if (typeof d.body === 'string' && d.body.includes('Strategic Air Command')) {
        ok('proposal body carries the research text')
      } else {
        bad('proposal body missing or truncated')
      }
    }

    // ── 2. Raw Vault untouched ──
    const { data: mems } = await supabase
      .from('memories')
      .select('id')
      .eq('source_submission_id', res.meta.submission_id)
    if ((mems ?? []).length === 0) ok('no memory written — research stayed out of the Raw Vault')
    else bad((mems ?? []).length + ' memory row(s) written for a research paste')

    // ── 3. Backlog not used ──
    const { data: backlog } = await supabase
      .from('review_queue')
      .select('id')
      .eq('user_id', user.id)
      .eq('item_type', 'memory_elaboration_needed')
      .gte('created_at', startedAt)
    if ((backlog ?? []).length === 0) ok('no memory_elaboration_needed backlog row queued')
    else bad('research was parked in the backlog (' + (backlog ?? []).length + ' row(s)) — the dead-end this slice closes')

    // ── 4. Confirm-first: nothing persisted ──
    const { data: notes } = await supabase
      .from('entity_context_notes')
      .select('id')
      .eq('entity_id', entityId!)
    if ((notes ?? []).length === 0) ok('no entity_context_notes row — persistence waits for the user Accept')
    else bad('a context note was persisted without user confirmation')

    // ── Reply awareness (reported, not asserted) ──
    if (/context|background|research/i.test(res.reply)) {
      ok('reply speaks in context terms')
    } else {
      info('reply wording did not mention context explicitly — probabilistic; structured checks held')
    }
  } finally {
    // ── Cleanup — everything from this run's window + fixtures ──
    const { data: subs } = await supabase.from('capture_submissions')
      .select('id').eq('user_id', user.id).gte('created_at', startedAt)
    const subIds = (subs ?? []).map((s: any) => s.id)
    if (subIds.length) {
      const { data: mems2 } = await supabase.from('memories').select('id').in('source_submission_id', subIds)
      const memIds = (mems2 ?? []).map((m: any) => m.id)
      if (memIds.length) {
        await supabase.from('assumption_log').delete().in('memory_id', memIds)
        await supabase.from('memories').delete().in('id', memIds)
      }
      await supabase.from('review_queue').delete().in('source_submission_id', subIds).then(() => {}, () => {})
      await supabase.from('capture_submissions').delete().in('id', subIds)
    }
    // Entities created in the window with the TESTCTX marker (extraction
    // may have created a duplicate) + the fixture itself.
    const { data: strays } = await supabase.from('entities')
      .select('id').eq('user_id', user.id).ilike('canonical_name', '%TESTCTX%')
    const strayIds = (strays ?? []).map((e: any) => e.id)
    if (strayIds.length) {
      await supabase.from('assumption_log').delete().in('entity_id', strayIds)
      await supabase.from('review_queue').delete().in('item_id', strayIds)
      await supabase.from('memory_entities').delete().in('entity_id', strayIds)
      await supabase.from('entity_context_notes').delete().in('entity_id', strayIds)
      await supabase.from('entities').delete().in('id', strayIds)
    }
    const { data: left } = await supabase.from('entities')
      .select('id').eq('user_id', user.id).ilike('canonical_name', '%TESTCTX%')
    if ((left ?? []).length === 0) ok('cleanup complete — no TESTCTX residue')
    else bad('TESTCTX residue remains: ' + JSON.stringify(left))
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.context-behavioral-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
