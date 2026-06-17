#!/usr/bin/env node
/**
 * Proof for the finalize extraction backfill (QA item 6, 2026-06-17).
 *
 * Reproduces the Wallace failure in miniature and asserts the fix:
 *   1. A finalised memory can exist with ZERO memory_entities (the gate
 *      condition the route checks before re-emitting memory/ingested).
 *   2. Running the same extraction the re-emitted Entity listener runs
 *      (runEntity persist=true — see lib/inngest/agents/entity-agent.ts)
 *      backfills memory_entities for that memory.
 *   3. content_raw is untouched (Raw Vault invariant holds).
 *
 * Uses a fabricated, highly-distinctive person name so the entity it
 * creates is unambiguous to clean up. Non-destructive: the temp memory,
 * its links, the created entity, and any review_queue rows are deleted.
 *
 * Run: node scripts/verify-finalize-extraction-backfill.mjs
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
import { runEntity } from '${projectRoot}/lib/agents/entity/core'

const admin = createAdminClient()
let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

// Distinctive fabricated person → unambiguous create + safe cleanup.
const PERSON = 'Zephyrina Qwolthadrex'
const BODY = 'I once met ' + PERSON + ' at a small gathering in Ravenscroft and we talked for hours.'

async function main() {
  const { data: users } = await admin.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
  const USER_ID = user.id

  // Simulate an orchestrator-created memory that was finalised WITHOUT
  // its draft-time extraction ever running.
  const { data: mem, error: insErr } = await admin.from('memories').insert({
    user_id: USER_ID, content_raw: BODY, time_precision: 'unknown',
    source: 'text_entry', confidence: 'certain', is_draft: false,
    metadata: { created_by: 'orchestrator', skip_async_fanout: false },
  }).select('id').single()
  if (insErr || !mem) { bad('insert temp memory: ' + (insErr?.message ?? 'no row')); process.exit(1) }
  const MEM_ID = mem.id

  let createdEntityIds: string[] = []
  try {
    // 1. Gate condition: zero entities (the route's head/count query).
    const { count: before } = await admin.from('memory_entities')
      .select('memory_id', { count: 'exact', head: true }).eq('memory_id', MEM_ID)
    ;(before ?? 0) === 0 ? ok('memory starts with zero memory_entities (gate fires)')
                         : bad('expected 0 entities, got ' + before)

    // 2. Backfill: exactly what the re-emitted Entity listener does.
    const res = await runEntity({ text: BODY, user_id: USER_ID, memory_id: MEM_ID, persist: true })
    res.proposals.length > 0 ? ok('runEntity proposed ' + res.proposals.length + ' entity(ies)')
                             : bad('runEntity proposed nothing')

    const { data: links } = await admin.from('memory_entities')
      .select('entity_id, role, entities(canonical_name, type)').eq('memory_id', MEM_ID)
    ;(links?.length ?? 0) > 0 ? ok('memory_entities backfilled (' + links!.length + ' link(s))')
                              : bad('no memory_entities after backfill')
    const person = (links ?? []).find((l: any) => (l.entities?.canonical_name ?? '').includes('Zephyrina'))
    person ? ok('the person was extracted + linked: ' + person.entities.canonical_name)
           : bad('fabricated person not linked')
    createdEntityIds = (links ?? []).map((l: any) => l.entity_id)

    // 3. Raw Vault: content_raw unchanged.
    const { data: after } = await admin.from('memories').select('content_raw').eq('id', MEM_ID).single()
    after!.content_raw === BODY ? ok('content_raw untouched (Raw Vault)') : bad('content_raw changed!')
  } finally {
    await admin.from('memory_entities').delete().eq('memory_id', MEM_ID)
    // Delete every entity this run linked that is now orphaned (no other
    // memory_entities). Covers BOTH the fabricated person and any place
    // (e.g. "Ravenscroft") the extractor minted from the test body, while
    // never touching a pre-existing entity that happens to share a link.
    for (const eid of createdEntityIds) {
      const { count } = await admin.from('memory_entities')
        .select('memory_id', { count: 'exact', head: true }).eq('entity_id', eid)
      if ((count ?? 0) === 0) {
        await admin.from('review_queue').delete().eq('item_id', eid)
        await admin.from('entities').delete().eq('id', eid)
      }
    }
    await admin.from('memories').delete().eq('id', MEM_ID)
    console.log('Temp memory + links + entities created by this run deleted.')
  }

  if (failures) { console.error('\\nFAIL: ' + failures + ' assertion(s)'); process.exit(1) }
  console.log('\\nPASS')
}

main().catch((e) => { console.error(e); process.exit(1) })
`

console.log('Finalize extraction-backfill proof (QA item 6)\n')
const tmp = join(projectRoot, '.finalize-backfill-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
