> **Archived 2026-07-17.** Superseded by `2026-07-07-claude-code-handoff-prompt-post-slice7.md` (per that file's own header) and now further superseded by the 2026-07-15 Trips & Travel Journal ship; kept for history only, not to be used to start a new session. See `memory/MEMORY.md` for current state.

# Claude Code handoff prompt — resume at Slice 7 (Person page + Life's Cast + Hopper 5b)

*Copy everything below the line into Claude Code at the start of a session in this repo. Supersedes `docs/plans/2026-07-04-claude-code-handoff-prompt.md`.*

---

Pick up the Life Chronicle build. The Journey surface (J1–J5) and everything
before it is SHIPPED; the next build unit is **Slice 7 — the Person page +
Life's Cast + Hopper 5b** per the revised roadmap. Get accurately oriented,
check what Andy's QA surfaced since 2026-07-07, and get agreement before
coding.

## 1. Familiarize yourself first (read in this order)

- `CLAUDE.md` — standing protocols + architectural invariants (auto-loaded; don't relitigate).
- `memory/MEMORY.md` — the decision index; "Current state (read first)".
- `memory/project_lc_build_progress.md` — START with the top "Session handoff — 2026-07-05" block and read DOWN through the 07-06/07 entries (Journey J1–J5, Hopper 5a, stub resolution, owner-edit, and three incident+guard records). Canonical build state.
- `docs/plans/2026-06-22-globe-and-entity-ux-revised-roadmap.md` — the slice roadmap. **Slice 7 section** is the next build's product spec (M2 `memory_stubs` already applied by Hopper 5a; M3 = `entities.metadata.in_lifes_cast`, no DDL).
- `docs/plans/2026-07-05-journey-view-design.md` — the Journey design (BUILT; pattern reference for how slices get specced here).
- `docs/plans/2026-06-14-context-layer-and-recollection-surfaces-design.md` — the Entity-View substrate Slice 7 rides on (built as Slice 6).

## 2. Session context from 2026-07-06/07 (already in the docs, but load-bearing)

- **Dual-write auto-memory path** (the project CLAUDE.md protocol): this
  session's auto-memory folder is
  `~/Library/Application Support/Claude/local-agent-mode-sessions/99941bd0-7c42-497a-a200-4ffa0a812688/edd2b163-0c68-47f9-83f8-3094545aaf1d/spaces/21262e82-8b84-41ca-b3c6-cc17cb673f39/memory/`.
  A NEW session may get a different space — locate it (`find ~/Library/Application\ Support/Claude/local-agent-mode-sessions -maxdepth 6 -type d -name memory`), diff against the workspace mirror before first write, and heal drift (it has drifted twice; workspace was newer both times).
- **The auto-push hook sometimes lags a commit** — after committing, verify `git status -sb` shows no "[ahead N]" and `git push origin HEAD` manually if it does.
- **Three fresh class-of-bug rules** (full records in build_progress):
  1. `role='location'` + `capture_mode='globe_onboarding'` is the pin-overview discriminator — mention-links must use `'mentioned'` (`defaultRoleForType`), never location.
  2. "Words are not actions": the orchestrator once narrated a save with zero tool calls; prompt directive + a capture-panel "no action was taken" notice guard it — keep both intact.
  3. `merge_entities` preserves entity substance (geom etc.) in either direction — don't regress it when touching the function.
- **Both former background tasks are BUILT** (2026-07-07, end of session): pin adoption at placement time ("this looks like your existing X — pin it?", migration `20260707120000`, proof 12/12) and Entity-View alias editing. Andy's QA for both: `docs/qa/2026-07-07-pin-adoption-and-aliases-qa-checklist.md` (removing the junk "Leo" alias is deliberately his rep).
- Verify scripts run against the LIVE shared DB: relative-only assertions on own fixtures, self-cleaning finally blocks (see any recent `scripts/verify-*.mjs`). Migrations apply via `node scripts/db-apply.mjs <filename>`; the safety gate stops for anything altering existing data.
- Dev stack: `./scripts/dev-up.sh` (Next 3001 + Inngest 8288, detached); never `npm run build` while dev is live.

## 3. Andy's outstanding QA queue (confirm what he's done before proposing)

- Journey walkthrough §§1–7 (`docs/qa/2026-07-06-journey-j1-qa-checklist.md`)
- ~57 "New mention" stub proposals on /review + the recovered Harry Leonard research card ("Tell me more" → Attach as context…)
- The Phillips Exeter twin merge in /entities (direction now safe either way)
- Slice 6 walkthrough (`docs/qa/2026-06-24-slice6-entity-view-context-qa-checklist.md`) — was deferred until 6.5b
- Hopper 5a (`docs/qa/2026-07-05-hopper-5a-qa-checklist.md`) — Andy said he'd comment on "Jot"
- Stub resolution (`docs/qa/2026-07-06-stub-resolution-qa-checklist.md`)
- Owner-edit §§4–5 remain unchecked (`docs/qa/2026-07-06-memories-owner-edit-qa-checklist.md`)

## 4. What to produce (before any code)

1. A short current-state summary, claims cited to doc lines; call out anything Andy's QA changed since 2026-07-07.
2. A Slice 7 build proposal: phases + acceptance criteria drawn from the roadmap's Slice 7 section (mentions aggregator that links OUT; person-anchored recollections without a pin; open/private commentary via `entity_context_notes`; deliberate promote-to-Life's-Cast via `entities.metadata.in_lifes_cast`; content-only filter; Hopper 5b = the capture-assistant loop consuming `memory_stubs` + the person host for the existing `PinHopper` machinery — note it's nocturne-styled and needs a light-theme variant for the person page).
3. Agreement from Andy before coding.

## 5. Protocols to honor

- Dual-write every memory change (auto-memory + `memory/` mirror) and update `MEMORY.md`.
- Architectural invariants (Raw Vault; residence spine; Postgres+pgvector; Access Cards; when_text never parsed — Temporal Agent) are settled.
- Migration Safety Checkpoint: additive applies freely; anything altering existing data STOPS for Andy.
- Commit autonomy per global CLAUDE.md; `origin/main` is a continuous backup (hook + manual fallback above).
- tsc + `npx next lint` gate every commit; proofs for anything with logic.
