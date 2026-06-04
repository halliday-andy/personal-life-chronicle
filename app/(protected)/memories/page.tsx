/**
 * Memories list — Step 6e quick-fix for Task #37.
 *
 * Chronological list of the user's memories with draft vs finalised
 * distinction. Throwaway code; the Timeline view in Step 7h supersedes
 * this with chronological-by-time_estimate sort, metadata strip,
 * multi-select, PDF export.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MemoryCard, { type MemoryRow } from '@/components/MemoryCard'

export const dynamic = 'force-dynamic'

export default async function MemoriesPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  // RLS isn't activated yet (viewer_can_access stub returns FALSE).
  // Use admin client scoped by user_id. When Step 13 lands and RLS goes
  // live, flip back to the user-scoped client.
  const admin = createAdminClient()
  const { data: memories, error } = await admin
    .from('memories')
    .select(
      // Safe to include private_notes here: this page is owner-only
      // (the redirect above gates it behind the authenticated user).
      // Step 13 RLS will enforce this at the database layer too.
      'id, content_raw, occurred_at_fuzzy, time_precision, is_draft, source, created_at, source_submission_id, source_session_id, private_notes',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const rows = (memories ?? []) as MemoryRow[]
  const draftCount = rows.filter((m) => m.is_draft).length
  const finalisedCount = rows.length - draftCount

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-stone-400 hover:text-stone-900 transition-colors"
            >
              ← Dashboard
            </Link>
            <span className="text-stone-300">|</span>
            <span className="text-sm font-medium text-stone-700">Memories</span>
          </div>
          <span className="text-xs text-stone-400">
            {rows.length} total · {finalisedCount} final · {draftCount} draft{draftCount === 1 ? '' : 's'}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 mb-6 text-sm">
            Failed to load memories: {error.message}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-stone-500">No memories recorded yet.</p>
            <p className="mt-2 text-sm text-stone-400">
              Use the Capture button (⌘K) to begin.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-stone-400 mb-2">
              Sorted by capture time. A proper Timeline view sorting by inferred event time
              arrives in Step 7.
            </p>
            {rows.map((m) => (
              <MemoryCard key={m.id} m={m} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
