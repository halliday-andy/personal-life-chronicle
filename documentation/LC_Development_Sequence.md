# Life Chronicle — MVP Development Sequence for Claude Code

*Created May 2026. This document sequences every MVP implementation step in dependency order and provides the first Claude Code prompts to initiate the build. Hand this document to a Claude Code session to establish context before issuing any prompt.*

---

## How to use this document

Each step below has:
- **What to build** — the deliverable
- **Depends on** — what must be complete first (gates this step)
- **Acceptance criteria** — how to know the step is done
- **Prompt** — the exact Claude Code prompt to issue (steps 1–3 provided in full; later steps have abbreviated prompts)

Read the full PRD first: `documentation/Life_Chronicle_PRD.md`
Read the schema: `documentation/schema_v1.sql`
Read the architecture: `documentation/DB_Architecture_Design_v1.md`

---

## Tech Stack Decision (confirm before Step 1)

| Layer | Decision | Notes |
|---|---|---|
| Database | PostgreSQL + pgvector on Supabase | Decided |
| Auth | Supabase Auth — Passkeys primary, magic link fallback | Decided |
| Agent orchestration | Inngest | Decided — architecture doc Part XVI |
| Backend functions | Supabase Edge Functions (Deno/TypeScript) | Recommended |
| Frontend framework | **Next.js 14 (App Router) + TypeScript** | Recommended — confirm before Step 1 |
| Styling | Tailwind CSS + shadcn/ui | Recommended |
| Globe rendering | Cesium.js or Mapbox GL JS (TBD — PRD OQ-4) | Validate both before Step 13 |

---

## Implementation Steps

### FOUNDATION — Steps 1–4
*No user-facing features. All subsequent steps depend on the foundation being complete.*

---

### Step 1 — Supabase Project Setup + Schema Deployment

**What to build:**
- New Supabase project created
- `schema_v1.sql` deployed and verified (all tables, indexes, types, functions)
- Supabase Auth configured (Passkeys + magic link)
- Environment variables documented in `.env.example`
- Next.js project scaffolded with Supabase client wiring

**Depends on:** Nothing. This is step zero.

**Acceptance criteria:**
- `supabase db push` completes without errors
- All tables in `schema_v1.sql` exist in Supabase dashboard
- `uuid_generate_v4()` and `pg_trgm` extensions enabled
- `pgvector` extension enabled
- A test user can sign up via magic link
- Environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` set and validated

**First Claude Code prompt:**

```
I'm building Life Chronicle, a personal memory chronicle application. I need you to set up the project foundation.

Tech stack: Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL + pgvector + Auth).

Please:
1. Scaffold a new Next.js 14 project with TypeScript and Tailwind CSS in the current directory
2. Install and configure the Supabase client (@supabase/supabase-js, @supabase/ssr)
3. Create a Supabase client utility (lib/supabase/client.ts, lib/supabase/server.ts, lib/supabase/middleware.ts) following the Supabase Next.js SSR pattern
4. Create a .env.local with placeholder values for: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
5. Create a .env.example documenting all required variables
6. Add a basic middleware.ts that refreshes the Supabase auth session on every request
7. Create a simple health-check route at /api/health that returns { status: "ok", db: true } after confirming Supabase connectivity

