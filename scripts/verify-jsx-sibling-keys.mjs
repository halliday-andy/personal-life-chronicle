#!/usr/bin/env node
/**
 * Proof: no two SIBLING JSX elements carry the same `key` expression.
 *
 * Origin (2026-07-26, Andy's QA): the pin edit panel rendered its Facts block
 * NINETEEN times. Root cause — PinFactsEditor and PinConnections are siblings
 * in the same children list and both used `key={pin.relationship_id}`. React
 * reconciles siblings by key, so a collision makes it "duplicate and/or omit"
 * them. It warns, but only at runtime in dev, in a console nobody was reading.
 *
 * The class of bug: when several sibling components each reset on the same
 * entity, keying them all off that entity's bare id collides. Namespace the
 * key by the component's ROLE (`facts-${id}`, `connections-${id}`).
 *
 * Static check over every .tsx: for each JSX element, compare the `key`
 * attribute source text of its DIRECT element children. Children produced
 * inside a .map() sit in their own expression container and so are never
 * compared against each other — only literal siblings are.
 *
 * Run: node scripts/verify-jsx-sibling-keys.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const ts = (await import('typescript')).default ?? (await import('typescript'))

/** Every .tsx under the app's source directories. */
function collect(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) collect(full, out)
    else if (name.endsWith('.tsx')) out.push(full)
  }
  return out
}

const files = ['components', 'app'].flatMap((d) => {
  try { return collect(join(projectRoot, d)) } catch { return [] }
})

const findings = []

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  /** The `key={...}` source text of a JSX element, or null when it has none. */
  const keyOf = (node) => {
    const opening = ts.isJsxElement(node) ? node.openingElement
      : ts.isJsxSelfClosingElement(node) ? node : null
    if (!opening) return null
    for (const attr of opening.attributes.properties) {
      if (ts.isJsxAttribute(attr) && attr.name.getText(sf) === 'key' && attr.initializer) {
        return attr.initializer.getText(sf)
      }
    }
    return null
  }

  /**
   * The JSX elements a child slot can actually render. A slot is usually
   * `{cond && <El/>}` or `{cond ? <A/> : <B/>}` rather than a bare element —
   * that is exactly the shape the 19x bug hid in. Elements produced inside a
   * .map() are skipped: their keys are per-item and comparing them across two
   * different maps would be a false positive.
   */
  const candidates = (child) => {
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) return [child]
    if (!ts.isJsxExpression(child) || !child.expression) return []
    const found = []
    const walk = (n) => {
      if (ts.isCallExpression(n) && /\.map$/.test(n.expression.getText(sf))) return
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) found.push(n)
      ts.forEachChild(n, walk)
    }
    walk(child.expression)
    return found
  }

  const visit = (node) => {
    const children = ts.isJsxElement(node) ? node.children
      : ts.isJsxFragment(node) ? node.children : null
    if (children) {
      const seen = new Map()
      for (const slot of children) {
        for (const child of candidates(slot)) {
        const key = keyOf(child)
        if (!key) continue
        const tag = (ts.isJsxElement(child) ? child.openingElement : child).tagName.getText(sf)
        if (seen.has(key)) {
          const { line } = sf.getLineAndCharacterOfPosition(child.getStart(sf))
          findings.push({
            file: relative(projectRoot, file),
            line: line + 1,
            key,
            tags: [seen.get(key), tag],
          })
        } else {
          seen.set(key, tag)
        }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

console.log(`Scanned ${files.length} .tsx files for colliding sibling keys.`)
if (findings.length === 0) {
  console.log('  ✓ every sibling key is unique within its parent')
  console.log('\nPASS')
  process.exit(0)
}
for (const f of findings) {
  console.error(`  ✗ ${f.file}:${f.line} — <${f.tags[0]}> and <${f.tags[1]}> are siblings sharing key ${f.key}`)
  console.error('     Namespace them by role, e.g. key={`facts-${id}`} / key={`connections-${id}`}.')
}
console.error(`\nFAIL (${findings.length})`)
process.exit(1)
