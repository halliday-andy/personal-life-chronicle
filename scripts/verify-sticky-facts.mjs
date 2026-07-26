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
  mergeFactsIntoMetadata,
} from '${projectRoot}/lib/globe/sticky-facts'
import {
  RESIDENCE_TYPES,
  MOVE_REASONS,
  factOptionLabel,
} from '${projectRoot}/lib/globe/fact-vocabulary'

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

// ── mergeFactsIntoMetadata: the ONE writer of the persisted fact shape ──
// Facts live in two places at once: residence_type/move_reason at the metadata
// top level (the period-summary SQL reads them there) and all four mirrored
// under globe_extraction. runGlobeExtraction and the owner-edit path must
// produce byte-identical shapes, so both call this.
const auditMeta = {
  is_self: false,
  prior_anchor_residence_id: 'rel-123',
  facts_owner_edited: ['residence_type'],
  globe_extraction: {
    residence_type: 'house',
    residence_detail: 'small third-floor walk-up',
    household_composition: 'parents and older brother Doug',
    move_reason: 'military_posting',
    mentioned_people: ['my father'],
    mentioned_organisations: ['Lockbourne AFB'],
    rough_temporal_range: 'right after the war',
    confidence: 0.8,
    memory_id: 'mem-1',
    model: 'claude-x',
    extracted_at: '2026-07-10T00:00:00.000Z',
  },
}
const merged = mergeFactsIntoMetadata({
  metadata: auditMeta,
  facts: { residence_type: 'apartment', residence_detail: 'walk-up', household_composition: 'just me', move_reason: 'education' },
  ownerEdited: ['residence_type', 'move_reason'],
})
expect('top-level residence_type written', merged.residence_type, 'apartment')
expect('top-level move_reason written', merged.move_reason, 'education')
expect('globe_extraction mirrors all four facts', {
  residence_type: merged.globe_extraction.residence_type,
  residence_detail: merged.globe_extraction.residence_detail,
  household_composition: merged.globe_extraction.household_composition,
  move_reason: merged.globe_extraction.move_reason,
}, { residence_type: 'apartment', residence_detail: 'walk-up', household_composition: 'just me', move_reason: 'education' })
expect('owner-edited list written', merged.facts_owner_edited, ['residence_type', 'move_reason'])
// MERGE-only, in both directions: unrelated metadata AND the extraction audit
// trail (who was mentioned, when it ran, how sure it was) must survive an edit.
expect('unrelated metadata keys preserved', { is_self: merged.is_self, prior: merged.prior_anchor_residence_id }, { is_self: false, prior: 'rel-123' })
expect('extraction audit trail preserved', {
  people: merged.globe_extraction.mentioned_people,
  orgs: merged.globe_extraction.mentioned_organisations,
  range: merged.globe_extraction.rough_temporal_range,
  confidence: merged.globe_extraction.confidence,
  at: merged.globe_extraction.extracted_at,
}, { people: ['my father'], orgs: ['Lockbourne AFB'], range: 'right after the war', confidence: 0.8, at: '2026-07-10T00:00:00.000Z' })
// The never-extracted pin: an owner can edit facts on a pin Claude never ran
// on. The shape must still come out whole, not half-written.
const fromNothing = mergeFactsIntoMetadata({
  metadata: null,
  facts: { residence_type: null, residence_detail: null, household_composition: 'my parents', move_reason: null },
  ownerEdited: ['household_composition'],
})
expect('no prior metadata → globe_extraction created', fromNothing.globe_extraction.household_composition, 'my parents')
expect('no prior metadata → owner list created', fromNothing.facts_owner_edited, ['household_composition'])
expect('nulls persist as null, not dropped', fromNothing.residence_type, null)

// ── fact vocabulary: the UI selects and the model enum read ONE list ──
expect('residence types are the extraction vocabulary', [...RESIDENCE_TYPES], ['apartment', 'house', 'dormitory', 'military_base', 'rental', 'family_home', 'other'])
expect('move reasons include the 2026-07-09 additions', MOVE_REASONS.includes('relationship') && MOVE_REASONS.includes('seasonal_work'), true)
expect('unknown is a selectable move reason', MOVE_REASONS.includes('unknown'), true)
// Every code needs a human label — adding a code without one must be caught here.
const unlabelled = [...RESIDENCE_TYPES, ...MOVE_REASONS].filter((c) => !factOptionLabel(c) || factOptionLabel(c) === c)
expect('every vocabulary code has a human label', unlabelled, [])

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.sticky-facts-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
