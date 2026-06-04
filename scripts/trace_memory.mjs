import { createClient } from '@supabase/supabase-js'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const userId = 'b957ab56-8926-4749-b44f-e67831d0afcc'
const memoryId = '117e4005-' // need full id

const { data: mems } = await admin
  .from('memories')
  .select('id, is_draft, metadata, created_at, updated_at, content_raw')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(1)

const m = mems?.[0]
console.log('MOST RECENT MEMORY:')
console.log(JSON.stringify(m, null, 2))

if (m) {
  const { data: logs } = await admin
    .from('assumption_log')
    .select('id, assumption_type, decision_json, model_version, created_at')
    .eq('memory_id', m.id)
    .order('created_at')
  console.log(`\nASSUMPTION LOG (${logs?.length ?? 0}):`)
  for (const l of logs ?? []) {
    console.log(`  ${l.created_at}  ${l.assumption_type}`)
  }

  // capture_submissions — check the right schema
  const { data: cs, error: csErr } = await admin
    .from('capture_submissions')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', '2026-06-03T19:00:00Z')
    .order('created_at', { ascending: false })
    .limit(3)
  if (csErr) console.log('capture_submissions error:', csErr.message)
  console.log(`\nCAPTURE_SUBMISSIONS today (${cs?.length ?? 0}):`)
  for (const s of cs ?? []) {
    console.log(`  ${s.id.slice(0,8)}  created=${s.created_at}  cols:`, Object.keys(s).join(', '))
    console.log(`    "${(s.submission_text ?? '').slice(0,120)}"`)
  }
}
