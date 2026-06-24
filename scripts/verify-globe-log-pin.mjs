#!/usr/bin/env node
/**
 * Proof for the "Log" pin + generalized anchoring (Slice 3.6).
 *
 *   - logged_at is a valid globe pin type.
 *   - validate_pin_anchor: a marker may anchor to ANY of the user's own
 *     globe pins (primary OR marker), not only a primary residence — so a
 *     Log can hang off a vacation ("places around a vacation destination").
 *   - Multi-tenancy still holds: a ghost / non-globe anchor is rejected.
 *   - get_residence_pins includes logged_at pins.
 *
 * Relative-only against this script's own fixtures; self-cleaning.
 * Run: node scripts/verify-globe-log-pin.mjs
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

console.log('Globe Log pin + generalized anchoring proof\n')

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
  // Fixtures: primary P → vacation V (anchored to P).
  const { data: pd, error: ep } = await mk(0, 30, 'TESTPIN log P', 'lived_at', null)
  if (ep) throw new Error('P: ' + ep.message)
  const P = rel(pd).relationship_id; created.push(P)

  const { data: vd, error: ev } = await mk(2, 32, 'TESTPIN log V', 'vacationed_at', P)
  if (ev) throw new Error('V: ' + ev.message)
  const V = rel(vd).relationship_id; created.push(V)

  // A Log anchored to the VACATION (a marker → marker anchor). This is the
  // generalized-anchor case the old validator rejected.
  const { data: ld, error: el } = await mk(3, 33, 'TESTPIN log L', 'logged_at', V)
  if (el) bad('Log anchored to a vacation was rejected: ' + el.message)
  else {
    const L = rel(ld).relationship_id; created.push(L)
    ok('Log pin created, anchored to a non-primary marker (vacation)')
    const { data: lrow } = await admin.from('relationships').select('anchor_residence_id').eq('id', L).single()
    if (lrow.anchor_residence_id === V) ok('Log anchor stored = the vacation')
    else bad('Log anchor wrong: ' + lrow.anchor_residence_id)
  }

  // Multi-tenancy / validity still enforced: a ghost anchor is rejected.
  const { error: eGhost } = await mk(4, 34, 'TESTPIN log ghost', 'logged_at', '00000000-0000-0000-0000-000000000000')
  if (eGhost) ok('Log anchor to a nonexistent/non-owned pin is rejected')
  else bad('ghost anchor was WRONGLY accepted')

  // get_residence_pins surfaces the Log.
  const { data: pins, error: eg } = await admin.rpc('get_residence_pins', { p_user_id: user.id })
  if (eg) throw new Error('get_residence_pins: ' + eg.message)
  const logRow = (pins ?? []).find((p) => p.type_code === 'logged_at' && p.name === 'TESTPIN log L')
  if (logRow) ok('get_residence_pins returns the Log pin (type_code=logged_at)')
  else bad('Log pin missing from get_residence_pins')
} catch (e) {
  bad(e.message)
} finally {
  for (const id of created.reverse()) {
    try { await admin.rpc('delete_residence_pin', { p_relationship_id: id, p_user_id: user.id }) } catch { /* best effort */ }
  }
  const { data: ents } = await admin.from('entities').select('id').eq('user_id', user.id).like('canonical_name', 'TESTPIN log %')
  for (const e of ents ?? []) {
    await admin.from('memory_entities').delete().eq('entity_id', e.id)
    await admin.from('relationships').delete().eq('object_id', e.id)
    await admin.from('entities').delete().eq('id', e.id)
  }
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
