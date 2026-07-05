---
name: Project: LC build progress — May 2026 implementation phase
description: What's been built so far in the Claude Code implementation of Life Chronicle. Step-by-step state from Step 1 (scaffold) through Step 5 (interview API). Captures decisions made during build that aren't in the PRD.
type: project
---

## Session handoff — 2026-07-05 (reconciliation; Slice 6.5b in progress)

Supersedes the 2026-06-17 block below, which had gone nine days stale. The
06-22→06-26 interval is fully recorded in
`docs/plans/2026-06-22-globe-and-entity-ux-revised-roadmap.md`,
`docs/qa/2026-06-24-globe-slice3-closeout-qa-checklist.md`,
`docs/qa/2026-06-24-slice6-entity-view-context-qa-checklist.md`, and
[[project_lc_globe_entity_ux_brief]]; this block makes this file current again.

- **Slice 3 close-out BUILT 2026-06-23** (`12a3392`…`a9183ce`, 7 atomic commits):
  placard (reuses `entities.description`), at-rest when-chips + hover card,
  origin-pin treatment, "Refine location" detail-card action, re-type
  anchor stash/restore (`metadata.prior_anchor_residence_id`), chevron/tether
  contrast. Migrations `20260623120000` + `20260623130000` (additive).
- **Slice 3.5 BUILT 06-23 (`87ffe44`), REWORKED 06-24 (`cfa7202`)** after Andy's
  QA: the active-lines tray + per-pin toggle were REMOVED (OR-logic conflict);
  line visibility is now global-only — class filters + a zoom-gated
  "Side lines in view" toggle + transient hover preview.
- **Slice 3.6 "Log" pin BUILT 06-23** (`3219462`/`3650151`/`f19b39d`):
  `logged_at` type, `validate_pin_anchor` generalizes anchoring to any own
  globe pin, recollection roll-up ("Anchored here"). Andy proofed it live
  (globe QA §§9–11 ✓).
- **QA rounds 1–3 (06-24)** drove fixes: origin star rework (`f91f9b4`),
  one-chevron-per-leg (`1f4c8e9`), refine-drag guard (`c15b118`), editable
  pin name (`ac7c72a`), re-type inserts after the anchor home (`89c7266`),
  edit-panel markdown (`44fa2a9`).
- **Slice 6 (Entity View + context substrate) BUILT through Phase 6.6**
  (06-24→06-26): 6.1 `entity_context_notes` + merge repoint (`8dbbcd0`);
  6.2/6.3 Entity View `/entities/[id]` + add/remove context (`6ab7481`);
  6.4 entity chips + globe→Entity-View link (`474915e`, `04d8acd`;
  /memories full-text search deferred); 6.5a attach-research-as-context
  from /review (`9e56a58`); 6.6 note markdown, derived titles, in-place
  edit, pin-card count-chips (`90aed81`, `e356815`, `6f27c90`, `b452302`).
- **2026-07-04 session:** `verify-globe-slice4b.mjs` made live-DB-safe
  (`9ce8116`) after it had shifted the real spine; origin-backup hook made
  observable (`ab30e12`). See [[feedback_lc_silent_backup_and_sandbox]].
- **Andy's QA state:** globe checklist mostly ✓; re-tests outstanding
  (§4 chevron-on-line, §5 refine, §12 retype round-trip, §13 orphan,
  §14 naming/markdown). **Slice 6 walkthrough deliberately deferred by Andy
  until Slice 6 completes.** The 06-15 UI checklist pass is committed
  (`b2cd6fb`).
- **NOW BUILDING: Slice 6.5b** — orchestrator auto-proposal of context
  (classify a pasted research blob as context, propose the entity with
  Accept/Adjust/Decline + source pre-fill, so it never reaches the backlog).
  Completes Slice 6; Slice 7 (Person page + Life's Cast + Hopper) rides on
  it; Resume View next per the roadmap order.

## Session handoff — 2026-06-17 (QA remediation pass, superseded)

Worked from Andy's hands-on QA of the recent UI/features (`docs/qa/2026-06-15-ui-qa-checklist.md`). All shipped to `main`, **not pushed** (11 commits, `0f37c5a`…`7474a99`):

- **Item 1** active global-nav tab now underlined (`0f37c5a`).
- **Item 4** pin selection ring/glow take the pin's own type colour via `--pin-ring` (`2759b20`).
- **Item 5.6** detail-card photo double-click enlarges — hover overlay was eating the gesture; handler moved to wrapper (`446d01a`).
- **Item 5** pin edit panel is user-resizable (drag left edge, sticky localStorage width, square thumbnails) (`bc2cd21`).
- **Item 6** finalize now backfills entity extraction when a memory has zero `memory_entities` (`7ef6b96`); proof `verify-finalize-extraction-backfill.mjs`; manual repair `scripts/backfill-memory-extraction.mjs`. See [[project_lc_extraction_reliability]].
- **Item 7** recollections render as markdown (`components/Markdown.tsx`, `8e1d787`); orchestrator now stores pasted text verbatim (system prompt invariant 1, `SYSTEM_PROMPT_VERSION=2026-06-17.0`, `a6b39c5`).
- **Feature** previous/next navigation along the residential spine with fly-to (`a6dee92`); marker-children inclusion deferred as **OQ-G15** in `feature_residential_globe_onboarding.md`.
- **Decisions:** item 2 (Memories chronological sort) deferred to the Temporal Agent; item 3 satisfied **render-only** (markdown = the "view as viewer" preview, no stored formatting edits).
- One-off: hand-linked Andy's "Wallace" context memory to its castle pin (extraction can't auto-associate third-person research — that's the context layer's job).
- New learning memory: [[feedback_lc_no_build_during_dev]] (never `npm run build` while `next dev` is live — it 500s every route).

**Continued QA (2026-06-17 PM, unpushed — `8c910e2`):**
- **place↔organization merge bug.** Andy added a recollection to his Loring AFB pin to test extraction; it extracted "Loring Air Force Base"/"Mather AFB" as `organization`, resolution correctly proposed merging them into his existing `place` pins, but the merge failed: *"cannot merge entities of different types."* Root cause: resolution's `candidateTypes()` blurs place/org (by design) but `merge_entities()` rejected all cross-type merges. Fixed (migration `20260617130000`): place/org now merge, place always survives (owns globe identity). Proof `verify-entity-merge-place-org.mjs`; reciprocal keep-in-sync comments added. The two real stuck proposals (Loring, Mather) are now actionable — Andy clicks "Same — link them".
- **Cause fix — physical locations type as `place` (`38017d8`).** Andy then questioned the deeper logic: the extraction prompt was typing bases/schools as `organization`; for a memoir product a thing the user *was at* is a place. New rule "physical location wins"; `organization` reserved for membership/employment institutions (an employer, a military command/unit). Proof `verify-entity-typing.mjs` (LLM eval). Merge tolerance kept as defense-in-depth. See [[project_lc_extraction_reliability]].
- **Draft editor too small (`ba9d59d`).** Draft Edit box sized by newline count, so a one-paragraph recollection collapsed to 3 rows. Now auto-grows to content (floor 8rem, cap 60vh) + `resize-y`. Reuses CaptureAssistant's composer auto-resize idiom.
- **"Lost work" scare — stale Capture panel (`d9c869c`).** Andy edited + accepted a recollection and merged its duplicate entities, then saw the merge prompts and a pending card again and feared the work was gone. **Data was intact throughout** (DB verified: full edited `content_raw`, both merges `resolution='merged'`, recollection linked to the Loring/Mather place pins). Root cause: `CaptureAssistant` suppressed itself with `return null` when the globe pin editor opens (`GlobeView` sets `assistantSuppressed`), unmounting every `ProposalCard`; cards hold resolution/accepted state in local `useState(initial…)`, so suppress→restore remounted them from stale capture-time props. Fix: hide with `display:none` (`hidden`/`contents` wrapper) instead of unmounting, so children keep state; ⌘K guarded while suppressed. **General gotcha worth remembering: don't hide stateful UI by returning null — that unmounts and resets local state; use `display:none` when the state must survive.** No component-test harness exists (lint/tsc only) — verified by reasoning + tsc + eslint, then **confirmed in-browser** (Claude-in-Chrome): edited a draft card to add a marker, entered globe pin edit mode (suppresses), exited, reopened Capture — the edit persisted (under the old code the card remounted and lost it). *Residual:* a full page reload still empties the in-memory thread (acceptable — DB is the source of truth; panel just starts empty). Standing up React Testing Library would let this class of bug be guarded — deferred.
- **Globe location search crashed on coordinate entry (`7f8c5b2`).** Pasting a "lat, lng" pair (e.g. from Google Maps) into the globe Find Location box threw an unhandled `MapboxError: Query exceeded character limit of 200` and crashed the page — the box (Mapbox `SearchBox`) force-fed coordinate text to *forward* geocoding. Fix: enable the SearchBox's built-in `componentOptions.allowReverse` (reverse-geocode a coordinate pair → place) + `flipCoordinates` (read pairs as lat,lng, Google's order) + `onSuggestError` to degrade gracefully. Confirmed in-browser: "35.716298, 139.440700" → Tachikawa, Tokyo and "48.858370, 2.294481" → Eiffel Tower; text search still works; no crash/console errors. `components/globe/FindLocationBox.tsx`.

