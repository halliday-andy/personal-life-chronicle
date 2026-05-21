---
name: Project: LC Capture Assistant + Orchestrator Agent
description: The always-present input surface for the chronicle. Orchestrator Agent (Claude Sonnet 4.5 with broad chronicle context) receives every submission, reasons about placement, and delegates to dual-mode sub-agents. Approved 2026-05-17.
type: project
---

## Status

Spec approved 2026-05-17. Canonical: `documentation/feature_capture_assistant.md` v1.1. To be built as `LC_Development_Sequence.md` Step 6 (substeps 6a–6i).

## Core idea

A persistent chat affordance — floating button + slide-out panel on desktop, FAB + bottom sheet on mobile — accepts any input the user wants to give it: typed, dictated (Wispr Flow), pasted, future file-uploaded. The Orchestrator Agent receives the input, reasons about what it is and where it belongs in the chronicle, and proposes actions visible to the user as cards with reasoning, confidence, and accept/adjust/decline controls. Nothing reaches the chronicle canon without explicit user finalisation.

## Architectural elements

**The Orchestrator Agent** (new architectural layer):
- Claude Sonnet 4.5, synchronous on each submission
- Three-layer prompt structure for multi-tenant safety and cost efficiency:
  - Layer A: generic system prompt (version-controlled, user-agnostic)
  - Layer B: per-user chronicle context digest (cached via Anthropic prompt caching, regenerated on chronicle changes)
  - Layer C: submission + active-screen context (fresh per call)
- Tool use over sub-agents (Tagger, Entity, Search) + non-memory tools (`propose_interview`, `propose_research_reminder`, `flag_for_private_notes`, `add_to_backlog`)
- Post-MVP tools anticipated: `search_external_media`, `propose_card_publish`, `ingest_notion_database`, `propose_source_document`, `propose_correction_chain`

**Dual-mode sub-agents:**
- Tagger and Entity Agents are designed from day one as both Inngest async listeners AND inline-callable tools
- Orchestrator uses inline mode for immediate response; sub-agents do deeper async passes after `memory/ingested` fires
- Future agents (Temporal, Source Document) integrate the same way

**Per-user chronicle context compaction:**
- Background "context digester" job (owned by Planner Agent) produces a 1–3k-token digest of the user's chronicle state
- Stored in `user_chronicle_digests` table (new), hash-invalidated on chronicle changes
- Loaded as Layer B of the orchestrator's prompt, marked for caching
- Cost target with caching: ~$0.005 per cache-hit submission, vs ~$0.02–$0.08 cache-miss

## Entity confirmation flow — tap-to-confirm pattern (added 2026-05-20)

Parallel to face recognition's "Is this Alice?" tap-to-confirm. When the Entity Agent creates a new `person` entity, it writes a `review_queue` row with `item_type='entity_confirmation_needed'`. The Review Queue UI (substep 6g) surfaces these as confirmation cards with Confirm / Edit name / Add aliases / This isn't a person / Merge with… actions. The migration adding this enum value (`20260520182927_entity_confirmation_queue.sql`) was applied during Step 6a, and the 5 existing person entities (Leola Lapides, Bob, Bob Katz, Leo, Lori) were backfilled via `scripts/backfill-entity-confirmations.mjs`. Scope at MVP: persons only — places get verification through the Residential Globe (Step 7), other types are post-MVP. Every confirmation makes the next memory's extraction more accurate via the aliases array.

Canonical: `documentation/feature_capture_assistant.md` §10.5.

## The unified Review Queue (key UX commitment)

All draft cards — from quick capture, from bulk paste, from future file uploads, from future Notion sync, from share-comment contributions — land in **one** Review Queue with `item_type` filter chips. The card lifecycle is **Draft → Finalised**:

- Drafts do NOT appear on the timeline or globe
- Finalised cards do
- The orchestrator always creates Drafts; the user always promotes
- Promotion appends rather than overwrites `content_raw` (Raw Vault sanctity preserved)

Earlier separation between "stubs from quick capture" and "backlog from bulk paste" was collapsed — same artefact, same workflow, regardless of source.

## Private notes (new content layer)

`memories.private_notes TEXT` — owner-only commentary on a card, **filtered out of non-owner projections via RLS** regardless of how the card is shared via Access Cards. Andy's specific concern (2026-05-17): a card shared via a Family card may still contain things the user wants to keep private — honest assessments, social-context reminders, second thoughts. This is a separate layer below the Access Cards visibility model, not another card tier.

UI: collapsed section labelled "Private notes — for your eyes only" on every memory card, lock icon, never visible to non-owners.

## Notion integration (post-MVP pin)

Two future bidirectional uses, deferred but anticipated in the architecture:

1. **Ingest:** Specialised "Notion Ingest" sub-agent pulls pages from a connected Notion scratchpad database and routes draft cards through the orchestrator to the Review Queue.
2. **Publish:** Finalised cards can be optionally published to a connected Notion database as a static archival/distribution surface.

Distinction from the in-app Share function (Step 12): Notion publish is static/read-only; Life Chronicle share invites commentary and refinement from the people associated with the event.

## Build state

Step 6 (substeps 6a–6i) is next in the build sequence. Builds the capture assistant + orchestrator + dual-mode sub-agents together, since they're designed as one architectural unit. After Step 6, Step 7 (residential globe — see `project_lc_capture_assistant`'s companion `feature_residential_globe_onboarding.md`) reuses the capture assistant as the sidekick chat in context-aware mode.

## How to apply

When working on Step 6, read the canonical spec first. When working on later steps that involve the orchestrator (Step 7 sidekick, future Step 8 entity strand, future Step 9 topic strand), remember:
- The orchestrator is the only surface that talks to the user
- Sub-agents have inline tools the orchestrator can call synchronously
- All proposals route to the unified Review Queue
- Private notes are owner-only, period — RLS enforces this
- Prompt caching and dream-compaction are architectural defaults, not optimisations to add later
