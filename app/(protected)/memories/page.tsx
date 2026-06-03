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
import PrivateNotesPanel from '@/components/PrivateNotesPanel'

export const dynamic = 'force-dynamic'

interface MemoryRow {
  id: string
  content_raw: string
  occurred_at_fuzzy: string | null
  time_precision: string | null
  is_draft: boolean
  source: string
  created_at: string
  source_submission_id: string | null
  source_session_id: string | null
  private_notes: string | null
}

function precisionLabel(p: string | null): string {
  if (!p || p === 'unknown') return 'time unknown'
  return p
}

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

function MemoryCard({ m }: { m: MemoryRow }) {
  const dimmed = m.is_draft
  return (
    <article
      className={`rounded-xl border p-4 ${
        dimmed ? 'bg-stone-50 border-stone-200' : 'bg-white border-stone-200'
      }`}
    >
      <div className="flex items-start gap-2 mb-2 text-xs">
        {m.is_draft ? (
          <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium uppercase tracking-wide px-1.5 py-0.5 text-[10px]">
            Draft · awaiting review
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium uppercase tracking-wide px-1.5 py-0.5 text-[10px]">
            Final
          </span>
        )}
        <span className="text-stone-400">
          {m.occurred_at_fuzzy ? `${m.occurred_at_fuzzy} · ${precisionLabel(m.time_precision)}` : precisionLabel(m.time_precision)}
        </span>
        <span className="ml-auto text-stone-400">{new Date(m.created_at).toLocaleDateString()}</span>
      </div>
      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${dimmed ? 'text-stone-600' : 'text-stone-900'}`}>
        {m.content_raw}
      </p>

      <PrivateNotesPanel memoryId={m.id} initialNotes={m.private_notes} />

      <div className="mt-2 text-[10px] text-stone-400 font-mono">
        {m.id.slice(0, 8)} · {m.source}
        {m.source_submission_id ? ' · from orchestrator' : ''}
        {m.source_session_id ? ' · from interview session' : ''}
      </div>
    </article>
  )
}
