#!/usr/bin/env node
/**
 * Proof for Slice 7.2 — Life's Cast metadata flag + content-only filter.
 *
 * Runs the REAL applyLifesCast / isInLifesCast / entityHasContent from lib.
 *
 * Asserts:
 *   1. Promotion sets in_lifes_cast=true while PRESERVING other metadata
 *      keys (is_self etc. are load-bearing — the whole point of the pure
 *      merge function).
 *   2. Demotion removes the key entirely (no lingering false), again
 *      preserving neighbors.
 *   3. Round-trip against the live DB on a fixture person: promote →
 *      readback true + neighbor intact; demote → readback false.
 *   4. entityHasContent: blank entity → false; each signal (mention, note,
 *      stub, description) alone → true.
 *
 * Self-cleaning. Run: node scripts/verify-lifes-cast.mjs
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
import { applyLifesCast, isInLifesCast } from '${projectRoot}/lib/entity/lifes-cast'
import { entityHasContent } from '${projectRoot}/lib/entity/content'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

async function main() {
  // ── 1 + 2. Pure merge semantics ──
  const before = { is_self: true, prior_anchor_residence_id: 'abc-123' }
  const promoted = applyLifesCast(before, true)
  if (promoted.in_lifes_cast === true && promoted.is_self === true && promoted.prior_anchor_residence_id === 'abc-123')
    ok('promotion sets the flag and preserves neighboring metadata keys')
  else bad('promotion clobbered metadata: ' + JSON.stringify(promoted))
  if ((before as any).in_lifes_cast === undefined) ok('merge does not mutate its input')
  else bad('applyLifesCast mutated the input object')

  const demoted = applyLifesCast(promoted, false)
  if (!('in_lifes_cast' in demoted) && demoted.is_self === true)
    ok('demotion removes the key entirely, neighbors intact')
  else bad('demotion left residue or clobbered: ' + JSON.stringify(demoted))
  if (isInLifesCast(promoted) && !isInLifesCast(demoted) && !isInLifesCast(null))
    ok('isInLifesCast reads promoted/demoted/null correctly')
  else bad('isInLifesCast misread membership')

  // ── 3. Live round-trip on a fixture person ──
  const admin = createAdminClient()
  const { data: users } = await admin.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
  let fixtureId: string | null = null
  try {
    const { data: person, error } = await admin.from('entities')
      .insert({ user_id: user.id, type: 'person', canonical_name: 'TESTCAST Person', metadata: { marker: 'keepme' } })
      .select('id, metadata').single()
    if (error || !person) throw new Error('fixture failed: ' + error?.message)
    fixtureId = person.id

    await admin.from('entities')
      .update({ metadata: applyLifesCast(person.metadata, true) })
      .eq('id', person.id)
    const { data: after } = await admin.from('entities').select('metadata').eq('id', person.id).single()
    if (isInLifesCast(after?.metadata) && (after?.metadata as any)?.marker === 'keepme')
      ok('live promote: flag set, neighbor key survived the write')
    else bad('live promote wrong: ' + JSON.stringify(after?.metadata))

    await admin.from('entities')
      .update({ metadata: applyLifesCast(after?.metadata, false) })
      .eq('id', person.id)
    const { data: after2 } = await admin.from('entities').select('metadata').eq('id', person.id).single()
    if (!isInLifesCast(after2?.metadata) && (after2?.metadata as any)?.marker === 'keepme')
      ok('live demote: flag gone, neighbor key still intact')
    else bad('live demote wrong: ' + JSON.stringify(after2?.metadata))
  } catch (e) {
    bad(e instanceof Error ? e.message : String(e))
  } finally {
    if (fixtureId) await admin.from('entities').delete().eq('id', fixtureId)
    const { data: left } = await admin.from('entities').select('id').ilike('canonical_name', 'TESTCAST%')
    if ((left ?? []).length === 0) ok('cleanup complete — no TESTCAST residue')
    else bad('TESTCAST residue remains')
  }

  // ── 4. Content predicate ──
  const blank = { mention_count: 0, note_count: 0, stub_count: 0, description: null }
  if (!entityHasContent(blank)) ok('blank entity has no content')
  else bad('blank entity misread as contentful')
  const signals = [
    { ...blank, mention_count: 1 },
    { ...blank, note_count: 1 },
    { ...blank, stub_count: 1 },
    { ...blank, description: 'a line' },
  ]
  if (signals.every(entityHasContent) && !entityHasContent({ ...blank, description: '   ' }))
    ok('each signal alone counts; whitespace description does not')
  else bad('content predicate wrong on a signal')

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.lifes-cast-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