**Open / next:**
- **Context-layer build is still #3 NEXT** (see below + `docs/plans/2026-06-14-context-layer-and-recollection-surfaces-design.md`) — the proper home for "add context to a pin/entity"; Andy hit its absence again this pass.
- **QA section 4 (edit / re-type / reorder pins) is UNTESTED by Andy** — lower priority; he'll exercise it when adding out-of-sequence pins (e.g. an early-life workplace).
- Andy is continuing QA; more feedback expected.

## Status as of 2026-05-10

**Steps 1–5 of `documentation/LC_Development_Sequence.md` complete.** Free-form memory capture is live end-to-end; user can sign in, start an interview, dictate via Wispr Flow, and the system extracts and stores memories using Claude Sonnet 4.5 with a `record_memory` tool. Phase 0 UI is the next major build (Steps 7–9).

## What's running

| Layer | State |
|---|---|
| Next.js 14 (App Router) + TypeScript + Tailwind | localhost:3001 in dev |
| Supabase | Real cloud project: `delzsmzovxwfgwetgooi.supabase.co` — not local |
| Schema v1.3 | Deployed via migration `20260505000000_initial_schema.sql` |
| Seed data | 10 dimensions, 8 life stages, 50 interview questions, all idempotent |
| Edge Function | `on-user-created` seeds 5 system cards per user (registered as DB webhook on `auth.users` INSERT) |
| Inngest | Dev Server on `localhost:8288`, auto-discovers app at `/api/inngest`; 9 functions registered |
| Auth | Email + password, Supabase Auth, working sign-up/sign-in/sign-out; email confirmation via `/auth/callback` |
| Capture Agent | Inngest function listening on `memory/ingested`; logs only at this stage |
| Interview API | `POST /api/interview/message` — Claude Sonnet 4.5 with `record_memory` tool; sessions persisted; memories inserted; emits `memory/ingested` |
| Interview UI | `/interview` — chat layout, Wispr Flow-compatible text field, ⌘↵ send, memory counter |

## Decisions made during build (not in the PRD)

- **Wispr Flow is Andy's primary STT path.** Wispr Flow is a macOS system-level dictation app that types polished text directly into the focused text field. The interview UI just provides a textarea — no integration code required. Andy gets professional cleanup (pause removal, filler words) for free.
- **Whisper API + click-to-record button deferred.** Will be added later as the path for users without Wispr Flow. Architecture is set up so it drops in cleanly: build `POST /api/interview/transcribe` (Whisper), add record button to UI, transcript fills the same text field. No change to the core interview logic. Need `OPENAI_API_KEY` when ready.
- **No push-to-talk, no VAD.** Voice Activity Detection is wrong for long reflective answers (false-stops on thinking pauses). Push-to-hold is wrong for 2-minute responses (uncomfortable). Click-to-start / click-to-stop is the right pattern when the in-app voice button is built.
- **Free-form memory capture before Phase 0 UI.** Step 5 ships a free-form interview that captures any memory in any order. The dashboard and interview page both clearly label this as "Phase 0 onboarding not yet started." This is for Andy to test the core capture loop and seed real content before the structured Phase 0 UI is built.
- **Memory writes happen synchronously in the API route (alpha shortcut).** The development sequence says the Capture Agent should do the INSERT under a restricted role. For local alpha we INSERT directly via the server-side Supabase client and emit `memory/ingested` so the Capture Agent can fan out to Tagger/Entity in Step 6. The proper INSERT-only role pattern is a production hardening item, not an MVP blocker.
- **Two Inngest Dev Servers caused a sync diagnosis dance.** A stale Inngest process from a prior Codex session was running on port 8290 alongside the active one on 8288. The 8288 server auto-discovers both the Codex Life Chronicle app (localhost:3000) and this Life Chronicle app (localhost:3001). Lesson: one Inngest Dev Server with auto-discovery handles multiple Next.js apps cleanly; don't run two.
- **`claude-sonnet-4-5` as the interview agent.** Right balance of warmth/perception/cost for an interview that needs to be reflective but not slow.
- **Schema extension quirks worth remembering:**
  - Supabase installs `pgvector` and `uuid-ossp` in the `extensions` schema, not `public`. Migrations need `SET search_path TO public, extensions;` at the top so `VECTOR` and `GEOGRAPHY` types resolve.
  - Replaced all `uuid_generate_v4()` with `gen_random_uuid()` (27 occurrences) — the former lives in `extensions` schema and isn't always on the search path.
  - `pgvector` extension is named `vector` in `CREATE EXTENSION`.
  - `GET DIAGNOSTICS` cannot do arithmetic on RHS — needed an intermediate INTEGER variable in `propagate_temporal_constraints`.
- **Inngest v4 SDK breaking change:** `createFunction` takes 2 args, not 3; trigger moves inside the options object as `triggers: [{ event: '...' }]`. Easy mistake when reading v3 examples.
- **`tsconfig.json` excludes `supabase/functions`** so the Next.js TS check doesn't try to type-check the Deno Edge Functions.
- **`viewer_can_access()` stub returns FALSE.** RLS is not yet activated. Activating RLS with the stub in place would lock all users out of their own content. RLS activation is gated on Step 13 (Access Cards UI), when the full function body lands.

## File layout established

```
app/
  (auth)/           sign-in, sign-up, callback        — auth pages, middleware redirects authenticated users away
  (protected)/      dashboard, interview              — server-side auth guard layout
  api/
    health/         health-check
    interview/
      message/      POST: text in, Claude reply out, memories extracted via tool use
    inngest/        Inngest serve handler
lib/
  supabase/         client.ts, server.ts, middleware.ts — three-environment Supabase client factory
  inngest/
    client.ts       Inngest({ id: 'life-chronicle' })
    events.ts       6 typed events
    agents/         9 functions (capture, tagger, entity, planner, synthesis × 3, timeline, search)
    index.ts        barrel export
middleware.ts       route protection + session refresh in one place
supabase/
  migrations/       schema_v1 as a single migration
  seed.sql          dimensions, life stages, interview questions
  functions/
    on-user-created/  Edge Function — seeds 5 system cards on auth.users INSERT
```

## What's next (revised 2026-05-17)

The development sequence was reorganised after Andy's review of the two feature specs (`feature_capture_assistant.md` and `feature_residential_globe_onboarding.md`, both v1.1 approved 2026-05-17). The original Steps 6–10 are replaced.

