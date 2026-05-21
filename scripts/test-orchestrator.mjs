#!/usr/bin/env node
/**
 * CLI smoke test for the Orchestrator Agent (Step 6b).
 *
 * Runs runOrchestrator() against Andy's user_id with one or more sample
 * submissions and prints the full structured response so we can verify:
 *
 *   - The three-layer prompt assembles (Layer A constant, Layer B digest,
 *     Layer C submission)
 *   - Claude calls the right tools for the right reasons
 *   - Sub-agent delegations (Tagger, Entity) fire and return useful data
 *   - The proposals[] array is well-shaped for downstream UI work (6e+)
 *
 * Run:
 *   node scripts/test-orchestrator.mjs           # runs both default samples
 *   node scripts/test-orchestrator.mjs short     # short single-recollection only
 *   node scripts/test-orchestrator.mjs long      # multi-recollection paste only
 *
 * Note: this script uses ts-node-style on-the-fly compilation by importing
 * the TypeScript modules through tsx. If tsx isn't installed, falls back
 * to instructions for the user.
 */

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

// Load .env.local
const envText = readFileSync(join(projectRoot, '.env.local'), 'utf8')
for (const line of envText.split('\n')) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i).trim()
  const v = line.slice(i + 1).trim()
  if (!process.env[k]) process.env[k] = v
}

const USER_ID = 'b957ab56-8926-4749-b44f-e67831d0afcc' // Andy

const SAMPLES = {
  short:
    'I just remembered — at the funeral for my mother, my Uncle Ken pulled me aside and told me she had been writing letters to her sister Helen for twenty years that nobody knew about. They were in a tin in the attic.',
  long: `Three things I want to capture from this week:

First, I saw an old photo of my father in his Air Force uniform from the mid-50s. It made me think about how little I know about his service years before he met my mother.

Second, my daughter called and asked about the time we drove cross-country in 1992. I'd forgotten how that trip changed our family — we left as one kind of family and arrived as another.

Third, I keep coming back to a book I read in college, "The Denial of Death" by Ernest Becker. I want to record how it shaped my thinking about meaning and mortality at age 20.`,
}

const which = process.argv[2]
const samplesToRun = which ? [which] : ['short', 'long']

// Use tsx to run the TS module directly.
const runnerSrc = `
import { runOrchestrator } from '${projectRoot}/lib/agents/orchestrator/core'

const USER_ID = '${USER_ID}'
const samples = ${JSON.stringify(samplesToRun)}
const SAMPLES = ${JSON.stringify(SAMPLES)}

async function main() {
  for (const key of samples) {
    const text = SAMPLES[key]
    if (!text) { console.error('Unknown sample:', key); continue }
    console.log('━'.repeat(72))
    console.log('SAMPLE:', key)
    console.log('━'.repeat(72))
    console.log('INPUT:')
    console.log(text)
    console.log()
    const t0 = Date.now()
    const response = await runOrchestrator({
      user_id: USER_ID,
      submission_text: text,
    })
    const ms = Date.now() - t0
    console.log('REPLY:')
    console.log(response.reply || '(empty)')
    console.log()
    console.log('PROPOSALS (' + response.proposals.length + '):')
    for (const p of response.proposals) {
      console.log('  • [iter ' + p.iteration + '] ' + p.tool + (p.persisted ? ' [PERSISTED]' : '') +
                  (p.confidence !== undefined ? ' (conf ' + p.confidence.toFixed(2) + ')' : ''))
      console.log('    why: ' + p.rationale)
      const dataKeys = Object.keys(p.data ?? {})
      if (dataKeys.length > 0) {
        console.log('    data keys: ' + dataKeys.join(', '))
      }
    }
    console.log()
    console.log('META:', JSON.stringify(response.meta, null, 2))
    console.log('Elapsed: ' + ms + 'ms')
    console.log()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
`

const tmpFile = join(projectRoot, '.orchestrator-runner.tmp.ts')
const fs = await import('node:fs/promises')
await fs.writeFile(tmpFile, runnerSrc)

const result = spawnSync(
  'npx',
  ['-y', 'tsx', tmpFile],
  { cwd: projectRoot, stdio: 'inherit', env: process.env },
)
await fs.unlink(tmpFile).catch(() => {})

process.exit(result.status ?? 1)
