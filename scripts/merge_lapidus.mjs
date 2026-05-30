import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key)

const userId = 'b957ab56-8926-4749-b44f-e67831d0afcc'
const sourceId = 'ff8b27bb-826d-454c-b29b-16010eaa3f82' // Leola Lapidus (misspelling)
const targetId = '7776f2b3-5673-43f0-9860-1e357f61a14c' // Leola Lapides (canonical)

console.log('Before merge:')
const { data: before } = await admin
  .from('entities')
  .select('id, canonical_name, aliases')
  .in('id', [sourceId, targetId])
console.log(JSON.stringify(before, null, 2))

const { data, error } = await admin.rpc('merge_entities', {
  p_source_id: sourceId,
  p_target_id: targetId,
  p_user_id: userId,
  p_resolved_by: 'user:manual-cleanup-2026-05-30',
})

if (error) {
  console.error('RPC error:', error)
  process.exit(1)
}
console.log('\nMerge result:', JSON.stringify(data, null, 2))

console.log('\nAfter merge:')
const { data: after } = await admin
  .from('entities')
  .select('id, canonical_name, aliases')
  .in('id', [sourceId, targetId])
console.log(JSON.stringify(after, null, 2))
