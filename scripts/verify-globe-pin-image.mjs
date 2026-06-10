#!/usr/bin/env node
/**
 * Slice 2 proof — pin image attach / read / replace / remove
 * (lib/globe/pin-image.ts against the real pin_images bucket).
 *
 * Asserts, on a temp pin this script creates:
 *   - attachPinImage uploads, inserts media + entity_media(is_primary)
 *   - getPinImage returns a signed URL that actually serves the bytes
 *   - attaching a second image REPLACES the first (one image per pin:
 *     single link row, old storage object gone)
 *   - removePinImage clears link + media row + storage object
 *
 * Relative-only assertions (live shared DB): everything is scoped to the
 * temp pin's entity. Non-destructive: deletes its pin + image at the end.
 *
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
import { attachPinImage, getPinImage, removePinImage, PIN_IMAGES_BUCKET } from '${projectRoot}/lib/globe/pin-image'

const admin = createAdminClient()
let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

async function main() {
  const { data: users } = await admin.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com') ?? users.users[0]
  const { data: self } = await admin.from('entities').select('id')
    .eq('user_id', user.id).eq('type', 'person').eq('metadata->>is_self', 'true').limit(1).maybeSingle()
  if (!self) { bad('no self entity'); process.exit(1) }

  const { data: pin, error: ce } = await admin.rpc('create_residence_pin', {
    p_user_id: user.id, p_self_entity_id: self.id, p_lng: 151.2093, p_lat: -33.8688,
    p_name: 'TESTPIN image', p_place_subtype: 'city', p_country_code: 'XX',
    p_when_text: null, p_body_text: null, p_position: null,
  })
  if (ce) { bad('create temp pin: ' + ce.message); process.exit(1) }
  const row = Array.isArray(pin) ? pin[0] : pin
  const entityId = row.place_entity_id as string
  const relId = row.relationship_id as string
  console.log('Temp pin entity:', entityId.slice(0, 8))

  try {
    // ── attach ──
    const img1 = await attachPinImage(admin, {
      userId: user.id, entityId, bytes: PNG, mimeType: 'image/png', filename: 'first.png',
    })
    img1.media_id ? ok('attach #1 returned media_id') : bad('attach #1 missing media_id')

    const { data: links1 } = await admin.from('entity_media')
      .select('media_id, is_primary').eq('entity_id', entityId)
    links1?.length === 1 && links1[0].is_primary
      ? ok('one primary entity_media link after attach')
      : bad('expected exactly one primary link, got ' + JSON.stringify(links1))

    // ── read: signed URL serves the bytes ──
    const got = await getPinImage(admin, user.id, entityId)
    if (!got) bad('getPinImage returned null')
    else {
      const res = await fetch(got.url)
      const body = Buffer.from(await res.arrayBuffer())
      res.ok && body.equals(PNG)
        ? ok('signed URL serves the uploaded bytes')
        : bad('signed URL fetch: status ' + res.status + ', bytes match=' + body.equals(PNG))
    }

    // ── replace ──
    const { data: m1 } = await admin.from('media').select('uri').eq('id', img1.media_id).single()
    const img2 = await attachPinImage(admin, {
      userId: user.id, entityId, bytes: PNG, mimeType: 'image/png', filename: 'second.png',
    })
    const { data: links2 } = await admin.from('entity_media')
      .select('media_id').eq('entity_id', entityId)
    links2?.length === 1 && links2[0].media_id === img2.media_id
      ? ok('replace keeps a single link, pointing at the new media')
      : bad('replace links wrong: ' + JSON.stringify(links2))
    const { data: oldMedia } = await admin.from('media').select('id').eq('id', img1.media_id).maybeSingle()
    !oldMedia ? ok('old media row deleted on replace') : bad('old media row survived replace')
    const { data: oldObj } = await admin.storage.from(PIN_IMAGES_BUCKET).download(m1!.uri)
    !oldObj ? ok('old storage object deleted on replace') : bad('old storage object survived replace')

    // ── remove ──
    const removed = await removePinImage(admin, user.id, entityId)
    removed ? ok('removePinImage reported removal') : bad('removePinImage returned false')
    const after = await getPinImage(admin, user.id, entityId)
    !after ? ok('pin has no image after remove') : bad('image still present after remove')
    const { data: m2 } = await admin.from('media').select('id').eq('id', img2.media_id).maybeSingle()
    !m2 ? ok('media row deleted on remove') : bad('media row survived remove')
  } finally {
    await admin.rpc('delete_residence_pin', { p_relationship_id: relId, p_user_id: user.id })
    console.log('Temp pin deleted.')
  }

  if (failures) { console.error('\\nFAIL: ' + failures + ' assertion(s)'); process.exit(1) }
  console.log('\\nPASS')
}

main().catch((e) => { console.error(e); process.exit(1) })
`

console.log('Slice 2 proof (pin image attach/read/replace/remove)\n')
const tmp = join(projectRoot, '.pin-image-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
