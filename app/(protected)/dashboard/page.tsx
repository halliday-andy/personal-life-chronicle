import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import SignOutButton from './sign-out-button'

export const dynamic = 'force-dynamic'

function labelForEntityType(t: string): string {
  switch (t) {
    case 'person': return t.endsWith('s') ? t : 'people'
    case 'place': return 'places'
    case 'organization': return 'orgs'
    case 'artifact': return 'artifacts'
    case 'event_series': return 'event series'
    default: return t
  }
}

function labelForType(t: string): string {
  switch (t) {
    case 'entity_confirmation_needed': return 'confirm'
    case 'entity_merge_proposal': return 'merge'
    case 'memory_elaboration_needed': return 'elaborate'
    case 'temporal_constraint': return 'temporal'
    case 'synthesis_stale': return 'refresh'
    case 'sensitive_promotion': return 'sensitive'
    case 'assumption_review': return 'review'
    case 'contribution_review': return 'contrib'
    default: return t
  }
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  // Admin client because RLS isn't activated yet (viewer_can_access() is
  // still a FALSE stub pending Step 13). Reads are scoped by user_id.
  // Once Step 13 lands and RLS is active, this can flip back to the
  // user-scoped client.
  const admin = createAdminClient()
  const [memoriesRes, draftsRes, cardsRes, reviewRes, entitiesRes, pinsRes] = await Promise.all([
    admin
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    admin
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_draft', true),
    admin
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .eq('owner_user_id', user.id),
    admin
      .from('review_queue')
      .select('item_type')
      .eq('user_id', user.id)
      .is('resolved_at', null),
    admin
      .from('entities')
      .select('type')
      .eq('user_id', user.id),
    admin
      .from('relationships')
      .select('id, relationship_types!inner(code)', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('relationship_types.code', 'lived_at'),
  ])
  const totalMemories = memoriesRes.count ?? 0
  const draftCount = draftsRes.count ?? 0
  const finalisedCount = totalMemories - draftCount
  const cardCount = cardsRes.count ?? 0
  const pinCount = pinsRes.count ?? 0

  const entityRows = (entitiesRes.data ?? []) as { type: string }[]
  const entityCount = entityRows.length
  const entityByType: Record<string, number> = {}
  for (const e of entityRows) entityByType[e.type] = (entityByType[e.type] ?? 0) + 1
  const entitySummary = entityCount === 0
    ? 'None yet'
    : Object.entries(entityByType)
        .sort((a, b) => b[1] - a[1])
        .map(([t, n]) => `${n} ${labelForEntityType(t)}`)
        .slice(0, 3)
        .join(' · ')

  const reviewRows = (reviewRes.data ?? []) as { item_type: string }[]
  const reviewOpen = reviewRows.length
  const reviewByType: Record<string, number> = {}
  for (const r of reviewRows) {
    reviewByType[r.item_type] = (reviewByType[r.item_type] ?? 0) + 1
  }
  const reviewSummary = reviewOpen === 0
    ? 'Nothing waiting'
    : Object.entries(reviewByType)
        .map(([t, n]) => `${n} ${labelForType(t)}`)
        .slice(0, 2)
        .join(' · ')

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-base font-semibold text-stone-900 tracking-tight">Life Chronicle</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-500">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-xl font-semibold text-stone-900">Welcome back</h1>
        <p className="mt-1 text-sm text-stone-500">Your life chronicle is waiting.</p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/globe"
            className="block rounded-xl border border-stone-800 bg-stone-900 p-5 hover:border-stone-600 hover:shadow-md transition-all"
          >
            <p className="text-xs font-medium text-amber-400/80 uppercase tracking-wide">Life Globe</p>
            <p className="mt-1 text-2xl font-semibold text-stone-50">{pinCount}</p>
            <p className="mt-2 text-xs text-stone-400">
              {pinCount === 0
                ? 'Place the first pin where your life began'
                : `residence${pinCount === 1 ? '' : 's'} on your globe`}
            </p>
            <p className="mt-2 text-xs text-amber-400/90">Open the globe →</p>
          </Link>
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Phase 0</p>
            <p className="mt-1 text-sm font-medium text-stone-700">Ontology Bootstrap</p>
            <p className="mt-2 text-xs text-stone-400">Not started</p>
          </div>
          <Link
            href="/memories"
            className="block bg-white rounded-xl border border-stone-200 p-5 hover:border-stone-300 hover:shadow-sm transition-all"
          >
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Memories</p>
            <p className="mt-1 text-2xl font-semibold text-stone-900">{totalMemories}</p>
            <p className="mt-2 text-xs text-stone-400">
              {totalMemories === 0
                ? 'Start an interview to begin'
                : `${finalisedCount} finalised · ${draftCount} draft${draftCount === 1 ? '' : 's'} awaiting review`}
            </p>
            <p className="mt-2 text-xs text-stone-500">View all →</p>
          </Link>
          <Link
            href="/entities"
            className="block bg-white rounded-xl border border-stone-200 p-5 hover:border-stone-300 hover:shadow-sm transition-all"
          >
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Entities</p>
            <p className="mt-1 text-2xl font-semibold text-stone-900">{entityCount}</p>
            <p className="mt-2 text-xs text-stone-400">{entitySummary}</p>
            <p className="mt-2 text-xs text-stone-500">Manage →</p>
          </Link>
          <Link
            href="/review"
            className="block bg-white rounded-xl border border-stone-200 p-5 hover:border-stone-300 hover:shadow-sm transition-all relative"
          >
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Review</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-stone-900">{reviewOpen}</p>
              {reviewOpen > 0 && (
                <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                  open
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-stone-400">{reviewSummary}</p>
            <p className="mt-2 text-xs text-stone-500">Go to review →</p>
          </Link>
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Your Cards</p>
            <p className="mt-1 text-sm font-medium text-stone-700">
              {cardCount} {cardCount === 1 ? 'card' : 'cards'}
            </p>
            <p className="mt-2 text-xs text-stone-400">
              Private · Close Friends · Family · Professional · Public
            </p>
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/interview"
            className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
          >
            Start Interview
          </Link>
          <p className="mt-2 text-xs text-stone-400">
            Free-form memory capture — share anything and it&apos;s recorded automatically.
            The guided Phase 0 onboarding will follow once it&apos;s built.
          </p>
        </div>
      </main>
    </div>
  )
}
