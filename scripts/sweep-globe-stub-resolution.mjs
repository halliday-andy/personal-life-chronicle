#!/usr/bin/env node
/**
 * One-time (re-runnable) sweep: resolve the extraction stubs of EVERY
 * existing globe pin for the owner account (2026-07-06). Idempotent —
 * lib/globe/stub-resolution.ts skips stubs already linked / proposed /
 * dismissed, so running this again only picks up NEW names.
 *
 * WRITES REAL DATA, deliberately (Andy-approved 2026-07-06, option 2):
 *   - direct memory_entities links for exact-name matches
 *   - review_queue entity_stub_proposal rows for everything else
 * Nothing is deleted; no entities are created (creation happens only via
 * the user's Accept on /review).
 *
 * Run: node scripts/sweep-globe-stub-resolution.mjs
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
import { resolveGlobePinStubs } from '${projectRoot}/lib/globe/stub-resolution'

async function main() {
  const supabase = createAdminClient()
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com')
  if (!user) { console.error('owner account not found'); process.exit(1) }

  // Every globe pin relationship that has extraction stubs.
  const { data: rels } = await supabase
    .from('relationships')
    .select('id, object_id, metadata')
    .eq('user_id', user.id)
    .filter('metadata->>globe_pin', 'eq', 'true')

  let pins = 0, linked = 0, proposed = 0, settled = 0, skipped = 0
  for (const rel of rels ?? []) {
    const ge: any = rel.metadata?.globe_extraction
    if (!ge || ((ge.mentioned_people ?? []).length === 0 && (ge.mentioned_organisations ?? []).length === 0)) continue

    // The pin's own globe memory — same scoping rule as every pin-memory
    // lookup (capture_mode + oldest-first, never bare LIMIT 1).
    const { data: linksRows } = await supabase
      .from('memory_entities')
      .select('memory_id, memories!inner(id, capture_mode, created_at, user_id)')
      .eq('entity_id', rel.object_id)
      .eq('role', 'location')
      .eq('memories.capture_mode', 'globe_onboarding')
      .eq('memories.user_id', user.id)
    const mems = (linksRows ?? [])
      .map((r: any) => (Array.isArray(r.memories) ? r.memories[0] : r.memories))
      .filter(Boolean)
      .sort((a: any, b: any) => (a.created_at < b.created_at ? -1 : 1))
    if (mems.length === 0) { console.log('  (no globe memory for pin ' + rel.id.slice(0,8) + ' — skipped)'); continue }

    const { data: pinEnt } = await supabase.from('entities').select('canonical_name').eq('id', rel.object_id).single()
    const summary = await resolveGlobePinStubs(supabase, {
      userId: user.id, relationshipId: rel.id, memoryId: mems[0].id,
    })
    pins++
    linked += summary.linked.length
    proposed += summary.proposed.length
    settled += summary.already_settled
    skipped += summary.skipped_variants.length
    if (summary.linked.length || summary.proposed.length) {
      console.log('\\n' + (pinEnt?.canonical_name ?? rel.id.slice(0,8)) + ':')
      for (const l of summary.linked) console.log('  LINKED   ' + l.name + ' \\u2192 ' + l.canonical_name)
      for (const p of summary.proposed) console.log('  PROPOSED ' + p.name + (p.suggested ? ' (suggest: ' + p.suggested + ')' : ''))
      if (summary.skipped_variants.length) console.log('  skipped variants: ' + summary.skipped_variants.join(', '))
    }
  }
  console.log('\\nSWEEP DONE: ' + pins + ' pins · ' + linked + ' linked directly · ' + proposed + ' proposals on /review · ' + skipped + ' short variants skipped · ' + settled + ' already settled')
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.stub-sweep-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
