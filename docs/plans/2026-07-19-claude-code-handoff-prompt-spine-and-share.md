# Claude Code handoff prompt — Spine & Share: QA remediation + the Loose-Ends design

*Copy everything below the line into Claude Code at the start of the next
session in this repo. Supersedes `archive/2026-07-07-claude-code-handoff-prompt-post-slice7.md`.*

---

Pick up the Life Chronicle build. The active forward plan is the
**Spine & Share roadmap** (2026-07-17): Track A = a complete birth-to-now
residential spine in weeks, Track B = a shareable spine + Shareable
Collections. Andy is mid-QA on the consolidated master sequence and will
keep walking it; your session has TWO jobs, interleaved:

1. **QA-remediation support** — Andy reports findings as he tests; you
   root-cause and fix them properly (this has been the recent rhythm:
   every finding either a proven fix or a small built rider, same
   session).
2. **The next development unit** — the Loose-Ends surface design doc
   (roadmap §3), the engine of Track A. Design WITH Andy before any code.

## 1. Read in this order (before anything else)

- `CLAUDE.md` — standing protocols + architectural invariants (auto-loaded; don't relitigate).
- `memory/MEMORY.md` — the decision index; "Current state (read first)".
- `memory/project_lc_build_progress.md` — the TOP "Session handoff — 2026-07-18" block is current: Spine & Share direction, the 07-18/19 rider builds, two live bug fixes with their class-of-bug rules, Andy's QA position.
- `docs/plans/2026-07-17-spine-and-share-roadmap.md` — the canonical roadmap. §2 lists the built riders; §3 is your design unit; §4 is the later Collections design (with the Gemini-sourced design inputs); §5 holds everything parked.
- `docs/qa/2026-07-17-master-qa-sequence.md` — the single prioritized QA walk (Phase 1 in progress; the 07-18/19 rider checklists are folded into Phase 1).
- `memory/project_lc_direction_2026-07-17.md` — the strategic why (undaunting-by-requirement, shareable collections).
- `documentation/knowledge-base/README.md` — the user-facing support KB (seeded 2026-07-19). **Standing rule: any change to a captured flow updates the affected KB article in the same commit.**

## 2. What shipped 2026-07-18/19 (all pushed; know these before touching the globe)

- **Globe pin search** — FindLocationBox rebuilt headless on SearchBoxCore; "Your pins" (all types, `lib/globe/pin-search.ts`) above Mapbox places; pin pick = `framePinOnMap` (shared with the ?pin= deep link); coordinate-paste + suggest-crash-guard preserved.
- **Basemap regime** — nocturne ↔ `outdoors-v12` at reading zoom (`lib/globe/style-regime.ts`, in ≥13.2 / out ≤12.6). **`setStyle` wipes all sources/layers/images** — chronicle layers install idempotently on every `style.load`, seeded from `lineDataRef` + `activeArcRef`. `.globe-daylight` on the container is the light-basemap CSS tuning hook (first uses: the unplaced/trip-draft dashed rings).
- **Decide-later bug fix** — handleSave dropped `unsequenced` from the create POST; assembly now lives in `lib/globe/create-pin-payload.ts` behind a `satisfies Record<keyof PinDraftData, unknown>` exhaustiveness guard. **Class-of-bug: never re-enumerate payload fields inline at a boundary.**
- **Anchor picker fix** — `lib/globe/anchor-options.ts`: non-Log markers anchor to HOMES (primaries sequenced-first, unsequenced "· not yet placed", second residences, short stays); Log anchors to any pin. **Principle: home-ness is the TYPE, not the spine slot.**
- **Trips additions** — "Start a trip from here" on home pins (armed origin, `lib/globe/trip-origin.ts` precedence: existing > armed > anchor > Home Base; armed also defaults the modal's anchor); one-way trips (framing panel exposes `return_to_origin`); trip jots on the globe trip strip (same hopper the Travel Journal card mounts).
- **Knowledge base** — `documentation/knowledge-base/` (5 articles). Assistant lookup-tool integration is pending, recorded in roadmap §5.

## 3. QA-remediation mode (how to support Andy)

- Open checklists, all in `docs/qa/`: master sequence Phase 1 = unsequenced-residences (9/13 done), slice3-closeout re-tests, UI-checklist remnants, plus the rider checklists (2026-07-18 pin-search, 2026-07-18 basemap-regime, 2026-07-19 trip-from-here incl. one-way + trip jots). Then Phases 2–5.
- On any finding: **systematic debugging — root cause before fix** (the decide-later bug lived in the one unproven hop; trace the whole chain). Failing proof first, then fix, then the class-of-bug rule into the build-progress block if it generalizes.
- **The pin-facts editor is agreed but STILL UNBUILT** (`docs/plans/2026-07-10-pin-facts-editor-enhancement.md`, agreed 2026-07-10, ~an hour with proof). It has now missed several globe sessions it was supposed to ride — build it early rather than letting it slip again.
- Rider pattern (established): a QA-born enhancement Andy approves gets built same-session with a proof for any pure logic + a QA checklist section, recorded in the master sequence Phase 1 and the roadmap §2 rider list.

## 4. The development unit: Loose-Ends surface design doc (roadmap §3)

Design-first, Journey-doc pattern (`archive/2026-07-05-journey-view-design.md` is the shape). Get Andy's agreement on the design before code. The doc must cover:

- The Dashboard reincarnation gathering: user-asserted spine gaps (NEVER date-computed — invariant #5), unsequenced residences, draft trips, open jots across hosts, review-queue proposals, Future Places (lightest touch).
- **Tone as acceptance criteria**: progressive disclosure (a handful of invitations, never the full ledger), years-long framing, celebrate-what-exists, every item one tap from its capture flow. Andy's words: "extensive and, at the same time, undaunting."
- Step 8's orchestrated strand (assistant nudging off `chronicle/threshold.reached`) — passive face + active face, one design. The KB lookup tool (assistant support face) belongs in this design conversation too.
- Session-end capture triage (Gemini §2C input, roadmap §3) — prevention beats display.

## 5. Load-bearing operational knowledge

- **Dual-write memory protocol**: every memory change → workspace `memory/` AND auto-memory. Current auto-memory path (verify it's this session's, else `find ~/Library/Application\ Support/Claude/local-agent-mode-sessions -maxdepth 6 -type d -name memory`): `~/Library/Application Support/Claude/local-agent-mode-sessions/99941bd0-*/edd2b163-*/spaces/21262e82-*/memory`. In sync as of 2026-07-19.
- **Auto-push hook** backs up every commit to origin/main, but occasionally lags — after committing check `git status -sb` for "[ahead N]" and push manually.
- Dev stack: `./scripts/dev-up.sh` (Next 3001 + Inngest 8288); **never `npm run build` while dev runs**. Gates on every commit: `npx tsc --noEmit` + `npx next lint --dir app --dir components --dir lib`. Proof scripts: self-cleaning `scripts/verify-*.mjs` (tsx-runner pattern for pure lib logic); migrations via `node scripts/db-apply.mjs` with the safety checkpoint for anything touching existing data.
- Standing class-of-bug guards (do not weaken): role='location' is the pin-overview discriminator (mention-links use 'mentioned'); words-are-not-actions (tool results required); merge_entities preserves substance both directions; `entities.metadata` is MERGE-only; UI flows needing visible outcomes get deterministic links at their own gate; plus the two new 07-18 rules in §2.
- `WHAT-CHANGED.md` (untracked, repo root) is Andy's — leave it; its item 3 (`.claude/settings.local.json`) still awaits his call.

## 6. Session shape

1. Orient (§1 reads) + a two-paragraph current-state summary back to Andy.
2. Ask where he is in the QA walk; fold in anything found since 2026-07-19.
3. Propose the session split (remediation vs. Loose-Ends design) and get his go.
4. Build the pin-facts editor early if he agrees — it's overdue.
5. Loose-Ends design doc → his review → only then code.
