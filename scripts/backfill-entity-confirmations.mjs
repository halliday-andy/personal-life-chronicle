#!/usr/bin/env node
/**
 * One-off backfill: for every existing person entity that doesn't already
 * have an entity_confirmation_needed queue row, write one. Uses the first
 * memory the entity is linked to (via memory_entities) as the source-memory
 * context and quotes a snippet of that memory's content_raw.
 *
 * Idempotent — safe to re-run; it skips entities that already have a
 * confirmation row queued.
 *
 * Requires: the 20260520182927_entity_confirmation_queue.sql migration
 * applied (or the equivalent SQL run via the dashboard).
 *
 * Run with:
 *   node scripts/backfill-entity-confirmations.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: persons, error: pErr } = await sb
  .from('entities')
  .select('id, user_id, canonical_name, type')
  .eq('type', 'person')

if (pErr) throw pErr
console.log(`Found ${persons.length} person entities`)

let written = 0
let skipped = 0

for (const p of persons) {
  // Skip if a confirmation row already exists for this entity
  const { data: existing } = await sb
    .from('review_queue')
    .select('id')
    .eq('item_id', p.id)
    .eq('item_type', 'entity_confirmation_needed')
    .limit(1)
  if (existing && existing.length > 0) {
    skipped++
    continue
  }

  // Find the first memory this person is linked to, plus a quote
  const { data: links } = await sb
    .from('memory_entities')
    .select('memory_id, role')
    .eq('entity_id', p.id)
    .limit(1)
  const link = links?.[0]
  let context_quote = '(no linked memory found)'
  let source_memory_id = null
  let role = 'participant'
  if (link) {
    source_memory_id = link.memory_id
    role = link.role
    const { data: mem } = await sb
      .from('memories')
      .select('content_raw')
      .eq('id', link.memory_id)
      .single()
    if (mem) {
      const text = (mem.content_raw || '').trim()
      // Try to find a sentence containing the name
      const idx = text.toLowerCase().indexOf(p.canonical_name.toLowerCase())
      if (idx >= 0) {
        const start = Math.max(0, idx - 60)
        const end = Math.min(text.length, idx + p.canonical_name.length + 100)
        context_quote = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
      } else {
        context_quote = text.slice(0, 180) + (text.length > 180 ? '…' : '')
      }
    }
  }

  const { error: insErr } = await sb.from('review_queue').insert({
    user_id: p.user_id,
    item_type: 'entity_confirmation_needed',
    item_id: p.id,
    context_json: {
      extracted_name: p.canonical_name,
      type: 'person',
      role,
      source_memory_id,
      context_quote,
      backfilled: true,
      backfilled_at: new Date().toISOString(),
    },
    priority: 3,
  })
  if (insErr) {
    console.error(`  ✗ ${p.canonical_name}: ${insErr.message}`)
    continue
  }
  console.log(`  ✓ ${p.canonical_name} → queued`)
  written++
}

console.log(`\nDone. Written: ${written}, Skipped (already queued): ${skipped}`)
