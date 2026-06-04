import { createClient } from '@supabase/supabase-js'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const userId = 'b957ab56-8926-4749-b44f-e67831d0afcc'

// Last 5 memories regardless of state
const { data: mems } = await admin
  .from('memories')
  .select('id, content_raw, is_draft, redacted_at, private_notes, source, created_at, updated_at, occurred_at_fuzzy')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(5)

console.log(`MOST RECENT MEMORIES (${mems?.length ?? 0}):`)
for (const m of mems ?? []) {
  console.log(`\n  ${m.id.slice(0, 8)}  created=${m.created_at}  updated=${m.updated_at}`)
  console.log(`    is_draft=${m.is_draft}  redacted=${m.redacted_at ? 'yes ('+m.redacted_at+')' : 'no'}  source=${m.source}`)
  console.log(`    occurred_at_fuzzy=${m.occurred_at_fuzzy ?? 'null'}`)
  console.log(`    content_raw: "${(m.content_raw ?? '').slice(0, 140)}"`)
  if (m.private_notes) {
    console.log(`    🔒 private_notes (${m.private_notes.length} chars): "${m.private_notes.slice(0, 200)}"`)
  }
}

// Also: any capture_submissions in the last hour
const oneHourAgo = new Date(Date.now() - 60*60*1000).toISOString()
const { data: subs } = await admin
  .from('capture_submissions')
  .select('id, submission_text, created_at, processed_at, error_text')
  .eq('user_id', userId)
  .gte('created_at', oneHourAgo)
  .order('created_at', { ascending: false })
console.log(`\nCAPTURE SUBMISSIONS in last hour (${subs?.length ?? 0}):`)
for (const s of subs ?? []) {
  console.log(`  ${s.id.slice(0,8)}  ${s.created_at}  text="${s.submission_text.slice(0,100)}"  processed=${s.processed_at ? 'yes' : 'no'}  err=${s.error_text ?? '-'}`)
}

// Counts by state
const { count: total } = await admin.from('memories').select('*', { count: 'exact', head: true }).eq('user_id', userId)
const { count: drafts } = await admin.from('memories').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_draft', true)
const { count: redacted } = await admin.from('memories').select('*', { count: 'exact', head: true }).eq('user_id', userId).not('redacted_at', 'is', null)
console.log(`\nCOUNTS: total=${total}  drafts=${drafts}  redacted=${redacted}`)
