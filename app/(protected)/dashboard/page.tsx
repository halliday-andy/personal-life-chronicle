import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import SignOutButton from './sign-out-button'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  // Admin client because RLS isn't activated yet (viewer_can_access() is
  // still a FALSE stub pending Step 13). Reads are scoped by user_id.
  // Once Step 13 lands and RLS is active, this can flip back to the
  // user-scoped client.
  const admin = createAdminClient()
  const [memoriesRes, draftsRes, cardsRes] = await Promise.all([
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
  ])
  const totalMemories = memoriesRes.count ?? 0
  const draftCount = draftsRes.count ?? 0
  const finalisedCount = totalMemories - draftCount
  const cardCount = cardsRes.count ?? 0

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

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Phase 0</p>
            <p className="mt-1 text-sm font-medium text-stone-700">Ontology Bootstrap</p>
            <p className="mt-2 text-xs text-stone-400">Not started</p>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Memories</p>
            <p className="mt-1 text-2xl font-semibold text-stone-900">{totalMemories}</p>
            <p className="mt-2 text-xs text-stone-400">
              {totalMemories === 0
                ? 'Start an interview to begin'
                : `${finalisedCount} finalised · ${draftCount} draft${draftCount === 1 ? '' : 's'} awaiting review`}
            </p>
          </div>
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
