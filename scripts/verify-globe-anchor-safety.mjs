#!/usr/bin/env node
/**
 * Proof for 20260615120000_globe_anchor_safety.sql (Gemini commentary A & C).
 *
 *   C — anchor validation: a marker can anchor to the user's own primary,
 *       but NOT to a non-primary relationship nor a nonexistent id.
 *   A — re-typing a primary away from lived_at orphans the markers that
 *       were anchored to it (their anchor_residence_id → NULL).
 *
 * Relative-only against this script's own fixtures; cleans up.
 * Run: node scripts/verify-globe-anchor-safety.mjs
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

console.log('Globe anchor-safety proof\n')

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
const rel = (row) => (Array.isArray(row) ? row[0] : row)
const created = []

try {
  // Fixtures: two primaries P1, P2.
  const { data: p1d, error: e1 } = await mk(0, 10, 'TESTPIN anchor P1', 'lived_at', null)
  if (e1) throw new Error('P1: ' + e1.message)
  const P1 = rel(p1d).relationship_id; created.push(P1)
  const { data: p2d, error: e2 } = await mk(1, 11, 'TESTPIN anchor P2', 'lived_at', null)
  if (e2) throw new Error('P2: ' + e2.message)
  const P2 = rel(p2d).relationship_id; created.push(P2)

  // C1 — valid: marker M anchored to P1
  const { data: md, error: em } = await mk(2, 12, 'TESTPIN anchor M', 'vacationed_at', P1)
  if (em) bad('valid anchor to own primary was rejected: ' + em.message)
  else { ok('marker anchors to own primary'); created.push(rel(md).relationship_id) }
  const M = md ? rel(md).relationship_id : null

  // C2 — generalized anchoring (Slice 3.6): anchoring to a non-primary
  // marker (here the vacation M) is now ALLOWED. Multi-tenancy is still
  // enforced (C3). Superseded the old "non-primary anchor rejected" rule.
  const { data: nd, error: eNon } = await mk(3, 13, 'TESTPIN ok nonprimary', 'vacationed_at', M)
  if (eNon) bad('anchor to a non-primary marker was rejected (allowed since Slice 3.6): ' + eNon.message)
  else { ok('anchor to a non-primary marker is allowed (generalized anchoring)'); created.push(rel(nd).relationship_id) }

  // C3 — invalid: anchor to a nonexistent / non-owned id
  const { error: eGhost } = await mk(4, 14, 'TESTPIN bad ghost', 'vacationed_at', '00000000-0000-0000-0000-000000000000')
  if (eGhost) ok('anchor to a nonexistent/non-owned residence is rejected')
  else bad('anchor to a ghost id was WRONGLY accepted')

  // A — re-type P1 away from lived_at (→ second residence anchored to P2).
  // M was anchored to P1; after P1 leaves the spine, M must be orphaned.
  const { error: eRetype } = await admin.rpc('update_residence_pin', {
    p_relationship_id: P1, p_user_id: user.id, p_lng: null, p_lat: null,
    p_name: null, p_place_subtype: null, p_country_code: null, p_when_text: null,
    p_body: null, p_type_code: 'owned_residence_at', p_anchor_residence_id: P2,
  })
  if (eRetype) throw new Error('retype P1: ' + eRetype.message)
  const { data: mAfter } = await admin.from('relationships').select('anchor_residence_id').eq('id', M).single()
  if (mAfter.anchor_residence_id === null) ok('re-typing a primary away orphaned its anchored marker (anchor → NULL)')
  else bad('marker still anchored to the demoted primary: ' + mAfter.anchor_residence_id)
} catch (e) {
  bad(e.message)
} finally {
  for (const id of created.reverse()) {
    try { await admin.rpc('delete_residence_pin', { p_relationship_id: id, p_user_id: user.id }) } catch { /* best effort */ }
  }
  // Any leftover test entities
  const { data: ents } = await admin.from('entities').select('id').eq('user_id', user.id).like('canonical_name', 'TESTPIN %')
  for (const e of ents ?? []) {
    await admin.from('memory_entities').delete().eq('entity_id', e.id)
    await admin.from('relationships').delete().eq('object_id', e.id)
    await admin.from('entities').delete().eq('id', e.id)
  }
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
