---
name: Project: LC pre-PRD decisions (resolved 2026-04-30)
description: The seven decisions that gated PRD authoring, all resolved 2026-04-30. Preserved here as the canonical record of WHY each decision went the way it did; PRD v1.1 reflects all outcomes.
type: project
---

## Status

✅ All seven decisions resolved 2026-04-30. PRD v1.1 written. This file is the durable record of the decisions themselves and the reasoning behind each — referenced when a decision is later questioned.

---

### Decision 1 — Video PRD retirement

Video-first PRD (`Personal-Life-Chronicle-PRD.docx`, Feb 2026) archived to `documentation/archive/Personal-Life-Chronicle-PRD-video-first-Feb2026.docx`. No longer a competing product vision. Video capability is split across three positions:
- **Phase 2:** Real-time video as a capture modality at memory markers; transcription extracts verbal content into the memory record.
- **Phase 3:** Processing existing video archives — atomization, highlight extraction, facial recognition.
- **Not a product vision:** The original archive-first, media-intelligence-first framing is retired.

---

### Decision 2 — Marketing positioning (three-layer hierarchy)

**Lead (MVP):** Personal memoir and living legacy archive. Differentiator vs. Memento/Storybook is that Life Chronicle is a *living, ongoing system* rather than a one-time canned-question output. No AI framing required at this level.

**Secondary hook (MVP, vanguard users):** The digital twin — a continuously growing, structured representation of a person that deepens over time. Speaks to early adopters who understand a living archive is more valuable than a printed book.

**Reserved mission (Phase 2–3):** The agentic AI legacy — a fully realized chronicle as the richest possible context for AI agents operating on a person's behalf. Data model is already built for it; messaging held until core value is proven.

General public marketing should not lead on AI legacy (too abstract); the digital twin is the right intermediate hook for the vanguard segment.

---

### Decision 3 — Phase 0 model (parallel strands, amended twice)

Phase 0 is **three parallel strands of activity**, not three sequential stages. The user engages with strands in any order through a persistent capture assistant; the system internally tracks data accumulation and ships artifacts when thresholds are met — without ever asking the user to declare a stage "complete."

**The three strands:**

| Strand | What it builds | Primary surface |
|---|---|---|
| Residential strand (was Stage 1) | Temporal/geographic spine — places the user has lived, in sequence, with whatever date precision is available | Life Globe (the pinning UI per `feature_residential_globe_onboarding.md`) |
| Entity strand (was Stage 2) | Seed of key people, institutions, organisations significant to the user | Conversational capture assistant + entity-confirmation cards in the Review Queue |
| Topic strand (was Stage 3) | Confirmation of which life dimensions are active for this user, and themes that recur | Conversational capture assistant + dimension confirmation UI |

**Artifact thresholds (system-detected, not user-declared):**

- ≥3 main-residence pins with at least one having a date or rough date range → **Life Globe** is "delivered" (the same globe surface the user has been using, now marked as published-artifact state)
- ≥3 person entities with non-trivial context → first **Entity Portrait** synthesis generated
- ≥5 person entities across multiple life stages + ≥3 residential pins → first **Life's Players** (lifes_cast) synthesis generated

Each threshold emits a `chronicle/threshold.reached` event (renamed from the obsolete `phase0/stage.completed`).

**Amendment history:**

- **2026-04-30 (original Decision 3):** Multi-session with mid-flight artifact delivery; reduced four stages to three by removing chapter naming. Each stage was a discrete session with a "Complete" gate.
- **2026-05-17 (parallel-strands amendment):** Eliminated explicit user-declared stage completion entirely. Phase 0 progression is invisible to the user. The capture assistant orchestrates strand transitions organically based on chronicle state; the user never sees a "Stage 1 of 3" indicator and is never prompted to declare a stage "done." This shift was made during the residential globe spec review when it became clear that the user's understanding of their chronicle's extent should not be truncated by stage gates — places, people, and themes all surface over months and years, not in a single onboarding session.

**Dependency theory unchanged:** Tier 1 structural scaffold (residential) is conceptually prior to Tier 2 entity seed, which is conceptually prior to Tier 3 topic map. This dependency is enforced by the orchestrator's internal reasoning about which strand to prompt next, not by user-facing UI sequencing. (See `memory/project_lc_ontology_bootstrap.md` for the full dependency theory.)

**What this means for the development sequence:**

