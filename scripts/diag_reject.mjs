import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key)

const rqId = '106973a2-bb84-47dd-a359-1363bfbf0ad5'
const { data: row } = await admin.from('review_queue').select('*').eq('id', rqId).single()
console.log('QUEUE ROW:', JSON.stringify(row, null, 2))

if (row) {
  const entityId = row.item_id
  const { data: ent } = await admin.from('entities').select('id, canonical_name, aliases, user_id, type').eq('id', entityId).maybeSingle()
  console.log('ENTITY:', ent)

  // Inspect every table that references entities(id)
  const tables = [
    ['memory_entities', 'entity_id'],
    ['entity_media', 'entity_id'],
    ['relationships', 'subject_id'],
    ['relationships', 'object_id'],
    ['entities', 'location_entity_id'],
    ['interview_sessions', 'focus_entity_id'],
    ['syntheses', 'entity_id'],
    ['coverage', 'entity_id'],
    ['contacts', 'person_entity_id'],
    ['assumption_log', 'entity_id'],
  ]
  for (const [t, col] of tables) {
    const r = await admin.from(t).select('*', { count: 'exact', head: true }).eq(col, entityId)
    if ((r.count ?? 0) > 0) console.log(`  BLOCKS: ${t}.${col} = ${r.count} row(s)`)
  }

  // Also any other open review_queue rows referencing this entity
  const { data: extra } = await admin.from('review_queue').select('id, item_type, item_id, context_json, resolved_at').or(`item_id.eq.${entityId},context_json->>proposed_primary.eq.${entityId},context_json->>duplicate_id.eq.${entityId}`)
  console.log('RELATED QUEUE ROWS:', JSON.stringify(extra, null, 2))
}
