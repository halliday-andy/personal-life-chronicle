import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key)

const userId = 'b957ab56-8926-4749-b44f-e67831d0afcc'

// All entities, with mention counts
const { data: ents } = await admin
  .from('entities')
  .select('id, type, canonical_name, aliases, created_at')
  .eq('user_id', userId)
  .order('type', { ascending: true })
  .order('canonical_name', { ascending: true })

// Memory counts per entity
const mentionCounts = new Map()
const { data: links } = await admin
  .from('memory_entities')
  .select('entity_id, memories!inner(user_id)')
  .eq('memories.user_id', userId)
for (const l of links ?? []) {
  mentionCounts.set(l.entity_id, (mentionCounts.get(l.entity_id) ?? 0) + 1)
}

// Open review items per entity
const reviewByEntity = new Map()
const { data: open } = await admin
  .from('review_queue')
  .select('item_id, item_type')
  .eq('user_id', userId)
  .is('resolved_at', null)
for (const r of open ?? []) {
  if (!reviewByEntity.has(r.item_id)) reviewByEntity.set(r.item_id, [])
  reviewByEntity.get(r.item_id).push(r.item_type)
}

// Group by type
const byType = {}
for (const e of ents ?? []) {
  ;(byType[e.type] ??= []).push(e)
}

for (const [type, list] of Object.entries(byType)) {
  console.log(`\n=== ${type.toUpperCase()} (${list.length}) ===`)
  for (const e of list) {
    const mentions = mentionCounts.get(e.id) ?? 0
    const reviews = reviewByEntity.get(e.id) ?? []
    const reviewMark = reviews.length > 0 ? `  ⚠ ${reviews.join(', ')}` : ''
    const aliases = e.aliases && e.aliases.length > 0 ? `  (a.k.a. ${e.aliases.join(', ')})` : ''
    console.log(`  ${e.canonical_name.padEnd(30)} ${String(mentions).padStart(3)} mentions${aliases}${reviewMark}`)
  }
}
