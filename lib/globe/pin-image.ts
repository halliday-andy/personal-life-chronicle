/**
 * Pin image — single image per residence pin (Step 7 Slice 2).
 *
 * Storage layout (decision_step7_image_storage_2026-06-04.md):
 *   bucket `pin_images` (private), object path
 *   users/<user_id>/pins/<place_entity_id>/<ts>-<filename>
 *
 * DB layout: one `media` row (type='photo', uri = the storage PATH, not
 * a URL — reads mint short-lived signed URLs) linked to the place entity
 * via `entity_media` with is_primary=true. MVP enforces one image per
 * pin: attaching replaces any existing pin image (link + media row +
 * storage object).
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
}

function storagePrefix(userId: string, entityId: string): string {
  return `users/${userId}/pins/${entityId}`
}

/** The pin's current image as a signed URL, or null if it has none. */
export async function getPinImage(
  admin: SupabaseClient,
  userId: string,
  entityId: string,
): Promise<PinImage | null> {
  const row = await findPinImageRow(admin, userId, entityId)
  if (!row) return null
  const { data, error } = await admin.storage
    .from(PIN_IMAGES_BUCKET)
    .createSignedUrl(row.uri, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) return null
  return { media_id: row.media_id, url: data.signedUrl, filename: row.filename }
}

/**
 * Attach an image to a pin, replacing any existing one. Returns the new
 * image with a fresh signed URL. Throws on validation or write failure.
 */
export async function attachPinImage(
  admin: SupabaseClient,
  args: {
    userId: string
    entityId: string
    bytes: Buffer | Uint8Array
    mimeType: string
    filename?: string | null
  },
): Promise<PinImage> {
  const { userId, entityId, bytes, mimeType } = args
  if (!PIN_IMAGE_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported image type: ${mimeType}`)
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PIN_IMAGE_BYTES) {
    throw new Error(`Image must be between 1 byte and ${MAX_PIN_IMAGE_BYTES / (1024 * 1024)}MB`)
  }

  const safeName = (args.filename ?? 'image')
    .replace(/[^\w.\-]+/g, '_')
    .slice(-80)
  const path = `${storagePrefix(userId, entityId)}/${Date.now()}-${safeName}`

  const { error: upErr } = await admin.storage
    .from(PIN_IMAGES_BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: false })
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`)

  try {
    // One image per pin: clear the previous one before linking the new.
    await removePinImage(admin, userId, entityId)

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

    const { error: linkErr } = await admin
      .from('entity_media')
      .insert({ entity_id: entityId, media_id: media.id, is_primary: true })
    if (linkErr) {
      await admin.from('media').delete().eq('id', media.id)
      throw new Error(`entity_media insert failed: ${linkErr.message}`)
    }

    const { data: signed, error: signErr } = await admin.storage
      .from(PIN_IMAGES_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (signErr || !signed?.signedUrl) throw new Error('Could not sign image URL')
    return { media_id: media.id, url: signed.signedUrl, filename: args.filename ?? null }
  } catch (e) {
    // Don't leave orphaned bytes if the DB chain failed after upload.
    await admin.storage.from(PIN_IMAGES_BUCKET).remove([path])
    throw e
  }
}

/**
 * Remove the pin's image: entity_media link, media row, storage object.
 * Returns true if an image was removed. Call this before deleting a pin —
 * the entity_media CASCADE would otherwise orphan the media row + bytes.
 */
export async function removePinImage(
  admin: SupabaseClient,
  userId: string,
  entityId: string,
): Promise<boolean> {
  const row = await findPinImageRow(admin, userId, entityId)
  if (!row) return false
  await admin.from('entity_media')
    .delete().eq('entity_id', entityId).eq('media_id', row.media_id)
  await admin.from('media').delete().eq('id', row.media_id)
  await admin.storage.from(PIN_IMAGES_BUCKET).remove([row.uri])
  return true
}

async function findPinImageRow(
  admin: SupabaseClient,
  userId: string,
  entityId: string,
): Promise<{ media_id: string; uri: string; filename: string | null } | null> {
  // Only media this module created (path-scoped) — a pin entity could in
  // principle carry other linked media from elsewhere in the chronicle.
  const { data, error } = await admin
    .from('entity_media')
    .select('media_id, media:media_id (id, user_id, uri, filename)')
    .eq('entity_id', entityId)
    .eq('is_primary', true)
  if (error || !data) return null
  for (const link of data) {
    const m = Array.isArray(link.media) ? link.media[0] : link.media
    if (m && m.user_id === userId && typeof m.uri === 'string' && m.uri.startsWith(storagePrefix(userId, entityId))) {
      return { media_id: link.media_id, uri: m.uri, filename: m.filename ?? null }
    }
  }
  return null
}
