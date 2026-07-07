---
name: Reference: LC Development Sequence
description: Pointer to the 15-step ordered implementation plan in documentation/LC_Development_Sequence.md. Updated 2026-07-07 with current build progress (Step 7 complete through Slice 7).
type: reference
---

## Document

`documentation/LC_Development_Sequence.md`

## Current build progress (updated 2026-07-07)

| Step | What | State |
|---|---|---|
| 1 | Supabase project + Next.js scaffold + Supabase client wiring | ✅ Complete |
| 2 | Schema deployment + seed data + on-user-created Edge Function | ✅ Complete |
| 3 | Inngest setup + 7 stub agent functions (9 functions total counting synthesis triggers) | ✅ Complete |
| 4 | Auth UI (sign-up, sign-in, middleware route protection, callback) | ✅ Complete |
| 5 | Capture Agent + Interview API + free-form interview UI | ✅ Complete |
| 6 | **Capture Assistant + Orchestrator + Tagger + Entity Agents** (expanded). Substeps 6a–6i per `feature_capture_assistant.md` v1.1. Includes Inngest event rename `phase0/stage.completed` → `chronicle/threshold.reached`. | ✅ Complete (6a–6h shipped) |
| 7 | **Residential strand (Life Globe onboarding)** — phased per `decision_step7_slice_phasing_2026-06-05.md`, then resequenced by the 2026-06-22 roadmap. | ✅ **Complete 2026-07-07.** Slices 1/2/4a/4b, globe-legibility 3/3.5/3.6, Slice 6 (Entity View + context), Journey J1–J5, Hopper 5a+5b, Slice 7 (Person page + Life's Cast). The roadmap's slice list is exhausted. |
| 8 | Entity strand UX (feature spec — capture-assistant-prompted entity onboarding) | **Partially absorbed** by Slices 6+7 (Entity View, person pages, hopper, person-anchored capture). The *orchestrated strand* — the assistant proactively prompting entity work off chronicle state — has no spec yet. |
| 9 | Topic strand UX (forthcoming feature spec — prompted by capture assistant after entity content accumulates) | Pending |
| 10 | ABSORBED INTO STEP 7 — Life Globe is the input surface, not a downstream synthesis | — |
| 11 | Life's Players (lifes_cast) synthesis + rendering | **Partially delivered** by Slice 7.2 (deliberate promotion flag + /entities Cast grouping). The synthesis artifact + dedicated rendering remain. |
| 12 | Single Post Share (token-in-URL, enrichment invitation UX) | Pending |
| 13 | Access Cards UI + viewer_can_access() full implementation + RLS activation + private notes column filter | Pending |
| 14 | Search Agent + semantic search UI | Pending |
| 15 | Review Inbox UI | Pending (note: Step 6 ships a working Review Queue for capture-assistant proposals; Step 15 generalises and polishes it) |

For step-by-step state of what's actually built, see `project_lc_build_progress.md`.

## Architectural invariants (must not be violated)

- `memories.content_raw` is NEVER modified — corrections via `memory_revisions` only
- `memories.private_notes` is owner-only — filtered out by `viewer_can_access()` for non-owner viewers regardless of Access Card grants
- `viewer_can_access()` returns FALSE until full body implemented — do NOT activate RLS until then
- Privacy filter MUST run BEFORE pgvector similarity in all Search Agent queries
- No Neo4j, no separate vector store — pgvector on Supabase only
- Phase 0 is **three parallel strands** (residential, entity, topic) — not sequential stages. No user-declared stage completion; system detects data thresholds and fires `chronicle/threshold.reached`. (Chapter naming removed 2026-04-30; sequential staging removed 2026-05-17.)
- Orchestrator's three-layer prompt structure: generic system prompt (user-agnostic) + per-user cached digest + submission. Designed for multi-tenant safety and prompt caching cost efficiency.

## How to apply

When starting a build session for the next step, read the relevant step's "What to build / Depends on / Acceptance criteria" in `LC_Development_Sequence.md`, then read `project_lc_build_progress.md` for current state. Don't issue the original Step prompts verbatim now that several are complete — adapt to the actual codebase state.
