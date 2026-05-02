# Life Chronicle — Access Cards Framework
## Requirements Definition (Working Draft)

**Version:** 0.1 (draft for review)
**Date:** April 2026
**Replaces:** The five-tier `privacy_tier` ENUM model (`private`, `close_friends`, `family`, `professional`, `public`) on `memories`, `entities`, `relationships`, `media`, and `syntheses`.

---

## 1. Origin and Concept

The `privacy_tier` ENUM model was a pragmatic first cut at access control: five socially recognizable bands ordered from most to least restrictive, with a single tier value attached to each record. It works mathematically (a synthesis inherits `MIN(privacy_tier)` of its sources) and it's easy to explain. But it imposes a hierarchy that real-life sharing doesn't honor — *my old Air Force buddies*, *my book club*, *the kids only*, *my advisory board*, *my therapist and my wife* are not points on a single line, and they're not neatly contained inside any of the five pre-defined bands.

The replacement model, **Access Cards**, generalizes the ENUM to a permission-grant artifact. The pattern is taken from a contact-management permission architecture used in a prior system: the user creates a *card* defining what content it grants visibility into; the user assigns the card to specific contacts; possession of the card by a contact governs what that contact can see. Cards can be scoped by collection, by time band, by topic tag, by life period, by place, or by explicit memory list. They can be time-bounded (active for a date range). They can be revoked by reclaiming the card from a holder.

Five tiers can be expressed as five system-defined cards. Custom audiences are additional user-defined cards. The schema generalizes; the UI can still surface a five-tier mental model in the MVP.

---

## 2. Vocabulary

**Card** — A named permission grant created by a chronicle owner. Defines a *scope* (what content it unlocks) and is held by zero or more *contacts*. A card may be active continuously or bounded by validity dates.

**Scope** — The rule set that determines which records a card grants visibility into. A scope can include constraints across multiple axes (dimensions, periods, entities, time ranges, places, explicit memory IDs). Within an axis, rules combine as OR; across axes, rules combine as AND.

**Holder** — A contact who possesses an active card. Holders see, on behalf of the chronicle owner, exactly the content the card's scope grants — no more, no less.

**Contact** — A person the chronicle owner has identified as a potential card holder. May be another registered Life Chronicle user, an email-only invitee, and/or linked to a `person` entity in the chronicle's entity graph.

**Owner** — The chronicle owner; always has full access to their own records (no card needed).

**System Card** — A card pre-created for every user that emulates one of the legacy ENUM tiers (Private, Close Friends, Family, Professional, Public). System cards are managed by the user but cannot be deleted; they are the default audiences offered in the MVP UI.

**Custom Card** — Any card created by the user beyond the five system cards. Deferred to Phase 2 in terms of UI exposure; supported by the schema from MVP.

---

## 3. Functional Requirements

### 3.1 Card Definition

**FR-1.** A user shall be able to create a card with a name, description, optional validity start/end dates, and a scope rule set.

**FR-2.** Card names shall be unique within an owner's account.

**FR-3.** A user shall be able to edit a card's scope, name, description, validity dates, and active status at any time. Changes take effect immediately for all holders.

**FR-4.** A user shall be able to deactivate a card without deleting it (preserves audit trail and holder list for possible reactivation).

**FR-5.** A user shall be able to delete a card. Deletion removes all holder associations but preserves an audit record of the card's existence and prior holders.

### 3.2 Scope Specification

**FR-6.** A card's scope shall be expressible across the following rule axes, any of which may be empty:
- **Time band:** records whose `time_estimate` falls within `[start, end]`
- **User periods:** records anchored to one of the listed `user_period_id`s (chapter naming, see Phase 0)
- **Life stage:** records whose `life_stage_id` matches one of the listed dimension IDs
- **Dimensions:** records tagged with at least one of the listed `dimension_id`s across any of the ten axes
- **Entities:** records linked to at least one of the listed `entity_id`s (people, places, organizations, vehicles, artifacts)
- **Places (geographic):** records whose location entity is one of the listed places or any descendant in the geographic hierarchy
- **Explicit memory IDs:** records explicitly enumerated in an include list
- **Explicit excludes:** records explicitly enumerated in an exclude list (override include rules)

**FR-7.** Within a single rule axis, multiple values combine as **OR** (any match grants).

