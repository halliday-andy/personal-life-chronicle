> **ARCHIVED 2026-07-17** — Superseded by `../2026-07-17-spine-and-share-roadmap.md` — this handoff predates the 2026-07-15 Trips & Travel build entirely.

# Claude Code handoff prompt — resume after Slice 7 (roadmap exhausted; pick the next build unit)

*Copy everything below the line into Claude Code at the start of a session in this repo. Supersedes `docs/plans/2026-07-07-claude-code-handoff-prompt.md` (whose task — Slice 7 — is now BUILT).*

---

Pick up the Life Chronicle build. **Slice 7 (Person page + Life's Cast +
Hopper 5b) is SHIPPED as of 2026-07-07** — with it, the 2026-06-22 revised
roadmap's slice list is EXHAUSTED. There is no pre-agreed next build unit:
your job is to get accurately oriented, fold in whatever Andy's QA has
surfaced since 2026-07-07, propose the next unit from the options in §4,
and get Andy's agreement before coding.

## 1. Familiarize yourself first (read in this order)

- `CLAUDE.md` — standing protocols + architectural invariants (auto-loaded; don't relitigate).
- `memory/MEMORY.md` — the decision index; "Current state (read first)".
- `memory/project_lc_build_progress.md` — START at the top "Session handoff — 2026-07-05" block and read DOWN through the 07-06/07 entries. The **"SLICE 7 BUILT 2026-07-07"** bullet near the end of that block is the latest state: all four phases, commit hashes, proofs, and Andy's live QA delta. Canonical build state.
- `memory/reference_lc_dev_sequence.md` — the 15-step master plan table, refreshed 2026-07-07: Steps 1–7 ✅; Step 8 partially absorbed by Slices 6+7; Step 11 partially delivered by 7.2; Steps 9, 12, 13, 14, 15 pending. Full step definitions in `documentation/LC_Development_Sequence.md`.
- `docs/plans/2026-06-22-globe-and-entity-ux-revised-roadmap.md` — the completed roadmap (context for what just shipped + the parked items in its §4).
- `docs/qa/2026-07-07-slice7-person-page-qa-checklist.md` — what Andy is QA-ing right now.

## 2. What Slice 7 delivered (2026-07-07, six commits `77ada81`…`134386f`, all pushed)

- **7.1** — `/memories#<memory_id>` row anchor (scroll + amber flash); Entity-View mention rows link OUT (pin-anchored → `/journey?pin=` via `lib/entity/mention-pins.ts`; else the /memories anchor); `PinHopper` light theme + person-page host.
- **7.2** — Life's Cast: `entities.metadata.in_lifes_cast` via pure `applyLifesCast` merge (`lib/entity/lifes-cast.ts` — MERGES, never clobbers `is_self` etc.); ☆/★ toggle on person pages; /entities ★ badge + Cast-first + "with content only" filter (`lib/entity/content.ts`; default OFF deliberately).
- **7.3** — person-anchored recollections: `lib/memory/person-recollection.ts` + `POST /api/entity/[id]/recollection` (verbatim, saves FINAL, `role='participant'`, no-orphan guarantee); "Add recollection" on person pages. Capture-order listing — event chronology stays the Temporal Agent's.
- **7.4** — Hopper 5b: orchestrator tools `list_memory_stubs` / `add_memory_stub` (only on explicit user yes; never mints entities) / `consume_memory_stub` (requires a REAL memory_id); prompt section "The Hopper" (SYSTEM_PROMPT_VERSION `2026-07-07.0`); migration `20260707130000` = `memory_stubs.consumed_by_memory_id` lineage (additive, APPLIED).
- Proofs all green: `verify-entity-mention-links` 4/4, `verify-lifes-cast` 9/9, `verify-person-recollection` 9/9, `verify-hopper-consume-tools` 8/8, `verify-orchestrator-hopper-loop` 6/6 (a REAL orchestrator run: list → create → classify/extract → consume in one run).

## 3. Session context (load-bearing operational knowledge)

- **Dual-write memory protocol** (project CLAUDE.md): locate the NEW session's auto-memory folder (`find ~/Library/Application\ Support/Claude/local-agent-mode-sessions -maxdepth 6 -type d -name memory`), diff against the workspace `memory/` mirror before first write, heal real drift. **Known benign diff:** `reference_lc_designer_skills.md` differs by two harness-injected frontmatter lines (`node_type`, `originSessionId`) — bodies identical; do NOT "heal" it.
- **Auto-push hook sometimes lags a commit** — after committing, check `git status -sb` for "[ahead N]" and `git push origin HEAD` if needed.
- **Class-of-bug rules (keep the guards intact):**
  1. `role='location'` + `capture_mode='globe_onboarding'` is the pin-overview discriminator — mention-links must use `'mentioned'`/`'participant'` (`defaultRoleForType`), never location.
  2. "Words are not actions": prompt directive + capture-panel "no action was taken" notice + `consume_memory_stub` requiring a real memory_id — all deliberate; don't weaken.
  3. `merge_entities` preserves entity substance (geom etc.) in either direction.
  4. `entities.metadata` is load-bearing (`is_self`, anchor stash, extraction bookkeeping) — always MERGE via `applyLifesCast`-style helpers, never whole-object overwrite.
- Verify scripts run against the LIVE shared DB: relative-only assertions on own fixtures, self-cleaning finally blocks (pattern: any recent `scripts/verify-*.mjs`; the tsx-runner variant imports real lib TS). Migrations apply via `node scripts/db-apply.mjs <filename>`; the Migration Safety Checkpoint stops for anything altering existing data.
- Dev stack: `./scripts/dev-up.sh` (Next 3001 + Inngest 8288, detached); never `npm run build` while dev is live. Gates on every commit: `npx tsc --noEmit` + `npx next lint --dir app --dir components --dir lib`.

## 4. The remainder of the project (what "done" still needs)

**First: Andy's QA queue** (confirm what he's done before proposing anything — check the checklists for `[x]` and the DB where relevant):

