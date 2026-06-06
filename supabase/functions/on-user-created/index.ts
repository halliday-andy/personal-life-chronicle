import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Five system cards seeded for every new user.
// system_code values are the legacy tier names — they live on as card names
// while the schema underneath is Access Cards-only.
const SYSTEM_CARDS = [
  {
    name: 'Private',
    description: 'Only you can see this content.',
    system_code: 'private',
    is_public: false,
    scope_rules: {},
  },
  {
    name: 'Close Friends',
    description: 'People you share your innermost experiences with.',
    system_code: 'close_friends',
    is_public: false,
    scope_rules: {},
  },
  {
    name: 'Family',
    description: 'Your family members.',
    system_code: 'family',
    is_public: false,
    scope_rules: {},
  },
  {
    name: 'Professional',
    description: 'Colleagues and professional connections.',
    system_code: 'professional',
    is_public: false,
    scope_rules: {},
  },
  {
    name: 'Public',
    description: 'Anyone with a link can view this content.',
    system_code: 'public',
    is_public: true,
    scope_rules: {},
  },
] as const

serve(async (req) => {
  try {
    const payload = await req.json()
    const userId: string | undefined = payload?.record?.id

    if (!userId) {
      return new Response(JSON.stringify({ error: 'No user ID in payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Service role client — bypasses RLS for this privileged seeding operation.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const rows = SYSTEM_CARDS.map((card) => ({
      owner_user_id: userId,
      name: card.name,
      description: card.description,
      is_system: true,
      system_code: card.system_code,
      is_active: true,
      is_public: card.is_public,
      scope_rules: card.scope_rules,
    }))

    const { error } = await supabase.from('cards').insert(rows)

    if (error) {
      console.error('Failed to seed system cards:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create the "self" person entity at account inception, using the
    // name captured at registration (sign-up passes options.data.full_name,
    // which lands in raw_user_meta_data). This entity is the subject of
    // all the user's first-person relationships — residences, and later
    // person/org links. See lib/globe/self-entity.ts for the app-side
    // equivalent and the idempotent backfill for pre-existing accounts.
    const record = payload?.record ?? {}
    const meta = record.raw_user_meta_data ?? {}
    const displayName =
      (meta.full_name ?? meta.name ?? '').toString().trim() ||
      (record.email ? String(record.email).split('@')[0] : '') ||
      'You'

    const { error: selfErr } = await supabase.from('entities').insert({
      user_id: userId,
      type: 'person',
      canonical_name: displayName,
      metadata: { is_self: true },
    })
    if (selfErr) {
      // Non-fatal: card seeding already succeeded. Log for visibility;
      // the backfill script / app-side ensureSelfEntity will recover.
      console.error('Failed to create self entity:', selfErr)
    }

    return new Response(
      JSON.stringify({
        seeded: SYSTEM_CARDS.length,
        user_id: userId,
        self_entity: selfErr ? 'failed' : 'created',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('Unexpected error in on-user-created:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