**FR-8.** Across rule axes, all axes must match for access to be granted (**AND**), with the exception that:
- An empty rule axis is a no-op (does not constrain).
- An empty scope (no rules at all) grants access to all of the owner's content.
- The explicit-excludes list always trumps; a record on the excludes list is denied regardless of any other rule.

**FR-9.** A user shall be able to preview a card's effective record set ("what will my mother see if I give her this card?") before saving or assigning the card.

**FR-10.** Scope evaluation shall be performant enough to render a card preview of up to 10,000 records in under one second.

### 3.3 Holders

**FR-11.** A card may have zero or more holders. A card with zero holders is functionally inert (no one can see anything through it) but legitimate (used for staging or when the holder list is being assembled).

**FR-12.** A holder is identified by either:
- A registered Life Chronicle user ID, or
- An email address (with optional display name) for not-yet-registered invitees.

An email-only holder is upgraded to a user-ID-linked holder when the invitee accepts an invitation and registers.

**FR-13.** A holder may optionally be linked to a `person` entity in the chronicle's entity graph (e.g., the holder Beth Lyons is also the entity *Beth Lyons*). Linking enables features like "who in my chronicle can also see it" without forcing the link.

**FR-14.** A holder may possess multiple cards from the same owner. The holder's effective access is the **union** of the scopes of all their active cards.

**FR-15.** A user shall be able to add or remove a holder from a card at any time. Removing a holder takes effect on the holder's next access attempt (no grace period).

**FR-16.** A user shall be able to view, for any contact, the full list of cards the contact currently holds and what each card grants — both as a summary ("Beth currently sees 1,247 of your 4,302 memories") and as a per-card breakdown.

### 3.4 Time-Banded Validity

**FR-17.** A card may carry `validity_start` and `validity_end` dates that bound when the card is active. Outside this window the card is inert regardless of holder status.

**FR-18.** The validity window is distinct from the card's *scope* time band. Validity governs *when the card grants*; scope time band governs *which records are in the grant*. Example: a 30-day reunion access card (validity = next 30 days) granting visibility into memories from 1965–1972 (scope time band).

**FR-19.** Validity windows shall display prominently in the holder management UI and trigger expiry notifications to the owner one week before expiry.

### 3.5 System Cards (Default Audiences)

**FR-20.** Every newly created user account shall be seeded with five system cards: `Private`, `Close Friends`, `Family`, `Professional`, `Public`. These cards have system-defined names and pre-set semantics:

- **Private** — Empty scope (grants nothing); not assignable to any holder; serves as the conceptual default for unshared content. Functionally, "shared via the Private card" means "shared with no one but the owner."
- **Close Friends** — Empty scope by default (grants all owner content); user populates the holder list. User may narrow the scope.
- **Family** — Empty scope by default (grants all owner content); user populates the holder list.
- **Professional** — Default scope: dimensions in the Career & Professional series + Education series; user populates the holder list.
- **Public** — Special card: anyone with a viewing URL can view; no holder list required; scope defaults empty (no records made public until owner explicitly grants records to this card).

**FR-21.** System cards cannot be deleted. They can be renamed by the user (display name only; the system identifier remains stable) and their scopes/holders fully edited.

**FR-22.** New records do not automatically join any system card. Default state is "shared via Private" (no audience).

### 3.6 Per-Record Overrides

**FR-23.** A user shall be able to attach a record (memory, entity, relationship, media item, synthesis) to one or more cards explicitly, regardless of whether the record matches the card's scope rules. This is the *explicit grant* mechanism.

**FR-24.** A user shall be able to explicitly exclude a record from a card's scope, even if the record matches the scope rules. Exclusion takes precedence over scope rules.

**FR-25.** Per-record overrides shall be visible on the record's detail surface ("This memory is shared with: Family card, Air Force Buddies card; explicitly hidden from: Public card").

### 3.7 Default Deny

**FR-26.** Every record is created with no card associations. A viewer who is not the owner can see a record only if at least one card they hold has a scope that matches the record (or the record has been explicitly granted to a card the viewer holds).

**FR-27.** The application layer and database (RLS) shall both enforce default deny. Failure of either layer must not result in unintended exposure.

### 3.8 Sensitive-Dimension Auto-Isolation

**FR-28.** When the Tagger Agent assigns a dimension marked `is_sensitive = true` to a memory, the memory is automatically excluded from all cards via an `explicit_excludes` entry against every active card on the user's account. Equivalent in effect to the prior "auto-lock to private" behavior.

