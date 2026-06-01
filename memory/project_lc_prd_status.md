---
name: Project: LC PRD and schema — current state
description: PRD v1.1, schema v1.4, build phase active (Steps 1-5 complete as of 2026-05-10). Single source for current document versions and build status.
type: project
---

## Status as of 2026-05-10

PRD authored, schema deployed, build phase active. Steps 1–5 of `LC_Development_Sequence.md` complete; Step 6 (Tagger + Entity Agents) is next.

## Document versions

| Document | Version | Location |
|---|---|---|
| PRD | v1.1 | `documentation/Life_Chronicle_PRD.md` (markdown canonical since 2026-05-31; .docx archived under `documentation/archive/`) |
| Schema | v1.4 | `documentation/schema_v1.sql` (deployed via `supabase/migrations/`) |
| Architecture | Parts I–XVI | `documentation/DB_Architecture_Design_v1.md` |
| Development Sequence | v1.0 | `documentation/LC_Development_Sequence.md` |
| Access Cards | working draft | `documentation/access_cards_requirements.md` |
| Reminiscence (The Stroll) | spec | `documentation/feature_reminiscence_mode.md` |

## What was settled in PRD v1.1 (May 2026)

- §7.3 Inngest decision: event taxonomy (6 events), scheduled jobs, tier strategy (Hobby $0 → Pro $75/mo at 400–500 active users)
- §8.7 Single Post Share: token-in-URL, no login, privacy context audit via card_id (defaults to Private), owner controls (expiry/revoke), auto-isolated memory protection
- §4 Feature Scope: Single Post Share added to MVP column
- Phase 0 reset to three stages (per prd_readiness Decision 3 amendment): Temporal Skeleton → Entity Seed → Topic Map. Chapter naming removed.
- MVP synthesis pair: place portrait (with temporal transit animation) + Life's Players (lifes_cast). Chapter narrative deferred to Phase 2.

## Schema v1.4 highlights

- **Privacy model: Access Cards only.** The `privacy_tier` ENUM type and per-row `privacy_tier`/`tier_locked` columns on `memories`, `entities`, `relationships`, `media`, `syntheses` were removed in v1.4 (2026-05-20). The deployed migration `supabase/migrations/20260505000000_initial_schema.sql` was already clean; `documentation/schema_v1.sql` is now synced to match. The `compute_synthesis_tier()` / `trg_set_synthesis_privacy_tier()` / `cascade_synthesis_tier_on_memory_change()` helpers and their triggers were retired alongside.
- **Access Cards tables:** `cards`, `contacts`, `card_holders`, `record_card_grants`, `synthesis_visibility_cache`, `card_audit_log`, `access_log`. Five tier names live on as `system_code` values of the five system cards pre-seeded for every user.
- `memory_shares.share_token` (UUID UNIQUE), `expires_at`, `is_revoked`, `revoked_at`, `view_count`, `last_viewed_at`
- Partial index on `share_token WHERE is_revoked = false`
- Stroll: `stroll_sessions`, `reflections`, `memory_revisions`; `triggered_by_memory_id`, `triggered_in_stroll_session`, `capture_mode` on `memories`
- Geospatial: PostGIS, `geom GEOGRAPHY(GEOMETRY, 4326)`, `place_subtype` enum, `life_journey` view, `life_journey_geojson()` function
- **`entity_confirmation_needed`** as a new `review_queue.item_type` value (migration `20260520182927_entity_confirmation_queue.sql`, 2026-05-20). Tap-to-confirm pattern for new person entities; surfaced in the Review Queue UI (Step 6g).

## Build state

See `project_lc_build_progress.md` for the detailed step-by-step state and the build decisions that aren't captured in the PRD.

Short version: free-form memory capture works end-to-end at `/interview`. User can dictate via Wispr Flow; Claude Sonnet 4.5 conducts the interview and extracts memories via a `record_memory` tool. Phase 0 onboarding UI not yet built — clearly labeled as such in the UI.

## Critical invariants (also in `CLAUDE.md`)

- `memories.content_raw` is NEVER modified — corrections via `memory_revisions`
- `viewer_can_access()` returns FALSE until fully implemented — RLS not yet activated
- Privacy filter MUST run BEFORE pgvector similarity in all Search Agent queries
- pgvector on Supabase only — no Neo4j, no separate vector store
- Phase 0 is **three stages** (chapter naming was removed 2026-04-30)

## Remaining open decisions (non-blocking)

- OQ-2: Life's Players output format (hybrid JSON+prose recommended)
- OQ-4: Globe visualization library (Cesium.js vs Mapbox GL JS — validate before Step 10)
- OQ-5 (PRD): Passkeys primary auth — currently using email+password for the alpha
