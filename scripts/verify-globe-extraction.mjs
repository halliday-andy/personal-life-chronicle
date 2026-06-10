#!/usr/bin/env node
/**
 * Slice 2 proof — globe modal extraction (lib/globe/extraction.ts,
 * the core the Inngest globe-extraction-agent wraps).
 *
 * On a temp pin with a deliberately fact-rich recollection, asserts:
 *   - runGlobeExtraction returns status 'extracted'
 *   - relationships.metadata gains globe_extraction + top-level
 *     residence_type / move_reason
 *   - the obvious named person ("Nancy") is in mentioned_people
 *   - content_raw is byte-identical after the run (Raw Vault)
 *   - an assumption_log row exists (globe_modal_extraction, right memory)
 *   - a pin with no recollection is skipped, writes nothing
 *
 * Relative-only assertions; non-destructive (temp pins + the log rows
 * this run created are deleted). Calls Claude once (~1k tokens).
 * Run: node scripts/verify-globe-extraction.mjs
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
import { runGlobeExtraction } from '${projectRoot}/lib/globe/extraction'

const admin = createAdminClient()
let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

const BODY = 'We moved into a small rented apartment in Madrid right after my father was posted there by the Air Force. I lived there with my parents and my sister Nancy until I left for college.'

async function makePin(body: string | null) {
  const { data, error } = await admin.rpc('create_residence_pin', {
    p_user_id: USER_ID, p_self_entity_id: SELF_ID, p_lng: -3.70, p_lat: 40.41,
    p_name: 'TESTPIN extraction', p_place_subtype: 'city', p_country_code: 'XX',
    p_when_text: null, p_body_text: body, p_position: null,
  })
  if (error) throw new Error('create pin: ' + error.message)
  return Array.isArray(data) ? data[0] : data
}

let USER_ID = ''
let SELF_ID = ''

async function main() {
  const { data: users } = await admin.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
  USER_ID = user.id
  const { data: self } = await admin.from('entities').select('id')
    .eq('user_id', USER_ID).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
  if (!self) { bad('no self entity'); process.exit(1) }
  SELF_ID = self.id

  const rich = await makePin(BODY)
  const bare = await makePin(null)
  const cleanupLogIds: string[] = []

  try {
    // ── rich pin: full extraction ──
    const res = await runGlobeExtraction(admin, {
      userId: USER_ID, relationshipId: rich.relationship_id, memoryId: rich.memory_id,
    })
    res.status === 'extracted' ? ok('extraction ran (status extracted)') : bad('status: ' + JSON.stringify(res))

    const { data: rel } = await admin.from('relationships')
      .select('metadata').eq('id', rich.relationship_id).single()
    const meta = rel!.metadata ?? {}
    meta.globe_extraction ? ok('metadata.globe_extraction written') : bad('no globe_extraction in metadata')
    meta.residence_type ? ok('top-level residence_type: ' + meta.residence_type) : bad('no top-level residence_type')
    meta.move_reason ? ok('top-level move_reason: ' + meta.move_reason) : bad('no top-level move_reason')
    const people = meta.globe_extraction?.mentioned_people ?? []
    people.some((p: string) => p.toLowerCase().includes('nancy'))
      ? ok('mentioned_people includes Nancy')
      : bad('Nancy missing from mentioned_people: ' + JSON.stringify(people))

    const { data: mem } = await admin.from('memories')
      .select('content_raw').eq('id', rich.memory_id).single()
    mem!.content_raw === BODY ? ok('content_raw untouched (Raw Vault)') : bad('content_raw changed!')

    const { data: logs } = await admin.from('assumption_log')
      .select('id, assumption_type, memory_id')
      .eq('user_id', USER_ID).eq('assumption_type', 'globe_modal_extraction')
      .eq('memory_id', rich.memory_id)
    logs?.length === 1
      ? ok('one assumption_log row for this memory')
      : bad('expected 1 log row, got ' + (logs?.length ?? 0))
    for (const l of logs ?? []) cleanupLogIds.push(l.id)

    // ── bare pin: skip path. A pin saved with no body has no memory at
    // all (memory_id null), so probe with a nonexistent memory id — the
    // lookup must miss and the run must write nothing. ──
    const skip = await runGlobeExtraction(admin, {
      userId: USER_ID, relationshipId: bare.relationship_id, memoryId: crypto.randomUUID(),
    })
    skip.status === 'skipped' ? ok('no-text pin skipped (' + (skip as any).reason + ')') : bad('expected skip, got ' + JSON.stringify(skip))
    const { data: bareRel } = await admin.from('relationships')
      .select('metadata').eq('id', bare.relationship_id).single()
    !(bareRel!.metadata ?? {}).globe_extraction
      ? ok('skip wrote nothing to metadata')
      : bad('skip path wrote metadata')
  } finally {
    if (cleanupLogIds.length) await admin.from('assumption_log').delete().in('id', cleanupLogIds)
    await admin.rpc('delete_residence_pin', { p_relationship_id: rich.relationship_id, p_user_id: USER_ID })
    await admin.rpc('delete_residence_pin', { p_relationship_id: bare.relationship_id, p_user_id: USER_ID })
    console.log('Temp pins + log rows deleted.')
  }

  if (failures) { console.error('\\nFAIL: ' + failures + ' assertion(s)'); process.exit(1) }
  console.log('\\nPASS')
}

main().catch((e) => { console.error(e); process.exit(1) })
`

console.log('Slice 2 proof (globe modal extraction)\n')
const tmp = join(projectRoot, '.extraction-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