**FR-29.** The user must explicitly remove the auto-exclusion before any card can grant access to a sensitive memory. The UI shall present a confirmation dialog explaining the sensitivity classification and requiring acknowledgment.

**FR-30.** A `tier_locked` boolean (renamed `auto_isolated` for clarity under the card model) on the memory record signals to the UI that auto-isolation has been applied. Removing all auto-isolation entries clears the flag.

### 3.9 Synthesis Inheritance

**FR-31.** A synthesis is visible to a holder of card C if and only if **every** source memory of the synthesis is visible to a holder of C. Equivalently: a card grants access to a synthesis if and only if its scope (or explicit grants) covers all source memories without any explicit exclusion.

**FR-32.** When a synthesis is generated or its source memory set changes, the system shall recompute the set of cards that grant access to it and store this in a `synthesis_visibility_cache` table for query performance.

**FR-33.** When a memory's card associations change (scope-rule change, explicit grant or exclude added/removed), every synthesis containing that memory shall have its visibility cache recomputed.

**FR-34.** The user may not promote a synthesis to a card whose scope does not already cover all source memories. The UI shall surface this constraint as a clear error: "This synthesis includes content from memories not shared via the Family card. Promote those memories first, or remove them from the synthesis source set."

### 3.10 Public Visibility (Special Case)

**FR-35.** The Public card is a singleton system card with no holder list. Anyone with a viewing URL (or, in the future, anyone authenticated to the system) can view records granted to the Public card.

**FR-36.** Records do not become Public by default under any circumstance. A record reaches Public visibility only when the owner explicitly attaches it to the Public card.

**FR-37.** Sensitive-flagged records cannot be attached to the Public card unless the user explicitly removes auto-isolation (FR-29) AND confirms an additional public-sharing acknowledgment.

### 3.11 Audit and Access Logging

**FR-38.** Every card creation, modification, deletion, holder addition, holder removal, scope change, and explicit grant/exclude shall be recorded in an immutable `card_audit_log` table with timestamp, actor, action type, and before/after JSON snapshots of the affected entities.

**FR-39.** Every successful access by a holder (synthesis view, memory view, media view, search retrieval) shall be recorded in an `access_log` table with viewer ID, record ID, card ID used to grant access, and timestamp. (Sampling acceptable at scale; minimum a daily summary per holder per card.)

**FR-40.** The owner shall be able to view, for any card, a per-holder access summary: when last accessed, total accesses, top records viewed.

### 3.12 Revocation

**FR-41.** A user shall be able to revoke a holder's access in three ways:
- **Per-card revocation:** remove the holder from a single card.
- **Bulk revocation:** remove a contact from all cards they currently hold.
- **Card-wide revocation:** deactivate or delete a card, removing all holders.

**FR-42.** Revocation shall take effect immediately. In-flight requests by the holder may complete; subsequent requests shall be denied.

**FR-43.** Revocation events shall write to the audit log and shall optionally notify the holder ("Beth, your Family card has been revoked").

### 3.13 Card Templates

**FR-44.** The system shall provide pre-made scope templates the user can apply when creating a card:
- **Time-banded** — All content from a date range, all dimensions.
- **Period-banded** — All content from a user-named life chapter.
- **Topic-banded** — Content tagged with a single topic domain or set of dimensions.
- **Place-banded** — Content located at a specific place or geographic radius.
- **Career-banded** — Content from a single employer/organization entity, optionally bounded by employment dates.
- **Reunion** — Time-banded with a default 30-day card validity, suitable for short-lived sharing.

**FR-45.** Templates are not constraints; they pre-fill the scope editor with sensible defaults, which the user may then edit freely.

### 3.14 Discovery Aids for Holders

**FR-46.** A holder, on accessing the chronicle owner's content, shall see only what their cards grant — no indication that other content exists. Card-based access leakage (where a holder can infer the existence of records they cannot view) shall be minimized.

**FR-47.** Search, browse, timeline, and globe views shall respect card scope: results shown to a holder are exactly what their cards grant.

---

## 4. Schema Sketch

The following tables replace the `privacy_tier` ENUM column on `memories`, `entities`, `relationships`, `media`, and `syntheses`. The ENUM column is dropped from those tables.

### 4.1 `cards` — Card definition

