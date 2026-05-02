---
name: Life Chronicle — Access Cards framework decision
description: Decision direction April 2026 to replace 5-tier privacy_tier ENUM with user-defined Access Cards (named permission grants with scope rules, holders, and validity windows); pattern from Andy's prior contact-management work
type: project
originSessionId: b2a30b2d-fc2f-4ca5-bfaf-2f6dc2a43ae1
---
April 2026 decision direction (still in dialogue): replace `privacy_tier` ENUM with an Access Cards framework.

## Pattern origin
Andy worked on a contact-management permission architecture where the user creates a "card" populated with the level of visibility into various collections of data (personal and professional), then assigns the card to specific contacts. Possession of the card by a contact governs that contact's visibility into the user's collections. Cards can be time-banded and association-banded — e.g., a card granting access to a date range of entries tagged with a specific professional association.

## Core concept
A **card** is a named permission grant created by the chronicle owner. It defines a *scope* (what records it unlocks) and is held by zero or more *contacts*. The owner-viewer relationship is mediated entirely through card possession. Five system cards (Private, Close Friends, Family, Professional, Public) are pre-seeded for every user and emulate the legacy ENUM tiers; custom cards are user-created and unbounded.

## Key design decisions

- **Scope rules:** time band, user periods, life stages, dimensions, entities, places, explicit memory IDs (include and exclude). Within an axis: OR. Across axes: AND. Empty scope = grants all owner content.
- **Synthesis inheritance:** A synthesis is visible to a card holder iff every source memory is visible to that card. Computed and materialized in `synthesis_visibility_cache`.
- **Sensitive auto-isolation:** Renamed from "auto-lock to private". Sensitive-flagged memories receive `record_card_grants(grant_type='auto_isolate')` against every active card. User must explicitly remove auto-isolation before any card can grant access.
- **Default deny:** New records have no card associations. Owner sees all; holders see only what their cards grant.
- **System cards cannot be deleted** but can be renamed and edited freely.
- **Time-banded validity:** Distinct from scope time band. Validity bounds when the card is active; scope time band bounds which records are in scope.
- **Per-record overrides:** Explicit include and explicit exclude on (card_id, record_id). Excludes always win over scope rules.
- **MVP cut:** Schema is full from day 1. UI exposes only the five system cards. Custom card creation in Phase 2.

## Schema replaces
- `privacy_tier` ENUM column on memories, entities, relationships, media, syntheses → dropped
- `compute_synthesis_tier()` and tier-cascade triggers → replaced by synthesis_visibility_cache mechanism
- Connection group tables (user_close_friends/user_family_members/user_professional_connections from Next Steps item 1) → replaced by contacts + card_holders
- JWT role_tier claim (Next Steps item 24) → replaced by JWT carrying held card IDs per owner

## New tables
cards, contacts, card_holders, record_card_grants, synthesis_visibility_cache, card_audit_log, access_log

## How to apply
- Treat `privacy_tier` as deprecated in any future schema work
- The card model unblocks Executor role (item 31), training-consent layer, and reciprocal sharing patterns — all express as cards rather than as new ENUM values
- Working draft requirements: `/Personal-Life-Chronicle/documentation/access_cards_requirements.md`
- 10 open questions still pending Andy's resolution (term "card" vs. "audience", max card count, holder notification policy, link-based shares, view-as-holder UI, granular permissions beyond view, scope-vs-explicit conflict resolution, anonymized research access, etc.)
