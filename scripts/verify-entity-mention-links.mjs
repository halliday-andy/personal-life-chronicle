#!/usr/bin/env node
/**
 * Proof for Slice 7.1 — mention out-links on the Entity View.
 *
 * A mention that lives on a globe pin must resolve to that pin's
 * relationship id (→ /journey?pin=); everything else must resolve to
 * nothing (→ /memories row anchor). Runs the REAL mapMentionsToPins from
 * lib/entity/mention-pins.ts against live fixtures created here.
 *
 * Asserts (relative-only, own fixtures; live shared DB):
 *   1. The pin's own recollection (role='location' link) maps to the pin's
 *      relationship id.
 *   2. A person-only mention (role='participant', no location link) maps to
 *      nothing — the /memories anchor fallback.
 *   3. A role='mentioned' link to a pinned place does NOT map — only
 *      role='location' is the pin discriminator (2026-07-07 incident rule).
 *
 * Self-cleaning finally block. Run: node scripts/verify-entity-mention-links.mjs
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
import { mapMentionsToPins, PIN_TYPE_CODES } from '${projectRoot}/lib/entity/mention-pins'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

async function main() {
  const admin = createAdminClient()
  const { data: users } = await admin.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
  const { data: self } = await admin.from('entities').select('id')
    .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
  if (!self) { console.error('no self entity'); process.exit(1) }

  const rel = (row: any) => (Array.isArray(row) ? row[0] : row)
  const pins: string[] = []
  const memories: string[] = []
  const entities: string[] = []

  try {
    // ── Fixtures ──
    // A pin whose creation writes the pin's own recollection (role='location').
    const { data: pd, error: ep } = await admin.rpc('create_residence_pin', {
      p_user_id: user.id, p_self_entity_id: self.id, p_lng: 3, p_lat: 42,
      p_name: 'TESTMENTION pin place', p_place_subtype: 'city', p_country_code: 'XX',
      p_when_text: null, p_body_text: 'TESTMENTION afternoon with a friend at the lookout',
      p_position: null, p_type_code: 'logged_at', p_anchor_residence_id: null,
    })
    if (ep) throw new Error('pin create failed: ' + ep.message)
    const pinRelId = rel(pd).relationship_id as string
    const pinPlaceId = rel(pd).place_entity_id as string
    const pinMemoryId = rel(pd).memory_id as string
    pins.push(pinRelId)

    // The person both memories mention.
    const { data: person, error: epe } = await admin.from('entities')
      .insert({ user_id: user.id, type: 'person', canonical_name: 'TESTMENTION Friend' })
      .select('id').single()
    if (epe || !person) throw new Error('person fixture failed: ' + epe?.message)
    entities.push(person.id)

    // Link the pin's recollection to the person (a mention ON a pin).
    await admin.from('memory_entities').insert({ memory_id: pinMemoryId, entity_id: person.id, role: 'participant' })

    // A second, pin-less memory mentioning the person, plus a 'mentioned'
    // link to the pinned place (the role that must NOT resolve to a pin).
    const { data: mem2, error: em2 } = await admin.from('memories').insert({
      user_id: user.id, content_raw: 'TESTMENTION a phone call years later',
      source: 'text_entry', is_draft: false,
    }).select('id').single()
    if (em2 || !mem2) throw new Error('memory fixture failed: ' + em2?.message)
    memories.push(mem2.id)
    await admin.from('memory_entities').insert([
      { memory_id: mem2.id, entity_id: person.id, role: 'participant' },
      { memory_id: mem2.id, entity_id: pinPlaceId, role: 'mentioned' },
    ])

    // ── Replicate the Entity View page's query shape for the person ──
    const mentionIds = [pinMemoryId, mem2.id]
    const { data: locLinks } = await admin.from('memory_entities')
      .select('memory_id, entity_id').in('memory_id', mentionIds).eq('role', 'location')
    const placeIds = [...new Set((locLinks ?? []).map((l: any) => l.entity_id))]
    const { data: relRows } = await admin.from('relationships')
      .select('id, object_id, relationship_types!inner(code)')
      .eq('user_id', user.id).in('object_id', placeIds.length ? placeIds : ['00000000-0000-0000-0000-000000000000'])
    const pinRows = (relRows ?? [])
      .filter((r: any) => {
        const rt = Array.isArray(r.relationship_types) ? r.relationship_types[0] : r.relationship_types
        return rt && PIN_TYPE_CODES.has(rt.code)
      })
      .map((r: any) => ({ relationship_id: r.id, place_entity_id: r.object_id }))

    const map = mapMentionsToPins((locLinks ?? []) as any, pinRows)

    // ── 1. Pin-anchored mention → its pin ──
    if (map.get(pinMemoryId) === pinRelId) ok('pin recollection maps to its pin relationship (→ /journey?pin=)')
    else bad('pin recollection mapped wrong: ' + JSON.stringify(map.get(pinMemoryId)))

    // ── 2. Pin-less mention → nothing ──
    if (!map.has(mem2.id)) ok('pin-less mention maps to nothing (→ /memories row anchor)')
    else bad('pin-less mention wrongly mapped to ' + map.get(mem2.id))

    // ── 3. role='mentioned' to a pinned place is not a pin anchor ──
    // mem2 DOES link to the pinned place, but with role='mentioned' — the
    // .eq('role','location') query guard must keep it out of the link set
    // (and therefore out of the mapping, asserted in 2 above).
    const leaked = (locLinks ?? []).some((l: any) => l.memory_id === mem2.id)
    if (!leaked) ok("role='mentioned' link never enters the location-link set")
    else bad("role='mentioned' leaked into the location-link set")
  } catch (e) {
    bad(e instanceof Error ? e.message : String(e))
  } finally {
    for (const id of pins.reverse()) {
      try { await admin.rpc('delete_residence_pin', { p_relationship_id: id, p_user_id: user.id }) } catch { /* best effort */ }
    }
    for (const id of memories) {
      await admin.from('memory_entities').delete().eq('memory_id', id)
      await admin.from('memories').delete().eq('id', id)
    }
    const { data: ents } = await admin.from('entities').select('id')
      .eq('user_id', user.id).like('canonical_name', 'TESTMENTION%')
    for (const e of ents ?? []) {
      await admin.from('memory_entities').delete().eq('entity_id', e.id)
      await admin.from('relationships').delete().eq('object_id', e.id)
      await admin.from('entities').delete().eq('id', e.id)
    }
    const { data: left } = await admin.from('entities').select('id').ilike('canonical_name', 'TESTMENTION%')
    if ((left ?? []).length === 0) ok('cleanup complete — no TESTMENTION residue')
    else bad('TESTMENTION residue remains: ' + JSON.stringify(left))
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.entity-mention-links-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