- `LC_Development_Sequence.md` Steps 7 and 10 (Phase 0 Stage 1 UI + Life Globe rendering) collapse into a single residential-strand build (see `documentation/feature_residential_globe_onboarding.md` v1.1).
- Steps 8 and 9 (Stage 2 and Stage 3 UI) become "entity-strand UX" and "topic-strand UX" — separate forthcoming feature specs, both built on top of the capture assistant.
- The capture assistant (Step 6 expansion per `documentation/feature_capture_assistant.md` v1.1) is the orchestration surface for strand transitions.

**What this means for the PRD:**

PRD v1.1 §3 (Phase 0 Onboarding Flow) currently describes three sequential stages. Authoring the PRD v1.2 amendment to reflect parallel strands is queued; in the meantime, this memory file and the feature specs are the source of truth.

Single-session onboarding remains rejected (would not be completed by target user).

---

### Decision 4 — MVP synthesis pair

**Keep:** Place portrait (`entity_biography` for place entities) powering the globe, **with a temporal transit layer added** — a chronological animation tracing the user's geographic path through life, camera moving between significant places, dwelling proportionally to time spent. UX enhancement on top of existing `life_journey_geojson()`; no new synthesis type required.

**Replace chapter narrative with: Life's Players** (internal synthesis type: `lifes_cast`) — a time-series progression of the significant people who played roles in the user's life, from earliest remembered relationships to present central figures. Named for *As You Like It*, Act II Scene VII. User-facing names: *Life's Players*, *Life's Cast*, *Life's Cast and Characters*. Differs from `relationship_portrait` (one relationship, deep) — broader and temporal, showing how the cast evolved across life stages. Draws on Phase 0 Stage 2 entity seed; requires only temporal placement of key entities, not dense per-relationship memory collection.

Key design note: the artifact accommodates relationships of any duration — lifelong spouse and a formative three-year mentor are equally valid players. Duration is not the criterion; significance at the time is.

**Deferred to Phase 2:** Chapter narrative (`life_period_narrative`).

---

### Decision 5 — Channel scope

**MVP channels:** Web app (desktop + mobile-web) and SMS async capture. Voice-only phone deferred to Phase 2.

**Rationale:** MVP target user is technically proficient. Voice-only phone is an accessibility channel for less technically comfortable users and isn't the right fit for the vanguard segment. PRD user definition reflects this — technically comfortable adults who can navigate a web app, use SMS, and engage with AI-assisted interview sessions.

---

### Decision 6 — Access Cards terminology and permissions

**User-facing term:** "Share Card" — what the owner creates, names, and assigns to a correspondent. Self-describing; implies deliberate personal sharing.

**Two permission levels:**
- **View** — card holder can see scoped content
- **Contribute** — card holder can add to the owner's chronicle (embellishments, additional memories of shared events)

**Contribution model:** Contributions do NOT auto-ingest into the Raw Vault. They arrive as attributed, staged entries (`contributor_id` preserved) and enter the review queue. Owner accepts, modifies, or rejects each before it becomes canon. May be anchored to an existing memory (embellishment) or a new stub. `triggered_by_memory_id` pattern from the Stroll applies.

**Architectural implications:** `record_card_grants` needs a `can_contribute` field or separate grant type; contributions need `contributor_id`; `review_queue` (already MVP) handles staging/approval. Contribution permission itself is a Phase 2 feature (custom cards are Phase 2), but architecture anticipates it from MVP.

---

### Decision 7 — Share Cards: distribution, notification, comments

**Distribution channel:** Social media is the primary external distribution mechanism. The share card controls access permissions; the act of distribution may be a social post pointing people to the chronicle. No separate in-platform "you've been added as a card holder" notification required at MVP.

**Notification resolution:** The social post is the notification. When a card holder arrives via shared link, they see what their card grants on login.

**Comment capture (MVP):** Recipients may leave comments in response to a shared memory. Comments are attributed (email, social handle, or anonymous) and stored linked to the share instance. Comments do not auto-enter the chronicle — visible to the owner in a separate view.

**Future (Phase 2+):** File attachments on contributions deferred.

**Architectural implications:**
- `memory_shares` table records each share event (memory_id, share_card_id, channel enum, shared_at, share_url)
- `share_comments` table: recipient identity (nullable), comment text, linked to `memory_shares.id`
- Future: `contribution_attachments` table for file references on contributions

---

## How to apply

When a decision above is later questioned, this file is the durable record of WHY it went the way it did. Decisions are not relitigated unless Andy explicitly opens them. Cross-reference with PRD v1.1 (which is the authoritative current specification) and schema v1.3.
