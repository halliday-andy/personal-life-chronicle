#!/usr/bin/env node
/**
 * Proof for primary-relationship references (2026-07-10, Andy's direction
 * from stub-resolution QA) + the alias fold both resolve paths now share.
 *
 * 1. appendAlias (pure): folds without clobbering, ci-dedupes, never
 *    duplicates the canonical name.
 * 2. LLM eval — entity agent (capture path, preview mode): "my father" is
 *    extracted verbatim as a person; "my friend" is not.
 * 3. LLM eval — globe extraction (pin path, own fixture): mentioned_people
 *    carries "my father" and the named person; not the friend.
 *
 * Costs two LLM calls. Run: node scripts/verify-relational-references.mjs
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
import { appendAlias } from '${projectRoot}/lib/entity/alias'
import { runEntity } from '${projectRoot}/lib/agents/entity/core'
import { runGlobeExtraction } from '${projectRoot}/lib/globe/extraction'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

const STORY =
  'That winter my father drove up every weekend to help me fix the place. ' +
  'Lorraine kept us fed, and my friend from the ski school lent us his tools.'

async function main() {
  // ── 1. appendAlias pure semantics ──
  const a1 = appendAlias(['Leo'], 'my father', 'Bill Halliday')
  if (a1 && a1.join('|') === 'Leo|my father') ok('fold appends without clobbering existing aliases')
  else bad('fold clobbered or missed: ' + JSON.stringify(a1))
  if (appendAlias(['my father'], 'My Father', 'Bill Halliday') === null) ok('ci-duplicate alias → no change')
  else bad('duplicate alias re-added')
  if (appendAlias([], 'Bill Halliday', 'Bill Halliday') === null) ok('canonical name never becomes its own alias')
  else bad('canonical duplicated as alias')
  if (appendAlias(null, '  my mother  ', 'Jean') ?.join('') === 'my mother') ok('null aliases start a fresh list, trimmed')
  else bad('null-alias fold wrong')

  const supabase = createAdminClient()
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]

  // ── 2. Entity agent (preview — persists nothing) ──
  console.log('LLM eval 1/2: entity agent preview\\u2026')
  const res = await runEntity({ user_id: user.id, memory_id: '00000000-0000-0000-0000-000000000000', text: STORY, persist: false, supabase } as any)
  const names = (res.proposals ?? []).map((e: any) => String(e.extracted_name ?? '').toLowerCase())
  console.log('  extracted:', JSON.stringify(names))
  if (names.includes('my father')) ok("entity agent extracts 'my father' verbatim (primary relation)")
  else bad("entity agent missed 'my father'")
  if (names.some((n: string) => n.includes('lorraine'))) ok('named person still extracted')
  else bad('named person missed')
  if (!names.some((n: string) => n.includes('friend'))) ok("'my friend' correctly skipped (non-primary)")
  else bad("'my friend' was extracted")

  // ── 3. Globe extraction (own fixture pin) ──
  const { data: self } = await supabase.from('entities').select('id')
    .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
  const rel = (row: any) => (Array.isArray(row) ? row[0] : row)
  let pinRel: string | null = null
  try {
    const { data: pd, error: ep } = await supabase.rpc('create_residence_pin', {
      p_user_id: user.id, p_self_entity_id: self!.id, p_lng: 4, p_lat: 43,
      p_name: 'TESTREL fixture cabin', p_place_subtype: 'city', p_country_code: 'XX',
      p_when_text: null, p_body_text: STORY, p_position: null, p_type_code: 'logged_at', p_anchor_residence_id: null,
    })
    if (ep) throw new Error('fixture pin failed: ' + ep.message)
    pinRel = rel(pd).relationship_id
    console.log('LLM eval 2/2: globe extraction\\u2026')
    const g = await runGlobeExtraction(supabase, {
      userId: user.id, relationshipId: pinRel!, memoryId: rel(pd).memory_id,
    })
    if (g.status !== 'extracted') throw new Error('globe extraction failed: ' + JSON.stringify(g))
    const people = (g.extraction!.mentioned_people ?? []).map((p: string) => p.toLowerCase())
    console.log('  mentioned_people:', JSON.stringify(people))
    if (people.includes('my father')) ok("globe extraction lists 'my father' verbatim")
    else bad("globe extraction missed 'my father'")
    if (!people.some((p: string) => p.includes('friend'))) ok("'my friend' stays out of mentioned_people")
    else bad("'my friend' leaked into mentioned_people")
  } finally {
    if (pinRel) {
      try { await supabase.rpc('delete_residence_pin', { p_relationship_id: pinRel, p_user_id: user.id }) } catch { /* */ }
    }
    const { data: strays } = await supabase.from('entities').select('id').ilike('canonical_name', 'TESTREL%')
    for (const e of strays ?? []) {
      await supabase.from('memory_entities').delete().eq('entity_id', e.id)
      await supabase.from('relationships').delete().eq('object_id', e.id)
      await supabase.from('entities').delete().eq('id', e.id)
    }
    const { data: left } = await supabase.from('entities').select('id').ilike('canonical_name', 'TESTREL%')
    if ((left ?? []).length === 0) ok('cleanup complete — no TESTREL residue')
    else bad('TESTREL residue remains')
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.relational-refs-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
