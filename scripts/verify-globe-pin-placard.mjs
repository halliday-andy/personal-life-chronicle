#!/usr/bin/env node
/**
 * Proof for the pin placard (Slice 3 close-out, item 1).
 *
 * The placard is a short user-written one-line description of a place,
 * reusing the existing entities.description column (no new column). The
 * globe hover card needs it for every pin without a per-pin fetch, so
 * get_residence_pins must surface description.
 *
 * Relative-only against this script's own fixtures; self-cleaning.
 * Run: node scripts/verify-globe-pin-placard.mjs
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

console.log('Globe pin placard proof\n')

const { data: users } = await admin.auth.admin.listUsers()
const user = users.users.find((u) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
const { data: self } = await admin.from('entities').select('id')
  .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
if (!self) { bad('no self entity'); process.exit(1) }

const rel = (row) => (Array.isArray(row) ? row[0] : row)
const created = []
const PLACARD = 'The college town where it all began'

try {
  const { data: pd, error: ep } = await admin.rpc('create_residence_pin', {
    p_user_id: user.id, p_self_entity_id: self.id, p_lng: 5, p_lat: 25,
    p_name: 'TESTPIN placard P', p_place_subtype: 'city', p_country_code: 'XX',
    p_when_text: null, p_body_text: null, p_position: null,
    p_type_code: 'lived_at', p_anchor_residence_id: null,
  })
  if (ep) throw new Error('create: ' + ep.message)
  const P = rel(pd).relationship_id; created.push(P)
  const placeId = rel(pd).place_entity_id

  // Write a placard onto the place entity (what the route does after create).
  const { error: eu } = await admin.from('entities').update({ description: PLACARD }).eq('id', placeId)
  if (eu) throw new Error('set description: ' + eu.message)

  const { data: pins, error: eg } = await admin.rpc('get_residence_pins', { p_user_id: user.id })
  if (eg) throw new Error('get_residence_pins: ' + eg.message)
  const row = (pins ?? []).find((p) => p.relationship_id === P)
  if (!row) bad('pin missing from get_residence_pins')
  else if (row.description === PLACARD) ok('get_residence_pins surfaces the placard (entities.description)')
  else bad('description wrong/missing: ' + JSON.stringify(row.description))
} catch (e) {
  bad(e.message)
} finally {
  for (const id of created.reverse()) {
    try { await admin.rpc('delete_residence_pin', { p_relationship_id: id, p_user_id: user.id }) } catch { /* best effort */ }
  }
  const { data: ents } = await admin.from('entities').select('id').eq('user_id', user.id).like('canonical_name', 'TESTPIN placard %')
  for (const e of ents ?? []) {
    await admin.from('memory_entities').delete().eq('entity_id', e.id)
    await admin.from('relationships').delete().eq('object_id', e.id)
    await admin.from('entities').delete().eq('id', e.id)
  }
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
