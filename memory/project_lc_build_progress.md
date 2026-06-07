---
name: Project: LC build progress — May 2026 implementation phase
description: What's been built so far in the Claude Code implementation of Life Chronicle. Step-by-step state from Step 1 (scaffold) through Step 5 (interview API). Captures decisions made during build that aren't in the PRD.
type: project
---

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
| 7 | Entity Agent name matching uses exact + substring containment only, no edit distance. Reproduced 2026-05-22: paste of "Leola Lapidus" (typo of canonical "Leola Lapides") created a duplicate entity AND queued a spurious merge proposal to the unrelated "Leo" entity (because "Leo" is a substring of "Leola Lapidus"). Two real failure modes — missed typos and false-positive substrings. Replace containment-only with Levenshtein or Jaro-Winkler scoring; require minimum length ratio on substring matches | 6f (with Review Queue feedback loop) or Phase 2 | #38 |
| 8 | Orchestrator should catch near-duplicate entities *in the moment* using Layer B context, rather than producing a Review Queue backlog of every fuzzy match. Andy's framing 2026-05-22: "discrepancies should be corrected in real time." Implementation: system prompt directs the orchestrator to scan Layer B for near-matches before letting extract_entities create duplicates; the proposal card UX in 6f surfaces a two-option "link existing vs create new" choice in-flow. Complementary to #38 (orchestrator = smart frontline; Entity Agent algorithm = rigid backstop) | 6f | #39 |

These are the kind of items that vanish in chat history if they're not captured in the task list AND mirrored to durable memory. This subsection is the durable record; the task list is the actionable surface. Both must move together — when one of these tasks is closed, the matching row here gets a `✅` and a one-line note on what was done.

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

## How to apply

When starting work on Step 6 or Step 7, this is the file to read first. It captures the actual state of the codebase and the decisions that aren't documented elsewhere. Cross-reference `LC_Development_Sequence.md` for the canonical step definitions.
