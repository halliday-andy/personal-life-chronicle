#!/usr/bin/env node
/**
 * Proof for lib/richPaste.ts — rich-clipboard paste → markdown.
 *
 * Root cause it guards (2026-07-16, Andy's Biggs AFB note): research
 * copied from a rendered-HTML source (Gemini etc.) carries a rich
 * text/html clipboard flavor AND a degraded text/plain flavor — bold,
 * bullets, citation links stripped, block boundaries run together
 * ("missions.The Jet"). A bare <textarea> pastes the plain flavor, so
 * the degradation reached entity_context_notes at write time. The fix
 * converts the HTML flavor to markdown instead.
 *
 * Asserts (pure function, no DB):
 *   1. <strong>/<b> → **bold**
 *   2. <ul><li> → "- " bullets, one per line
 *   3. <a href> → [text](url) (the citation links survive)
 *   4. Adjacent <p> blocks separate with blank lines — never run together
 *   5. <h2> → ## heading
 *   6. Nested formatting inside a bullet survives
 *   7. shouldUseHtmlFlavor: true when HTML adds formatting; false for
 *      span-wrapped plain text (default paste stays untouched)
 *
 * Run: node scripts/verify-rich-paste.mjs
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const runnerSrc = `
import { htmlToMarkdown, shouldUseHtmlFlavor } from '${projectRoot}/lib/richPaste'

let failures = 0
const ok = (m: string) => console.log('  \\u2713 ' + m)
const bad = (m: string) => { console.error('  \\u2717 ' + m); failures++ }

// 1. Bold
const bold = htmlToMarkdown('<p>almost certainly <strong>Biggs Air Force Base</strong>.</p>')
bold.includes('**Biggs Air Force Base**') ? ok('strong → **bold**') : bad('bold lost: ' + JSON.stringify(bold))

// 2. Bullets
const list = htmlToMarkdown('<ul><li>The SAC Connection</li><li>The Jet Transition Era</li></ul>')
const listLines = list.split('\\n').filter(Boolean)
listLines.length === 2 && listLines.every((l) => l.startsWith('- '))
  ? ok('ul/li → "- " bullets on separate lines') : bad('bullets wrong: ' + JSON.stringify(list))

// 3. Links (the citations)
const link = htmlToMarkdown('<p>renamed Biggs AFB. [<a href="https://tshaonline.org/biggs">1</a>]</p>')
link.includes('[1](https://tshaonline.org/biggs)') ? ok('a href → [text](url)') : bad('link lost: ' + JSON.stringify(link))

// 4. Block separation — the "missions.The Jet Transition Era" regression
const blocks = htmlToMarkdown('<p>long-range deterrence missions.</p><p>The Jet Transition Era began.</p>')
if (blocks.includes('missions.\\n\\nThe Jet')) ok('adjacent <p> blocks never run together')
else bad('blocks ran together: ' + JSON.stringify(blocks))

// 5. Headings
const head = htmlToMarkdown('<h2>Biggs Air Force Base (El Paso, TX)</h2><p>body</p>')
head.startsWith('## Biggs Air Force Base') ? ok('h2 → ## heading') : bad('heading wrong: ' + JSON.stringify(head))

// 6. Formatting nested in bullets
const nested = htmlToMarkdown('<ul><li><strong>The SAC Connection:</strong> a major hub. [<a href="https://x.test/1">1</a>]</li></ul>')
nested.includes('- **The SAC Connection:**') && nested.includes('[1](https://x.test/1)')
  ? ok('bold + link survive inside a bullet') : bad('nested formatting lost: ' + JSON.stringify(nested))

// 7. Flavor decision
const richHtml = '<p>See <strong>this</strong>.</p>'
shouldUseHtmlFlavor(richHtml, 'See this.') ? ok('rich HTML flavor wins when it adds formatting') : bad('rich flavor not chosen')
const trivial = '<span>just plain words</span>'
!shouldUseHtmlFlavor(trivial, 'just plain words') ? ok('span-wrapped plain text falls back to default paste') : bad('trivial HTML wrongly intercepted')
!shouldUseHtmlFlavor('', 'plain only') ? ok('no HTML flavor → default paste') : bad('empty HTML wrongly intercepted')

// ── R9 / finding F11 (2026-07-30, Andy's Dartmouth paste) ──────────────
// Two losses against his real Gemini source: the whole table, and EVERY
// bold run. Bold survived the fixtures above because they use semantic
// <strong>; the real source marks emphasis PRESENTATIONALLY. Rule 12:
// test a converter against captured real input, not idealised markup.

// 8. GFM tables survive as tables
const table = htmlToMarkdown(
  '<table><thead><tr><th>Institution</th><th>Transition</th></tr></thead>' +
  '<tbody><tr><td>Dartmouth</td><td>1972</td></tr>' +
  '<tr><td>Brown</td><td>1971</td></tr></tbody></table>',
)
if (table.includes('| Institution |') && table.includes('| Dartmouth |') && /\\|\\s*---/.test(table))
  ok('table → GFM pipe table with a delimiter row')
else bad('F11: table destroyed: ' + JSON.stringify(table))

// 9. The table's cells must NOT become a vertical run of orphaned values
if (!/Institution\\n\\nTransition/.test(table))
  ok('table cells are not exploded into separate blocks')
else bad('F11: cells exploded into blocks: ' + JSON.stringify(table))

// 10. PRESENTATIONAL bold — the real-world form that lost everything
const styledBold = htmlToMarkdown('<p><span style="font-weight:700">Zero-Sum Fear:</span> a practical fear.</p>')
styledBold.includes('**Zero-Sum Fear:**')
  ? ok('span[style=font-weight:700] → **bold**')
  : bad('F11: presentational bold lost: ' + JSON.stringify(styledBold))
const styledBoldWord = htmlToMarkdown('<p><span style="font-weight: bold">D-Plan</span> details.</p>')
styledBoldWord.includes('**D-Plan**')
  ? ok('span[style=font-weight:bold] → **bold**')
  : bad('F11: keyword font-weight lost: ' + JSON.stringify(styledBoldWord))

// 11. Presentational italic
const styledItalic = htmlToMarkdown('<p><span style="font-style: italic">Keep the Damned Women Out</span></p>')
styledItalic.includes('*Keep the Damned Women Out*')
  ? ok('span[style=font-style:italic] → *italic*')
  : bad('F11: presentational italic lost: ' + JSON.stringify(styledItalic))

// 12. Normal weights are left alone — no bolding the whole document
const normalWeight = htmlToMarkdown('<p><span style="font-weight:400">ordinary text</span> here.</p>')
!normalWeight.includes('**')
  ? ok('font-weight:400 is not treated as bold')
  : bad('over-bolded normal text: ' + JSON.stringify(normalWeight))

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
process.exit(failures === 0 ? 0 : 1)
`

const tmp = join(projectRoot, '.rich-paste-runner.tmp.ts')
writeFileSync(tmp, runnerSrc)
const r = spawnSync('npx', ['-y', 'tsx', tmp], { cwd: projectRoot, stdio: 'inherit', env: process.env })
unlinkSync(tmp)
process.exit(r.status ?? 1)
