import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key)

const ids = [
  '106973a2-bb84-47dd-a359-1363bfbf0ad5', // confirmation Leo
  'b16248e3-4deb-4979-840c-6613a7f05026', // merge_proposal Leo→Leola
  '710faee3-22c7-47f4-b41c-898a722f92ac', // merge_proposal Leola Lapidus→Leo
]
const { data: rows } = await admin
  .from('review_queue')
  .select('id, item_type, item_id, resolved_at, resolution, resolution_payload, resolved_by')
  .in('id', ids)
console.log('TARGET QUEUE ROWS:')
console.log(JSON.stringify(rows, null, 2))

// Also check entity state
const entIds = ['c0377218-92b6-4ed8-a641-3b96f64f9de6', '7776f2b3-5673-43f0-9860-1e357f61a14c', 'ff8b27bb-826d-454c-b29b-16010eaa3f82']
const { data: ents } = await admin.from('entities').select('id, canonical_name, aliases').in('id', entIds)
console.log('\nCURRENT ENTITIES:')
console.log(JSON.stringify(ents, null, 2))

// All open queue rows
const { data: open } = await admin
  .from('review_queue')
  .select('id, item_type, item_id, surfaced_at, context_json')
  .is('resolved_at', null)
  .order('surfaced_at', { ascending: false })
console.log(`\nOPEN QUEUE ROWS: ${open?.length ?? 0}`)
for (const r of open ?? []) {
  const ctx = r.context_json ?? {}
  const label = ctx.extracted_name ?? ctx.duplicate_name ?? r.item_id.slice(0, 8)
  console.log(`  ${r.id.slice(0, 8)}  ${r.item_type}  ${label}`)
}