- Slice 7 walkthrough (`docs/qa/2026-07-07-slice7-person-page-qa-checklist.md`) — findings here shape the next unit.
- Pin adoption + aliases (`docs/qa/2026-07-07-pin-adoption-and-aliases-qa-checklist.md`) — as of 2026-07-07 the junk "Leo" alias on Leola Lapides was still present (his rep).
- Journey J1 (`docs/qa/2026-07-06-journey-j1-qa-checklist.md`, 0/34), Slice 6 (`docs/qa/2026-06-24-slice6-entity-view-context-qa-checklist.md`, 4/40), Hopper 5a (`docs/qa/2026-07-05-hopper-5a-qa-checklist.md` — Andy said he'd comment on "Jot"), stub resolution (`docs/qa/2026-07-06-stub-resolution-qa-checklist.md`).
- Data chores: Phillips Exeter twin merge in /entities (safe either direction now); ~5 remaining "New mention" stub proposals on /review (52/57 confirmed as of 2026-07-07).

**Then: candidate next build units** (present these to Andy with a recommendation; do NOT pick unilaterally):

1. **QA remediation pass** — whatever the walkthroughs surface. Historically each QA round has produced a day of real fixes; if Andy has been QA-ing, this likely comes first.
2. **/memories full-text search** — the deferred Slice-6 half (the row-anchor half shipped in 7.1). Small, self-contained, completes the "searchable, editable recollection home" promise from the 2026-06-14 design.
3. **Step 11 completion — Life's Players synthesis + rendering** — 7.2 shipped the promotion flag + list grouping; the synthesis artifact (a rendered Cast surface / relationship portraits seed) remains. Natural continuation of the person-page arc; needs a design doc first (pattern: `docs/plans/2026-07-05-journey-view-design.md`).
4. **Step 9 — topic strand spec** (and the un-absorbed part of Step 8: the capture assistant proactively prompting entity/topic work off chronicle state via `chronicle/threshold.reached`). This is the last unspecced Phase-0 strand — product-shaping work WITH Andy, not just build.
5. **Step 13 — Access Cards UI + `viewer_can_access()` + RLS activation** — the big security milestone; unblocks Step 12 (Single Post Share, spec exists: `memory/project_lc_single_post_share.md`). Remember: RLS must NOT be activated until the full function body lands.
6. **Step 14 — Search Agent + semantic search** (privacy filter BEFORE pgvector similarity — invariant).
7. Parked smalls: pin-visual redesign (roadmap §4 "Deferred"), Vertical Moments (parked until Andy supplies examples), Temporal Agent + The Stroll (specs exist; no step number — post-Phase-0 features).

## 5. What to produce (before any code)

1. A short current-state summary, claims cited to doc lines; call out anything Andy's QA changed since 2026-07-07 (checklist check-offs, resolved proposals, the Exeter merge, the Leo alias).
2. A next-unit proposal: your recommended pick from §4 with a phase breakdown + acceptance criteria (and for units 3/4, a design doc first — Journey doc is the pattern).
3. Agreement from Andy before coding.

## 6. Protocols to honor

- Dual-write every memory change (auto-memory + `memory/` mirror) and update `MEMORY.md`.
- Architectural invariants (Raw Vault; residence spine; Postgres+pgvector; Access Cards; when_text never parsed — Temporal Agent) are settled.
- Migration Safety Checkpoint: additive applies freely; anything altering existing data STOPS for Andy.
- Commit autonomy per global CLAUDE.md; `origin/main` is a continuous backup (hook + manual fallback above).
- tsc + `npx next lint` gate every commit; proofs for anything with logic.
