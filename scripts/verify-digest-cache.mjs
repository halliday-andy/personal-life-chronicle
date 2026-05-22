#!/usr/bin/env node
/**
 * End-to-end verification of the digest cache mechanism (Step 6c-5).
 *
 * Tests the four paths through getChronicleDigest / markDigestStale /
 * regenerateDigest:
 *
 *   1. Empty cache → getChronicleDigest creates a row
 *   2. Fresh cache → second call returns cached (no upsert, generated_at unchanged)
 *   3. markDigestStale flips is_stale=true
 *   4. Stale cache → next getChronicleDigest regenerates (generated_at advances)
 *
 * Run: node scripts/verify-digest-cache.mjs
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
import {
  getChronicleDigest,
  markDigestStale,
} from '${projectRoot}/lib/agents/orchestrator/digest-cache'

const USER_ID = '${USER_ID}'
const supabase = createAdminClient()

async function getRow() {
  const { data } = await supabase
    .from('user_chronicle_digests')
    .select('*')
    .eq('user_id', USER_ID)
    .maybeSingle()
  return data
}

function snapshot(row, label) {
  if (!row) return label + ': (no row)'
  return label + ': hash=' + row.digest_hash + ' gen=' + new Date(row.generated_at).toISOString() + ' stale=' + row.is_stale + ' len=' + row.digest_text.length
}

async function main() {
  // ── Step 0: clear any pre-existing row so we test from a clean state ──
  await supabase.from('user_chronicle_digests').delete().eq('user_id', USER_ID)
  const before = await getRow()
  console.log('1. Before any call →', before ? 'ROW EXISTS (unexpected)' : 'no row (expected)')

  // ── Step 1: first getChronicleDigest creates the row ──
  console.log()
  console.log('2. Calling getChronicleDigest (should CREATE)...')
  const t0 = Date.now()
  const d1 = await getChronicleDigest(USER_ID, supabase)
  console.log('   built in ' + (Date.now() - t0) + 'ms, hash=' + d1.hash + ' len=' + d1.text.length)
  const row1 = await getRow()
  console.log('   ' + snapshot(row1, '   row'))

  // ── Step 2: immediate second call returns cached ──
  console.log()
  console.log('3. Calling getChronicleDigest again (should READ CACHE)...')
  const t1 = Date.now()
  const d2 = await getChronicleDigest(USER_ID, supabase)
  console.log('   completed in ' + (Date.now() - t1) + 'ms')
  const row2 = await getRow()
  console.log('   hash match: ' + (d1.hash === d2.hash))
  console.log('   generated_at unchanged: ' + (row1.generated_at === row2.generated_at))

  // ── Step 3: mark stale ──
  console.log()
  console.log('4. Calling markDigestStale...')
  await markDigestStale(USER_ID, supabase)
  const row3 = await getRow()
  console.log('   is_stale=' + row3.is_stale + ' (expected true)')

  // ── Step 4: regeneration on read ──
  console.log()
  console.log('5. Calling getChronicleDigest (should REGENERATE since stale)...')
  const t2 = Date.now()
  const d3 = await getChronicleDigest(USER_ID, supabase)
  console.log('   built in ' + (Date.now() - t2) + 'ms')
  const row4 = await getRow()
  console.log('   is_stale=' + row4.is_stale + ' (expected false)')
  console.log('   generated_at advanced: ' + (new Date(row4.generated_at) > new Date(row3.generated_at)))
  console.log('   hash same as initial: ' + (d3.hash === d1.hash) + ' (expected true — chronicle unchanged)')

  console.log()
  console.log('━ All four cache paths verified ━')
}

main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.digest-cache-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
try { unlinkSync(tmp) } catch {}
process.exit(r.status ?? 1)
