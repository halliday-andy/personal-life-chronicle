/**
 * /api/entity/[id]/stubs — hopper stubs on an entity (Hopper 5a).
 *
 *   GET                              → list stubs (open first, newest first)
 *   POST   { body }                  → jot a stub (created_by='owner')
 *   PATCH  ?stub=<uuid> { status }   → consume ('consumed') / reopen ('open')
 *   DELETE ?stub=<uuid>              → remove a stub
 *
 * Stubs are a consumable checklist of to-be-recollected memories — NOT Raw
 * Vault rows (invariant #1 untouched). Host-agnostic: [id] is the pin's place
 * entity today, a person entity when the Person page lands. Ownership is
 * enforced at the app layer (entity + stub must belong to the caller); RLS
 * lands with Step 13 Access Cards.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getUser() {
  const { data: { user } } = await createUserClient().auth.getUser()
  return user
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const STUB_FIELDS = 'id, body, status, created_by, created_at, consumed_at'

async function ownEntity(admin: ReturnType<typeof createAdminClient>, id: string, userId: string) {
  const { data: ent } = await admin.from('entities').select('id, user_id').eq('id', id).maybeSingle()
  return Boolean(ent && ent.user_id === userId)
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Bad entity id' }, { status: 400 })

  const admin = createAdminClient()
  if (!(await ownEntity(admin, params.id, user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: stubs, error } = await admin
    .from('memory_stubs')
    .select(STUB_FIELDS)
    .eq('user_id', user.id)
    .eq('host_entity_id', params.id)
    .order('status', { ascending: false }) // 'open' > 'consumed' — open first
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Could not list stubs', detail: error.message }, { status: 500 })

  return NextResponse.json({ stubs: stubs ?? [] })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Bad entity id' }, { status: 400 })

  let p: { body?: string }
  try { p = (await request.json()) as { body?: string } } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const body = (p.body ?? '').trim()
  if (!body) return NextResponse.json({ error: 'A stub needs some text' }, { status: 400 })

  const admin = createAdminClient()
  if (!(await ownEntity(admin, params.id, user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: stub, error } = await admin
    .from('memory_stubs')
    .insert({ user_id: user.id, host_entity_id: params.id, body, created_by: 'owner' })
    .select(STUB_FIELDS)
    .single()
  if (error) return NextResponse.json({ error: 'Could not save the stub', detail: error.message }, { status: 500 })

  return NextResponse.json({ stub })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Bad entity id' }, { status: 400 })
  const stubId = new URL(request.url).searchParams.get('stub')
  if (!stubId || !UUID_RE.test(stubId)) return NextResponse.json({ error: 'Bad stub id' }, { status: 400 })

  let p: { status?: string }
  try { p = (await request.json()) as { status?: string } } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (p.status !== 'consumed' && p.status !== 'open') {
    return NextResponse.json({ error: "status must be 'consumed' or 'open'" }, { status: 400 })
  }

  const admin = createAdminClient()
  // Scope to this user + this entity so a stub can't be flipped across
  // ownership or off another entity; empty result surfaces as 404.
  const { data: stub, error } = await admin
    .from('memory_stubs')
    .update({
      status: p.status,
      consumed_at: p.status === 'consumed' ? new Date().toISOString() : null,
    })
    .eq('id', stubId)
    .eq('user_id', user.id)
    .eq('host_entity_id', params.id)
    .select(STUB_FIELDS)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not update the stub', detail: error.message }, { status: 500 })
  if (!stub) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ stub })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const stubId = new URL(request.url).searchParams.get('stub')
  if (!stubId || !UUID_RE.test(stubId)) return NextResponse.json({ error: 'Bad stub id' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('memory_stubs')
    .delete()
    .eq('id', stubId)
    .eq('user_id', user.id)
    .eq('host_entity_id', params.id)
  if (error) return NextResponse.json({ error: 'Could not remove the stub', detail: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
