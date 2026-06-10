---
name: reference_lc_migration_apply
description: How to apply Supabase migrations in this project — Claude can apply DDL directly via scripts/db-apply.mjs (no dashboard paste needed)
metadata:
  type: reference
---

# Applying Supabase migrations

As of 2026-06-09, migrations can be applied **directly from the repo** —
no dashboard copy-paste and no `supabase` CLI required (neither the CLI,
`psql`, nor a linked CLI ledger is present on this machine).

**Tool:** `scripts/db-apply.mjs` (uses `pg`, a devDependency).

```
node scripts/db-apply.mjs              # apply all pending migrations
node scripts/db-apply.mjs <name.sql>   # apply one migration by filename
node scripts/db-apply.mjs --status     # list applied vs pending
node scripts/db-apply.mjs --mark <f>   # record as applied WITHOUT running
```

Each file runs in **one transaction** (rollback on error). Applied files
are tracked in `public._claude_migrations` — a ledger **independent** of
the Supabase CLI's own history. Migrations applied out-of-band (e.g. via
the dashboard) should be `--mark`ed so apply-all skips them. All
migrations through `20260609010000_globe_slice4b_proximity.sql` are
already marked applied.

**Credentials (in `.env.local`, git-ignored — never commit):**
- `SUPABASE_DB_URL` — the Postgres URI from the dashboard **Connect**
  button (top bar; the connection string moved out of Settings). Pooler
  URI is fine: `…@aws-1-us-west-2.pooler.supabase.com:5432/postgres`,
  user `postgres.delzsmzovxwfgwetgooi`.
- `SUPABASE_DB_PASSWORD` — the **raw** DB password on its own line, no
  quotes/brackets/encoding. The script passes it to the driver directly
  so URI-special chars (`%`, `@`, `:`) need no escaping. (Embedding the
  password in the URI instead breaks on those characters.)

**Workflow with Andy:** write the migration → show it → apply via
db-apply → run the matching `scripts/verify-globe-*.mjs` (or equivalent)
proof → commit. Andy can still paste SQL manually if he prefers, but it's
no longer required. See [[feedback_lc_memory_dual_write]] for the
parallel rule that memory writes hit both mirrors.

**Safety checkpoint (2026-06-09):** before applying any migration that
ALTERS or DROPS existing data, STOP and get Andy's explicit approval
first. Additive/reversible changes (CREATE … IF NOT EXISTS, ADD COLUMN
nullable, CREATE OR REPLACE FUNCTION, new RPCs) may be applied without
the gate; when unsure, treat as destructive and ask. Canonical statement
is in the project `CLAUDE.md` ("Migration Safety Checkpoint"). Removable
later if it proves superfluous.

**Verify-script caution:** proofs run against the live shared DB with
real data — assert only relative properties between a script's own
fixtures, never absolute counts/distances that assume an empty database
(see the Slice 4b proximity note in [[project_lc_build_progress]]).
