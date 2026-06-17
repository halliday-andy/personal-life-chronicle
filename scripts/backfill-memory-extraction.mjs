#!/usr/bin/env node
/**
 * Backfill entity + dimension extraction for an already-finalised memory
 * that has none — the manual counterpart to the finalize-route backfill
 * (QA item 6, 2026-06-17). Use for memories captured before that fix, when
 * the orchestrator skipped its draft-time extract_entities turn.
 *
 * Runs the same cores the async listeners run (runEntity + runTagger,
 * persist=true). Both upsert (onConflict), so re-running is idempotent.
 * content_raw is never touched (Raw Vault).
 *
 *   node scripts/backfill-memory-extraction.mjs <memory_id>
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const memoryId = process.argv[2]
if (!memoryId) {
  console.error('Usage: node scripts/backfill-memory-extraction.mjs <memory_id>')
  process.exit(1)
}

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(projectRoot, '.env.local'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('='); if (i < 0) continue
  const k = line.slice(0, i).trim(); if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}

const runnerSrc = `
import { createAdminClient } from '${projectRoot}/lib/supabase/admin'
import { runEntity } from '${projectRoot}/lib/agents/entity/core'
import { runTagger } from '${projectRoot}/lib/agents/tagger/core'

const admin = createAdminClient()
const MEM_ID = ${JSON.stringify(memoryId)}

async function main() {
  const { data: mem, error } = await admin.from('memories')
    .select('content_raw, user_id, is_draft').eq('id', MEM_ID).single()
  if (error || !mem) { console.error('memory not found: ' + (error?.message ?? 'no row')); process.exit(1) }

  const before = await admin.from('memory_entities')
    .select('memory_id', { count: 'exact', head: true }).eq('memory_id', MEM_ID)
  console.log('memory_entities before: ' + (before.count ?? 0))

  const ent = await runEntity({ text: mem.content_raw, user_id: mem.user_id, memory_id: MEM_ID, persist: true })
  console.log('runEntity: ' + ent.proposals.length + ' proposal(s), ' + ent.new_entity_count + ' new')

  const tag = await runTagger({ text: mem.content_raw, user_id: mem.user_id, memory_id: MEM_ID, persist: true, supabase: admin })
  console.log('runTagger: ' + tag.proposals.length + ' dimension(s)')

  const { data: links } = await admin.from('memory_entities')
    .select('role, entities(canonical_name, type)').eq('memory_id', MEM_ID)
  console.log('\\nLinked entities now:')
  for (const l of links ?? []) console.log('  - [' + (l as any).entities.type + '] ' + (l as any).entities.canonical_name + ' (role: ' + l.role + ')')
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.backfill-extraction-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