**Next build — Step 6 (expanded): Capture Assistant + Orchestrator + Tagger + Entity Agents**

Canonical: `documentation/feature_capture_assistant.md` v1.1. Substeps 6a–6i, summary:

- **6a:** Tagger + Entity sub-agents as dual-mode (Inngest listener + inline tool)
- **6b:** Orchestrator agent (Claude Sonnet 4.5) with three-layer prompt and tool definitions; prompt caching enabled
- **6c:** `user_chronicle_digests` table + Planner-owned context-digester background job
- **6d:** `capture_submissions` table + enum extensions + `memories.private_notes` column
- **6e:** Capture assistant UI (floating button, panel, FAB, ⌘K, priming opener)
- **6f:** Proposal cards UI (reasoning, confidence, Accept/Adjust/Decline/Defer, inline "to private notes" toggle)
- **6g:** Unified Review Queue tab (filters, card detail, batch actions; Draft → Finalised lifecycle)
- **6h:** Private notes UI section on every memory card + RLS column-level filter
- **6i:** Mobile FAB + bottom sheet polish

Also in Step 6: rename Inngest event `phase0/stage.completed` → `chronicle/threshold.reached` and update the three stub synthesis agents to listen on the new name.

**Then — Step 7: Residential strand (Life Globe onboarding)**

Canonical: `documentation/feature_residential_globe_onboarding.md` v1.1. Absorbs the old Step 10 (Life Globe synthesis becomes the input surface, not a downstream pass). Substeps 7a–7j. The sidekick chat in 7c is the capture assistant from Step 6 in context-aware mode — no separate UI to build.

**Then — Steps 8 and 9: Entity strand + Topic strand (forthcoming feature specs)**

Phase 0 is non-sequential parallel strands. The capture assistant orchestrates strand transitions organically; the user never declares a stage "complete." System-detected thresholds trigger artifacts via `chronicle/threshold.reached` events.

**Free-form interview at `/interview`** is a deliberate placeholder from Step 5 — it predates the capture assistant. When the capture assistant lands in Step 6, the free-form interview becomes one of several inputs the orchestrator can handle. It is **not** Phase 0 onboarding. The header and opening message currently make this explicit and will continue to until the capture assistant supplants it.

## Step 6a + 6b verification followups (captured 2026-05-20)

Five items surfaced during the Step 6a and 6b verifications. Each has a corresponding task in the project task list with `target_substep` metadata for routing.

| # | Item | Lands in | Task |
|---|---|---|---|
| 1 | ✅ Add `orchestrator_reasoning` + `globe_modal_extraction` to `assumption_log.assumption_type` CHECK; switch orchestrator to use it | 6d migration | #21 — closed 2026-05-22 |
| 2 | Dedupe Tagger/Entity work — inline preview + async fanout both run; user-approve should short-circuit async (or fire `memory/finalized` instead of `memory/ingested`) | 6f UI build | #22 |
| 3 | Orchestrator system prompt nudge — reply must not contradict structured tool data (saw "linked to existing" claim while data showed `created_new`) | 6f after proposal cards exist | #23 |
| 4 | ✅ Wire `add_to_backlog` and `flag_for_private_notes` to real persistence once 6d migration ships `private_notes` column and `memory_elaboration_needed` item_type | 6d migration + tools.ts update | #24 — closed 2026-05-22 |
| 5 | Orchestrator latency 35–55s — partial fix applied (parallel sub-agent execution: short 35→17s, long 55→35s); streaming + Haiku + deferred-inline remain post-6f | post-6f | #25 (partial) |
| 6 | Dashboard surfaces a memory count but provides no way to navigate to and view those memories. The canonical destination is the Timeline view (Step 7h per the residential-globe spec). Quick-fix intermediate `/memories` list recommended for substep 6e — same shape, throwaway code, gives the alpha user real inspectability of the chronicle in the meantime | 6e (recommended) or 7h (canonical) | #37 |
| 7 | ✅ Closed 2026-06-12 (commit `bb93e00`): `scoreNameMatch` adds abbreviation expansion, token-subset scoring, Jaro-Winkler, and containment guards; resolution searches place+organization for institutions. Acceptance verified by `scripts/verify-entity-matching.mjs` + a preview-mode extraction replay. Original record: Entity Agent name matching uses exact + substring containment only, no edit distance. Reproduced 2026-05-22: paste of "Leola Lapidus" (typo of canonical "Leola Lapides") created a duplicate entity AND queued a spurious merge proposal to the unrelated "Leo" entity (because "Leo" is a substring of "Leola Lapidus"). Two real failure modes — missed typos and false-positive substrings. Replace containment-only with Levenshtein or Jaro-Winkler scoring; require minimum length ratio on substring matches. **Third live failure 2026-06-12 (abbreviations):** "Lockbourne Air Force Base" silently duplicated "Lockbourne AFB Columbus Ohio" (AFB ≠ Air Force Base for substring matching; no review-queue item raised). Healed by manual `merge_entities`; the phrase is now an alias on the pin entity. Fix must also expand common abbreviations (AFB↔Air Force Base etc.). **Acceptance test (Andy):** that capture, replayed, must link or raise a confirmation — never silently duplicate. | 6f (with Review Queue feedback loop) or Phase 2 | #38 |
| 8 | ✅ Closed 2026-06-12 (commits `e184e0f` prompt directive + `adc1074` in-flow UX): entity proposals carry merge_candidate + review_queue_id; proposal card renders a per-entity "Is X the same as your existing Y?" strip (Same→merge_entities / Different→reject queue row). Behavioral proof `scripts/verify-orchestrator-vigilance.mjs` — real run with uncovered variant resolved as created_with_merge_proposal (0.86), reply flagged the duplicate explicitly, full cleanup. Original record: Orchestrator should catch near-duplicate entities *in the moment* using Layer B context, rather than producing a Review Queue backlog of every fuzzy match. Andy's framing 2026-05-22: "discrepancies should be corrected in real time." Implementation: system prompt directs the orchestrator to scan Layer B for near-matches before letting extract_entities create duplicates; the proposal card UX in 6f surfaces a two-option "link existing vs create new" choice in-flow. Complementary to #38 (orchestrator = smart frontline; Entity Agent algorithm = rigid backstop). **Live failure this would have caught (2026-06-12):** the Lockbourne aviation-story capture created a silent duplicate place entity despite "Lockbourne AFB Columbus Ohio" sitting in Layer B. **Acceptance test (Andy):** replaying that submission must yield a direct link or an explicit link-vs-create proposal, not a silent new entity. | 6f | #39 |

These are the kind of items that vanish in chat history if they're not captured in the task list AND mirrored to durable memory. This subsection is the durable record; the task list is the actionable surface. Both must move together — when one of these tasks is closed, the matching row here gets a `✅` and a one-line note on what was done. **Caveat learned 2026-06-12: the session task list does NOT persist across sessions** (the May entries were gone) — #38 and #39 were recreated from this table with the Lockbourne acceptance tests attached. This table is canonical; rebuild task-list entries from it when picking the work up.

## Step 6d — what got built (2026-05-22)

Multi-purpose schema migration + orchestrator wiring. Closes followup tasks #21 (orchestrator_reasoning enum) and #24 (backlog + private_notes wired to persistence).

