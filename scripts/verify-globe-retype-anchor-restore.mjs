#!/usr/bin/env node
/**
 * Proof for the re-type anchor/tether restore fix (Slice 3 close-out,
 * Phase-5 finding 2).
 *
 * Bug: marker → primary → marker re-typing lost the anchor. When a marker
 * is re-typed to a primary, update_residence_pin set anchor_residence_id =
 * NULL and forgot the old value, so on revert the picker fell to
 * "standalone" and no dashed tether redrew.
 *
 * Fix: on the marker → primary leg, stash the old anchor into
 * relationships.metadata.prior_anchor_residence_id, and surface it from
 * get_residence_pins so the edit panel can default the anchor picker back
 * to the prior primary on revert.
 *
 * Relative-only against this script's own fixtures; self-cleaning.
 * Run: node scripts/verify-globe-retype-anchor-restore.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(projectRoot, '.env.local'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('='); if (i < 0) continue
  const k = line.slice(0, i).trim(); if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let failures = 0
const ok = (m) => console.log(`  ✓ ${m}`)
const bad = (m) => { console.error(`  ✗ ${m}`); failures++ }

console.log('Globe re-type anchor restore proof\n')

const { data: users } = await admin.auth.admin.listUsers()
const user = users.users.find((u) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
const { data: self } = await admin.from('entities').select('id')
  .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
if (!self) { bad('no self entity'); process.exit(1) }

const mk = (lng, lat, name, type, anchor) => admin.rpc('create_residence_pin', {
  p_user_id: user.id, p_self_entity_id: self.id, p_lng: lng, p_lat: lat,
  p_name: name, p_place_subtype: 'city', p_country_code: 'XX',
  p_when_text: null, p_body_text: null, p_position: null,
  p_type_code: type, p_anchor_residence_id: anchor ?? null,
})
const retype = (id, type, anchor) => admin.rpc('update_residence_pin', {
  p_relationship_id: id, p_user_id: user.id, p_lng: null, p_lat: null,
  p_name: null, p_place_subtype: null, p_country_code: null, p_when_text: null,
  p_body: null, p_type_code: type, p_anchor_residence_id: anchor ?? null,
})
const rel = (row) => (Array.isArray(row) ? row[0] : row)
const created = []

try {
  // Fixtures: primary P, marker M (vacation) anchored to P.
  const { data: pd, error: ep } = await mk(0, 20, 'TESTPIN restore P', 'lived_at', null)
  if (ep) throw new Error('P: ' + ep.message)
  const P = rel(pd).relationship_id; created.push(P)

  const { data: md, error: em } = await mk(2, 22, 'TESTPIN restore M', 'vacationed_at', P)
  if (em) throw new Error('M: ' + em.message)
  const M = rel(md).relationship_id; created.push(M)

  const { data: m0 } = await admin.from('relationships').select('anchor_residence_id').eq('id', M).single()
  if (m0.anchor_residence_id === P) ok('marker M starts anchored to primary P')
  else bad('M did not anchor to P: ' + m0.anchor_residence_id)

  // Re-type M to primary (lived_at). The old anchor (P) must be stashed.
  const { error: e1 } = await retype(M, 'lived_at', null)
  if (e1) throw new Error('retype M→primary: ' + e1.message)

  const { data: m1 } = await admin.from('relationships').select('anchor_residence_id, metadata').eq('id', M).single()
  if (m1.anchor_residence_id === null) ok('M→primary clears the live anchor (enters the spine)')
  else bad('M still carries a live anchor as a primary: ' + m1.anchor_residence_id)
  if (m1.metadata?.prior_anchor_residence_id === P) ok('M→primary stashed metadata.prior_anchor_residence_id = P')
  else bad('prior anchor was NOT stashed: ' + JSON.stringify(m1.metadata?.prior_anchor_residence_id))

  // get_residence_pins must surface the stash so the edit panel can default to it.
  const { data: pins, error: eg } = await admin.rpc('get_residence_pins', { p_user_id: user.id })
  if (eg) throw new Error('get_residence_pins: ' + eg.message)
  const mPin = (pins ?? []).find((p) => p.relationship_id === M)
  if (!mPin) bad('M missing from get_residence_pins')
  else if (mPin.prior_anchor_residence_id === P) ok('get_residence_pins surfaces prior_anchor_residence_id = P')
  else bad('get_residence_pins prior_anchor_residence_id wrong/missing: ' + JSON.stringify(mPin.prior_anchor_residence_id))
} catch (e) {
  bad(e.message)
} finally {
  for (const id of created.reverse()) {
    try { await admin.rpc('delete_residence_pin', { p_relationship_id: id, p_user_id: user.id }) } catch { /* best effort */ }
  }
  const { data: ents } = await admin.from('entities').select('id').eq('user_id', user.id).like('canonical_name', 'TESTPIN restore %')
  for (const e of ents ?? []) {
    await admin.from('memory_entities').delete().eq('entity_id', e.id)
    await admin.from('relationships').delete().eq('object_id', e.id)
    await admin.from('entities').delete().eq('id', e.id)
  }
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
