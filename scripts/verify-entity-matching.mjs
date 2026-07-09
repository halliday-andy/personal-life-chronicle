#!/usr/bin/env node
/**
 * Proof for task #38 — entity name matching handles abbreviations,
 * typos, and containment without false positives.
 *
 * Bands: ≥0.95 auto-link · 0.7–0.95 merge proposal · <0.7 no match.
 *
 * Acceptance cases (both live failures + the historical false positive):
 *   - "Lockbourne Air Force Base" vs "Lockbourne AFB Columbus Ohio"
 *     → proposal band or better (was 0 → silent duplicate, 2026-06-12)
 *   - "Leola Lapidus" vs "Leola Lapides" → proposal band (typo, 2026-05-22)
 *   - "Leo" vs "Leola Lapidus" → NO match (substring false positive, 2026-05-22)
 *   - "Nancy" vs "Nancy Halliday" → proposal band (legit containment)
 *
 * Also resolves against a temp DB fixture entity end-to-end (no Claude).
 * Run: node scripts/verify-entity-matching.mjs
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
import { scoreNameMatch, resolveAgainstExisting } from '${projectRoot}/lib/agents/entity/core'
import { createAdminClient } from '${projectRoot}/lib/supabase/admin'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

function band(s: number): string {
  return s >= 0.95 ? 'auto-link' : s >= 0.7 ? 'proposal' : 'none'
}
function expect(a: string, b: string, want: 'auto-link' | 'proposal' | 'none' | 'proposal+') {
  const s = scoreNameMatch(a, b)
  const got = band(s)
  const pass = want === 'proposal+' ? got !== 'none' : got === want
  ;(pass ? ok : bad)(
    JSON.stringify(a) + ' vs ' + JSON.stringify(b) + ' \\u2192 ' + s.toFixed(2) + ' (' + got + (pass ? '' : ', wanted ' + want) + ')'
  )
}

console.log('Scorer cases:')
expect('Lockbourne AFB Columbus Ohio', 'Lockbourne AFB Columbus Ohio', 'auto-link')   // exact
expect('Lockbourne Air Force Base', 'Lockbourne AFB Columbus Ohio', 'proposal+')      // THE live failure
expect('Lockbourne AFB', 'Lockbourne Air Force Base', 'auto-link')                    // pure abbreviation
expect('Leola Lapidus', 'Leola Lapides', 'proposal')                                  // typo (2026-05-22)
expect('Leo', 'Leola Lapidus', 'none')                                                // false positive guard
expect('Nancy', 'Nancy Halliday', 'proposal')                                         // legit containment
expect('Madrid', 'Lockbourne AFB Columbus Ohio', 'none')                              // unrelated
expect('RAF Mildenhall', 'Royal Air Force Mildenhall', 'auto-link')                   // RAF expansion
expect('Base', 'Lockbourne AFB Columbus Ohio', 'none')                                // lone common token
expect('Commaruga', 'Playa Coma Ruga', 'proposal')     // space-collapse disguise — live failure 2026-07-09
expect('Comaruga', 'Playa Coma Ruga', 'proposal')      // same, without the doubled m
expect('Leo', 'Playa Coma Ruga', 'none')               // collapse rule respects the micro-name guard
expect('Marta', 'Playa Coma Ruga', 'none')             // short unrelated name can't window-match

async function main() {
console.log('\\nDB fixture resolution (no Claude):')
const supabase = createAdminClient()
const { data: users } = await supabase.auth.admin.listUsers()
const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
const { data: fixture, error } = await supabase.from('entities').insert({
  user_id: user.id, type: 'place', canonical_name: 'ZZTestville AFB Marsden County',
}).select('id').single()
if (error) { bad('fixture insert: ' + error.message); process.exit(1) }
try {
  const hit = await resolveAgainstExisting(supabase, user.id, 'place', 'ZZTestville Air Force Base')
  if (hit.match?.id === fixture.id && hit.confidence >= 0.7) {
    ok('resolveAgainstExisting found the fixture (' + hit.confidence.toFixed(2) + ', ' + hit.rationale + ')')
  } else {
    bad('fixture not matched: ' + JSON.stringify({ id: hit.match?.id, confidence: hit.confidence }))
  }
  // Cross-type: same probe extracted as 'organization' must still find
  // the place-typed fixture (institutions type-flip run to run).
  const cross = await resolveAgainstExisting(supabase, user.id, 'organization', 'ZZTestville Air Force Base')
  if (cross.match?.id === fixture.id && cross.confidence >= 0.7) {
    ok('organization-typed probe matched the place fixture (' + cross.confidence.toFixed(2) + ')')
  } else {
    bad('cross-type probe missed the fixture: ' + JSON.stringify({ id: cross.match?.id, confidence: cross.confidence }))
  }
  const miss = await resolveAgainstExisting(supabase, user.id, 'place', 'Completely Unrelated Harbor')
  if (!miss.match || miss.confidence < 0.7) ok('unrelated probe stayed unmatched')
  else bad('unrelated probe matched ' + miss.match.canonical_name + ' at ' + miss.confidence.toFixed(2))
} finally {
  await supabase.from('entities').delete().eq('id', fixture.id)
}

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.entity-matching-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
