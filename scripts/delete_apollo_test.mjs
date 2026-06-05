import { createClient } from '@supabase/supabase-js'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const ANDY = 'b957ab56-8926-4749-b44f-e67831d0afcc'
const APOLLO_MEMORY = '7b2fee99-8996-4528-87fd-4a0bd2fb5100'
const APOLLO_ENTITY = '7c2df76e-180b-4fa7-8859-2d3d1c135b5d'

// Pre-flight: snapshot what we're about to remove
const { data: m } = await admin
  .from('memories')
  .select('id, user_id, content_raw, is_draft')
  .eq('id', APOLLO_MEMORY)
  .maybeSingle()
const { data: e } = await admin
  .from('entities')
  .select('id, user_id, canonical_name, type')
  .eq('id', APOLLO_ENTITY)
  .maybeSingle()

console.log('PRE-DELETE SNAPSHOT:')
console.log(`  memory  ${m?.id?.slice(0,8) ?? 'MISSING'}  user_match=${m?.user_id === ANDY}  is_draft=${m?.is_draft}`)
console.log(`  entity  ${e?.id?.slice(0,8) ?? 'MISSING'}  user_match=${e?.user_id === ANDY}  name=${e?.canonical_name}`)

if (!m || m.user_id !== ANDY) { console.error('Aborting: memory ownership check failed.'); process.exit(1) }
if (!e || e.user_id !== ANDY) { console.error('Aborting: entity ownership check failed.'); process.exit(1) }

// Memory first — CASCADE on memory_entities.memory_id cleans the link automatically
const { error: dmErr } = await admin.from('memories').delete().eq('id', APOLLO_MEMORY).eq('user_id', ANDY)
if (dmErr) { console.error('memory delete failed:', dmErr); process.exit(1) }
console.log('✓ deleted memory 7b2fee99 (Apollo 11 test data)')

// Then the entity
const { error: deErr } = await admin.from('entities').delete().eq('id', APOLLO_ENTITY).eq('user_id', ANDY)
if (deErr) { console.error('entity delete failed:', deErr); process.exit(1) }
console.log('✓ deleted entity 7c2df76e (Apollo 11)')

// Post-snapshot
const { count: memCount } = await admin.from('memories').select('*', { count: 'exact', head: true }).eq('user_id', ANDY)
const { count: entCount } = await admin.from('entities').select('*', { count: 'exact', head: true }).eq('user_id', ANDY)
const { count: linkCount } = await admin.from('memory_entities').select('*', { count: 'exact', head: true }).eq('entity_id', APOLLO_ENTITY)
console.log(`\nPOST-DELETE COUNTS:`)
console.log(`  memories for Andy: ${memCount}`)
console.log(`  entities for Andy: ${entCount}`)
console.log(`  memory_entities still pointing at Apollo 11: ${linkCount}  (should be 0 — CASCADE)`)