| Piece | Purpose |
|---|---|
| `supabase/migrations/20260521215905_capture_assistant_schema.sql` | Six related additions: capture_submissions table, memories.private_notes, memories.source_submission_id, memory_source ENUM extension ('external_witness_account'), assumption_log.assumption_type CHECK extension (orchestrator_reasoning, orchestrator_dispatch, globe_modal_extraction), review_queue.item_type CHECK extension (memory_elaboration_needed, orchestrator_proposal). |
| `lib/agents/orchestrator/core.ts` | Opens a capture_submissions row at the start of each run (status='processing'); closes it ('awaiting_review' when proposals need user resolution, 'integrated' when the run was purely conversational); audit log now uses assumption_type='orchestrator_reasoning'; submission_id passed into ToolContext. |
| `lib/agents/orchestrator/tools.ts` | ToolContext gains source_submission_id. create_memory threads it into the memories insert. flag_for_private_notes appends to memories.private_notes when memory_id is supplied (proposal-only otherwise). add_to_backlog inserts a real review_queue row with item_type='memory_elaboration_needed' and full lineage via context_json. |
| `lib/agents/shared/types.ts` | AssumptionType union expanded to match the migration. |
| `scripts/verify-6d-tools.mjs` | Direct dispatch verification of the two newly-persistent tools (cleans up after itself). |

Verified end-to-end: capture_submissions row created; memory.source_submission_id links cleanly; assumption_log uses 'orchestrator_reasoning'; flag_for_private_notes writes to the column; add_to_backlog inserts a queue row with the right item_type.

The followup table at the top of this file now shows tasks #21 and #24 as closed.

## Step 6c — what got built (2026-05-21)

Durable Layer B cache for the orchestrator. Removes the per-submission digest rebuild and gives Anthropic prompt caching a stable Layer B key across consecutive submissions.

| Piece | Purpose |
|---|---|
| `supabase/migrations/20260521130453_user_chronicle_digests.sql` | `user_chronicle_digests` table — one row per user; `digest_text`, `digest_hash`, `generated_at`, `generation_version`, `stats`, `is_stale`. Partial index on stale rows for the sweeper. |
| `lib/agents/orchestrator/digest-cache.ts` | `getChronicleDigest()` (read-or-regenerate, 5min TTL), `markDigestStale()`, `regenerateDigest()`. |
| `lib/inngest/agents/chronicle-digester.ts` | Three functions: invalidate-on-`memory/ingested`, invalidate-on-`entity/merged`, and an hourly cron sweep that regenerates any stale rows proactively. |
| Wiring | Orchestrator now reads via `getChronicleDigest`; the three new Inngest functions are registered in `lib/inngest/index.ts` and the serve handler. |
| Verification scripts | `scripts/verify-digest-cache.mjs` (direct cache paths), `scripts/verify-inngest-invalidation.mjs` (Inngest listener). Both pass: cache hit 164ms vs regenerate 524-665ms; Inngest invalidation ~575ms end-to-end. |

The hourly cron is conservative — most regeneration still happens lazily on read, since `is_stale` is flipped by the event listener and the next orchestrator call rebuilds. The cron is a backstop for users whose chronicle changes outside event-driven paths (e.g., direct admin writes) or whose digest stays cold for hours.

## Step 6b — what got built (2026-05-20)

Orchestrator library lives at `lib/agents/orchestrator/`:

| File | Purpose |
|---|---|
| `system.ts` | Layer A — multi-tenant system prompt (`ORCHESTRATOR_SYSTEM_PROMPT`, `SYSTEM_PROMPT_VERSION`) |
| `digest.ts` | Layer B — `buildUserDigest(user_id, supabase)` produces a hashed, deterministic chronicle digest (live query; durable table comes in 6c) |
| `tools.ts` | Tool registry (`ORCHESTRATOR_TOOLS`) + dispatch (`executeTool`) for the 7 MVP tools |
| `core.ts` | `runOrchestrator({...})` — the entry point. Composes the three-layer prompt with `cache_control: ephemeral` on Layers A and B, runs the multi-turn tool-use loop (bounded at 5 iterations), returns `{ reply, proposals[], meta }` |

CLI test harness at `scripts/test-orchestrator.mjs`. Smoke-tested with two samples; both produced well-shaped responses. Orchestrator-created memories carry `metadata.created_by='orchestrator'` and `is_draft=true`. Async Tagger and Entity agents pick them up via the existing `memory/ingested` event.

## Catch-up note (2026-06-05): state between this log and now

This file went quiet after Step 6d (2026-05-22). Since then, per git history: Step 6e–6h shipped (capture-assistant UI, proposal cards, unified Review Queue, private-notes UI), the `/entities` management view + dashboard tiles landed, entity merge/reject hardening, an FK-on-delete audit, and the **navigation-surfaces reframing** (PRD v1.1; Globe / Recollections / Timelines as distinct surfaces — see `decision_phase0_reframing_2026-05-31.md`). Step 6 is effectively complete. Treat git log + the decision memos as authoritative for that interval; this section just closes the gap.

## Step 7 Slice 1 — what got built (2026-06-05)

Residential globe **walking skeleton** — the create-and-view loop. Phasing + design in `decision_step7_slice_phasing_2026-06-05.md`; canonical UX in `documentation/feature_residential_globe_onboarding.md` (phased).

| Piece | Detail |
|---|---|
| Self-entity primitive | `lib/globe/self-entity.ts` (`ensureSelfEntity`/`findSelfEntity`). The user's `type='person', metadata.is_self=true` entity is the subject of all first-person relationships. Backfill: `scripts/backfill-self-entity.mjs` (created "Andy Halliday"). Registration now captures a name (sign-up + `on-user-created` create it at inception — **edge fn not yet deployed**). |
| Persistence | Migration `20260605120000_globe_residence_functions.sql`: `create_residence_pin` (atomic entity→relationship `lived_at`→optional memory+link, PostGIS via `ST_MakePoint`) + `get_residence_pins` (coords out, placement order). API `app/api/globe/residence` GET/POST. `lib/globe/geocoding.ts` (Mapbox v6 reverse → place_subtype + country). |
| UI | `/globe` (nocturne dark globe, `projection: globe`, Fraunces display + Geist). Search-first: search → fly-to → drag draft pin → modal (verbatim narrative + free-text "when") → save → ember pin **bloom** + warm arc in placement order. `components/globe/{GlobeView,GlobeClient,FindLocationBox,PinModal}.tsx`. |
| Verification | `scripts/verify-globe-slice1-schema.mjs` + `scripts/verify-globe-residence.mjs` — both PASS. Production build clean. Reviewed live in-browser; Andy approved the globe look. |

**Bugs fixed during first use:** stale-dev-server hang; map container collapsing to 0 height (mapbox-gl.css `position:relative` overriding Tailwind `.absolute` — fixed with `h-full w-full`); search-input black-on-black text (forced `--ink`/ember caret).

**Slice 1 scope = create + view only.** No edit/relocate/delete (Slice 4), no image (Slice 2), no AI extraction (Slice 2), no place types (Slice 3), no sidekick. Globe memories are saved `is_draft=false` (final) — reconsider for Slice 4.

**Next: Slice 4 (edit/relocate/delete)** — flagged highest-value after first real use immediately needed pin correction.

## Step 7 Slice 4a — what got built (2026-06-07)

Select / edit / relocate / delete a residence pin. Migration
`20260605140000_globe_slice4_edit_delete.sql` + the `[relationshipId]`
route (GET text / PATCH edit+relocate / DELETE).

| Piece | Detail |
|---|---|
| Drafts-on-create | `create_residence_pin` now writes `is_draft=true` so globe recollections are editable in place until finalized. Raw Vault invariant preserved: a *finalized* owner edit writes the prior `content_raw` into `memory_revisions` before overwriting. |
| Edit / relocate | `update_residence_pin` edits name/subtype/country/geom/when/body. Selected pin is draggable on the globe (relocate); the right-side `PinEditPanel` edits text fields. |
| Delete | `delete_residence_pin` — atomic hard delete (memory → relationship → place, place only if unreferenced), with an explicit 3s "can't be undone" confirm in the panel. |
| Chrome fix | CaptureAssistant FAB suppressed only while the pin editor is open (it was overlapping the Delete button). |
| Verify | `scripts/verify-globe-slice4.mjs` — PASS. |

## Step 7 Slice 4b — what got built (2026-06-09)

