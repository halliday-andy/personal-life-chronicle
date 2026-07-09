#!/usr/bin/env node
/**
 * Proof for the capture-intent pure logic (R1, 2026-07-09) —
 * lib/agents/orchestrator/intent.ts.
 *
 * Asserts:
 *   1. parseCaptureIntent accepts a well-formed consume_stub intent and
 *      rejects: wrong kind, bad uuids, empty body/name, non-objects.
 *   2. findBackstopConsume owes nothing when: no intent; the model already
 *      consumed THIS stub; no memory was created (mid-interview turn).
 *   3. findBackstopConsume owes the consume when a memory persisted but
 *      the stub wasn't consumed — including when a consume ran for a
 *      DIFFERENT stub (that one doesn't count).
 *   4. renderIntentPreamble carries the exact stub_id and entity name.
 *
 * Pure — no DB. Run: node scripts/verify-capture-intent.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { parseCaptureIntent, renderIntentPreamble, findBackstopConsume } from '${projectRoot}/lib/agents/orchestrator/intent'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

const STUB = '11111111-2222-3333-4444-555555555555'
const ENT = '66666666-7777-8888-9999-aaaaaaaaaaaa'
const MEM = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'
const good = { kind: 'consume_stub', stub_id: STUB, stub_body: 'the boat July', entity_id: ENT, entity_name: 'Marta' }

// ── 1. parse ──
if (parseCaptureIntent(good)?.stub_id === STUB) ok('parse accepts a well-formed intent')
else bad('parse rejected a good intent')
const rejects = [
  { ...good, kind: 'other' },
  { ...good, stub_id: 'not-a-uuid' },
  { ...good, entity_id: '123' },
  { ...good, stub_body: '  ' },
  { ...good, entity_name: '' },
  null, 42, 'consume_stub', [],
]
if (rejects.every((r) => parseCaptureIntent(r) === null)) ok('parse rejects malformed intents (kind/uuids/empties/non-objects)')
else bad('parse accepted something malformed')

// ── 2 + 3. backstop decision ──
const createP = { tool: 'create_memory', persisted: true, rationale: '', data: { memory_id: MEM } } as any
const consumeMine = { tool: 'consume_memory_stub', persisted: true, rationale: '', data: { stub_id: STUB } } as any
const consumeOther = { tool: 'consume_memory_stub', persisted: true, rationale: '', data: { stub_id: ENT } } as any
const consumeFailed = { tool: 'consume_memory_stub', persisted: false, rationale: '', data: { stub_id: STUB } } as any
const intent = parseCaptureIntent(good)!

if (findBackstopConsume(null, [createP]) === null) ok('no intent → nothing owed')
else bad('owed without intent')
if (findBackstopConsume(intent, [createP, consumeMine]) === null) ok('model already consumed this stub → nothing owed')
else bad('owed despite model consume')
if (findBackstopConsume(intent, []) === null && findBackstopConsume(intent, [consumeFailed]) === null)
  ok('no persisted memory (mid-interview) → nothing owed; failed consume alone changes nothing')
else bad('owed on a mid-interview turn')
const owed1 = findBackstopConsume(intent, [createP])
if (owed1?.stub_id === STUB && owed1.memory_id === MEM) ok('memory persisted, no consume → backstop owes {stub, memory}')
else bad('backstop missed the owed consume: ' + JSON.stringify(owed1))
const owed2 = findBackstopConsume(intent, [createP, consumeOther])
if (owed2?.stub_id === STUB) ok("a consume for a DIFFERENT stub doesn't satisfy this intent")
else bad('foreign consume wrongly satisfied the intent')
const owed3 = findBackstopConsume(intent, [createP, consumeFailed])
if (owed3?.stub_id === STUB) ok('a FAILED consume for this stub still leaves it owed')
else bad('failed consume wrongly satisfied the intent')

// ── 4. preamble ──
const pre = renderIntentPreamble(intent)
if (pre.includes(STUB) && pre.includes('Marta') && pre.includes('the boat July'))
  ok('preamble carries the exact stub_id, entity name, and jot text')
else bad('preamble missing fields')

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.capture-intent-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
