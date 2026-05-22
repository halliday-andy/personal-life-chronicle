#!/usr/bin/env node
/**
 * Directly exercises the two orchestrator tools that became persistent
 * in Step 6d (closing followup #24):
 *
 *   - flag_for_private_notes — appends to memories.private_notes
 *   - add_to_backlog        — inserts review_queue row with item_type
 *                             'memory_elaboration_needed'
 *
 * Doesn't depend on Claude choosing to call these tools — invokes the
 * dispatch directly.
 *
 * Run: node scripts/verify-6d-tools.mjs
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

for (const line of readFileSync(join(projectRoot, '.env.local'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i).trim()
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}

const USER_ID = 'b957ab56-8926-4749-b44f-e67831d0afcc'

const runnerSrc = `
import { createAdminClient } from '${projectRoot}/lib/supabase/admin'
import { executeTool } from '${projectRoot}/lib/agents/orchestrator/tools'

const USER_ID = '${USER_ID}'
const supabase = createAdminClient()

async function main() {
  // ── Pick a recent draft memory for the private-notes test ──
  const { data: drafts } = await supabase
    .from('memories')
    .select('id, content_raw, private_notes, source_submission_id')
    .eq('user_id', USER_ID)
    .eq('is_draft', true)
    .order('created_at', { ascending: false })
    .limit(1)
  const draft = drafts?.[0]
  if (!draft) {
    console.error('No draft memory found to test against; run the orchestrator first.')
    process.exit(1)
  }
  console.log('Using draft memory:', draft.id.slice(0,8))
  console.log('  current private_notes:', draft.private_notes ?? '(null)')
  console.log()

  // ── flag_for_private_notes test ──
  console.log('━ flag_for_private_notes (with memory_id) ━')
  const fpnResult = await executeTool(
    'flag_for_private_notes',
    {
      passage: 'A small note for my eyes only — testing the private notes layer.',
      rationale: 'Verifying that 6d wiring writes to memories.private_notes correctly.',
      memory_id: draft.id,
    },
    { user_id: USER_ID, supabase },
  )
  console.log('  persisted:', fpnResult.persisted)
  console.log('  data:', JSON.stringify(fpnResult.data))

  // Confirm the column was written
  const { data: updated } = await supabase
    .from('memories')
    .select('private_notes')
    .eq('id', draft.id)
    .single()
  console.log('  memory.private_notes is now:', JSON.stringify(updated.private_notes))
  console.log()

  // ── add_to_backlog test ──
  console.log('━ add_to_backlog ━')
  const subId = draft.source_submission_id // borrow one for the lineage
  const atbResult = await executeTool(
    'add_to_backlog',
    {
      text: 'Test stub: remember to write about the day I learned to drive.',
      rationale: 'Verifying that 6d wiring inserts a review_queue row.',
    },
    { user_id: USER_ID, supabase, source_submission_id: subId },
  )
  console.log('  persisted:', atbResult.persisted)
  console.log('  data:', JSON.stringify(atbResult.data))

  // Confirm the queue row exists
  if (atbResult.data.review_queue_id) {
    const { data: rq } = await supabase
      .from('review_queue')
      .select('item_type, context_json, priority')
      .eq('id', atbResult.data.review_queue_id)
      .single()
    console.log('  review_queue row:', JSON.stringify(rq))
  }
  console.log()

  // ── Cleanup: remove the test notes and the test backlog row so the
  //    real data isn't polluted by this verification script ──
  await supabase.from('memories').update({ private_notes: null }).eq('id', draft.id)
  if (atbResult.data.review_queue_id) {
    await supabase.from('review_queue').delete().eq('id', atbResult.data.review_queue_id)
  }
  console.log('━ Test artifacts cleaned up ━')
}

main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.6d-tools-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
try { unlinkSync(tmp) } catch {}
process.exit(r.status ?? 1)
