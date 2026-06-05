import { createClient } from '@supabase/supabase-js'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const ANDY = 'b957ab56-8926-4749-b44f-e67831d0afcc'

const { data: mems } = await admin
  .from('memories')
  .select('id, content_raw, created_at, source, source_submission_id, occurred_at_fuzzy, metadata')
  .eq('user_id', ANDY)
  .order('created_at', { ascending: true })

console.log(`ALL ${mems?.length ?? 0} MEMORIES for Andy, oldest first:\n`)
for (const m of mems ?? []) {
  const date = m.created_at.slice(0, 16).replace('T', ' ')
  console.log(`──────────────────────────────────────────────────────────────────`)
  console.log(`  id=${m.id.slice(0,8)}…   created=${date} UTC   source=${m.source}`)
  console.log(`  occurred_at_fuzzy=${m.occurred_at_fuzzy ?? '(null)'}`)
  console.log(`  metadata.created_by=${m.metadata?.created_by ?? '(none)'}`)
  console.log(`  source_submission_id=${m.source_submission_id ?? '(null)'}`)
  console.log()
  // First 280 chars of content
  const c = (m.content_raw ?? '').replace(/\s+/g, ' ').trim()
  console.log(`  "${c.slice(0, 280)}${c.length > 280 ? '…' : ''}"`)
  console.log()
  // If there's a submission, show what was actually typed
  if (m.source_submission_id) {
    const { data: sub } = await admin
      .from('capture_submissions')
      .select('input_text, input_type, submitted_at, user_guidance')
      .eq('id', m.source_submission_id)
      .maybeSingle()
    if (sub) {
      const subText = (sub.input_text ?? '').replace(/\s+/g, ' ').trim()
      const matchesContent = subText === c
      console.log(`  📝 SUBMISSION: input_type=${sub.input_type}  guidance=${sub.user_guidance ?? '-'}`)
      console.log(`     ${matchesContent ? '✓ matches memory text verbatim' : '⚠ differs from memory text'}`)
      if (!matchesContent) {
        console.log(`     submitted: "${subText.slice(0, 200)}${subText.length > 200 ? '…' : ''}"`)
      }
    }
  }
  console.log()
}
