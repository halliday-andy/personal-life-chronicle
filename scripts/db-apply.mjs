#!/usr/bin/env node
/**
 * Apply Supabase migrations directly from this repo over a Postgres
 * connection, so DDL can be applied without the dashboard copy-paste loop.
 *
 * Requires, in .env.local (git-ignored, never committed):
 *   SUPABASE_DB_URL — the project's Postgres connection URI (from the
 *     dashboard "Connect" button; the pooler URI is fine). The password
 *     in it may be left as a placeholder.
 *   SUPABASE_DB_PASSWORD — the raw database password, on its own line,
 *     pasted EXACTLY as-is (no percent-encoding). When present it is
 *     passed to the driver directly, so special characters in the
 *     password (%, @, :, …) never have to be URI-escaped. Recommended.
 *
 * Usage:
 *   node scripts/db-apply.mjs                 # apply all pending migrations
 *   node scripts/db-apply.mjs <name.sql>      # apply one migration by filename
 *   node scripts/db-apply.mjs --status        # show applied vs pending
 *   node scripts/db-apply.mjs --mark <name>   # record as applied WITHOUT running
 *                                             # (for migrations already applied
 *                                             #  out-of-band, e.g. via dashboard)
 *
 * Applied files are tracked in public._claude_migrations. Each migration
 * runs inside ONE transaction: any error rolls the whole file back and
 * records nothing, so a failed apply never leaves a half-migrated schema.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(projectRoot, 'supabase', 'migrations')

// Load .env.local (same minimal parser the verify scripts use).
for (const line of readFileSync(join(projectRoot, '.env.local'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('='); if (i < 0) continue
  const k = line.slice(0, i).trim(); if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}

const DB_URL = process.env.SUPABASE_DB_URL
if (!DB_URL) {
  console.error('✗ SUPABASE_DB_URL is not set in .env.local.')
  console.error('  Add it from Supabase → Project Settings → Database → Connection string (URI).')
  process.exit(1)
}

let Client
try {
  ({ Client } = await import('pg'))
} catch {
  console.error('✗ The "pg" package is not installed. Run:  npm install pg')
  process.exit(1)
}

const allMigrations = () =>
  readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()

// Build the connection config. If a raw password is supplied separately,
// parse the URI for host/user/db and pass the password to the driver
// directly — this sidesteps URI percent-encoding for special characters.
const ssl = /supabase\.(co|com)/.test(DB_URL) ? { rejectUnauthorized: false } : undefined
const rawPassword = process.env.SUPABASE_DB_PASSWORD
let clientConfig
if (rawPassword) {
  const u = new URL(DB_URL)
  clientConfig = {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    user: decodeURIComponent(u.username),
    database: u.pathname.replace(/^\//, '') || 'postgres',
    password: rawPassword,
    ssl,
  }
} else {
  clientConfig = { connectionString: DB_URL, ssl }
}

const client = new Client(clientConfig)
await client.connect()

await client.query(`
  CREATE TABLE IF NOT EXISTS public._claude_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`)

const appliedSet = async () => {
  const { rows } = await client.query('SELECT filename FROM public._claude_migrations')
  return new Set(rows.map((r) => r.filename))
}

const args = process.argv.slice(2)

try {
  if (args[0] === '--status') {
    const applied = await appliedSet()
    for (const f of allMigrations()) console.log(`${applied.has(f) ? '✓ applied ' : '· pending '} ${f}`)
  } else if (args[0] === '--mark') {
    const f = args[1]
    if (!f || !allMigrations().includes(f)) throw new Error(`unknown migration: ${f ?? '(none)'}`)
    await client.query('INSERT INTO public._claude_migrations(filename) VALUES ($1) ON CONFLICT DO NOTHING', [f])
    console.log(`marked as applied (not run): ${f}`)
  } else {
    const applied = await appliedSet()
    const targets = args[0]
      ? [args[0]]
      : allMigrations().filter((f) => !applied.has(f))

    if (args[0] && !allMigrations().includes(args[0])) throw new Error(`unknown migration: ${args[0]}`)
    if (targets.length === 0) { console.log('Nothing to apply — all migrations are recorded as applied.'); }

    for (const f of targets) {
      if (applied.has(f) && !args[0]) continue
      if (applied.has(f)) { console.log(`already applied, skipping: ${f}`); continue }
      const sql = readFileSync(join(migrationsDir, f), 'utf8')
      process.stdout.write(`applying ${f} … `)
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('INSERT INTO public._claude_migrations(filename) VALUES ($1) ON CONFLICT DO NOTHING', [f])
        await client.query('COMMIT')
        console.log('ok')
      } catch (e) {
        await client.query('ROLLBACK')
        console.log('FAILED')
        throw new Error(`${f}: ${e.message}`)
      }
    }
  }
} finally {
  await client.end()
}
