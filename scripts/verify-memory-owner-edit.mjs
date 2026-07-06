#!/usr/bin/env node
/**
 * Proof for the /memories owner-edit micro-slice (2026-07-06):
 * lib/memory/owner-edit.ts — revision-preserving finalized edits +
 * owner entity linking.
 *
 * Asserts (relative-only, against this script's OWN fixtures — the live
 * shared DB has real data):
 *   1. Draft content edit applies in place, NO revision row.
 *   2. Finalized content edit writes memory_revisions FIRST (original
 *      preserved verbatim), then overwrites; revision_saved=true.
 *   3. Finalized temporal-metadata-only edit does NOT write a revision.
 *   4. Empty content is rejected (400).
 *   5. Cross-user edit is rejected (403) — ownership guard.
 *   6. linkEntityToMemory links with the right default role
 *      (person → participant, place → location); relinking is idempotent
 *      (already_linked=true, no duplicate row).
 *   7. Unlink (the DELETE the UI calls) removes the row; entity survives.
 *
 * Creates TESTEDIT fixtures (2 memories, 2 entities); deletes everything
 * in a finally block. Run: node scripts/verify-memory-owner-edit.mjs
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(projectRoot, '.env.local'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i).trim()
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}

const runnerSrc = `
import { createAdminClient } from '${projectRoot}/lib/supabase/admin'
import { ownerEditMemory, linkEntityToMemory, OwnerEditError } from '${projectRoot}/lib/memory/owner-edit'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

async function main() {
  const supabase = createAdminClient()
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com')
  if (!user) { console.error('test user not found'); process.exit(1) }

  const memIds: string[] = []
  const entIds: string[] = []

  try {
    // ── Fixtures ──
    const mkMem = async (text: string, draft: boolean) => {
      const { data, error } = await supabase.from('memories')
        .insert({ user_id: user.id, content_raw: text, source: 'text_entry', confidence: 'certain',
                  is_draft: draft, metadata: { skip_async_fanout: true } })
        .select('id').single()
      if (error || !data) throw new Error('memory fixture failed: ' + error?.message)
      memIds.push(data.id); return data.id as string
    }
    const mkEnt = async (name: string, type: string) => {
      const { data, error } = await supabase.from('entities')
        .insert({ user_id: user.id, type, canonical_name: name })
        .select('id').single()
      if (error || !data) throw new Error('entity fixture failed: ' + error?.message)
      entIds.push(data.id); return data.id as string
    }

    const draftMem = await mkMem('TESTEDIT draft original', true)
    const finalMem = await mkMem('TESTEDIT final original', false)
    const person = await mkEnt('TESTEDIT Person', 'person')
    const place = await mkEnt('TESTEDIT Place', 'place')

    const revCount = async (mid: string) => {
      const { data } = await supabase.from('memory_revisions').select('id').eq('source_memory_id', mid)
      return (data ?? []).length
    }

    // ── 1. Draft edit — in place, no revision ──
    const r1 = await ownerEditMemory(supabase, user.id, draftMem, { content_raw: 'TESTEDIT draft edited' })
    if (r1.memory.content_raw === 'TESTEDIT draft edited' && r1.revision_saved === false && (await revCount(draftMem)) === 0) {
      ok('draft edit applies in place with no revision')
    } else bad('draft edit wrong: ' + JSON.stringify(r1))

    // ── 2. Finalized edit — revision first, then overwrite ──
    const r2 = await ownerEditMemory(supabase, user.id, finalMem, { content_raw: 'TESTEDIT final revised' })
    const { data: revs } = await supabase.from('memory_revisions')
      .select('original_excerpt, revised_content, revision_type').eq('source_memory_id', finalMem)
    if (r2.revision_saved === true && revs?.length === 1
        && revs[0].original_excerpt === 'TESTEDIT final original'
        && revs[0].revised_content === 'TESTEDIT final revised'
        && r2.memory.content_raw === 'TESTEDIT final revised') {
      ok('finalized edit preserves the original verbatim in memory_revisions, then overwrites')
    } else bad('finalized edit wrong: ' + JSON.stringify({ r2, revs }))

    // ── 3. Temporal-metadata edit on finalized — no new revision ──
    const r3 = await ownerEditMemory(supabase, user.id, finalMem, { occurred_at_fuzzy: 'summer 1970', time_precision: 'season' })
    if (r3.revision_saved === false && (await revCount(finalMem)) === 1) {
      ok('temporal metadata edits freely on finalized memories (no revision)')
    } else bad('metadata edit wrongly revised: ' + JSON.stringify(r3))

    // ── 4. Empty content rejected ──
    try {
      await ownerEditMemory(supabase, user.id, finalMem, { content_raw: '   ' })
      bad('empty content was accepted')
    } catch (e) {
      if (e instanceof OwnerEditError && e.status === 400) ok('empty content rejected (400)')
      else bad('wrong rejection: ' + e)
    }

    // ── 5. Cross-user guard ──
    try {
      await ownerEditMemory(supabase, '00000000-0000-0000-0000-000000000000', finalMem, { content_raw: 'x' })
      bad('cross-user edit was accepted')
    } catch (e) {
      if (e instanceof OwnerEditError && e.status === 403) ok('cross-user edit rejected (403)')
      else bad('wrong cross-user rejection: ' + e)
    }

    // ── 6. Entity linking — default roles + idempotency ──
    // place → 'mentioned', NEVER 'location': role='location' is the pin-
    // overview discriminator; a mention-link carrying it lets one pin's
    // recollection hijack another pin's text (incident 2026-07-07).
    const l1 = await linkEntityToMemory(supabase, user.id, finalMem, person)
    const l2 = await linkEntityToMemory(supabase, user.id, finalMem, place)
    if (l1.role === 'participant' && l2.role === 'mentioned') ok('default roles: person→participant, place→mentioned (never location)')
    else bad('roles wrong: ' + JSON.stringify({ l1: l1.role, l2: l2.role }))

    const l3 = await linkEntityToMemory(supabase, user.id, finalMem, person)
    const { data: links } = await supabase.from('memory_entities')
      .select('entity_id, role').eq('memory_id', finalMem)
    if (l3.already_linked === true && (links ?? []).length === 2) ok('relinking is idempotent (no duplicate row)')
    else bad('idempotency broken: ' + JSON.stringify({ l3, links }))

    // ── 7. Unlink removes the row; entity survives ──
    await supabase.from('memory_entities').delete().eq('memory_id', finalMem).eq('entity_id', person)
    const { data: after } = await supabase.from('memory_entities')
      .select('entity_id').eq('memory_id', finalMem)
    const { data: entRow } = await supabase.from('entities').select('id').eq('id', person).maybeSingle()
    if ((after ?? []).length === 1 && entRow) ok('unlink removes only the link; the entity survives')
    else bad('unlink wrong: ' + JSON.stringify({ after, entSurvives: !!entRow }))
  } finally {
    if (memIds.length) {
      await supabase.from('memory_revisions').delete().in('source_memory_id', memIds)
      await supabase.from('memory_entities').delete().in('memory_id', memIds)
      await supabase.from('memories').delete().in('id', memIds)
    }
    if (entIds.length) await supabase.from('entities').delete().in('id', entIds)
    const { data: left } = await supabase.from('memories').select('id').like('content_raw', 'TESTEDIT%')
    const { data: leftE } = await supabase.from('entities').select('id').ilike('canonical_name', 'TESTEDIT%')
    if ((left ?? []).length === 0 && (leftE ?? []).length === 0) ok('cleanup complete — no TESTEDIT residue')
    else bad('TESTEDIT residue remains: ' + JSON.stringify({ left, leftE }))
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.owner-edit-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