Finishing the editing slice: explicit sequence (insert before/after +
reorder) and returning/intra-metro detection. Drag-to-refine precision
was already delivered in 4a (draft + selected pins are draggable), so 4b
is the sequence + proximity work. Two migrations (both applied + verified
via the paste-into-Supabase loop while direct DB access was being set up).

| Piece | Detail |
|---|---|
| Sequence schema | `20260609000000_globe_slice4b_sequence.sql`: `relationships.sort_order` (backfilled from placement order); `get_residence_pins` orders by it; `create_residence_pin` gains `p_position` (NULL=append, k=insert at index k shifting later pins up); `reorder_residence_pins(user, ordered_ids[])` — atomic, ownership- + coverage-guarded. Proof: `scripts/verify-globe-slice4b.mjs`. |
| Insert UX | `PinModal` asks "Where does this fall in your life?" (before earliest / after any pin / most recent default) → `position` to POST. GlobeView reloads the whole chain after save (an insert shifts others). |
| Reorder UX | `PinEditPanel` shows "stop N of M" + ↑ Earlier / ↓ Later controls → `POST /api/globe/residence/reorder`. Selection persists across the reload. |
| Detection | `20260609010000_globe_slice4b_proximity.sql`: `nearest_residence(user, lng, lat, exclude_rel)` (PostGIS `ST_Distance` on geography). `lib/globe/proximity.ts` classifies: "returning" <1.5 km, "intra_metro" <25 km, else none. POST + PATCH(relocate) return `proximity`; GlobeView shows an auto-dismiss toast. Proof: `scripts/verify-globe-proximity.mjs`. |

**Build decision — proximity in SQL, not app JS.** PostGIS `ST_Distance`
on the geom we already store is both more accurate and testable through
the existing RPC-based verify pattern; the route only owns the threshold
classification.

**Verify-script gotcha (class of bug).** `verify-globe-proximity.mjs`
first asserted an absolute distance (London→Madrid >1000 km) and FAILED
because Andy has *real* residences — one ~103 km from London — that
`nearest_residence` correctly returned. Lesson: verify scripts run
against the live shared DB with real data; assert only **relative**
properties between the script's *own* fixtures (or distances to points
it created), never absolute distances/counts that assume an empty DB.

**Slice 4 remaining → folded into later slices:** "returning vs
intra-metro" now *detects* and hints, but distinct pin/arc *styling* for
the cases is deferred (relates to Slice 3 place types). Image + AI
extraction = Slice 2; place types = Slice 3; sidekick/clustering = 5+.

## Overnight session 2026-06-11 (Andy-authorized autonomous package)

Two agreed-but-deferred items shipped while Andy slept (his "go", with
Slice 3 explicitly held back for the joint owned-vs-visited decision):

| Piece | Detail |
|---|---|
| Directional arcs (`699346f`) | Arc source is now per-leg segments (`seq`-tagged). Faint ember chevrons along every leg at rest; selecting a pin brightens its inbound leg ("approached from", opacity .95/width 2.8) over its outbound ("egressed to", .55/2.2) via `arcs-active` + `arc-chevrons-active` layers with case-expressions on `seq`. |
| Image preprocessing (`70fca2b`) | `lib/globe/image-preprocess.ts` — client-side HEIC→JPEG (heic2any, lazy dynamic import) + compression toward the 2MB memo target (max 2048px, quality 0.85→0.6 stepped). Wired into PinDetailCard upload. Animated GIFs pass through. |

Verified by `tsc --noEmit` + clean dev-server compile. **Morning manual
checks for Andy:** (1) look at the arcs — resting chevron subtlety and
the inbound/outbound emphasis are taste calls; (2) upload a real iPhone
HEIC in Chrome and confirm it renders. Note: `npm run lint` turns out to
be unconfigured in this repo (next lint prompts for interactive setup) —
tsc is the only static gate; configuring ESLint is a candidate chore.

## Globe anchor-safety hardening (2026-06-15, `324aacf`) — from Gemini commentary

Reviewed Gemini's commentary on the shipped Slice 3 globe design; two were real
code gaps, fixed in `20260615120000_globe_anchor_safety.sql`:
- **C (multi-tenancy):** `create`/`update_residence_pin` stored `p_anchor_residence_id`
  with NO validation — a client could anchor to another user's residence or a
  non-primary. New `validate_residence_anchor()` (non-null anchor must be the same
  user's own `lived_at`); both RPCs call it. The DB is the authoritative guard
  (defense-in-depth; the API route just passes anchorId through).
- **A (orphan-on-retype):** re-typing a primary off the spine now NULLs the
  `anchor_residence_id` of markers anchored to it (FK SET NULL only fires on delete).
Proof `verify-globe-anchor-safety.mjs` (4/4). No invalid anchors in live data.
**Adopted as guidance (no code):** multi-residence workplaces via "Workplace Epochs"
(multiple `worked_at` pins per era, not one pin→many homes). **Future UI polish:**
tether highlight on selection; static era gradient from parsed `when_text`. All in
`docs/plans/2026-06-12-globe-place-types-design.md` (post-ship commentary section).

## Shared global nav header (2026-06-14, `fcb8bb6`)

Fable-5-suggested refactor, agreed + done after Slice 3 build. `components/AppNav.tsx`
(client, `usePathname`) renders once from `app/(protected)/layout.tsx`: brand +
links to Dashboard/Globe/Memories/Entities/Review/Interview with active-route
highlighting + email/sign-out. **Globe opts out** (returns null on `/globe`) so its
full-screen nocturne chrome is never covered — it keeps its own glass "← Dashboard"
link. Each page dropped its redundant "← Dashboard | Title" bar, keeping a slim
title+counts row; dashboard's duplicated email/sign-out moved into AppNav. Interview
page (full-height chat) now uses `h-[calc(100vh-3.5rem)]` to fit below the 56px nav.
Attributed to Opus 4.8 (Fable 5 originated the idea). Ends the navigation-dead-end
whack-a-mole — new protected pages inherit nav automatically. **JSX gotcha hit:** a
`{/* */}` comment can't precede the root element in a `return (...)` (creates two
roots); use a `//` JS comment instead.

## Reliable HEIC display — server-side conversion (2026-06-14, `c45278b`)

Follow-up to the graceful-fallback fix: Andy will send iPhone HEICs to his Mac
and upload via desktop Chrome (no iOS auto-convert), so reliable display
everywhere requires real conversion. **Decision: convert server-side, not in
the browser.** Browser heic2any/libheif is per-browser-flaky; the server is one
controlled environment. `lib/globe/heic-server.ts` (`toWebSafeImage`) uses
`heic-convert` (pure-JS libheif WASM, no native deps — portable to Vercel),
lazy-loaded only when a HEIC arrives; quality steps 0.85→0.6→0.45 if a converted
JPEG would exceed the 5MB cap. Wired into `POST …/image` before `addPinImage`,
so **storage always holds a web-universal JPEG**. Client `preprocessPinImage` is
now **compression-only** (HEIC passes straight through); `heic2any` dependency
removed. Privacy-preserving (no third-party CDN — rejected Cloudinary for the
memory vault). **Proven on a real 3MB HEVC HEIC → valid 3992×2992 JPEG under
cap**: `scripts/verify-heic-server-convert.mjs`. The image route is Node runtime
(heic-convert needs Node, not edge). **Prod note:** verify Next traces the
libheif WASM into the serverless bundle at deploy time (works in dev now).

## HEIC upload bug fixed (2026-06-14, `549d686`)

