#!/usr/bin/env node
/**
 * Verifies the chronicle-digester Inngest listener:
 *   1. Cache is fresh (is_stale=false)
 *   2. Emit a memory/ingested event
 *   3. Wait briefly for Inngest async delivery
 *   4. Confirm is_stale flipped to true
 *
 * Run: node scripts/verify-inngest-invalidation.mjs
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
import { getChronicleDigest } from '${projectRoot}/lib/agents/orchestrator/digest-cache'
import { inngest } from '${projectRoot}/lib/inngest/client'

const USER_ID = '${USER_ID}'
const supabase = createAdminClient()

async function getRow() {
  const { data } = await supabase
    .from('user_chronicle_digests')
    .select('is_stale, generated_at, digest_hash')
    .eq('user_id', USER_ID)
    .maybeSingle()
  return data
}

async function main() {
  // ── Ensure a fresh, non-stale row exists ──
  await supabase.from('user_chronicle_digests').delete().eq('user_id', USER_ID)
  await getChronicleDigest(USER_ID, supabase)
  let row = await getRow()
  console.log('1. Initial state → is_stale=' + row.is_stale + ' (expected false)')

  // ── Fake memory_id is fine; the listener only uses user_id ──
  const fakeMemId = '00000000-0000-0000-0000-000000000000'
  console.log('2. Emitting memory/ingested event...')
  await inngest.send({
    name: 'memory/ingested',
    data: { memory_id: fakeMemId, user_id: USER_ID },
  })

  // ── Poll for staleness with a short timeout ──
  const start = Date.now()
  const TIMEOUT_MS = 15000
  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 500))
    row = await getRow()
    if (row?.is_stale) break
  }
  const elapsed = Date.now() - start
  console.log('3. After event delivery → is_stale=' + row.is_stale + ' (expected true) — observed after ' + elapsed + 'ms')

  if (!row.is_stale) {
    console.error('   FAILURE: digest did not become stale within ' + TIMEOUT_MS + 'ms')
    console.error('   Check the Inngest Dev Server UI at http://localhost:8288 — did chronicle-digester-on-memory-ingested fire?')
    process.exit(1)
  }

  console.log()
  console.log('━ Inngest invalidation path verified ━')
}

main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.inngest-invalidation-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
try { unlinkSync(tmp) } catch {}
process.exit(r.status ?? 1)
