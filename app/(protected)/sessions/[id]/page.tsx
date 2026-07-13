/**
 * /sessions/[id] — read an interview conversation (2026-07-10).
 *
 * From Andy's Leola-thread QA: interview memories are ANSWERS whose
 * questions were recorded (interview_sessions.transcript) but never
 * displayed — read standalone they're orphaned fragments. This is the
 * read-only conversation view: the full exchange, with the recollections
 * it produced listed beneath (each anchoring into /memories).
 *
 * Owner-only via the protected layout + user_id scoping; Raw Vault
 * untouched — this renders what was always stored.
 */

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Markdown from '@/components/Markdown'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Conversation — Life Chronicle' }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Turn {
  role?: string
  speaker?: string
  content?: string
  text?: string
}

export default async function SessionPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  if (!UUID_RE.test(params.id)) notFound()

  const admin = createAdminClient()
  const { data: sess } = await admin
    .from('interview_sessions')
    .select('id, user_id, started_at, turn_count, transcript, memory_ids')
    .eq('id', params.id)
    .maybeSingle()
  if (!sess || sess.user_id !== user.id) notFound()

  const raw = sess.transcript
  const turns: Turn[] = Array.isArray(raw) ? raw : ((raw as { turns?: Turn[] })?.turns ?? [])

  // The recollections this conversation produced, in creation order.
  const memoryIds: string[] = Array.isArray(sess.memory_ids) ? sess.memory_ids : []
  let memories: { id: string; content_raw: string }[] = []
  if (memoryIds.length > 0) {
    const { data: mems } = await admin
      .from('memories')
      .select('id, content_raw, created_at')
      .in('id', memoryIds)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    memories = mems ?? []
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href="/memories" className="text-sm text-stone-500 hover:text-stone-800">← Memories</Link>

        <h1 className="mt-3 text-2xl font-semibold text-stone-900">An interview conversation</h1>
        <p className="mt-1 text-sm text-stone-500">
          {new Date(sess.started_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
          {' · '}{turns.length} turns · {memories.length} {memories.length === 1 ? 'recollection' : 'recollections'} captured
        </p>
        <p className="mt-1 text-xs text-stone-400">
          Read-only — the exchange as it happened. Your words entered the Raw Vault verbatim; the
          assistant&apos;s questions give each answer its context.
        </p>

        <div className="mt-6 space-y-3">
          {turns.map((t, i) => {
            const role = (t.role ?? t.speaker ?? 'user') === 'assistant' ? 'assistant' : 'user'
            const text = String(t.content ?? t.text ?? '').trim()
            if (!text) return null
            return role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[88%] rounded-2xl rounded-br-sm bg-stone-800 px-4 py-2.5 text-sm leading-relaxed text-white">
                  <Markdown>{text}</Markdown>
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-stone-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-stone-700 shadow-sm">
                  <Markdown>{text}</Markdown>
                </div>
              </div>
            )
          })}
        </div>

        {memories.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Recollections from this conversation
            </h2>
            <ul className="mt-2 space-y-2">
              {memories.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/memories#${m.id}`}
                    className="group block rounded-lg border border-stone-200 bg-white px-3 py-2 transition-colors hover:border-stone-400 hover:bg-stone-50"
                  >
                    <span className="block text-sm leading-relaxed text-stone-700 group-hover:text-stone-900">
                      {m.content_raw.replace(/\s+/g, ' ').slice(0, 180)}…
                    </span>
                    <span className="mt-0.5 block text-right text-[11px] text-stone-300 transition-colors group-hover:text-stone-500">
                      read this recollection →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
