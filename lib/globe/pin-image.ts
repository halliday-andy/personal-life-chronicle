/**
 * Pin images — multi-photo gallery per residence pin with one primary
 * (Step 7 Slice 2; gallery added 2026-06-12 per the deferred-item
 * decision: the pin/detail-card photo is whichever image is flagged
 * is_primary; the edit panel manages the rest).
 *
 * Storage layout (decision_step7_image_storage_2026-06-04.md):
 *   bucket `pin_images` (private), object path
 *   users/<user_id>/pins/<place_entity_id>/<ts>-<filename>
 *
 * DB layout: one `media` row per photo (type='photo', uri = the storage
 * PATH, not a URL — reads mint short-lived signed URLs) linked to the
 * place entity via `entity_media`. Invariant: when a pin has any
 * images, exactly one is is_primary=true.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const PIN_IMAGES_BUCKET = 'pin_images'
export const MAX_PIN_IMAGE_BYTES = 5 * 1024 * 1024
export const PIN_IMAGE_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
]
const SIGNED_URL_TTL_SECONDS = 3600

export interface PinImage {
  media_id: string
  url: string            // signed, short-lived
  filename: string | null
  is_primary: boolean
}

interface PinImageRow {
  media_id: string
  uri: string
  filename: string | null
  is_primary: boolean
  created_at: string
}

function storagePrefix(userId: string, entityId: string): string {
  return `users/${userId}/pins/${entityId}`
}

// Only media this module created (path-scoped) — a pin entity could in
// principle carry other linked media from elsewhere in the chronicle.
async function findPinImageRows(
  admin: SupabaseClient,
  userId: string,
  entityId: string,
): Promise<PinImageRow[]> {
  const { data, error } = await admin
    .from('entity_media')
    .select('media_id, is_primary, media:media_id (id, user_id, uri, filename, created_at)')
    .eq('entity_id', entityId)
  if (error || !data) return []
  const rows: PinImageRow[] = []
  for (const link of data) {
    const m = Array.isArray(link.media) ? link.media[0] : link.media
    if (m && m.user_id === userId && typeof m.uri === 'string' && m.uri.startsWith(storagePrefix(userId, entityId))) {
      rows.push({
        media_id: link.media_id,
        uri: m.uri,
        filename: m.filename ?? null,
        is_primary: Boolean(link.is_primary),
        created_at: m.created_at,
      })
    }
  }
  // Primary first, then newest first.
  rows.sort((a, b) =>
    a.is_primary !== b.is_primary
      ? (a.is_primary ? -1 : 1)
      : b.created_at.localeCompare(a.created_at),
  )
  return rows
}

async function sign(admin: SupabaseClient, row: PinImageRow): Promise<PinImage | null> {
  const { data, error } = await admin.storage
    .from(PIN_IMAGES_BUCKET)
    .createSignedUrl(row.uri, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) return null
  return { media_id: row.media_id, url: data.signedUrl, filename: row.filename, is_primary: row.is_primary }
}

/** All of the pin's images, primary first, with signed URLs. */
export async function listPinImages(
  admin: SupabaseClient,
  userId: string,
  entityId: string,
): Promise<PinImage[]> {
  const rows = await findPinImageRows(admin, userId, entityId)
  const out: PinImage[] = []
  for (const r of rows) {
    const img = await sign(admin, r)
    if (img) out.push(img)
  }
  return out
}

/** The pin's primary image, or null. (Detail-card / globe surface.) */
export async function getPinImage(
  admin: SupabaseClient,
  userId: string,
  entityId: string,
): Promise<PinImage | null> {
  const rows = await findPinImageRows(admin, userId, entityId)
  const primary = rows.find((r) => r.is_primary) ?? rows[0] ?? null
  return primary ? sign(admin, primary) : null
}

/**
 * Add an image to the pin's gallery. The first image (or makePrimary)
 * becomes the primary — existing primaries are demoted, never deleted.
 * Returns the new image with a fresh signed URL.
 */
