#!/usr/bin/env node
/**
 * Proof for server-side HEIC→JPEG conversion (lib/globe/heic-server.ts).
 *
 * Converts a real HEVC HEIC (the iPhone-style format browser heic2any
 * failed on) and asserts the output is a valid JPEG under the storage cap,
 * and that non-HEIC input passes through untouched.
 *
 * Fetches a sample HEIC to /tmp on first run; SKIPS gracefully if offline
 * and no sample is cached (so it never hard-fails CI without network).
 *
 * Run: node scripts/verify-heic-server-convert.mjs
 */

import { spawnSync, execSync } from 'node:child_process'
import { existsSync, writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const SAMPLE = '/tmp/sample.heic'
const SAMPLE_URL = 'https://github.com/tigranbs/test-heic-images/raw/master/image1.heic'

if (!existsSync(SAMPLE)) {
  try {
    execSync(`curl -fsSL --max-time 25 -o ${SAMPLE} "${SAMPLE_URL}"`, { stdio: 'ignore' })
  } catch {
    console.log('SKIP — no cached sample HEIC and could not fetch one (offline).')
    process.exit(0)
  }
}

const runner = `
import { readFileSync } from 'node:fs'
import { toWebSafeImage } from '${projectRoot}/lib/globe/heic-server'

let failures = 0
const ok = (m) => console.log('  \\u2713 ' + m)
const bad = (m) => { console.error('  \\u2717 ' + m); failures++ }

async function main() {
  const heic = readFileSync('${SAMPLE}')
  const out = await toWebSafeImage(heic, 'image/heic', 'IMG_0001.heic')
  if (out.converted && out.mimeType === 'image/jpeg' && out.filename === 'IMG_0001.jpg') ok('HEIC converted → JPEG, renamed .jpg')
  else bad('conversion metadata wrong: ' + JSON.stringify({ c: out.converted, m: out.mimeType, f: out.filename }))
  const b = out.bytes
  if (b[0] === 0xff && b[1] === 0xd8 && b[b.length-2] === 0xff && b[b.length-1] === 0xd9) ok('output is a valid JPEG (FFD8…FFD9), ' + b.byteLength + ' bytes')
  else bad('not a valid JPEG')
  if (b.byteLength <= 5*1024*1024) ok('under the 5MB storage cap'); else bad('exceeds 5MB')

  const jpg = Buffer.from([0xff,0xd8,0xff,0xe0,1,2,3])
  const p = await toWebSafeImage(jpg, 'image/jpeg', 'photo.jpg')
  if (!p.converted && p.bytes === jpg) ok('non-HEIC passes through untouched'); else bad('passthrough wrong')

  console.log(failures === 0 ? '\\nPASS' : '\\nFAIL (' + failures + ')')
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
`
const tmp = join(projectRoot, '.heic-server-runner.tmp.ts')
writeFileSync(tmp, runner)
const r = spawnSync('npx', ['-y', 'tsx', '--tsconfig', 'tsconfig.json', tmp], { cwd: projectRoot, stdio: 'inherit' })
unlinkSync(tmp)
process.exit(r.status ?? 1)
