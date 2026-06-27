/**
 * /api/entity/[id]/context — context notes on an entity (Slice 6.3).
 *
 *   POST   { body, sourceLabel?, sourceUrl?, visibility }  → add a note
 *   PATCH  ?note=<uuid> { body, sourceLabel?, sourceUrl?, visibility }  → edit
 *   DELETE ?note=<uuid>                                    → remove a note
 *
 * Ownership is enforced at the app layer (entity + note must belong to the
 * caller). RLS lands with Step 13 Access Cards. Context is never a Raw Vault
 * memory — it lives only in entity_context_notes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getUser() {
  const { data: { user } } = await createUserClient().auth.getUser()
  return user
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface PostBody {
  body?: string
  sourceLabel?: string
  sourceUrl?: string
  visibility?: string
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Bad entity id' }, { status: 400 })

  let p: PostBody
  try { p = (await request.json()) as PostBody } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const body = (p.body ?? '').trim()
  if (!body) return NextResponse.json({ error: 'A note body is required' }, { status: 400 })
  const visibility = p.visibility === 'shareable' ? 'shareable' : 'private'

  const admin = createAdminClient()
  // Confirm the entity belongs to the caller before attaching anything.
  const { data: ent } = await admin.from('entities').select('id, user_id').eq('id', params.id).maybeSingle()
  if (!ent || ent.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: note, error } = await admin
    .from('entity_context_notes')
    .insert({
      user_id: user.id,
      entity_id: params.id,
      body,
      source_label: p.sourceLabel?.trim() || null,
      source_url: p.sourceUrl?.trim() || null,
      created_by: 'owner',
      visibility,
    })
    .select('id, body, source_label, source_url, created_by, visibility, created_at')
    .single()
  if (error) return NextResponse.json({ error: 'Could not add the note', detail: error.message }, { status: 500 })

  return NextResponse.json({ note })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Bad entity id' }, { status: 400 })
  const noteId = new URL(request.url).searchParams.get('note')
  if (!noteId || !UUID_RE.test(noteId)) return NextResponse.json({ error: 'Bad note id' }, { status: 400 })

  let p: PostBody
  try { p = (await request.json()) as PostBody } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const body = (p.body ?? '').trim()
  if (!body) return NextResponse.json({ error: 'A note body is required' }, { status: 400 })
  const visibility = p.visibility === 'shareable' ? 'shareable' : 'private'

  const admin = createAdminClient()
  // Scope the update to this user + this entity so a note can't be edited
  // across ownership or off another entity. The .select() returns no rows if
  // the scope misses, which we surface as 404.
  const { data: note, error } = await admin
    .from('entity_context_notes')
    .update({
      body,
      source_label: p.sourceLabel?.trim() || null,
      source_url: p.sourceUrl?.trim() || null,
      visibility,
    })
    .eq('id', noteId)
    .eq('user_id', user.id)
    .eq('entity_id', params.id)
    .select('id, body, source_label, source_url, created_by, visibility, created_at')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not update the note', detail: error.message }, { status: 500 })
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ note })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const noteId = new URL(request.url).searchParams.get('note')
  if (!noteId || !UUID_RE.test(noteId)) return NextResponse.json({ error: 'Bad note id' }, { status: 400 })

  const admin = createAdminClient()
  // Scope the delete to this user + this entity so a note can't be removed
  // across ownership or off another entity.
  const { error } = await admin
    .from('entity_context_notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', user.id)
    .eq('entity_id', params.id)
  if (error) return NextResponse.json({ error: 'Could not remove the note', detail: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
