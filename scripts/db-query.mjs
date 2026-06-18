#!/usr/bin/env node
/**
 * Run a read-only SQL query against the project's Postgres, reusing the
 * same .env.local connection setup as db-apply.mjs. For inspection /
 * debugging only — never use this to mutate data (that path is migrations
 * via db-apply.mjs).
 *
 * Usage:
 *   node scripts/db-query.mjs "SELECT id, type, canonical_name FROM entities LIMIT 5"
 *
 * Output is printed as aligned JSON rows. The query runs inside a
 * READ ONLY transaction, so any write statement will error.
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

for (const line of readFileSync(join(projectRoot, '.env.local'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('='); if (i < 0) continue
  const k = line.slice(0, i).trim(); if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}

const DB_URL = process.env.SUPABASE_DB_URL
if (!DB_URL) { console.error('✗ SUPABASE_DB_URL is not set in .env.local.'); process.exit(1) }

const sql = process.argv[2]
if (!sql) { console.error('Usage: node scripts/db-query.mjs "SELECT ..."'); process.exit(1) }

const { Client } = await import('pg')
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
try {
  await client.query('BEGIN READ ONLY')
  const { rows } = await client.query(sql)
  console.log(JSON.stringify(rows, null, 2))
  await client.query('ROLLBACK')
} finally {
  await client.end()
}