export async function addPinImage(
  admin: SupabaseClient,
  args: {
    userId: string
    entityId: string
    bytes: Buffer | Uint8Array
    mimeType: string
    filename?: string | null
    makePrimary?: boolean
  },
): Promise<PinImage> {
  const { userId, entityId, bytes, mimeType } = args
  if (!PIN_IMAGE_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported image type: ${mimeType}`)
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PIN_IMAGE_BYTES) {
    throw new Error(`Image must be between 1 byte and ${MAX_PIN_IMAGE_BYTES / (1024 * 1024)}MB`)
  }

  const existing = await findPinImageRows(admin, userId, entityId)
  const asPrimary = Boolean(args.makePrimary) || existing.length === 0

  const safeName = (args.filename ?? 'image')
    .replace(/[^\w.\-]+/g, '_')
    .slice(-80)
  const path = `${storagePrefix(userId, entityId)}/${Date.now()}-${safeName}`

  const { error: upErr } = await admin.storage
    .from(PIN_IMAGES_BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: false })
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`)

  try {
    const { data: media, error: mediaErr } = await admin
      .from('media')
      .insert({
        user_id: userId,
        type: 'photo',
        uri: path,
        filename: args.filename ?? null,
        mime_type: mimeType,
        file_size_bytes: bytes.byteLength,
      })
      .select('id')
      .single()
    if (mediaErr || !media) throw new Error(`media insert failed: ${mediaErr?.message}`)

    if (asPrimary && existing.length > 0) {
      await admin.from('entity_media')
        .update({ is_primary: false })
        .eq('entity_id', entityId)
        .in('media_id', existing.map((r) => r.media_id))
    }
    const { error: linkErr } = await admin
      .from('entity_media')
      .insert({ entity_id: entityId, media_id: media.id, is_primary: asPrimary })
    if (linkErr) {
      await admin.from('media').delete().eq('id', media.id)
      throw new Error(`entity_media insert failed: ${linkErr.message}`)
    }

    const img = await sign(admin, {
      media_id: media.id, uri: path, filename: args.filename ?? null,
      is_primary: asPrimary, created_at: new Date().toISOString(),
    })
    if (!img) throw new Error('Could not sign image URL')
    return img
  } catch (e) {
    // Don't leave orphaned bytes if the DB chain failed after upload.
    await admin.storage.from(PIN_IMAGES_BUCKET).remove([path])
    throw e
  }
}

/** Flag one of the pin's images as the primary (demoting the others). */
export async function setPrimaryPinImage(
  admin: SupabaseClient,
  userId: string,
  entityId: string,
  mediaId: string,
): Promise<boolean> {
  const rows = await findPinImageRows(admin, userId, entityId)
  if (!rows.some((r) => r.media_id === mediaId)) return false
  await admin.from('entity_media')
    .update({ is_primary: false })
    .eq('entity_id', entityId)
    .in('media_id', rows.filter((r) => r.media_id !== mediaId).map((r) => r.media_id))
  await admin.from('entity_media')
    .update({ is_primary: true })
    .eq('entity_id', entityId)
    .eq('media_id', mediaId)
  return true
}

/**
 * Remove one image (link, media row, storage object). When the primary
 * is removed and others remain, the newest remaining image is promoted
 * so the one-primary invariant holds. Omit mediaId to remove the
 * current primary.
 */
export async function removePinImageById(
  admin: SupabaseClient,
  userId: string,
  entityId: string,
  mediaId?: string | null,
): Promise<boolean> {
  const rows = await findPinImageRows(admin, userId, entityId)
  const target = mediaId
    ? rows.find((r) => r.media_id === mediaId)
    : rows.find((r) => r.is_primary) ?? rows[0]
  if (!target) return false
  await admin.from('entity_media')
    .delete().eq('entity_id', entityId).eq('media_id', target.media_id)
  await admin.from('media').delete().eq('id', target.media_id)
  await admin.storage.from(PIN_IMAGES_BUCKET).remove([target.uri])
  if (target.is_primary) {
    const rest = rows.filter((r) => r.media_id !== target.media_id)
    if (rest.length > 0) {
      await admin.from('entity_media')
        .update({ is_primary: true })
        .eq('entity_id', entityId)
        .eq('media_id', rest[0].media_id)
    }
  }
  return true
}

/**
 * Remove every image on the pin. Call before deleting a pin — the
 * entity_media CASCADE would otherwise orphan media rows + bytes.
 * Returns the number removed.
 */
export async function removeAllPinImages(
  admin: SupabaseClient,
  userId: string,
  entityId: string,
): Promise<number> {
  const rows = await findPinImageRows(admin, userId, entityId)
  for (const r of rows) {
    await admin.from('entity_media')
      .delete().eq('entity_id', entityId).eq('media_id', r.media_id)
    await admin.from('media').delete().eq('id', r.media_id)
  }
  if (rows.length) {
    await admin.storage.from(PIN_IMAGES_BUCKET).remove(rows.map((r) => r.uri))
  }
  return rows.length
}
