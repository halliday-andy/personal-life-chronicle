#!/usr/bin/env node
/**
 * Proof for pin images — multi-photo gallery, one primary (Slice 2 +
 * gallery 2026-06-12; supersedes the single-image proof). Exercises
 * lib/globe/pin-image.ts directly:
 *
 *   1. addPinImage: first image becomes primary automatically
 *   2. second add (no makePrimary) appends as non-primary
 *   3. add with makePrimary demotes (not deletes) the old primary
 *   4. setPrimaryPinImage swaps the flag
 *   5. removePinImageById on the primary promotes the newest remaining
 *   6. removeAllPinImages clears rows + storage (pin-delete path)
 *
 * Relative-only assertions on this script's own temp pin; cleans up.
 * Requires: node scripts/setup-pin-images-bucket.mjs (run once).
 * Run: node scripts/verify-globe-pin-image.mjs
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
import {
  addPinImage, listPinImages, getPinImage,
  setPrimaryPinImage, removePinImageById, removeAllPinImages,
} from '${projectRoot}/lib/globe/pin-image'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

async function main() {
  const admin = createAdminClient()
  const { data: users } = await admin.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
  const { data: self } = await admin.from('entities').select('id')
    .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
  if (!self) { bad('no self entity'); process.exit(1) }

  let relId: string | null = null
  let entityId: string | null = null
  try {
    const { data: pin, error } = await admin.rpc('create_residence_pin', {
      p_user_id: user.id, p_self_entity_id: self.id, p_lng: 139.69, p_lat: 35.69,
      p_name: 'TESTPIN gallery', p_place_subtype: 'city', p_country_code: 'XX',
      p_when_text: null, p_body_text: null, p_position: null,
    })
    if (error) throw new Error('create pin: ' + error.message)
    const row = Array.isArray(pin) ? pin[0] : pin
    relId = row.relationship_id; entityId = row.place_entity_id

    // 1. First image → primary
    const a = await addPinImage(admin, { userId: user.id, entityId: entityId!, bytes: PNG, mimeType: 'image/png', filename: 'a.png' })
    if (a.is_primary) ok('first image became primary'); else bad('first image not primary')

    // 2. Second image → non-primary append
    const b = await addPinImage(admin, { userId: user.id, entityId: entityId!, bytes: PNG, mimeType: 'image/png', filename: 'b.png' })
    if (!b.is_primary) ok('second image appended as non-primary'); else bad('second image stole primary')
    let list = await listPinImages(admin, user.id, entityId!)
    if (list.length === 2 && list[0].media_id === a.media_id) ok('gallery lists 2, primary first')
    else bad('gallery wrong: ' + JSON.stringify(list.map((i) => [i.filename, i.is_primary])))

    // 3. Add with makePrimary → demotes, never deletes
    const c = await addPinImage(admin, { userId: user.id, entityId: entityId!, bytes: PNG, mimeType: 'image/png', filename: 'c.png', makePrimary: true })
    list = await listPinImages(admin, user.id, entityId!)
    const primaries = list.filter((i) => i.is_primary)
    if (list.length === 3 && primaries.length === 1 && primaries[0].media_id === c.media_id) {
      ok('makePrimary demoted old primary, kept all 3, exactly one primary')
    } else bad('makePrimary state wrong: ' + JSON.stringify(list.map((i) => [i.filename, i.is_primary])))

    // 4. setPrimary swap to b
    await setPrimaryPinImage(admin, user.id, entityId!, b.media_id)
    const primaryNow = await getPinImage(admin, user.id, entityId!)
    if (primaryNow?.media_id === b.media_id) ok('setPrimaryPinImage swapped the flag')
    else bad('setPrimary failed: primary is ' + primaryNow?.filename)

    // 5. Remove the primary → newest remaining promoted, invariant holds
    await removePinImageById(admin, user.id, entityId!, b.media_id)
    list = await listPinImages(admin, user.id, entityId!)
    if (list.length === 2 && list.filter((i) => i.is_primary).length === 1) {
      ok('removing the primary promoted another (one-primary invariant holds: ' + list[0].filename + ')')
    } else bad('post-remove state wrong: ' + JSON.stringify(list.map((i) => [i.filename, i.is_primary])))

    // 6. removeAll (pin-delete path)
    const n = await removeAllPinImages(admin, user.id, entityId!)
    list = await listPinImages(admin, user.id, entityId!)
    if (n === 2 && list.length === 0) ok('removeAllPinImages cleared the gallery')
    else bad('removeAll left: ' + list.length)
  } catch (e: any) {
    bad(e.message)
  } finally {
    if (entityId) await removeAllPinImages(admin, user.id, entityId).catch(() => {})
    if (relId) await admin.rpc('delete_residence_pin', { p_relationship_id: relId, p_user_id: user.id })
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.pin-image-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