```
cards (
    id                  UUID PK
    owner_user_id       UUID NOT NULL
    name                TEXT NOT NULL
    description         TEXT
    is_system           BOOLEAN NOT NULL DEFAULT false
    system_code         TEXT  -- 'private', 'close_friends', 'family', 'professional', 'public' for system cards; null otherwise
    is_active           BOOLEAN NOT NULL DEFAULT true
    is_public           BOOLEAN NOT NULL DEFAULT false  -- true only for the Public system card
    validity_start      TIMESTAMPTZ
    validity_end        TIMESTAMPTZ
    scope_rules         JSONB NOT NULL DEFAULT '{}'  -- structured scope rules; see §4.2
    metadata            JSONB DEFAULT '{}'
    created_at          TIMESTAMPTZ DEFAULT NOW()
    updated_at          TIMESTAMPTZ DEFAULT NOW()
    UNIQUE (owner_user_id, name)
)
```

### 4.2 `scope_rules` JSONB structure

```json
{
  "time_band": { "start": "1965-01-01", "end": "1975-12-31" },
  "period_ids": ["uuid-1", "uuid-2"],
  "life_stage_ids": ["uuid-young-adult"],
  "dimension_ids": ["uuid-career", "uuid-education"],
  "entity_ids": ["uuid-employer-x"],
  "place_ids": ["uuid-spain"],
  "include_memory_ids": ["uuid-mem-a"],
  "exclude_memory_ids": ["uuid-mem-b"]
}
```

