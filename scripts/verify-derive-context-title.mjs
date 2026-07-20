#!/usr/bin/env node
/**
 * Proof for deriveContextTitle + stripInlineMarkdown (2026-07-09) —
 * lib/context/derive-title.ts.
 *
 * Live failure this guards: a context note pasted from agent research
 * ("The Mission: [Operation Reflex](https://www.google.com/search?q=…)")
 * derived a title carrying the full raw URL, overflowing the Journey
 * context list. Titles are PLAIN TEXT — markdown reduces to its human
 * text, bare URLs become hostnames, monster tokens clamp.
 *
 * Pure — no DB. Run: node scripts/verify-derive-context-title.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { deriveContextTitle, stripInlineMarkdown } from '${projectRoot}/lib/context/derive-title'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }
function expect(label: string, got: string, want: string) {
  if (got === want) ok(label + ' \\u2192 ' + JSON.stringify(got))
  else bad(label + ': got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))
}

const LONG_URL = 'https://www.google.com/search?q=operation+reflex&kgmid=/g/11xm56n_vj#sv=CBwSjAQKzwMSzAMKjANBSmlUNHRMelhNVS02Mno0UjR0dVlfWkVFRVk4RVRUWE4xVGc2dlBnam44RHVwU1E4VzJZ'

// ── THE live failure, verbatim shape ──
expect(
  'Operation Reflex paste',
  deriveContextTitle('The Mission: [Operation Reflex](' + LONG_URL + ') was the SAC rotational deployment program'),
  'The Mission: Operation Reflex was the SAC rotational…',
)

// ── Headings still win, and get the same cleaning ──
expect('plain heading', deriveContextTitle('## B-47s in the Cold War\\n\\nBody text'), 'B-47s in the Cold War')
expect(
  'heading with a link',
  deriveContextTitle('## The [Reflex](' + LONG_URL + ') era\\n\\nBody'),
  'The Reflex era',
)

// ── A "loose" heading with no space after the hashes (##Foo) is not a
//    valid ATX heading, so it fell through to the raw first line and leaked
//    its # marks into the title (Andy's Lockbourne finding, 2026-07-20).
//    A plain-text title must never begin with heading hashes. ──
expect(
  'no-space heading',
  deriveContextTitle('##The preamble to my journey.\\n\\nBody'),
  'The preamble to my journey.',
)
expect('single no-space hash', deriveContextTitle('#Solo note about the base'), 'Solo note about the base')
expect('hashes-only first line skipped', deriveContextTitle('##\\nReal content on line two'), 'Real content on line two')

// ── stripInlineMarkdown pieces ──
expect('link \\u2192 label', stripInlineMarkdown('see [Operation Reflex](' + LONG_URL + ') for detail'), 'see Operation Reflex for detail')
expect('image \\u2192 alt', stripInlineMarkdown('![base gate photo](https://x.example/img.jpg) 1959'), 'base gate photo 1959')
expect('bare URL \\u2192 hostname', stripInlineMarkdown('source: ' + LONG_URL), 'source: google.com')
expect('emphasis stripped', stripInlineMarkdown('the **secret** _history_ of \`reflex\`'), 'the secret history of reflex')
const clamped = stripInlineMarkdown('token ' + 'x'.repeat(80))
if (clamped.length <= 'token '.length + 41 && clamped.endsWith('\\u2026')) ok('monster token clamped \\u2192 ' + JSON.stringify(clamped.slice(0, 20) + '\\u2026'))
else bad('monster token not clamped: ' + clamped.length + ' chars')

// ── Fallback + empties unchanged ──
expect('plain first line', deriveContextTitle('Just a plain note about the villa summers'), 'Just a plain note about the villa summers')
expect(
  '8-word truncation',
  deriveContextTitle('one two three four five six seven eight nine ten'),
  'one two three four five six seven eight\\u2026',
)
expect('empty body', deriveContextTitle('   '), 'Untitled note')
expect('URL-only line', deriveContextTitle(LONG_URL), 'google.com')

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.derive-title-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
