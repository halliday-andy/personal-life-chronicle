#!/usr/bin/env node
/**
 * Direct-dispatch proof for the propose_context_note orchestrator tool
 * (Slice 6.5b). Doesn't depend on Claude choosing the tool — invokes the
 * dispatch directly and asserts the proposal payload shape.
 *
 * Asserts (relative-only, against this script's OWN fixtures — the live
 * shared DB has real data):
 *   1. Exact canonical-name match resolves to the fixture entity.
 *   2. Alias match resolves to the same entity.
 *   3. use_full_submission=true returns the fixture submission's
 *      input_text byte-identical (verbatim-fidelity guard).
 *   4. A URL in the body is auto-detected as source_url.
 *   5. persisted=false and NO entity_context_notes row exists for the
 *      fixture entity afterwards (proposal-only — nothing written).
 *   6. An unresolvable name returns entity=null with low confidence.
 *
 * Creates a TESTCTX entity + one capture_submissions row; deletes both
 * in a finally block. Run: node scripts/verify-context-proposal-tool.mjs
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
import { executeTool } from '${projectRoot}/lib/agents/orchestrator/tools'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

async function main() {
  const supabase = createAdminClient()
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find((u: any) => u.email === 'andrewsbox@gmail.com')
  if (!user) { console.error('test user not found'); process.exit(1) }

  const FIXTURE_NAME = 'TESTCTX Grafenwoehr Training Area'
  const FIXTURE_ALIAS = 'TESTCTX Graf'
  // Deliberately includes a URL and markdown so fidelity is observable.
  const FIXTURE_TEXT =
    '## TESTCTX unit history\\n\\nBackground research [1] with a link:\\n' +
    'https://example.org/testctx-history and a trailing paragraph.\\n\\n- bullet kept\\n- verbatim'

  let entityId: string | null = null
  let submissionId: string | null = null

  try {
    // ── Fixtures ──
    const { data: ent, error: entErr } = await supabase
      .from('entities')
      .insert({
        user_id: user.id,
        type: 'place',
        canonical_name: FIXTURE_NAME,
        aliases: [FIXTURE_ALIAS],
      })
      .select('id')
      .single()
    if (entErr || !ent) throw new Error('fixture entity insert failed: ' + entErr?.message)
    entityId = ent.id

    const { data: sub, error: subErr } = await supabase
      .from('capture_submissions')
      .insert({
        user_id: user.id,
        input_type: 'pasted',
        input_text: FIXTURE_TEXT,
        status: 'processing',
      })
      .select('id')
      .single()
    if (subErr || !sub) throw new Error('fixture submission insert failed: ' + subErr?.message)
    submissionId = sub.id

    const ctx = { user_id: user.id, supabase, source_submission_id: submissionId! }

    // ── 1. Exact canonical-name resolution ──
    const r1 = await executeTool(
      'propose_context_note',
      { entity_name: FIXTURE_NAME, body: 'Some background about the area.', rationale: 'test' },
      ctx,
    )
    const d1 = r1.data as any
    if (d1.entity?.id === entityId) ok('exact canonical name resolves to the fixture entity')
    else bad('exact-name resolution failed: ' + JSON.stringify(d1.entity))
    if (r1.persisted === false) ok('payload is proposal-only (persisted=false)')
    else bad('persisted should be false')
    if ((r1.confidence ?? 0) >= 0.9) ok('exact match carries high confidence (' + r1.confidence + ')')
    else bad('expected confidence >= 0.9, got ' + r1.confidence)

    // ── 2. Alias resolution ──
    const r2 = await executeTool(
      'propose_context_note',
      { entity_name: FIXTURE_ALIAS, body: 'More background.', rationale: 'test' },
      ctx,
    )
    const d2 = r2.data as any
    if (d2.entity?.id === entityId) ok('alias resolves to the same entity')
    else bad('alias resolution failed: ' + JSON.stringify(d2.entity))

    // ── 3. use_full_submission verbatim fidelity ──
    const r3 = await executeTool(
      'propose_context_note',
      { entity_name: FIXTURE_NAME, use_full_submission: true, rationale: 'test' },
      ctx,
    )
    const d3 = r3.data as any
    if (d3.body === FIXTURE_TEXT && d3.used_full_submission === true) {
      ok('use_full_submission returns input_text byte-identical')
    } else {
      bad('full-submission body mismatch (used_full_submission=' + d3.used_full_submission + ')')
    }

    // ── 4. source_url auto-detection ──
    if (d3.source_url === 'https://example.org/testctx-history') {
      ok('source_url auto-detected from the body')
    } else {
      bad('source_url wrong: ' + JSON.stringify(d3.source_url))
    }

    // ── 5. Nothing persisted ──
    const { data: notes } = await supabase
      .from('entity_context_notes')
      .select('id')
      .eq('entity_id', entityId!)
    if ((notes ?? []).length === 0) ok('no entity_context_notes row written for the fixture entity')
    else bad('proposal wrote ' + notes!.length + ' note row(s) — must persist nothing')

    // ── 6. Unresolvable name ──
    const r6 = await executeTool(
      'propose_context_note',
      { entity_name: 'TESTCTX Nonexistent Nowhere', body: 'x', rationale: 'test' },
      ctx,
    )
    const d6 = r6.data as any
    if (d6.entity === null && (r6.confidence ?? 1) <= 0.5) {
      ok('unknown name returns entity=null with low confidence (picker takes over)')
    } else {
      bad('unknown-name handling wrong: ' + JSON.stringify({ entity: d6.entity, confidence: r6.confidence }))
    }
  } finally {
    // ── Cleanup — only rows this script created ──
    if (entityId) await supabase.from('entities').delete().eq('id', entityId)
    if (submissionId) await supabase.from('capture_submissions').delete().eq('id', submissionId)
    const { data: leftover } = await supabase
      .from('entities')
      .select('id')
      .eq('user_id', user.id)
      .ilike('canonical_name', 'TESTCTX%')
    if ((leftover ?? []).length === 0) ok('cleanup complete — no TESTCTX residue')
    else bad('TESTCTX residue remains: ' + JSON.stringify(leftover))
  }

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`

const tmp = join(projectRoot, '.context-proposal-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
