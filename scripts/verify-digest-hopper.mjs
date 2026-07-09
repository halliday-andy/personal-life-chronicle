#!/usr/bin/env node
/**
 * Proof for R2 (2026-07-09) — hopper awareness in the Layer B digest.
 *
 * Runs the REAL buildUserDigest against live data + own fixtures.
 *
 * Asserts (relative-only; self-cleaning):
 *   1. The digest gains an "Open jots" section listing each fixture host
 *      with its count and quoted jot texts.
 *   2. Consumed stubs are EXCLUDED (only open jots nominate).
 *   3. Consuming a fixture stub and rebuilding drops that host's count —
 *      the section tracks reality.
 *   4. Two consecutive builds with no writes in between hash identically
 *      (cache-key stability — the section must not wobble the prompt cache).
 *
 * Run: node scripts/verify-digest-hopper.mjs
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
import { buildUserDigest } from '${projectRoot}/lib/agents/orchestrator/digest'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

async function main() {
  const supabase = createAdminClient()
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]

  const entities: string[] = []
  try {
    // ── Fixtures: a person (2 open + 1 consumed) and a place (1 open) ──
    const mk = async (type: string, name: string) => {
      const { data, error } = await supabase.from('entities')
        .insert({ user_id: user.id, type, canonical_name: name }).select('id').single()
      if (error || !data) throw new Error('fixture failed: ' + error?.message)
      entities.push(data.id)
      return data.id as string
    }
    const person = await mk('person', 'TESTDIGEST Ada Quinn')
    const place = await mk('place', 'TESTDIGEST Lighthouse Point')
    const { data: s1 } = await supabase.from('memory_stubs')
      .insert({ user_id: user.id, host_entity_id: person, body: 'the midnight rowboat dare', created_by: 'owner' })
      .select('id').single()
    await supabase.from('memory_stubs')
      .insert({ user_id: user.id, host_entity_id: person, body: 'her graduation speech disaster', created_by: 'owner' })
    await supabase.from('memory_stubs')
      .insert({ user_id: user.id, host_entity_id: person, body: 'CONSUMEDMARKER the forgotten birthday', created_by: 'owner',
                status: 'consumed', consumed_at: new Date().toISOString() })
    await supabase.from('memory_stubs')
      .insert({ user_id: user.id, host_entity_id: place, body: 'the storm we watched from the rocks', created_by: 'owner' })

    // ── 1. Section lists hosts with counts + quoted jots ──
    const d1 = await buildUserDigest(user.id, supabase)
    if (d1.text.includes('## Open jots in the hopper')) ok('digest carries the Open-jots section')
    else bad('Open-jots section missing')
    if (/TESTDIGEST Ada Quinn \\(person\\): 2 jot\\(s\\)/.test(d1.text) && d1.text.includes('"the midnight rowboat dare"'))
      ok('person host shows 2 jots with quoted text')
    else bad('person host line wrong')
    if (/TESTDIGEST Lighthouse Point \\(place\\): 1 jot\\(s\\)/.test(d1.text))
      ok('place host shows its 1 jot')
    else bad('place host line wrong')

    // ── 2. Consumed stubs excluded ──
    if (!d1.text.includes('CONSUMEDMARKER')) ok('consumed stub excluded from the digest')
    else bad('consumed stub leaked into the digest')

    // ── 4. Hash stability across a no-write rebuild ──
    const d1b = await buildUserDigest(user.id, supabase)
    if (d1.hash === d1b.hash) ok('back-to-back builds hash identically (prompt-cache safe)')
    else bad('hash wobbled with no data change')

    // ── 3. Consuming drops the count ──
    await supabase.from('memory_stubs')
      .update({ status: 'consumed', consumed_at: new Date().toISOString() }).eq('id', s1!.id)
    const d2 = await buildUserDigest(user.id, supabase)
    if (/TESTDIGEST Ada Quinn \\(person\\): 1 jot\\(s\\)/.test(d2.text) && !d2.text.includes('"the midnight rowboat dare"'))
      ok('consuming a jot drops the host count and its text')
    else bad('digest did not track the consume')
    if (d2.stats.open_stubs === d1.stats.open_stubs - 1) ok('stats.open_stubs tracks (n-1 after one consume)')
    else bad('stats.open_stubs wrong: ' + d1.stats.open_stubs + ' -> ' + d2.stats.open_stubs)
  } catch (e) {
    bad(e instanceof Error ? e.message : String(e))
  } finally {
    for (const id of entities) await supabase.from('entities').delete().eq('id', id) // stubs cascade
    const { data: left } = await supabase.from('entities').select('id').ilike('canonical_name', 'TESTDIGEST%')
    if ((left ?? []).length === 0) ok('cleanup complete — no TESTDIGEST residue')
    else bad('TESTDIGEST residue remains')
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.digest-hopper-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