(Empty object `{}` = grants all of the owner's content.)

### 4.3 `contacts` — Potential card holders

```
contacts (
    id                  UUID PK
    owner_user_id       UUID NOT NULL
    contact_user_id     UUID  -- null until invitation accepted
    email               CITEXT NOT NULL
    display_name        TEXT
    person_entity_id    UUID REFERENCES entities(id)  -- optional graph linkage
    invitation_status   TEXT  -- 'pending' | 'accepted' | 'declined' | 'revoked'
    invited_at          TIMESTAMPTZ
    accepted_at         TIMESTAMPTZ
    created_at          TIMESTAMPTZ DEFAULT NOW()
    UNIQUE (owner_user_id, email)
)
```

### 4.4 `card_holders` — Who holds which card

```
card_holders (
    card_id             UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE
    contact_id          UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE
    granted_at          TIMESTAMPTZ DEFAULT NOW()
    granted_by          UUID NOT NULL  -- user_id of the granter (typically the owner)
    last_accessed_at    TIMESTAMPTZ
    PRIMARY KEY (card_id, contact_id)
)
```

### 4.5 `record_card_grants` — Explicit per-record grants and excludes

```
record_card_grants (
    id                  UUID PK
    card_id             UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE
    record_type         TEXT NOT NULL  -- 'memory' | 'entity' | 'relationship' | 'media' | 'synthesis'
    record_id           UUID NOT NULL
    grant_type          TEXT NOT NULL  -- 'include' | 'exclude' | 'auto_isolate'
    reason              TEXT  -- e.g., 'sensitive_dimension', 'user_explicit'
    created_at          TIMESTAMPTZ DEFAULT NOW()
    created_by          UUID NOT NULL
    UNIQUE (card_id, record_type, record_id, grant_type)
)
```

(`auto_isolate` is the schema marker for sensitive-dimension auto-exclusion, FR-28.)

### 4.6 `synthesis_visibility_cache` — Materialized synthesis access

```
synthesis_visibility_cache (
    synthesis_id        UUID NOT NULL REFERENCES syntheses(id) ON DELETE CASCADE
    card_id             UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE
    computed_at         TIMESTAMPTZ DEFAULT NOW()
    PRIMARY KEY (synthesis_id, card_id)
)
```

(One row per (synthesis, card) pair where the card's scope or explicit grants cover all source memories without exclusion. Recomputed by the Synthesis Agent when sources change or card scopes change.)

### 4.7 `card_audit_log` — Immutable audit trail

```
card_audit_log (
    id                  UUID PK
    owner_user_id       UUID NOT NULL
    actor_user_id       UUID NOT NULL
    action              TEXT NOT NULL  -- 'card_created' | 'card_modified' | 'card_deleted' | 'holder_added' | 'holder_removed' | 'scope_changed' | 'record_granted' | 'record_excluded' | 'card_deactivated' | 'card_reactivated'
    card_id             UUID
    contact_id          UUID
    record_type         TEXT
    record_id           UUID
    before_state        JSONB
    after_state         JSONB
    occurred_at         TIMESTAMPTZ DEFAULT NOW()
)
```

### 4.8 `access_log` — Holder access events

```
access_log (
    id                  UUID PK
    owner_user_id       UUID NOT NULL
    viewer_user_id      UUID NOT NULL
    card_id             UUID NOT NULL  -- which card granted access
    record_type         TEXT NOT NULL
    record_id           UUID NOT NULL
    accessed_at         TIMESTAMPTZ DEFAULT NOW()
    -- partition by month for retention/sampling
)
```

---

## 5. Access Evaluation Algorithm

For a viewer V attempting to read record R owned by user O:

```
1. If V == O, grant. (Owner has full access.)
2. Find all active cards C owned by O where:
   - V is a card holder via card_holders linked through contacts, AND
   - Card C is currently within its validity window (or no validity bounds set).
3. For each such card C:
   a. If R is in record_card_grants(C, exclude or auto_isolate), skip.
   b. If R is in record_card_grants(C, include), grant. (Explicit include.)
   c. Else evaluate R against C.scope_rules:
      - If scope_rules is empty {}, grant.
      - Else for each rule axis populated in scope_rules:
        check whether R matches at least one value in that axis.
        If R fails any populated axis, skip.
        If R matches all populated axes, grant.
4. If no card grants access, deny.
```

This is implementable as a SQL function `viewer_can_access(viewer_id UUID, owner_id UUID, record_type TEXT, record_id UUID) RETURNS BOOLEAN`. RLS policies on each content table call this function in the `USING` clause.

For performance at scale, scope-rule evaluation against memory metadata can be materialized as a `card_record_grants_resolved` view or trigger-maintained table — recomputed when card scope changes or when memory metadata changes (dimension tags, period assignment, etc.).

---

## 6. Synthesis Visibility Computation

When a synthesis is created or its `source_memory_ids` array changes, the Synthesis Agent runs:

```
For each card C owned by the synthesis owner:
  If for every memory M in source_memory_ids:
    viewer-agnostic check: does C's scope (or explicit grants) cover M, with no exclusion?
  Then INSERT into synthesis_visibility_cache (synthesis_id, card_id).
```

This is the synthesis-time analogue of the per-viewer access evaluation. It avoids per-query intersection computation and gives synthesis viewers a fast indexed lookup.

When a card's scope changes or a memory's grants change, all syntheses referencing affected memories must have their cache rows recomputed.

---

## 7. RLS Policy Sketch

For the `memories` table:

```sql
CREATE POLICY memory_select_with_card_grant ON memories
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()  -- owner
    OR
    viewer_can_access(auth.uid(), user_id, 'memory', id)
);
```

Equivalent policies on `entities`, `relationships`, `media`, `syntheses` (the synthesis policy uses the cache: `EXISTS (SELECT 1 FROM synthesis_visibility_cache ... )`).

Service Role bypasses RLS for agent writes, as in the current design.

---

## 8. MVP Cut

The full schema lands in MVP. The UI surfaces only the five system cards as named "tiers" — the user can add holders and shift scope on each, but cannot create custom cards. This preserves the simple mental model for first users while leaving the schema unburdened by future migration.

**MVP exposed:** five system cards with editable holder lists. Default-private discipline. Sensitive auto-isolation. Audit log writing. Per-record grant/exclude exposed only as "share this with the Family card" / "hide this from the Family card" toggles.

**Phase 2 unlocks:**
- Custom card creation UI
- Scope editor (rule-builder) with preview
- Card templates (FR-44)
- Time-banded card validity (FR-17–19)
- Card holder management beyond the five system cards
- Holder-side experience: invitation acceptance, viewing-others'-chronicles UI

**Phase 3 unlocks:**
- Executor card pattern (posthumous-trigger validity)
- Training/research consent expressed as system cards with terms-of-use metadata
- Reciprocal sharing patterns (mutual chronicling between two users)

---

## 9. Migration from the ENUM

1. Create new tables (cards, contacts, card_holders, record_card_grants, synthesis_visibility_cache, card_audit_log, access_log).
2. For every existing user, seed five system cards with `system_code` set.
3. For every existing record carrying a non-`private` `privacy_tier`, write a corresponding `record_card_grants(grant_type='include')` row referencing the appropriate system card.
4. For every record where `tier_locked = true`, write a `record_card_grants(grant_type='auto_isolate')` row.
5. Recompute `synthesis_visibility_cache` for all syntheses.
6. Update RLS policies to call `viewer_can_access()`.
7. Drop `privacy_tier` and `tier_locked` columns from content tables (or rename to `_legacy_*` for one release as a safety net).
8. Drop the `privacy_tier` ENUM type after a deprecation window.

The migration is lossless — every prior tier value maps to a system card include grant.

---

## 10. Performance Considerations

- **`viewer_can_access()` cost:** With proper indexes on `card_holders`, `record_card_grants`, and the memory metadata columns, evaluating one (viewer, record) pair is bounded by the number of cards the viewer holds (typically 1–5) and the depth of scope rules (typically 1–3 populated axes). Should execute in single-digit milliseconds.
- **JWT carrying held card IDs:** When a viewer authenticates to view another user's chronicle, their JWT can carry the set of card IDs they hold from that owner. This avoids the `card_holders` join on every query.
- **Materialized scope expansion:** For users with many memories, a trigger-maintained `card_record_grants_resolved(card_id, record_id)` table can pre-compute scope-rule matches. Cost: recomputation on memory metadata changes. Benefit: reads become a single indexed lookup.
- **Synthesis visibility cache:** As specified, prevents per-query intersection computation.

---

## 11. Open Questions

**OQ-1.** Do we adopt the term *card* in the user-facing copy, or use a more universal phrase like *audience* or *circle*? Card has historical resonance from Andy's prior work but may feel jargon-y to a Boomer-segment user. Test in MVP.

**OQ-2.** What is the maximum number of cards per user (MVP and full)? Recommend soft limit of 25 in MVP, configurable; no hard limit in schema.

**OQ-3.** What is the maximum number of holders per card? Recommend no limit in schema; UI warns at >50.

**OQ-4.** Does a holder receive a notification when a card they hold has its scope changed? (Default: yes, but they only see what they're allowed to see.)

**OQ-5.** Should we model "share with anyone who has this URL" (link-based access without identifying the viewer) as a separate primitive from cards, or as a card variant? Recommend: link-based shares are tokens scoped to a single record-set; not cards. Defer to Phase 2.

**OQ-6.** Holder-side experience: when Beth holds a Family card from Andy and a Family card from her cousin Joe, does she see one merged feed of accessible content, or two separate views? Recommend separate (preserves context); revisit after user testing.

**OQ-7.** Granular per-card permissions beyond view (comment, suggest correction, download)? Recommend: MVP is view-only; comment is Phase 2; correction-suggestion is Phase 2 tied to the assumption-log workflow; download follows export rules.

**OQ-8.** Conflict between scope rule and explicit grant: if a card's scope excludes a memory by topic but the user has explicitly granted that memory to the card, does the explicit grant win? Recommend: yes, explicit grants override scope. Excludes win over both.

**OQ-9.** Anonymized/aggregated access tier (for research and training-consent): is this a card with a special holder type (`research_corpus`), or a separate access primitive? Recommend: card with holder type, leveraging the same evaluation engine.

**OQ-10.** Does the chronicle owner ever see exactly what a holder sees ("view as Beth")? Recommend: yes, this is essential for trust. Add to MVP UI.

---

## 12. What This Replaces in the Current Design Doc

Sections affected in `DB_Architecture_Design_v1.md`:
- **Part VIII (Privacy Architecture — Five-Tier Model):** Replaced wholesale by this requirements doc. The five tiers become five system cards.
- **Synthesis tier inheritance** (`compute_synthesis_tier`, `trg_syntheses_privacy_tier`, `trg_cascade_synthesis_tier` triggers): Replaced by the `synthesis_visibility_cache` mechanism.
- **Sensitive-dimension auto-lock:** Renamed *auto-isolation*, modeled as `record_card_grants(grant_type='auto_isolate')` on every card.
- **Connection group tables (Next Steps item 1):** Replaced by `contacts` + `card_holders`. The user_close_friends / user_family_members / user_professional_connections idea is no longer needed; those relationships emerge from card holder lists.
- **JWT `role_tier` claim (Next Steps item 24):** Replaced by JWT carrying the set of card IDs the viewer holds for the queried owner.

---

*This is a working draft. All numbered requirements (FR-#) are candidates for inclusion in the PRD pending Andy's review and resolution of the open questions.*
