#!/usr/bin/env node
/**
 * Eval: the Entity sub-agent types a named *physical location the user was
 * at* as a `place`, not an `organization`. Reserves `organization` for
 * institutions experienced as membership/employment with no single site.
 *
 * Why (Andy's 2026-06-17 QA): a military base, school, etc. has a physical
 * location and belongs on the globe as a place — only the place row carries
 * geom + the residence relationship. The old prompt told the model to type
 * bases as organizations ("named institution"); that mis-typed Loring AFB /
 * Mather AFB as organizations, duplicating his place pins. The rule now is
 * "physical location wins" (lib/agents/entity/core.ts SYSTEM_PROMPT). A base
 * and the commands stationed on it are different entities: base=place,
 * command/unit=organization.
 *
 * This is an LLM eval — it calls Claude once per case (~5 calls). Typing is
 * a model decision so it is not perfectly deterministic; the cases are
 * chosen to be unambiguous under the rule. persist=false → no DB writes.
 * Run: node scripts/verify-entity-typing.mjs
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

// [memory text, name token to find (lowercase), expected type]
const CASES: Array<[string, string, string]> = [
  ['I was stationed at Loring Air Force Base for three years in the 1970s.', 'loring', 'place'],
  ['As a boy I went to Damon Elementary School every morning.', 'damon', 'place'],
  ['I served under the Strategic Air Command during the Cold War.', 'air command', 'organization'],
  ['My sister Nancy used to visit us every summer.', 'nancy', 'person'],
  ['We moved to Madrid when I was ten years old.', 'madrid', 'place'],
]

async function main() {
  const { data: users } = await admin.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]

  for (const [text, token, want] of CASES) {
    const res = await runEntity({ supabase: admin, user_id: user.id, text, persist: false })
    const hit = res.proposals.find((p) => p.extracted_name.toLowerCase().includes(token))
    if (!hit) { bad(JSON.stringify(token) + ' not extracted from: ' + JSON.stringify(text)); continue }
    if (hit.type === want) ok(JSON.stringify(hit.extracted_name) + ' → ' + hit.type)
    else bad(JSON.stringify(hit.extracted_name) + ' → ' + hit.type + ' (wanted ' + want + ')')
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

console.log('Entity typing eval (place vs organization)\n')
const tmp = join(projectRoot, '.entity-typing-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
