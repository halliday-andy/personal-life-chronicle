/**
 * Residence pin images (Step 7 Slice 2; gallery 2026-06-12) — multiple
 * photos per pin, exactly one primary (the globe/detail-card photo).
 *
 *   POST   — multipart upload (`file` field). Appends to the gallery;
 *            first image (or `primary=true` form field) becomes primary,
 *            demoting — never deleting — the previous one.
 *   PUT    — JSON { media_id }: make that image the primary.
 *   DELETE — ?media_id=… removes that image; without it, removes the
 *            primary (newest remaining image is promoted).
 *
 * All verbs return { images } — the pin's full gallery, primary first —
 * so the client can swap state in one round trip.
 *
 * Server-proxy pattern (decision_step7_image_storage_2026-06-04.md): the
 * client never touches Storage directly; ownership, MIME, and size are
 * enforced here and in lib/globe/pin-image.ts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  addPinImage,
  listPinImages,
  removePinImageById,
  setPrimaryPinImage,
  MAX_PIN_IMAGE_BYTES,
  PIN_IMAGE_MIME_TYPES,
} from '@/lib/globe/pin-image'
import { toWebSafeImage } from '@/lib/globe/heic-server'

async function ownedPlaceEntity(relationshipId: string): Promise<
  { userId: string; entityId: string } | null
> {
  const { data: { user } } = await createUserClient().auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: rel } = await admin
    .from('relationships').select('object_id, user_id').eq('id', relationshipId).maybeSingle()
  if (!rel || rel.user_id !== user.id) return null
  return { userId: user.id, entityId: rel.object_id }
}

export async function POST(request: NextRequest, { params }: { params: { relationshipId: string } }) {
  const owned = await ownedPlaceEntity(params.relationshipId)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let file: File | null = null
  let makePrimary = false
  try {
    const form = await request.formData()
    const f = form.get('file')
    if (f instanceof File) file = f
    makePrimary = form.get('primary') === 'true'
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'Missing "file" field' }, { status: 400 })
  if (!PIN_IMAGE_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 })
  }
  if (file.size > MAX_PIN_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image too large (5MB max)' }, { status: 413 })
  }

  const admin = createAdminClient()
  try {
    // Convert HEIC/HEIF → JPEG server-side so the stored image renders in
    // every browser (not just Safari). Non-HEIC passes through untouched.
    const raw = Buffer.from(await file.arrayBuffer())
    const safe = await toWebSafeImage(raw, file.type, file.name || null)
    const image = await addPinImage(admin, {
      userId: owned.userId,
      entityId: owned.entityId,
      bytes: safe.bytes,
      mimeType: safe.mimeType,
      filename: safe.filename,
      makePrimary,
    })
    const images = await listPinImages(admin, owned.userId, owned.entityId)
    return NextResponse.json({ image, images })
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: 'Image upload failed', detail }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { relationshipId: string } }) {
  const owned = await ownedPlaceEntity(params.relationshipId)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let mediaId: string | null = null
  try {
    const body = (await request.json()) as { media_id?: unknown }
    if (typeof body.media_id === 'string') mediaId = body.media_id
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 })
  }
  if (!mediaId) return NextResponse.json({ error: 'media_id is required' }, { status: 400 })

  const admin = createAdminClient()
  const ok = await setPrimaryPinImage(admin, owned.userId, owned.entityId, mediaId)
  if (!ok) return NextResponse.json({ error: 'Image not found on this pin' }, { status: 404 })
  const images = await listPinImages(admin, owned.userId, owned.entityId)
  return NextResponse.json({ ok: true, images })
}

export async function DELETE(request: NextRequest, { params }: { params: { relationshipId: string } }) {
  const owned = await ownedPlaceEntity(params.relationshipId)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const mediaId = request.nextUrl.searchParams.get('media_id')
  const admin = createAdminClient()
  const removed = await removePinImageById(admin, owned.userId, owned.entityId, mediaId)
  const images = await listPinImages(admin, owned.userId, owned.entityId)
  return NextResponse.json({ ok: true, removed, images })
}
