# Claude Code handoff prompt — pin-card fixes, photo ordering, pin-facts UI next

*Copy everything below the line into Claude Code (Sonnet 5) at the start of
the next session in this repo. Supersedes
`2026-07-19-claude-code-handoff-prompt-spine-and-share.md`.*

---

Pick up the Life Chronicle build. The active forward plan is still the
**Spine & Share roadmap** (2026-07-17): Track A = a complete birth-to-now
residential spine in weeks, Track B = a shareable spine + Shareable
Collections. Andy resumes his QA walk **tomorrow at the 2026-07-19
"start a trip from here" checklist**. Your session has TWO jobs, interleaved:

1. **QA-remediation support** — Andy reports findings as he tests; you
   root-cause and fix them properly (established rhythm: every finding
   either a proven fix or a small built rider, same session).
2. **The next development unit** — finish the **pin-facts editor UI**
   (small; its data layer is already built and proven), then the
   **Loose-Ends surface design doc** (roadmap §3). Design WITH Andy before
   any code.

## 1. Read in this order (before anything else)

- `CLAUDE.md` — standing protocols + architectural invariants (auto-loaded; don't relitigate).
- `memory/MEMORY.md` — the decision index; "Current state (read first)".
- `memory/project_lc_build_progress.md` — the TOP "Session handoff — 2026-07-20" block is current: five units shipped (two QA-finding fixes, two features from Andy's design input, one data-layer build), each with its class-of-bug rule, and the exact QA resume point.
- `docs/plans/2026-07-17-spine-and-share-roadmap.md` — the canonical roadmap. §2 lists the built riders; §3 is the Loose-Ends design unit; §4 is the later Collections design; §5 holds everything parked.
- `docs/qa/2026-07-17-master-qa-sequence.md` — the single prioritized QA walk (Phase 1 well advanced; see §3 below for exact state).
- `memory/project_lc_direction_2026-07-17.md` — the strategic why (undaunting-by-requirement, shareable collections).
- `documentation/knowledge-base/README.md` — the user-facing support KB. **Standing rule: any change to a captured flow updates the affected KB article in the same commit.**

## 2. What shipped 2026-07-20 (all pushed; know these before touching pin cards or photos)

- **Context-card fix** (`74ea542`, `6bca349`) — the pin detail card's "N context" chip led with "＋ add context" over the actual note rendered as dim, dead-looking text; `deriveContextTitle` also leaked raw `##` when a heading had no space after the hashes (`##Foo`). Fixed: notes now lead (Andy's call: navigate-with-strong-affordance, trailing ↗), and the title fallback strips a leading ATX-hash run. **Class-of-bug: a derived plain-text label must never carry through block markdown (leading hashes), spacing regardless.**
- **Pin-card reconciliation** (design `docs/plans/2026-07-20-pin-card-reconciliation-design.md`; `af19c86`/`77fc099`/`324fb20`) — the detail card and edit panel each rendered the pin's connected collections independently and had drifted (the bigger edit panel showed LESS — no context, no related pins). Extracted `components/globe/PinConnections.tsx`, mounted by BOTH; the edit panel is now the pin's workbench. "N anchored" chip → **"N related pin(s)"**; "＋ Add New Context ↗" deep-links to `/entities/[id]?addContext=1`, which auto-opens the composer. **Class-of-bug: two surfaces rendering the same data drift — extract a shared component, don't copy the markup.** tsc+lint green; **VISUAL STILL PENDING Andy's eyeball** (Claude is auth-blocked from the running app) — QA `docs/qa/2026-07-20-pin-card-reconciliation-qa-checklist.md`.
- **Sticky pin-facts DATA LAYER** (`3679df6`; foundation for `docs/plans/2026-07-10-pin-facts-editor-enhancement.md`) — `runGlobeExtraction` used to overwrite every fact on each re-run, clobbering owner corrections. New pure `lib/globe/sticky-facts.ts` (`verify-sticky-facts.mjs` 16/16): owner-edited fields (provenance in `relationships.metadata.facts_owner_edited`) survive re-extraction. **Class-of-bug: an owner-editable field an agent also writes needs per-field provenance so the agent can't clobber the owner.** `applyOwnerFactEdit` write helper is built + proven, ready for the UI.
- **Pin photo ordering / carousel foundation** (`b325ec7`/`6a4c2ad`/`7609ecb`; design `docs/plans/2026-07-20-pin-photo-ordering-design.md`) — the gallery had no stored order (sorted `created_at` DESC), so new photos jumped to the front and sequential adds reversed. Added `entity_media.sort_order` (additive, no backfill — Andy's call); pure `lib/globe/pin-image-order.ts` (`verify-pin-image-order.mjs` 8/8); new photos append at the end; promoting a photo to primary drops the **former primary to the end** of the carousel (primary = cover, decoupled from sequence); drag-to-reorder in the edit-panel gallery. Deferred: keyboard reorder (drag is pointer-only), the carousel/slideshow presentation itself. **Andy CAN QA this one live** — QA `docs/qa/2026-07-20-photo-ordering-qa-checklist.md`.
- **Legend swatch fix** (`93be8de`, confirmed fixed by Andy) — Second residence & Vacation legend icons rendered as tiny black rectangles: the swatch applied the per-type CSS modifier class without the base `globe-pin` class the on-globe markers always include; those two modifiers have no size/background of their own. **Class-of-bug: a modifier-only CSS class applied without its base collapses to its box-shadow.**

## 3. QA-remediation mode (how to support Andy)

- **Andy resumes tomorrow at the 07-19 "start a trip from here" checklist** (`docs/qa/2026-07-19-trip-from-here-qa-checklist.md`) — ask him to confirm before assuming.
- Master-sequence Phase 1 state: **checked off** — unsequenced residences, Slice 3 close-out re-tests, UI-checklist spine remnants, globe pin search, basemap regime, legend swatch (fixed+confirmed, fold the checkbox in if it isn't already). **Still open in Phase 1** — "start a trip from here" (next up), the context-card checklist (`2026-07-20-context-card-qa-checklist.md`), the pin-card-reconciliation checklist (needs Andy's live eyeball), the photo-ordering checklist (Andy can test live), plus the small data chores (Phillips Exeter merge, Leola alias, ~5 stub proposals). Then Phases 2–5.
- On any finding: **systematic debugging — root cause before fix.** This session's pattern held throughout: failing proof first for anything with pure logic (`verify-*.mjs`, tsx-runner style, self-cleaning), then the minimal fix, then a class-of-bug rule into the build-progress block if it generalizes (see §2 above for the four added this session).
- Rider pattern (established): a QA-born enhancement Andy approves gets built same-session with a proof for any pure logic + a QA checklist section, recorded in the master sequence and the roadmap §2 rider list.

## 4. The development unit: finish pin-facts UI, then Loose-Ends design

**First, the small piece:** the pin-facts editor's UI layer. The data layer (`lib/globe/sticky-facts.ts`, proven) and Andy's defaults are already settled — **do not re-ask these**:
- All four facts are editable: `residence_type`, `residence_detail`, `household_composition`, `move_reason`.
- A user-triggered "refresh facts from the recollection" button on the workbench (respecting sticky fields), plus the already-queued "offer re-extraction after a finalized text edit" as a fast follow.
Wire the four fields + refresh button into `PinEditPanel` (the workbench established this session) using `applyOwnerFactEdit`. Small — should not need a new design conversation.

**Then, design-first** (Journey-doc pattern, `archive/2026-07-05-journey-view-design.md` is the shape): the **Loose-Ends surface design doc** (roadmap §3), unchanged from before — get Andy's agreement before any code. It must cover:

- The Dashboard reincarnation gathering: user-asserted spine gaps (NEVER date-computed — invariant #5), unsequenced residences, draft trips, open jots across hosts, review-queue proposals, Future Places (lightest touch).
- **Tone as acceptance criteria**: progressive disclosure (a handful of invitations, never the full ledger), years-long framing, celebrate-what-exists, every item one tap from its capture flow. Andy's words: "extensive and, at the same time, undaunting."
- Step 8's orchestrated strand (assistant nudging off `chronicle/threshold.reached`) — passive face + active face, one design. The KB lookup tool (assistant support face) belongs in this design conversation too.
- Session-end capture triage (Gemini §2C input, roadmap §3) — prevention beats display.

## 5. Load-bearing operational knowledge

- **Dual-write memory protocol**: every memory change → workspace `memory/` AND auto-memory. Current auto-memory path (verify it's this session's, else `find ~/Library/Application\ Support/Claude/local-agent-mode-sessions -maxdepth 6 -type d -name memory`): `~/Library/Application Support/Claude/local-agent-mode-sessions/99941bd0-*/edd2b163-*/spaces/21262e82-*/memory`. In sync as of 2026-07-20.
- **Auto-push hook** backs up every commit to origin/main, but occasionally lags — after committing check `git status -sb` for "[ahead N]" and push manually. `origin/main` is at `f77d3b3` as of this handoff.
- Dev stack: `./scripts/dev-up.sh` (Next 3001 + Inngest 8288); **never `npm run build` while dev runs**. Gates on every commit: `npx tsc --noEmit` + `npx next lint --dir app --dir components --dir lib`. Proof scripts: self-cleaning `scripts/verify-*.mjs` (tsx-runner pattern for pure lib logic); migrations via `node scripts/db-apply.mjs` — additive/reversible changes (like this session's two nullable-column migrations) don't need Andy's explicit gate, but always show the migration and verify it landed.
- **Claude is auth-blocked from the running app** (localhost:3001 sits behind sign-in; the in-app browser has no session). Visual verification of UI changes is Andy's to do live — say so explicitly rather than claiming a render is confirmed. Note which of this session's two UI units still need that eyeball (pin-card reconciliation) vs. which Andy can test himself right now (photo ordering).
- Standing class-of-bug guards (do not weaken): role='location' is the pin-overview discriminator (mention-links use 'mentioned'); words-are-not-actions (tool results required); merge_entities preserves substance both directions; `entities.metadata` is MERGE-only; UI flows needing visible outcomes get deterministic links at their own gate; the 07-18 rules (never re-enumerate payload fields inline at a boundary; home-ness is the type, not the spine slot); plus the four new 2026-07-20 rules in §2 above.
- `WHAT-CHANGED.md` (untracked, repo root) is Andy's — leave it; its item 3 (`.claude/settings.local.json`) still awaits his call.

## 6. Session shape

1. Orient (§1 reads) + a two-paragraph current-state summary back to Andy.
2. Confirm he's starting at the 07-19 trip-from-here checklist; ask if he's found anything since, or if the pin-card/photo-ordering visual confirms landed.
3. Offer to build the pin-facts UI first (it's small and unblocks nothing else) unless he'd rather stay in pure QA mode this session.
4. Loose-Ends design doc → his review → only then code.
