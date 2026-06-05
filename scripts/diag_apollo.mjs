import { createClient } from '@supabase/supabase-js'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const ANDY = 'b957ab56-8926-4749-b44f-e67831d0afcc'

// 1. Find the Apollo 11 entity
const { data: apollo } = await admin
  .from('entities')
  .select('*')
  .ilike('canonical_name', 'apollo%')
console.log('APOLLO 11 ENTITIES:')
console.log(JSON.stringify(apollo, null, 2))

if (apollo && apollo.length) {
  for (const e of apollo) {
    // 2. memory_entities rows pointing at this entity
    const { data: links } = await admin
      .from('memory_entities')
      .select('*')
      .eq('entity_id', e.id)
    console.log(`\nMEMORY_ENTITIES for ${e.canonical_name} (${e.id.slice(0,8)}): ${links?.length ?? 0}`)
    for (const l of links ?? []) {
      console.log(`  memory_id=${l.memory_id}  role=${l.role}`)
      // 3. The memory itself
      const { data: m } = await admin
        .from('memories')
        .select('id, user_id, content_raw, is_draft, redacted_at, source, created_at, updated_at, metadata, source_submission_id, source_session_id')
        .eq('id', l.memory_id)
        .maybeSingle()
      if (!m) {
        console.log(`    ⚠ MEMORY ROW MISSING from memories table — orphaned memory_entities row`)
      } else {
        console.log(`    user_id matches Andy: ${m.user_id === ANDY}`)
        console.log(`    user_id actual: ${m.user_id}`)
        console.log(`    is_draft=${m.is_draft}  redacted_at=${m.redacted_at ?? 'no'}  source=${m.source}`)
        console.log(`    created=${m.created_at}  updated=${m.updated_at}`)
        console.log(`    source_submission_id=${m.source_submission_id ?? 'null'}`)
        console.log(`    source_session_id=${m.source_session_id ?? 'null'}`)
        console.log(`    metadata: ${JSON.stringify(m.metadata)}`)
        console.log(`    content_raw[:200]: "${(m.content_raw ?? '').slice(0, 200)}"`)
      }
    }
  }
}

// 4. Re-pull the unfiltered /memories list for Andy exactly as the page does
const { data: list } = await admin
  .from('memories')
  .select('id, content_raw, created_at, source, is_draft')
  .eq('user_id', ANDY)
  .order('created_at', { ascending: false })
console.log(`\n/MEMORIES UNFILTERED for Andy: ${list?.length ?? 0} rows`)
for (const m of list ?? []) {
  console.log(`  ${m.id.slice(0,8)}  ${m.is_draft ? 'DRAFT' : 'FINAL'}  ${m.source}  ${m.created_at.slice(0,10)}  "${(m.content_raw ?? '').slice(0, 70)}…"`)
}

// 5. What's the actual source enum?
const { data: schemaCheck } = await admin
  .rpc('exec_sql', { sql: "select 'check' as ok" })
  .maybeSingle()
console.log('\n(source enum and schema introspection would need a separate path; do this via psql.)')
