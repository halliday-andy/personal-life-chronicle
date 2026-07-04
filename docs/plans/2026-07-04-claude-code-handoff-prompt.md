# Claude Code handoff prompt — resume Step 7 (get current, propose next)

*Copy everything below the line into Claude Code at the start of a session in this repo.*

---

Pick up the Life Chronicle build. Before proposing or writing anything, get **accurately oriented** on where Step 7 actually stands, then propose the next step. The prior handoff (`docs/plans/2026-06-22-claude-code-handoff-prompt.md`) kicked off the globe & entity UX enhancements; slices have progressed since. Reconcile the docs, tell me where we are, and get agreement before coding.

## 1. Familiarize yourself first (read in this order)

- `CLAUDE.md` — standing protocols + architectural invariants (auto-loaded; re-read the invariants, don't relitigate them).
- `memory/MEMORY.md` — the decision index; its "Current state (read first)" section links everything below.
- `memory/project_lc_build_progress.md` — START with the top "Session handoff" block; canonical build state (Steps 1–6 done; Step 7 Slices 1/2/4a/4b shipped as of its 2026-06-17 refresh).
- `memory/decision_step7_slice_phasing_2026-06-05.md` — the Step 7 slice plan (Slice 3 = place types was "next" at that time).
- `docs/plans/2026-06-22-globe-and-entity-ux-revised-roadmap.md` — the current resequenced roadmap (context: `memory/project_lc_globe_entity_ux_brief.md`).
- `docs/qa/2026-06-24-globe-slice3-closeout-qa-checklist.md` and `docs/qa/2026-06-24-slice6-entity-view-context-qa-checklist.md` — the newest QA state. These are NEWER than the 2026-06-17 build_progress refresh, so where they disagree, trust the 06-24 QA docs and reconcile.

## 2. Context from the 2026-07-04 session (not yet in the docs above)

- `scripts/verify-globe-slice4b.mjs` was corrupting the live shared DB's residence spine (asserted empty-DB invariants; inserted test pins at position 0/1, shifting real pins). Now data-safe: relative-only assertions against its own TESTPIN fixtures + a finally block that restores the real spine. General lesson: verify scripts run against the LIVE shared DB — assert only relative properties among the script's own fixtures, never absolute counts/order. See `memory/feedback_lc_silent_backup_and_sandbox.md`.
- The origin auto-push backup hook was silently swallowing push failures; hardened with an observable Stop hook. This project now runs in LOCAL execution, so commits auto-push with the owner's own credentials.

## 3. What to produce (before any code)

1. A short summary of where Step 7 actually stands now — each claim cited to the doc line that supports it.
2. A single prioritized next step, with acceptance criteria.
3. Any discrepancies between the 06-24 QA docs and the 06-17 build_progress refresh, called out explicitly.

## 4. Protocols to honor

- Dual-write every memory change (auto-memory + `memory/` mirror) and update `MEMORY.md`.
- Don't relitigate architectural invariants (Raw Vault append-only; residence spine as temporal scaffold; Postgres+pgvector; Access Cards privacy) unless Andy opens them.
- Lowercase file/folder names; never `npm run build` while `next dev` is live; `origin/main` is a continuous backup (auto-push + the new observable Stop hook are wired).
- Migration Safety Checkpoint: additive/reversible migrations may be applied; anything that alters/drops existing data STOPS for Andy's approval.

## 5. Housekeeping

- `docs/qa/2026-06-15-ui-qa-checklist.md` has an uncommitted local edit — flag it, don't touch it.