Andy's first HEIC upload (to Lockbourne via the edit-panel gallery) failed
with "Photo action failed." **Root cause (systematic debug):** no server
request was sent (dev log showed no POST for that pin) + the generic message
(non-Error throw) ⟹ client-side `heic2any`/libheif conversion *rejected*, and
since conversion was the ONLY path, the whole upload died — even though the
`pin_images` bucket accepts raw HEIC. **Fix:** `preprocessPinImage` is now
best-effort — returns `{ file, warning }`; on HEIC conversion or compression
failure it falls back to the original file, logs the real rejection to console,
and surfaces an amber notice ("uploaded as-is — may only display in Safari").
Both callers (PinDetailCard, PinEditPanel gallery) updated. Verified in Node
(heic2any can't load there → exercises the fallback): HEIC falls back without
throwing, JPEG passes through. **Class-of-bug lesson:** a client-side
enhancement (format conversion) must never gate the core action — degrade
gracefully. **Follow-up (not urgent):** the *browser-side* libheif failure
reason is now logged to console on the next attempt — use it to decide whether
to fix conversion (e.g. server-side sharp/libheif, or heic2any `multiple` for
Live Photos) so Chrome gets true HEIC support rather than the Safari-only
fallback.

## Design — context layer & recollection→entity journey (2026-06-14)

Spec: `docs/plans/2026-06-14-context-layer-and-recollection-surfaces-design.md`
(commit `f1c0323`). Validated with Andy. **Context** is a content type distinct
from recollections: captured once, attached to the **entity it's about** (ANY
entity type, not just places — e.g. an `event_series`); recollections inherit
context via `memory_entities` (never attached to a recollection directly). Data
model **B** = many context notes per entity (footnotes/bibliography) with optional
source_label+source_url; synthesized biography deferred. **Each note carries a
`visibility`**: shareable (governed by Access Cards) vs private ("for your eyes
only" — entity-level analog of `memories.private_notes`, canonical case = sensitive
notes on a person). Same Add-context UI hosts both. **Hard invariant:**
published/synthesized artifacts draw ONLY from shareable notes, never private. Capture =
**propose-and-confirm** (assistant classifies as context + proposes the entity;
user Accept/Adjust/Decline) — replaces the `memory_elaboration_needed` backlog
dead-end. Surfaces: per-entity **Entity View** is the context home (notes + linked
recollections + Add context); **`/memories` must become the searchable, editable
recollection home** (today editing is only via globe→detail→Edit) with entity
chips on the recollection DETAIL linking to the Entity View; add-context never on
the recollection editing form. **To-dos surfaced:** RAF Mildenhall has
`globe_extraction=false` (no chips) — Inngest-down event loss; re-trigger
`globe/pin.saved` + consider an extraction-backfill sweep. Confirm
`entity_biography` cardinality before building the notes store. **RESOLVED 2026-06-15:
`entity_biography` is a `syntheses.type` (derived, one-per-entity), NOT a table — raw
context needs a dedicated `entity_context_notes` table (gen_random_uuid, user_id w/o
auth.users FK; visibility shareable|private). Also: `merge_entities()` must repoint
`entity_context_notes.entity_id` on merge or notes orphan. RLS deferred to Step 13
(globally stubbed off now).**

## Deferred design — interview dialogue → recollections (2026-06-14)

Spec at `docs/plans/2026-06-14-interview-dialogue-to-recollections-design.md`
(commit `3e93af4`). **Explicitly post-MVP** — a narrative-biography editing
enhancement, not a capture primitive; Andy's use-case proofing doesn't need it.
Validated decisions: the **journalist model** (assistant elicits → Raw Vault
holds verbatim answers → synthesis "reports out" with quotations → biography
publishes a compact view). Whose words = both as layers (verbatim in vault + AI
synthesis derived). Question preserved in `memories.metadata.interview_question`
+ a session transcript. Trigger = quiet per-answer verbatim capture + "shape
this" synthesis offer at thread close. Revise-and-propagate: draft edits in
place, finalized edits write `memory_revisions` (non-destructive), synthesis
goes stale → regenerate reading revisions → propose updated language for
approval. Rails scaffolded (memory_revisions, synthesis stubs,
synthesis/invalidated, synthesis_stale); propagation automation + question
preservation + session transcript + synthesize-on-close are to-build.

## 2026-06-14 — pin-type descriptions + a debugging near-miss

- **Pin-type descriptions shipped (`5f2ddf0`)**: each of the six types now shows a
  one-line description under the selector (modal + edit panel), driven by
  `lib/globe/pin-types.ts`. Prompted by a real ambiguity — Andy's recurring summer
  rental at Playa Comaruga (anchored to Zaragoza) could read as Second residence,
  Short-term stay, or Vacation. Descriptions disambiguate; all three still render
  the same dashed tether so no choice is "wrong."
- **Backlog "data loss" was a FALSE ALARM — no bug.** Andy's Operation Reflex /
  Zaragoza research (a "context entry") IS correctly saved: `review_queue` row
  `99b9ac68`, `item_type='memory_elaboration_needed'`, open, full text intact;
  surfaces on /review. The capture assistant behaved correctly (kept research out
  of the Raw Vault, queued it). **My initial diagnosis was wrong**: I ran a
  `review_queue` select that named a nonexistent `status` column → supabase-js
  returned error+null → I misread it as "0 rows / not persisted" and told Andy his
  data wasn't saved. **Class-of-bug lesson: a supabase-js `.select()` naming a
  column that doesn't exist returns `{data:null,error}`, not a throw — ALWAYS check
  `error`, or you'll mistake a broken query for an empty table.** Systematic
  debugging (reproduce before fixing) prevented me from "fixing" a working feature.
- **✅ DONE (`d41af11` + `0c1dbca`):** `memory_elaboration_needed` cards rendered
  thinly (empty "Elaboration prompt" placeholder), hiding the user's research (Andy
  hit it on the Zaragoza item via the new AppNav). First fix showed `ctx.text` — but
  that's only the orchestrator's 753-char SUMMARY; the user's full 6,911-char
  research lives in `capture_submissions.input_text` (item_id = the submission id).
  Second fix: /review now hydrates the submission's `input_text` into
  `item.fullText`; the card shows the FULL research (scrollable) + the queue rationale.
  **Standing gap (→ context-layer design):** these cards are still Dismiss-only — no
  workflow to act on non-recollection research (view-in-place, attach to an entity as
  `entity_biography` context, elaborate, etc.). Andy hit this dead-end during proofing;
  it's motivating pulling the deferred context-layer design
  (`docs/plans/2026-06-14-interview-dialogue-...` sibling) forward. The backlog is an
  interim holding pen, not a destination.
- **#3 NEXT — context-layer design session:** where non-recollection material
  (research, historical background) ultimately lives. Backlog is the interim pen;
  durable home is the entity's context notes (a NEW `entity_context_notes` table) +
  the derived `entity_biography` synthesis (a `syntheses.type`, NOT a table) + period/era
  context (`life_periods`). Brainstorm capture → route (entity vs period) → surface.

## Step 7 Slice 3 — in progress (2026-06-12, autonomous under bypass)

Canonical design: `docs/plans/2026-06-12-globe-place-types-design.md`.
Six pin types; Model A (only `lived_at` is the connected spine; others
are anchored markers); three line tiers (spine ▸ commute line ▸ dashed
tethers). Phases tracked as tasks #4–#7.

- **Phase 1 DONE (`68ad485`)** — migration `20260613130000_globe_place_types.sql`:
  new codes `vacationed_at`/`traveled_for_work_to`; `relationships.anchor_residence_id`
  (nullable, ON DELETE SET NULL); `create`/`update_residence_pin` gain
  `p_type_code`+`p_anchor_residence_id`; `get_residence_pins` widened to all six
  types returning `type_code`+`anchor_residence_id`, scoped by `metadata.globe_pin`
  so non-globe relationships can't masquerade as pins. `reorder`/`nearest_residence`
  already spine-only. Additive (no gate). Proof `verify-globe-place-types.mjs` 9/9.
