# What changed — 2026-07-17 harness cleanup

Follow-up to `YOUR-AI-SETUP-2026-07-16/YOUR-AI-SETUP.html`. Andy approved items 1, 2, 4, and 5; item 3 (`.claude/settings.local.json`) was explained but no change was made — still open, awaiting your call.

## 1. Archived 3 stale handoff prompts

Moved to `docs/plans/archive/`, each with a one-line "archived / superseded" note at the top:
- `2026-06-22-claude-code-handoff-prompt.md`
- `2026-07-04-claude-code-handoff-prompt.md`
- `2026-07-07-claude-code-handoff-prompt.md`

`docs/plans/2026-07-07-claude-code-handoff-prompt-post-slice7.md` is untouched and remains the most recent handoff prompt in the active `docs/plans/` folder (still flagged in the original report as itself aging past the 2026-07-15 Trips & Travel work — that's a separate, still-open question).

## 2. Trimmed `memory/README.md`

It no longer restates the dual-write protocol. It now points to `CLAUDE.md` (the operative rule Claude actually loads) and `memory/feedback_lc_memory_dual_write.md` (the origin/incident rationale), and keeps only the verification steps, which were unique to this file.

## 3. Not changed — awaiting your decision

Explained how `.claude/settings.json` and `.claude/settings.local.json` interact (additive merge; the local file's git-permission entries are redundant with settings.json, its one unique grant is `verify-entity-matching.mjs`). No file touched.

## 4. Removed `documentation/early-planning-v2/`

Deleted (via git, fully recoverable from history): `README_Import_Validation.txt`, `Revised_PRD_v2.md`, `cef-schema.json`, `handoff-checklist.md`, `lovable-build-spec.v2.md`. Per your confirmation, these were seed documents for an early PRD draft, superseded by the current PRD v1.1 / schema v1.4.

## 5. Split `memory/project_lc_build_progress.md`

The file kept: the frontmatter, the **2026-07-15** (Trips & Travel Journal) and **2026-07-05** (reconciliation → Slice 6.5b → Journey J1–J5 → Slice 7 → Hopper QA through 07-09) session-handoff blocks, and the "How to apply" footer. Those two blocks are the ones that together give current, cross-feature guidance — they cover Trips, Globe/Slice 6, Journey, Hopper, and the most recent entity-resolution/data-integrity incidents and their fixes.

Everything from the **2026-06-17 QA remediation pass** backward through **Step 5 / Slice 2** (the original May–mid-June build history: Steps 6a–6h, Slices 1–4b, the context-layer design session, HEIC handling, dev-server operational rules, durable schema/tooling gotchas) moved verbatim, byte-for-byte, to a new file: `memory/project_lc_build_progress_archive_2026H1.md`. Nothing was deleted or reworded — only relocated.

Rationale for the cutoff: the 07-05 and 07-15 blocks are large enough on their own to carry forward context for every feature area currently active (globe, entity resolution, journey, hopper, trips) without needing the older slice-by-slice history for day-to-day resumption. The archived material is still one click away and is exactly where the durable "class-of-bug" lessons and tooling gotchas (Inngest v4 breaking changes, HEIC conversion, dev-server rules, RLS activation gate) now live if a future session needs them.

`memory/MEMORY.md` was updated to point at the new archive file so it isn't orphaned.

## Important caveat: dual-write is incomplete for this run

CLAUDE.md's dual-write protocol requires every memory change to land in both the auto-memory location and this workspace mirror. **This session only had the workspace mirror folder connected** — it has no access to the opaque auto-memory Library path. All five changes above are committed here (commit `d6136b5`) but have **not** been mirrored to auto-memory. A future Claude Code or Cowork session that has both locations available should reconcile them (or you can treat this workspace copy as the source of truth for these specific edits until then).

## Push status

Commit `d6136b5` was made locally but **could not be pushed to `origin/main`** — this Cowork sandbox has no git credentials configured, so `git push` failed with an authentication error. Per the project's origin-backup protocol, please push from a session that has credentials (your Mac / Claude Code) at your convenience:

```
git push origin HEAD
```

## Rollback

Every change here is a single git commit (`d6136b5`). To revert all of it: `git revert d6136b5`. To revert just one piece, the changes are logically separable in the diff (handoff moves, README rewrite, early-planning-v2 deletion, build-progress split, MEMORY.md index update) — let me know and I can prepare a partial revert.
