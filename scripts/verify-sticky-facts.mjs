#!/usr/bin/env node
/**
 * Proof for the sticky-facts data layer (2026-07-20) — lib/globe/sticky-facts.ts.
 *
 * The invariant (from docs/plans/2026-07-10-pin-facts-editor-enhancement.md):
 * owner-edited pin facts are FINAL — re-extraction never overwrites a field the
 * owner has edited; extraction stays the frontline for every untouched field.
 *
 * Before this, runGlobeExtraction overwrote all facts on every re-run ("latest
 * text wins"), so an owner's correction (e.g. household_composition) was lost
 * the next time Claude re-extracted (Andy's Rick Tole / Alp Hof sightings).
 *
 * Pure — no DB. Run: node scripts/verify-sticky-facts.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import {
  STICKY_FACT_FIELDS,
  readCurrentFacts,
  readOwnerEditedFields,
  resolveStickyFacts,
  applyOwnerFactEdit,
} from '${projectRoot}/lib/globe/sticky-facts'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }
function expect(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) ok(label + ' \\u2192 ' + g)
  else bad(label + ': got ' + g + ', wanted ' + w)
}

// Andy's Lockbourne shape: owner corrected household; extraction re-runs.
const current = {
  residence_type: 'house',
  residence_detail: 'small third-floor walk-up',
  household_composition: 'parents and older brother Doug',
  move_reason: 'military_posting',
}
const extracted = {
  residence_type: 'military_base',
  residence_detail: 'base housing',
  household_composition: 'my family',
  move_reason: 'career_relocation',
}

// ── resolveStickyFacts: owner-edited field kept, the rest take extraction ──
expect(
  'one owner-edited field kept, rest re-extracted',
  resolveStickyFacts({ current, extracted, ownerEdited: ['household_composition'] }),
  { residence_type: 'military_base', residence_detail: 'base housing', household_composition: 'parents and older brother Doug', move_reason: 'career_relocation' },
)
expect('no owner edits → everything re-extracted', resolveStickyFacts({ current, extracted, ownerEdited: [] }), extracted)
expect('all owner-edited → nothing changes', resolveStickyFacts({ current, extracted, ownerEdited: [...STICKY_FACT_FIELDS] }), current)
// Junk field names in the list are ignored (never let a bogus field pin a value).
expect('bogus owner-edited field ignored', resolveStickyFacts({ current, extracted, ownerEdited: ['bogus'] }), extracted)

// ── readCurrentFacts: top-level residence_type/move_reason + globe_extraction rest ──
expect(
  'reads facts from metadata (top-level + globe_extraction)',
  readCurrentFacts({ residence_type: 'house', move_reason: 'education', globe_extraction: { residence_detail: 'dorm room', household_composition: 'roommates' } }),
  { residence_type: 'house', residence_detail: 'dorm room', household_composition: 'roommates', move_reason: 'education' },
)
expect('null metadata → all null', readCurrentFacts(null), { residence_type: null, residence_detail: null, household_composition: null, move_reason: null })
expect('empty metadata → all null', readCurrentFacts({}), { residence_type: null, residence_detail: null, household_composition: null, move_reason: null })
// residence_type falls back to globe_extraction when absent at top level.
expect('residence_type falls back to globe_extraction', readCurrentFacts({ globe_extraction: { residence_type: 'rental' } }).residence_type, 'rental')

// ── readOwnerEditedFields: the metadata list, filtered to known fields ──
expect('reads + filters owner-edited list', readOwnerEditedFields({ facts_owner_edited: ['household_composition', 'bogus', 'move_reason'] }), ['household_composition', 'move_reason'])
expect('missing list → empty', readOwnerEditedFields({}), [])
expect('null metadata → empty', readOwnerEditedFields(null), [])

// ── applyOwnerFactEdit: set fields, union the owner-edited list (idempotent) ──
const edit1 = applyOwnerFactEdit({ current, edits: { household_composition: 'my parents and Doug' }, ownerEdited: ['residence_type'] })
expect('owner edit sets the value', edit1.facts.household_composition, 'my parents and Doug')
expect('owner edit leaves other fields', edit1.facts.residence_type, 'house')
expect('owner edit unions the edited list (stable order)', edit1.ownerEdited, ['residence_type', 'household_composition'])
const edit2 = applyOwnerFactEdit({ current: edit1.facts, edits: { residence_type: 'apartment' }, ownerEdited: edit1.ownerEdited })
expect('editing an already-edited field does not duplicate', edit2.ownerEdited, ['residence_type', 'household_composition'])
expect('clearing a field to null is a valid owner edit', applyOwnerFactEdit({ current, edits: { move_reason: null }, ownerEdited: [] }).ownerEdited, ['move_reason'])

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.sticky-facts-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