- **Phase 2 DONE (`a3b00b5`)** — POST/PATCH `/api/globe/residence` thread
  `typeCode`+`anchorId`; proximity hint primary-only; PATCH omitting typeCode
  leaves type/anchor untouched. tsc+lint clean.
- **Phase 3 DONE (`c9d2051`)** — GlobeView splits `lived_at` spine vs markers;
  spine keeps glowing chevron arcs (directional emphasis now indexed against the
  spine); markers render per-type pins + great-circle tether to anchor: workplace
  = commute line (tier 2 solid cyan glow), others = dashed dim tethers (tier 3).
  Per-type pin CSS in globals.css; collapsible legend (6 pins + 3 line tiers).
  tsc+lint clean. **Not visually exercisable until Phase 4** — no UI to create a
  typed pin yet, so all existing pins are still `lived_at`.
- **Phase 4 DONE (`e68f43e`)** — `lib/globe/pin-types.ts` is the shared source of
  truth (six types' labels/colors/anchor prompts). PinModal: type selector +
  contextual picker (spine→sequence slot, marker→"which home?" anchor). PinEditPanel:
  type dropdown (re-classify) + anchor selector; reorder controls spine-only.
  PinDetailCard: colored type chip. GlobeView threads typeCode+anchorId through
  create+edit, passes spine-relative position/primaries, handleMove reorders spine
  only. tsc+lint clean.
- **Phase 5 (Andy's manual proof)** — place one of each type in the live app;
  confirm pin styles, commute line (workplace→home), dashed tethers, re-typing,
  the type chip, and the when_text time phrase. Then the deferred shared-nav-header
  refactor (agreed: globe opts out via usePathname null-render; do it as a clean
  unit after Slice 3; attribute to Opus 4.8; chip task_fb6157e1 exists).

**Slice 3 build (Phases 1–4) COMPLETE** — all gated + committed. Only the manual
live proof remains before Slice 3 is fully closed.

**Discriminator note:** globe pins carry `metadata.globe_pin=true` (set on
create). `get_residence_pins` returns all `lived_at` by code (legacy pins need
no backfill) but markers only when flagged — future employment edges from the
entity pipeline therefore won't appear as pins.

## Finalised-memory deletion + duplicate cleanup (2026-06-13/later, Andy)

Owner can now delete a **finalised** memory (previously only drafts
could be deleted via Decline). `DELETE /api/memory/[id]?confirm=final`
+ a subtle two-click "Delete" on final `MemoryCard`s. Rationale: the
Raw Vault invariant binds agents/synthesis, **not the owner's right to
curate their own record** (remove duplicates, test entries). Cascade
(memory_entities/dimensions/revisions removed; linked entities
preserved) proven by `scripts/verify-memory-delete-final.mjs`. Commit
`5a73d36`.

Used it to resolve the Winter Carnival / ski-jump **duplicate**: two
near-identical finalised memories existed — `451541f4` (May 20,
"Leola Lapides" correct, richer: "high school girlfriend" + Berkeley)
and `54771fbc` (May 22, "Leola Lapidus" typo, sparser). Per Andy,
deleted the typo version, kept the correct one. The `Leola Lapides`
entity carries aliases `["Leo","Leola Lapidus"]` — "Lapidus" correctly
folded as alias (no duplicate entity), confirming the #38 matcher fix.
**Latent hygiene note:** the `"Leo"` alias is junk from the May-22
substring false-positive (pre-#38); harmless but could mis-match a real
"Leo" — left in place, flagged for Andy.

## Globe drafts decision — finalize on save (2026-06-13, Andy option 1)

Slice 4a's **drafts-on-create is reverted**: globe recollections are
written final (`is_draft=false`) at creation, and a body save via
`update_residence_pin` finalizes any legacy draft in place (no revision
for the finalizing save itself; subsequent edits revise via
memory_revisions as before). Rationale: the globe save IS the owner's
authorship — nothing ever finalized the drafts, so each pin sat in
"awaiting review" limbo (the Zaragoza draft; surfaced when Memories
said "1 draft awaiting review" while Review said "nothing waiting").
Migration `20260613120000_globe_finalize_on_save.sql` (+ 1-row backfill,
Andy-approved); proof `verify-globe-finalize-on-save.mjs`; commit
`3b064d1`. Related UI fix `a0009c8`: /review shows a draft-memories
banner so the two surfaces can't contradict each other.

## Photo scoping decision (2026-06-13, Andy)

**Two photo scopes, never mixed:** the globe pin's gallery is
*entity-level* (`entity_media` on the place, path
`users/<uid>/pins/<entity_id>/`); photos belonging to an individual
recollection are *memory-level* (`memory_media` — already in the
initial schema with caption + sort_order) and will live on the
/memories card, NOT in the pin gallery. Placeholder shipped on
MemoryCard (`19f86f3`, "Photos — coming soon"); full design recorded
in session task #3 ("Memory-level photos in /memories") — path-scope
separation is what keeps the galleries from cross-contaminating.
NB: session task lists don't persist — rebuild task from this note if
it's gone when the work starts.

## Linked-recollections navigation (2026-06-13, Andy's morning feedback)

Andy: excerpts weren't expandable, the edit panel gave no hint the
extra recollections existed, and nothing navigated to full text. Fix
(`338d2b3`): detail-card excerpts expand in place (▸/▾, full text,
scrollable); both card and edit panel link to `/memories?entity=<place>`
(the existing Step 6e list with entity filter). **Design line drawn:**
the globe panel edits only the pin's own overview memory; other
recollections are *viewed* from the globe but *edited* in the
Recollections surface (Raw Vault: finalized memories revise via
The Stroll pathway C, not a second editor on the globe).

## Overnight session 2026-06-12/13 (third package — bypass permissions granted)

Andy enabled bypass-permissions mode and said go. Slice 3 deliberately
left untouched (owned-vs-visited is his call).

| Piece | Detail |
|---|---|
| #39 completed (`adc1074`) | In-flow link-vs-create strip on proposal cards (see followup row 8 ✅). The behavioral proof ran a REAL orchestrator submission ("Lockbourne Air Base", not alias-covered): merge proposal at 0.86 with candidate + queue id, reply explicitly flagged the duplicate, all test rows swept (verify script waits 25s for async agents before cleanup). |
| Multi-photo gallery (`811851c`) | Deferred item shipped: many photos per pin, exactly one primary = the globe/card photo. Edit panel gallery (add / ★ make-primary / ✕ remove, immediate); card Replace demotes instead of deleting; +N badge; pin delete clears all images. `verify-globe-pin-image.mjs` rewritten for the gallery invariants. |

Gates: tsc + eslint clean; all proofs PASS. Andy should eyeball the
gallery UI styling and the duplicate-strip wording when next capturing.

## Overnight session 2026-06-12 (second Andy-authorized autonomous package)

| Piece | Detail |
|---|---|
| Linked recollections on pin card (`5835d55`) | Detail-card GET returns up to 20 non-globe memories linked to the place (excerpts, newest first); card shows a read-only "More recollections here" list. First data: the Lockbourne aviation story. |
| #38 matcher closed (`bb93e00`) | See followup row 7 ✅. **Replay also exposed a second root cause:** extraction type-flips institutions between place/organization run to run, and type-filtered resolution made the pin entity invisible — fixed by searching both types for institution names. |
| #39 prompt directive (`e184e0f`) | "Entity vigilance" section in the orchestrator system prompt (version 2026-06-12.0): compare submission names against Layer B, treat abbreviations/word-order/added-geography as disguises, call out suspected duplicates in the reply + rationale. **Remaining for #39:** supervised behavioral verification (the harness writes real drafts — don't run it unattended) and the in-flow two-option link-vs-create proposal card UX. |

Gates: tsc + eslint clean throughout; all verify scripts pass.

## Dev-stack operations rule (2026-06-11, after the stack died twice)

**Never run `npm run dev` or `npx inngest-cli dev` as Claude background
tasks** — they die when the session's tasks are stopped, which twice
left Andy's open globe tab failing pin-detail loads hours later. Use
`scripts/dev-up.sh` (commit `2f2fe56`): detached double-fork to launchd,
idempotent per port, logs in /tmp/lc-{next,inngest}-dev.log. At session
start, check ports 3001/8288 and run dev-up.sh if needed. Trade-off:
detached servers' logs are in those /tmp files, not in a harness task —
`tail` them when debugging.

## Morning fixes 2026-06-11 (after Andy's first look at the overnight work)

| Piece | Detail |
|---|---|
| Great-circle arcs (`2fbf103`) | Andy's screenshot showed chevrons floating off the arcs and arcs detaching from pins, zoom-dependent. Cause: 2-point legs — the line layer and symbol-along-line placement disagree about where a long straight segment lies on the globe projection. Fix: densify each leg along the great circle (~1 vertex/0.75°, cap 128, antimeridian unwrap). Line, chevrons, and pins now share one geometry at every zoom. |
| Pin memory scoping (`0df2c7a`, migration `20260611100000`) | **Class-of-bug caught by Andy's "add a second recollection" question:** update_residence_pin resolved the pin's memory via unordered `LIMIT 1` over all role=location links, and delete_residence_pin deleted EVERY memory linked to the place. Edit/delete/GET now all scope to `capture_mode='globe_onboarding'` oldest-first. Proof: `scripts/verify-globe-pin-memory-scoping.mjs` (fixture = pin + extra freeform memory on same place; edit hits only globe memory; delete spares the extra). **Rule: any "the pin's X" lookup must scope by capture_mode + deterministic order, never bare LIMIT 1.** |
| ESLint configured (`eccfe05`) | `.eslintrc.json` with next/core-web-vitals (deps were already present, config never created). First full run: zero warnings. Static gates are now tsc + eslint. |

**Additional recollections per pin (answered for Andy 2026-06-11):** the
supported path today is the Capture Assistant (FAB) — a new memory that
mentions the place gets entity-linked to it but stays out of the pin's
overview text (which is exclusively the globe_onboarding memory, per the
scoping fix above). A per-pin "linked recollections" list on the detail
card is the natural Slice 5 / Recollections-surface feature.

## Step 7 Slice 2 — what got built (2026-06-10)

Richness slice: pin detail card, single image per pin, Claude extraction
of the modal text. **No SQL migration** — `media` + `entity_media`
(is_primary) already covered images (see
`decision_step7_image_storage_2026-06-04.md`), extraction fields go in
`relationships.metadata` (per the prep-migration decision), and the
`globe_modal_extraction` assumption_type was already in the 6d CHECK.
Three commits: 5db2b8c (2a images), dc6fc89 (2b detail card), 650c2f9
(2c extraction).

| Piece | Detail |
|---|---|
| Image storage (2a) | Private `pin_images` bucket created via `scripts/setup-pin-images-bucket.mjs` (idempotent; 5MB cap, image MIME types — Storage API, not SQL, to dodge `storage.objects` ownership issues). `lib/globe/pin-image.ts`: one image per pin; object at `users/<uid>/pins/<entity>/…`; `media.uri` stores the storage PATH, reads mint 1h signed URLs. Server-proxy `POST/DELETE /api/globe/residence/[id]/image` (no client-direct Storage → no storage RLS needed yet). Pin DELETE clears the image first so the entity_media CASCADE can't orphan media rows/bytes. Proof: `verify-globe-pin-image.mjs`. |
| Detail card (2b) | `PinDetailCard` (bottom-center read view): recollection, photo with add/replace/remove, extracted-fact chips. **Pin click → detail card; Edit button → PinEditPanel**; drag-to-relocate arms only in edit mode. Single-pin GET now returns `image` (signed URL) + `facts`. |
| Extraction (2c) | `globe/pin.saved` event from POST-with-narrative and PATCH-with-body; `globe-extraction-agent` (Inngest) → `lib/globe/extraction.ts` runs spec §6.3 via forced tool call (sonnet-4-5). Writes `relationships.metadata`: `residence_type` + `move_reason` top-level (the period-summary SQL reads `metadata->>'move_reason'`), full payload under `globe_extraction`; logs to assumption_log (`globe_modal_extraction`, agent=`capture_agent`). Re-runs overwrite (latest text wins); audit trail is the log. Proof: `verify-globe-extraction.mjs` (asserts Raw Vault: content_raw byte-identical after extraction). |

**Stubs awaiting later slices:** `mentioned_people` / `mentioned_organisations`
stay inside `metadata.globe_extraction` — globe memories don't flow
through `memory/ingested`, so Entity Agent resolution of these stubs is
future work. Verify scripts that run TS libs use the `npx tsx` temp-runner
pattern (established by `verify-6d-tools.mjs`).

**Incident + class-of-bug (2026-06-10 evening, near-miss data loss):**
Andy's long-open globe tab hit a dead dev server (the background `npm
run dev` task had been killed); pin clicks then rendered his richest pin
(RAF Mildenhall — full recollection + photo) as *empty* ("No
recollection yet", "Add a photo"), because PinDetailCard/PinEditPanel
swallowed fetch errors into their empty defaults. DB was fully intact —
read-path only. The dangerous part: Save from the empty-looking edit
panel would have PATCHed an empty body over the real recollection (the
panel sends the full field set). Fixed in `d7b0b2c`: load failures now
render an explicit error + Retry, and the edit panel locks textarea +
Save until a load succeeds. **Rule: any UI whose Save writes back a
loaded field set must hard-disable Save while the load is failed or
pending — a failed read must never present as empty content.**

**Follow-on (same evening):** a save took 20+s because the Inngest dev
server was ALSO down — `await inngest.send` burned ~6s in connect
timeouts inside the PATCH. Fixed in `ac8cf39`: `lib/inngest/send-quick.ts`
(`sendEventQuick`) races sends against a 1.5s deadline (late sends still
deliver), and panel saves now land back on the refreshed detail card
with a "Saved" toast instead of closing silently. Operational note: the
globe extraction pipeline needs the Inngest dev server on 8288
(`npx inngest-cli@latest dev`); events sent while it's down are lost
(warn-logged only) — the pin re-extracts on its next save. Also fixed a
self-inflicted investigation error: `memory_revisions` keys revisions by
`source_memory_id`, NOT `memory_id` — supabase-js returns empty (not an
error surfaced) when filtering a nonexistent column if you don't check
`error`; always check it.

**Workflow rule (bug hit 2026-06-10):** never run `npm run build` while
Andy's dev server is live — both write `.next/`, and the prod build
clobbers the dev chunk cache (symptom: dynamic-import pages hang on
their loading state, e.g. /globe stuck on "Spinning up your globe…").
Fix is kill dev server → `rm -rf .next` → restart. To verify a build,
either ask/check first (`lsof -iTCP:3001 -sTCP:LISTEN`) or rely on
`tsc --noEmit` + the dev server's own compile output instead.

**Class-of-bug note (repeat of the 4b lesson, new variant):** the first
extraction-proof run failed because the "skip path" fixture fell back to
*another fixture's* memory id (`bare.memory_id ?? rich.memory_id`) when
the bare pin had none. Lesson: when a fixture's field can legitimately be
NULL, never paper over it with a fallback to a sibling fixture — probe
with an explicitly nonexistent id instead.

**Slice 2 remaining/deferred:** the spec's separate "small on-globe image
overlay card" was folded into the detail card (one surface for MVP).
Ghost-text guidance (§6.1) had already shipped in Slice 1's modal.
**Next: Slice 3 (place types) or Slice 5+ (sidekick context mode).**

## How to apply

When starting work on Step 6 or Step 7, this is the file to read first. It captures the actual state of the codebase and the decisions that aren't documented elsewhere. Cross-reference `LC_Development_Sequence.md` for the canonical step definitions.