The full database schema is in documentation/schema_v1.sql — do not apply it yet, just set up the project wiring. I'll walk through schema deployment in the next step.
```

---

### Step 2 — Schema Deployment + Seed Data

**What to build:**
- `schema_v1.sql` applied to Supabase via migration
- `viewer_can_access()` function stub confirmed present and returning FALSE
- Seed script: 10 life dimensions inserted into `dimensions` table
- Seed script: 5 system cards inserted per user (triggered on user creation)
- Seed script: interview question bank populated in `interview_questions` table

**Depends on:** Step 1 complete (Supabase project + Next.js wiring)

**Acceptance criteria:**
- All ~50 tables present in Supabase
- `SELECT viewer_can_access('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'memory', '00000000-0000-0000-0000-000000000003'::uuid);` returns `false`
- `SELECT count(*) FROM dimensions;` returns 10
- `SELECT count(*) FROM interview_questions;` returns > 0
- A Supabase Edge Function `on-user-created` exists that seeds 5 system cards on new user signup

**Prompt:**

```
The Supabase project is set up (Step 1 complete). Now deploy the schema and seed data.

1. Apply documentation/schema_v1.sql as a Supabase migration. Check for any dependency-ordering issues (types before tables, etc.) and fix them.

2. After schema deployment, verify the viewer_can_access() function stub exists and returns FALSE by default. This is critical — RLS will be activated later and must not accidentally grant access. Do not modify the stub yet.

3. Create a seed script at supabase/seed.sql that inserts:
   - The 10 life dimensions (from documentation/DB_Architecture_Design_v1.md Part IV — WisdomTopicSort taxonomy): Self & Identity, Relationships & Family, Career & Vocation, Health & Body, Home & Place, Learning & Mind, Beliefs & Values, Creative & Play, Community & World, Transitions & Endings. Each with is_sensitive = false except Health (true) and Beliefs (true).
   - ~5 sample interview questions per dimension phase (Phase 0 temporal, Phase 0 entity, general collection).

4. Create a Supabase Edge Function at supabase/functions/on-user-created/index.ts that fires on auth.users INSERT (via database webhook) and seeds 5 system cards for the new user: Private (system_code: private), Close Friends (close_friends), Family (family), Professional (professional), Public (public). All with is_system = true.

The schema is the source of truth. Reference documentation/schema_v1.sql for exact table/column names.
```

---

### Step 3 — Inngest Setup + Event Infrastructure

**What to build:**
- Inngest SDK installed and wired into Next.js
- Inngest client configured (`lib/inngest/client.ts`)
- `inngest.serve()` handler at `/api/inngest`
- Six named event types defined as TypeScript types
- Stub (no-op) Inngest functions created for each of the 7 agents so the event wiring can be tested before agent logic is written
- Local dev: Inngest Dev Server confirmed working with `npx inngest-cli@latest dev`

**Depends on:** Step 1 (Next.js project), Step 2 (schema + seed)

**Acceptance criteria:**
- `npx inngest-cli@latest dev` shows all 7 stub agent functions registered
- Sending a test `memory.ingested` event via Inngest Dev Server reaches the Tagger Agent stub and logs a confirmation
- No real LLM calls yet — stubs just log event payloads and return

**Prompt:**

```
Steps 1 and 2 are complete. Now set up the Inngest agent orchestration infrastructure.

Install: inngest (npm)

1. Create lib/inngest/client.ts — the Inngest client instance, named "life-chronicle"
2. Create app/api/inngest/route.ts — the serve handler using Next.js App Router
3. Create lib/inngest/events.ts — TypeScript type definitions for all 6 named events:
   - memory.ingested: { memory_id: string, user_id: string }
   - synthesis.invalidated: { synthesis_id: string, synthesis_type: string, user_id: string }
   - phase0.stage_completed: { stage: 1 | 2 | 3, user_id: string }
   - entity.merged: { survivor_id: string, merged_id: string, user_id: string }
   - review_queue.item_added: { item_id: string, item_type: string, user_id: string, priority: number }
   - user.period_confirmed: { period_id: string, user_id: string }

4. Create stub Inngest functions for all 7 agents in lib/inngest/agents/:
   - capture-agent.ts (listens to: fired manually from capture API)
   - tagger-agent.ts (listens to: memory.ingested)
   - entity-agent.ts (listens to: memory.ingested)
   - planner-agent.ts (cron: "0 3 * * *")
   - synthesis-agent.ts (listens to: synthesis.invalidated, phase0.stage_completed; cron: "0 2 * * *")
   - search-agent.ts (listens to: triggered via function call, not event)
   - timeline-agent.ts (listens to: memory.ingested)

   Each stub should: log the event payload, write a record to assumption_log with assumption_type='agent_stub_invoked', and return { status: 'stub', agent: '<name>' }.

5. Export all agent functions in lib/inngest/index.ts and import them into the serve handler.

Reference: documentation/DB_Architecture_Design_v1.md Part XVI for event taxonomy. Use the exact event names specified there.
```

---

### Step 4 — Authentication UI

**What to build:**
- Sign-up / sign-in page with Passkeys (WebAuthn) as primary, magic link as fallback
- Auth middleware protecting all `/app/*` routes
- Post-auth redirect to onboarding (Phase 0) for new users, home for returning users
- User profile stored in `users` table on first sign-in

**Depends on:** Steps 1–2

**Acceptance criteria:**
- New user can register with a passkey (tested on Chrome + Safari)
- Existing user can sign in with passkey or magic link
- Unauthenticated request to `/app/*` redirects to `/sign-in`
- New user signup triggers on-user-created Edge Function and seeds 5 system cards

---

### CAPTURE LAYER — Steps 5–6

---

### Step 5 — Capture Agent + Interview API

**What to build:**
- `POST /api/interview/message` — accepts user utterance, calls LLM, returns agent reply
- Capture Agent Inngest function (replaces stub): on confirmed memory extraction, INSERT to `memories` (content_raw only), INSERT to `interview_sessions`, emit `memory.ingested`
- The Capture Agent DB role is INSERT-only on `memories` and `interview_sessions` — enforce via Supabase RLS policy
- Interview session state management (session_id, turn history, current stage)

**Depends on:** Steps 2 (schema), 3 (Inngest), 4 (auth)

**Acceptance criteria:**
- User can send a text message, receive an AI response
- A confirmed memory results in a `memories` row with non-null `content_raw`
- `memory.ingested` event appears in Inngest Dev Server
- No UPDATE or DELETE to `memories` is possible via the Capture Agent's DB role

---

### Step 6 — Capture Assistant + Orchestrator + Tagger + Entity Agents

**Canonical spec:** `documentation/feature_capture_assistant.md` v1.1 (approved 2026-05-17).

**Expanded from the original "Tagger + Entity Agents" framing.** This step now builds the unified capture surface (the always-present orchestrator-driven chat) AND the lower-level sub-agents. Designing them together is the right shape because the orchestrator uses the sub-agents as both Inngest event listeners AND inline tools.

**Substeps (build in order, each independently testable):**

| Substep | What |
|---|---|
| 6a | Tagger and Entity sub-agents as dual-mode functions (Inngest listener on `memory/ingested` + synchronous inline tool exported for orchestrator tool use). Both write to `assumption_log` for every inference. |
| 6b | Orchestrator agent (`lib/agents/orchestrator.ts`) — Claude Sonnet 4.5 with three-layer prompt structure (generic system + cached per-user digest + submission). Tool definitions for all MVP tools in spec §4.3. Prompt caching enabled via Anthropic `cache_control`. |
| 6c | `user_chronicle_digests` table + background context-digester job (owned by Planner Agent) that produces the per-user 1–3k-token digest on schedule and on chronicle-change triggers. |
| 6d | `capture_submissions` table + migration; new enum values per spec §10.2; `memories.private_notes` column per spec §10.3. |
| 6e | Capture assistant UI — floating button + slide-out panel (desktop); FAB + bottom sheet (mobile); ⌘K shortcut; conversational priming opener; optional "tell me about this first" free-text field. Persists across navigation. |
| 6f | Proposal cards UI with reasoning, confidence, Accept / Adjust / Decline / Defer actions. Inline "move this passage to private notes" toggle per OQ-CA-10. |
| 6g | Unified Review Queue tab on the dashboard — filterable by `item_type`, source, date range. Card detail view with verbatim text, orchestrator reasoning, inferred metadata, edit controls. Batch actions. The card lifecycle is Draft → Finalised; drafts do NOT surface on timeline/globe. |
| 6h | Private notes UI section on every memory card (collapsed by default, lock icon, "for your eyes only"). RLS-level filter so non-owner viewers never see the column. |
| 6i | Mobile FAB + bottom sheet polish; thread state persistence across opens. |

**Depends on:** Step 5 (interview API + memories table) complete.

**Acceptance criteria:** Per spec §12. Summary:
- Capture panel works on desktop and mobile; accepts typed, dictated (Wispr Flow), and pasted content
- Orchestrator's three-layer prompt structure verified (system prompt is user-agnostic, per-user digest is cached, submission is fresh)
- All submissions create `capture_submissions` rows with lineage to downstream memories
- Short single-recollection submissions create a Draft and queue it for finalisation (never directly to timeline)
- Bulk-paste submissions segment into multiple Drafts queued together
- Low-confidence entities surface as proposal cards for user clarification
- Contradictions flagged in proposal cards (full constraint-graph in Phase 2)
- Detected attribution to other people defaults the card to Private visibility with alert
- Private notes are owner-only via RLS column-level filtering
- Tagger + Entity sub-agents callable both as Inngest async listeners and as inline tools
- Per-user digest job runs and produces a cached prompt block

**Note on Inngest event rename:** Step 6 renames the obsolete `phase0/stage.completed` event to `chronicle/threshold.reached` and updates the stub synthesis agents (built in Step 3) to listen on the new event name.

---

### PHASE 0 ONBOARDING — Step 7 + forthcoming strand specs

**Canonical reframe (2026-05-17):** Phase 0 is **three parallel strands**, not three sequential stages. The user engages with strands organically through the capture assistant (Step 6); the system internally tracks data accumulation and ships artifacts when thresholds are met. No user-declared completion gates. See `memory/project_lc_prd_readiness.md` Decision 3 (amended 2026-05-17) and `memory/project_lc_ontology_bootstrap.md`.

The old Steps 7, 8, 9 (Phase 0 Stages 1, 2, 3) and Step 10 (Life Globe synthesis) are reorganised as follows:

---

### Step 7 — Residential strand (Life Globe onboarding)

**Canonical spec:** `documentation/feature_residential_globe_onboarding.md` v1.1 (approved 2026-05-17).

**Absorbs the old Step 10.** The Life Globe is not a downstream synthesis — it is the input surface. The user pins places they have lived directly on a Mapbox globe; the residential temporal spine builds as they place pins. The artifact and the act of building it are the same thing.

**Substeps (build in order):**

| Substep | What |
|---|---|
| 7a | Mapbox base + pin placement + reverse geocoding + entity creation (`entities` with `type='place'`, `geom`, parent chain from reverse-geocoding) |
| 7b | Modal with rotating ghost-text guidance + free-form text capture + Claude extraction job (extracts `residence_type`, `move_reason`, mentioned people/orgs as entity stubs, temporal hints) |
| 7c | Sidekick chat integration — the capture assistant from Step 6 in context-aware "residential pin placement" mode, with suggestive prompting per pin |
| 7d | Side trips (`lived_briefly_at`) and vacation homes (`owned_residence_at`) — distinct visual styling per type |
| 7e | Drag-to-refine (pin precision = position at save time) + drag-arc-to-insert (sequence correction) |
| 7f | Pin clustering / zoom-expand for dense pin areas; side-trip visibility filter toggle |
| 7g | Intra-metro relocation handling (proximity at city level vs. building level; new-entity vs. returning-residence prompt) |
| 7h | Timeline UI — chronological card list, expandable metadata strip, multi-select, PDF export, search interface, bidirectional cross-links with globe |
| 7i | Mobile adaptation (coarse pin placement, deferred refinement on desktop) |
| 7j | Data-threshold detection emits `chronicle/threshold.reached` events; Synthesis Agent generates initial `place_portrait` entries when thresholds met |

**Depends on:** Step 6 (capture assistant + orchestrator + sub-agents). The sidekick chat in 7c IS the capture assistant in context-aware mode.

**Acceptance criteria:** Per spec §11.

---

### Step 8 — Entity strand UX (forthcoming spec)

**Status:** Forthcoming feature spec — placeholder for the entity-seeding UX that the capture assistant prompts toward after residential pins exist.

**Scope:** Conversational entity-seeding interactions for the key people, institutions, and organisations in the user's life. Prompted by the orchestrator based on chronicle state (typically after ≥3 residential pins are placed). Produces entity proposals for the Review Queue (the same Step 6 queue).

**Depends on:** Step 6 (capture assistant + Review Queue), Step 7 (so the orchestrator has scaffold to prompt against).

---

### Step 9 — Topic strand UX (forthcoming spec)

**Status:** Forthcoming feature spec — placeholder for the topic/dimension-confirmation UX.

**Scope:** Interaction to confirm which life dimensions are active for the user and what themes recur across their chronicle. Prompted by the orchestrator after enough memory content exists for theme detection. Maps the 10 life dimensions to the user's actual preoccupations; flags sensitive dimensions.

**Depends on:** Step 6 (capture assistant), Step 7 + Step 8 (data accumulated enough for theme inference).

---

### Step 10 — ABSORBED INTO STEP 7

The original Step 10 ("Life Globe Synthesis + Rendering") is absorbed into Step 7 per the residential globe spec. The Life Globe is the input surface, not a synthesis pass; `place_portrait` entries are generated per pinned place when data thresholds are met (Step 7j).

---

### Step 11 — Life's Players Synthesis + Rendering

**What to build:**
- Synthesis Agent function: on `phase0.stage_completed` stage 3, generate `lifes_cast` synthesis
- Entity significance model: `stage_score = role_significance × log1p(memory_density)` per architecture doc Part XV
- Rendering: life-stage accordion, player cards, entry/exit visualization, text-share action

**Depends on:** Steps 6 (entities), 9 (Phase 0 Stage 3 complete)

**Acceptance criteria:**
- `lifes_cast` synthesis generated within 60 seconds of Phase 0 Stage 3 completion
- At least 1 cast member rendered if ≥3 person entities exist
- Synthesis marked `is_current = false` when any entity is merged (invalidation trigger working)

---

### SHARING — Step 12

---

### Step 12 — Single Post Share

**Purpose:** The MVP use case is collaborative memory enrichment — Andy shares a specific recollection with someone who was present at that event, and captures their perspective as potentially additive material. This is an alpha hypothesis test: does sharing a memory with a participant elicit useful additive detail? The shared view must be designed to invite this, not just display content.

**What to build:**
- `POST /api/share` — creates `memory_shares` row with `share_token` UUID, optional `expires_at`, returns share URL
- Public route `/share/[token]` — no auth required; looks up non-revoked non-expired token, renders enrichment-invitation view (see UX note below)
- Share sheet UI on every memory card: Copy Link, optional expiry picker (7 days / 30 days / 1 year / Never)
- Share management screen (`/app/shares`): list active shares, view_count, last_viewed_at, revoke button
- `DELETE /api/share/[id]` — sets `is_revoked = true`, `revoked_at = NOW()`
- View counting: increment `view_count` and update `last_viewed_at` on each token-authenticated view (non-blocking, fire-and-forget)
- Auto-isolated memories: Share button disabled with tooltip "This memory is private-locked. Remove auto-isolation to share."
- **Response routing:** every `share_comments` INSERT from the shared view must also INSERT a `review_queue` row with `item_type = 'contribution_review'`, `priority = 2`, so the owner sees it in the Review Inbox (Step 15)

**UX note — the shared view is an enrichment invitation, not a passive display:**
The page should open with an invitation framing: "[Owner name] shared a memory and would love your perspective." Response field should appear prominently — immediately after the memory content, not at the bottom. Prompt text should nudge toward additive responses: "What do you remember from this?" or "Was anything missing?" rather than generic "Leave a comment." Name and email are optional. After submission: "Your response has been sent to [owner name]."

**Depends on:** Steps 2 (schema/seed), 4 (auth), 5 (memories exist)

**Acceptance criteria:**
- Share URL works in incognito window (no cookies, no login)
- Expired link (past `expires_at`) returns "This share has expired"
- Revoked link returns "This share has been removed"
- Auto-isolated memory shows disabled Share button
- `view_count` increments on each page load of a valid share URL
- Submitting a response via the shared view creates both a `share_comments` row AND a `review_queue` row with `item_type = 'contribution_review'`
- Review Inbox (Step 15) renders contribution_review items distinctly from agent-generated review items

---

### ACCESS CARDS UI — Step 13

---

### Step 13 — Access Cards Management UI

**What to build:**
- Contact management (`/app/contacts`): add/edit contacts with email and display name
- Card holder assignment: assign contacts to system cards (Private, Close Friends, Family, Professional, Public)
- Per-memory card toggle: "visible through Family card" / "hidden from Family card" writes to `record_card_grants`
- "View as holder" mode: owner selects a contact and sees exactly what that contact's cards grant them
- `viewer_can_access()` full implementation (replaces stub) + RLS activation on content tables

**Depends on:** Step 2 (cards seeded), Step 4 (auth)

**Critical:** Do not activate RLS until `viewer_can_access()` is fully implemented and tested. The function stub returns FALSE — activating RLS with the stub would lock all users out of their own content.

---

### SEARCH — Step 14

---

### Step 14 — Search Agent + Semantic Search UI

**What to build:**
- Embedding generation: on `memory.ingested`, generate pgvector embedding for `content_raw` and store in `memories.embedding`
- Search Agent: permission-first query ordering (RLS filter → metadata filter → pgvector similarity) — never reverse this order
- Search UI: `/app/search` with natural language input, results ranked by similarity

**Depends on:** Steps 6 (memories tagged), 13 (RLS active with viewer_can_access() working)

---

### REVIEW INBOX — Step 15

---

### Step 15 — Review Inbox UI

**What to build:**
- `/app/inbox` — renders `review_queue` items by priority and type
- Entity merge resolution: accept (runs merge, emits `entity.merged`), modify (edits entity name), reject
- Temporal constraint review: accept (triggers constraint propagation), reject
- Synthesis stale notification: accept (triggers regeneration via `synthesis.invalidated` event), dismiss
- Inbox badge count in main navigation

**Depends on:** Steps 6 (agents writing to review_queue), 11 (synthesis exists)

---

## First Three Claude Code Prompts (Ready to Issue)

The prompts for Steps 1, 2, and 3 are written in full above. Issue them in order.

Before issuing Step 1 prompt:
- Confirm the frontend framework (Next.js 14 recommended above)
- Have your Supabase project credentials ready (or let Claude Code scaffold them as placeholders)
- Point Claude Code to this file and to `documentation/Life_Chronicle_PRD.md` as context

**Command to give Claude Code before any prompt:**

```
Before we start building, read the following context documents:
1. documentation/Life_Chronicle_PRD.md — the full product requirements
2. documentation/schema_v1.sql — the complete database schema
3. documentation/DB_Architecture_Design_v1.md — architecture rationale and invariants
4. documentation/LC_Development_Sequence.md — this document; the ordered build plan
5. CLAUDE.md — standing instructions and architectural invariants that must not be violated

Key invariants that must not be violated under any circumstances:
- memories.content_raw is NEVER modified after creation. All corrections go through memory_revisions.
- viewer_can_access() must return FALSE until fully implemented. Do not activate RLS until the full function body is in place.
- Privacy filter (RLS/viewer_can_access) MUST run BEFORE any pgvector similarity search. Never reverse this.
- No Neo4j, no separate vector store. pgvector on Supabase only.

After reading, confirm you understand the architecture and ask if you have any questions before we begin.
```

Then issue the Step 1 prompt as written above.

---

## Notes for Later Steps

**Temporal Agent (Phase 2):** The schema tables (`temporal_constraints`, `temporal_resolution_queue`) are already in the schema. The Planner Agent's daily cron (Step 3 stub, built out in Step 5+) surfaces constraint opportunities. The full Temporal Agent implementation — constraint graph traversal, uncertainty envelope narrowing — is deferred to Phase 2 but should be kept in mind as the Planner Agent's review logic is written.

**The Stroll (Phase 2):** Reminiscence mode with three response pathways (A: adjacent stub, B: wisdom reflection, C: non-destructive revision). The `memory_revisions` table is in the schema. Build the revision pathway as an extension of the interview session UI.

**Eval loop:** The thumbs-up/down rating on synthesis artifacts (Life Globe, Life's Players) feeds the `synthesis_evals` mechanism. Wire this from day one — it's how synthesis quality is tracked over time.
