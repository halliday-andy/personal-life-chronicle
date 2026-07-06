#!/usr/bin/env node
/**
 * Proof for globe stub resolution (lib/globe/stub-resolution.ts,
 * 2026-07-06) — the deferred Slice-2 "mentioned_people" work.
 *
 * Asserts (relative-only, against this script's OWN fixtures — the live
 * shared DB has real data):
 *   1. An EXACT-name person stub links directly (memory_entities row,
 *      no proposal).
 *   2. An organization stub matching a PLACE entity exactly also links
 *      (the #38 institution place/org blur).
 *   3. An unknown name becomes a review_queue entity_stub_proposal row
 *      (nothing silently created).
 *   4. A single-token short variant ("Mike" next to "Mike …") is skipped.
 *   5. Re-running is idempotent — everything reports already_settled,
 *      no duplicate links or queue rows.
 *   6. settleStubState marks a stub dismissed so a re-run skips it.
 *
 * Creates TESTSTUBRES fixtures (entities, relationship, memory, queue
 * rows); deletes everything in a finally block.
 * Run: node scripts/verify-globe-stub-resolution.mjs
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
import { resolveGlobePinStubs, settleStubState } from '${projectRoot}/lib/globe/stub-resolution'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

async function main() {
  const supabase = createAdminClient()
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com')
  if (!user) { console.error('test user not found'); process.exit(1) }

  const entIds: string[] = []
  let memId: string | null = null
  let relId: string | null = null

  try {
    const mkEnt = async (name: string, type: string) => {
      const { data, error } = await supabase.from('entities')
        .insert({ user_id: user.id, type, canonical_name: name })
        .select('id').single()
      if (error || !data) throw new Error('entity fixture failed: ' + error?.message)
      entIds.push(data.id); return data.id as string
    }

    // Fixtures: a pin place, a subject person, an exact-match person, a
    // place standing in for an organization, a memory, a pin relationship
    // carrying extraction stubs.
    const pinPlace = await mkEnt('TESTSTUBRES Pin Place', 'place')
    const subject = await mkEnt('TESTSTUBRES Subject', 'person')
    const exactPerson = await mkEnt('TESTSTUBRES Karl Meier', 'person')
    const orgAsPlace = await mkEnt('TESTSTUBRES Alpine School', 'place')

    const { data: mem, error: memErr } = await supabase.from('memories')
      .insert({ user_id: user.id, content_raw: 'TESTSTUBRES recollection mentioning several people.',
                source: 'text_entry', confidence: 'certain', is_draft: false,
                capture_mode: 'globe_onboarding', metadata: { skip_async_fanout: true } })
      .select('id').single()
    if (memErr || !mem) throw new Error('memory fixture failed: ' + memErr?.message)
    memId = mem.id

    const { data: rt } = await supabase.from('relationship_types').select('id').eq('code', 'lived_at').single()
    const { data: rel, error: relErr } = await supabase.from('relationships')
      .insert({ user_id: user.id, subject_id: subject, object_id: pinPlace, type_id: rt!.id,
                metadata: { globe_pin: true, globe_extraction: {
                  mentioned_people: ['TESTSTUBRES Karl Meier', 'TESTSTUBRES Heidi Brandt', 'Mike', 'Mike TESTSTUBRESpaplow'],
                  mentioned_organisations: ['TESTSTUBRES Alpine School'],
                } } })
      .select('id').single()
    if (relErr || !rel) throw new Error('relationship fixture failed: ' + relErr?.message)
    relId = rel.id

    // ── First run ──
    const r1 = await resolveGlobePinStubs(supabase, { userId: user.id, relationshipId: relId!, memoryId: memId! })

    // 1. Exact person linked
    if (r1.linked.some((l) => l.entity_id === exactPerson)) ok('exact person stub linked directly')
    else bad('exact person not linked: ' + JSON.stringify(r1.linked))
    const { data: links } = await supabase.from('memory_entities')
      .select('entity_id, role').eq('memory_id', memId!)
    if ((links ?? []).some((l: any) => l.entity_id === exactPerson && l.role === 'participant')) {
      ok('memory_entities row exists with role participant')
    } else bad('missing participant link row')

    // 2. Organization stub matched the place entity (institution blur)
    if (r1.linked.some((l) => l.entity_id === orgAsPlace)) ok('organization stub linked to the place entity (#38 blur)')
    else bad('org→place exact match failed: ' + JSON.stringify(r1.linked))

    // 3. Unknown name proposed, nothing created
    const heidi = r1.proposed.find((p) => p.name === 'TESTSTUBRES Heidi Brandt')
    if (heidi) ok('unknown name became a proposal (no silent creation)')
    else bad('unknown name not proposed: ' + JSON.stringify(r1.proposed))
    const { data: heidiEnt } = await supabase.from('entities')
      .select('id').eq('user_id', user.id).eq('canonical_name', 'TESTSTUBRES Heidi Brandt')
    if ((heidiEnt ?? []).length === 0) ok('no entity row was created for the proposed name')
    else bad('proposal silently created an entity')

    // 4. Short variant skipped
    if (r1.skipped_variants.includes('Mike') && r1.proposed.some((p) => p.name === 'Mike TESTSTUBRESpaplow')) {
      ok('short variant "Mike" skipped; the full name proposed')
    } else bad('variant handling wrong: ' + JSON.stringify({ skipped: r1.skipped_variants, proposed: r1.proposed.map((p) => p.name) }))

    // 5. Idempotent re-run
    const r2 = await resolveGlobePinStubs(supabase, { userId: user.id, relationshipId: relId!, memoryId: memId! })
    const { data: qRows } = await supabase.from('review_queue')
      .select('id').eq('user_id', user.id).eq('item_type', 'entity_stub_proposal').eq('item_id', memId!)
    if (r2.linked.length === 0 && r2.proposed.length === 0 && (qRows ?? []).length === r1.proposed.length) {
      ok('re-run is idempotent (all settled; no duplicate proposals)')
    } else bad('re-run not idempotent: ' + JSON.stringify({ r2, queueCount: (qRows ?? []).length }))

    // 6. settleStubState dismiss honored
    await settleStubState(supabase, { relationshipId: relId!, entityType: 'person',
      name: 'TESTSTUBRES Heidi Brandt', status: 'dismissed' })
    const r3 = await resolveGlobePinStubs(supabase, { userId: user.id, relationshipId: relId!, memoryId: memId! })
    if (!r3.proposed.some((p) => p.name === 'TESTSTUBRES Heidi Brandt')) ok('dismissed stub is not re-proposed')
    else bad('dismissed stub re-proposed')
  } finally {
    if (memId) {
      await supabase.from('review_queue').delete().eq('item_id', memId)
      await supabase.from('memory_entities').delete().eq('memory_id', memId)
      await supabase.from('memories').delete().eq('id', memId)
    }
    if (relId) await supabase.from('relationships').delete().eq('id', relId)
    if (entIds.length) await supabase.from('entities').delete().in('id', entIds)
    const { data: left } = await supabase.from('entities')
      .select('id').eq('user_id', user.id).ilike('canonical_name', 'TESTSTUBRES%')
    if ((left ?? []).length === 0) ok('cleanup complete — no TESTSTUBRES residue')
    else bad('TESTSTUBRES residue remains: ' + JSON.stringify(left))
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.stub-resolution-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
