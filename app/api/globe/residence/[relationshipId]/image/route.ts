/**
 * Residence pin image (Step 7 Slice 2) — single image per pin.
 *
 *   POST   — multipart upload (`file` field); replaces any existing image.
 *   DELETE — remove the pin's image (link + media row + storage object).
 *
 * Server-proxy pattern (decision_step7_image_storage_2026-06-04.md): the
 * client never touches Storage directly; ownership, MIME, and size are
 * enforced here and in lib/globe/pin-image.ts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  attachPinImage,
  removePinImage,
  MAX_PIN_IMAGE_BYTES,
  PIN_IMAGE_MIME_TYPES,
} from '@/lib/globe/pin-image'

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
  try {
    const form = await request.formData()
    const f = form.get('file')
    if (f instanceof File) file = f
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

  try {
    const image = await attachPinImage(createAdminClient(), {
      userId: owned.userId,
      entityId: owned.entityId,
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      filename: file.name || null,
    })
    return NextResponse.json({ image })
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: 'Image upload failed', detail }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { relationshipId: string } }) {
  const owned = await ownedPlaceEntity(params.relationshipId)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const removed = await removePinImage(createAdminClient(), owned.userId, owned.entityId)
  return NextResponse.json({ ok: true, removed })
}
