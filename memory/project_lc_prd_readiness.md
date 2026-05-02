---
name: Project: LC PRD readiness — pending decision session
description: PRD cannot begin until Andy resolves 5 open decisions from the gap review and 2 blocking Access Cards questions. Andy has committed to a focused decision session (evening of 2026-04-29 or morning of 2026-04-30). Session agenda and context recorded here.
type: project
---

## Status

✅ ALL SEVEN DECISIONS RESOLVED — 2026-04-30. PRD can now be written.

**Why:** April 2026 gap review identified five open decisions that must be Andy's choices before the PRD can be written. Two of them (synthesis pair, Phase 0 session model) determine the core user journey. Two Access Cards questions also block the PRD privacy section.

## Decisions Recorded

### ✅ Decision 1 — Video PRD: RESOLVED 2026-04-30

Video-first PRD (`Personal-Life-Chronicle-PRD.docx`) archived to `documentation/archive/Personal-Life-Chronicle-PRD-video-first-Feb2026.docx`. No longer a competing product vision.

Video capability is now split across three distinct positions:
- **Phase 2:** Real-time video recording as a capture modality — at waypoints or memory markers in a Stroll or interview session, the user may respond via video rather than voice or text. Treated as media linked to the memory; transcription extracts verbal content into the memory record. Richer, more emotive than audio-only capture.
- **Phase 3:** Processing of existing video archives — atomization, highlight extraction, attachment of video excerpts to recollections. Facial recognition deferred to Phase 3.
- **Not a product vision:** The original video-first framing (archive-first, media-intelligence-first) is retired.

---

## Session Agenda — Seven Decisions

Work through these in order. Each has a recommendation ready; Andy just needs to confirm, modify, or override.

### ✅ Decision 6 — Access Cards terminology + permissions: RESOLVED 2026-04-30

**User-facing term:** "Share Card" — what the owner creates, names, and assigns to a correspondent. Self-describing; implies deliberate, personal sharing.

**Two permission levels on a share card:**
- **View** — card holder can see the scoped content
- **Contribute** — card holder can add to the owner's chronicle (embellishments, additional memories of shared events, details the owner didn't have)

**Contribution model:**
- Contributed content does NOT auto-ingest into the Raw Vault as owner-recorded memory
- Contributions arrive as attributed, staged entries (contributor_id preserved) and enter the owner's review queue
- Owner accepts, modifies, or rejects each contribution before it becomes part of the canon
- A contribution may be anchored to an existing memory (embellishment) or arrive as a new stub (fresh addition)
- The `triggered_by_memory_id` pattern from the Stroll feature applies: contributions link to the memory they're enriching where one exists

**Use case:** Owner shares a memory of a workplace event with former colleagues (via a share card with contribute access). Those colleagues can add their own recollection of the same event — their angle, details the owner had forgotten, things the owner didn't witness. The owner reviews and accepts what they want in their chronicle.

**Architectural implications:**
- `record_card_grants` needs a `can_contribute` field or a separate grant type for contribution permission
- Contributions need attribution — `contributor_id` on contributed entries
- `review_queue` table (already recommended for MVP) handles the staging/approval workflow
- This extends the "second-person memory mode" concept (architecture doc Next Steps item 41)
- Contribution permission is a Phase 2 feature (custom cards are Phase 2), but architecture must anticipate it from MVP

---

### ✅ Decision 5 — Channel scope: RESOLVED 2026-04-30

**MVP channels:** Web app (desktop + mobile-web) and SMS async capture. Voice-only phone deferred to Phase 2.

**Rationale:** MVP target user is technically proficient — someone who can engage with the full scope of the system. Voice-only phone is an accessibility channel for less technically comfortable users (older adults, etc.) and is not the right fit for the vanguard segment. Defer until Phase 2 when the core loop is validated and a broader user base is in scope.

**Target user implication:** MVP does not attempt to serve the least-technical end of the potential audience. The PRD user definition should reflect this — technically comfortable adults who can navigate a web app, use SMS, and engage with AI-assisted interview sessions.

---

### ✅ Decision 4 — MVP synthesis pair: RESOLVED 2026-04-30

**Keep:** Place portrait (`entity_biography` for place entities) powering the globe, with a temporal transit layer added — a chronological animation tracing the user's geographic path through life, camera moving between significant places in sequence, dwelling proportionally to time spent. UX enhancement on top of the existing `life_journey_geojson()` output; no new synthesis type required.

**Replace chapter narrative with: Life's Players** (internal synthesis type: `lifes_cast`) — a time-series progression of the significant people who played roles in the user's life, from earliest remembered relationships through to the present central figures. Named for the Shakespeare quote (*As You Like It*, Act II Scene VII): *"All the world's a stage, and all the men and women merely players; they have their exits and their entrances."* User-facing names: *Life's Players*, *Life's Cast*, or *Life's Cast and Characters*.

This is a new synthesis type not currently in the schema. It differs from `relationship_portrait` (one relationship, deep) — it is broader and temporal, showing how the cast of central figures evolved across life stages. It draws on the entity seed from Phase 0 Stage 3 and requires only temporal placement of key entities, not dense per-relationship memory collection. Works well with MVP-level data.

Key design note: the artifact must accommodate relationships of any duration — lifelong spouse and a formative three-year mentor are equally valid players. Duration is not the criterion; significance at the time is.

**Deferred to Phase 2:** Chapter narrative (`life_period_narrative`) — requires a richer collection to avoid feeling thin; better as a Phase 2 artifact when the chronicle has real depth.

---

### ✅ Decision 3 — Phase 0 session model: RESOLVED 2026-04-30, amended 2026-04-30

Multi-session with mid-flight artifact delivery after each stage. Phase 0 is **three stages** (not four — Stage 2 chapter naming was removed; see amendment below). Each stage is a discrete session (estimated 15–30 minutes each); the user receives a visible artifact immediately on completing each one before the next is scheduled.

**Artifact delivery sequence (three stages):**
- Stage 1 complete → Life Globe (residential and temporal spine rendered, with temporal transit animation)
- Stage 2 complete → Entity portrait of a key person named during the entity seed
- Stage 3 complete → Life's Players (lifes_cast synthesis: the cast of significant people across life stages)

**Stage 2 chapter naming — removed from Phase 0 (amendment, 2026-04-30):**
Asking a user to pre-define broad life chapter segments before any collection has occurred is impractical and artificial — particularly for users (e.g., 72-year-old with many professional and personal chapters) who have too rich a history to compress into broad segments on demand. The residential arc (places lived) and relationship arc (people) provide sufficient organizational framing for the early chronicle without requiring the user to impose chapter vocabulary upfront. Chapter structure will emerge from analysis once the collection is rich enough to support it. `user_periods` remain in the schema for post-collection use but are not populated in Phase 0.

The Stage 4 artifact in the original Decision 3 recording ("first chapter narrative") was also in error — chapter narrative (life_period_narrative) was deferred to Phase 2 in Decision 4. That error is corrected here: the final Phase 0 artifact is Life's Players.

Single-session onboarding is rejected. A 60–90 minute upfront session before any artifact appears will not be completed by the target user.

---

### ✅ Decision 2 — Marketing positioning: RESOLVED 2026-04-30

Three-layer positioning hierarchy:

**Lead (MVP):** Personal memoir and living legacy archive — organized memories for yourself and the people who matter to you. Differentiator vs. Memento/Storybook is that Life Chronicle is a *living, ongoing system* rather than a one-time canned-question output. No AI framing required at this level.

**Secondary hook (MVP, vanguard users):** The digital twin — a continuously growing, structured representation of a person that deepens over time. Speaks to early adopters who understand a living archive is more valuable than a printed book. Gives a mental model for the platform's ambition without requiring AI agent framing.

**Reserved mission (Phase 2–3):** The agentic AI legacy — a fully realized chronicle as the richest possible context for AI agents operating on a person's behalf, or for future systems needing deep individual human context. Data model is already built for it; messaging held until core value is proven.

Andy's explicit note: general public marketing should not attempt to compete on AI legacy (too abstract); the digital twin is the right intermediate hook for the vanguard segment.

---

### ✅ Decision 7 — Share Cards: distribution, notification, and comment capture: RESOLVED 2026-04-30

**Distribution channel:** Social media is the primary distribution mechanism for sharing memories externally — the share card controls access permissions, but the act of distribution may be a social post pointing people to the chronicle. No separate in-platform "you've been added as a card holder" notification is required at MVP.

**Notification resolution:** The social post itself is the notification. When a card holder arrives via a shared link, they see what their card grants on login — scope revealed on arrival, not before.

**Comment capture (MVP):** The system records comments from people who receive a shared memory. A recipient (whether via social share or direct link) may leave a comment in response. Comments are attributed (email, social handle, or anonymous) and stored linked to the specific share instance. Comments do not auto-enter the chronicle — they are visible to the owner in a separate view.

**Future (Phase 2+): file attachments on contributions.** Card holders with contribute permission should eventually be able to attach an image or file to their contribution. Deferred to a phase after contribution access is live.

**Architectural implications:**
- `memory_shares` table: records each share event (memory_id, share_card_id, channel enum: social_media/direct_link/sms, shared_at, share_url or platform identifier)
- `share_comments` table: recipient identity (nullable), comment text, linked to memory_shares.id, created_at. Owner-readable; not a chronicle entry.
- Future: `contribution_attachments` table — file references (blob store key, mime_type) linked to contribution entries

---

### Decision 1 — Retire the video PRD?

**Context:** A file called `Personal-Life-Chronicle-PRD.docx` (Feb 2026) in the project root describes a video-first system (video atomization, facial recognition, media intelligence). It is still active on disk and conflicts with the current voice/interview-first architecture.

**Recommendation:** Yes — move the file to `documentation/archive/` and add a one-line note at project root stating that voice/interview is the primary capture path and video is a Phase 3 input modality.

**Decision needed:** Confirm retirement, or keep it active for a reason.

---

### Decision 2 — Lead with "AI legacy" as marketing pillar?

**Context:** "AI legacy" means positioning Life Chronicle as the system that makes a person's experience, wisdom, and emotional life accessible to future AI — not just to family. The data model fully supports this. The question is whether to make it the primary value proposition now or earn it after the product has demonstrated simpler value first.

**Recommendation:** Earn it later. Lead MVP marketing with the personal and family value ("your life, organized and remembered"), and position AI legacy as the product's deeper mission for a second wave of messaging once the core experience is proven.

**Decision needed:** Lead with AI legacy now, or hold it for Phase 2 messaging?

---

### Decision 3 — Phase 0 as multi-session with mid-flight artifacts, or single onboarding interview?

**Context:** Phase 0 is the four-stage ontology bootstrap (temporal skeleton → chapter naming → entity seed → topic map). Option A (recommended): each stage is a separate session, 15–30 minutes each, and the user receives a visible artifact at the end of each one — the life globe after Stage 1, an entity portrait after Stage 3, a chapter narrative after Stage 4. This gives value before the whole bootstrap is complete and reduces dropout. Option B: Phase 0 is a single longer onboarding interview, everything upfront before any artifact appears.

**Recommendation:** Multi-session with mid-flight artifacts. Non-technical adults will not complete a 90-minute onboarding interview. Four 20-minute sessions with a reward at the end of each is both more completable and more trust-building.

**Decision needed:** Multi-session (recommended), or single session?

---

### Decision 4 — MVP synthesis pair: place portrait + chapter narrative, or substitute?

**Context:** The gap review proposed the MVP produce two synthesis types: place portrait (entity_biography for places, powers the globe hover) and chapter narrative (life_period_narrative, requires user_periods). Alternatives to consider: Relationship Portrait (most emotionally meaningful for family sharing, but requires richer entity data than MVP may have); Wisdom Distillation (most differentiated competitive advantage, but requires The Stroll feature which is Phase 2). 

**Recommendation:** Keep place portrait + chapter narrative. Place portrait delivers the globe experience (immediate visual delight); chapter narrative is what users will share first. Relationship Portrait and Wisdom Distillation are stronger artifacts but require more data to be good.

**Decision needed:** Confirm the pair, or substitute one?

---

### Decision 5 — Channel scope: web + mobile-web + SMS, or add voice-only phone?

**Context:** Current recommendation is web app (desktop and mobile-web) plus SMS as the async capture channel. Voice-only phone (a phone number the user calls to record memories, transcribed and ingested) is a separate channel that could reach older users with lower technical comfort. It adds meaningful build scope.

**Recommendation:** Defer voice-only phone to Phase 2. Web + mobile-web + SMS is already a three-channel build. The target user for MVP is comfortable enough with a web interface and SMS to not need phone. Validate the core loop first.

**Decision needed:** Defer phone (recommended), or include in MVP?

---

### Decision 6 — Access Cards: "card" or "audience" as the user-facing term?

**Context:** The permission grant object is called a "card" throughout the technical spec. The alternative term "audience" is more familiar from social media (Instagram, etc.) and may be clearer to non-technical users. "Card" connects to the physical-card metaphor (you hand someone a card that gives them access) which may be more intuitive for the use case.

**Recommendation:** "Card" — it maps to the physical intuition of handing someone a permission, and it avoids the social-media connotation of "audience" which feels broadcast-oriented rather than intimate.

**Decision needed:** "Card" or "audience" (or something else)?

---

### Decision 7 — Access Cards: holder notification policy

**Context:** When a chronicle owner adds someone as a card holder, does that person receive a notification? If yes: what does it say, and does it reveal what they have access to? If no: the holder discovers their access only when invited to view the chronicle, which avoids awkwardness but may feel opaque.

**Recommendation:** Notification on add (opt-in by owner), but the notification reveals only that they have been given access to some of Andy's chronicle — not the scope of the card. The holder sees scope only when they log in and view what is available to them.

**Decision needed:** Notify on add (with what message), or no notification until explicit invitation?

---

## After the Session

Once all seven decisions are recorded, update this memory file with Andy's answers, then begin drafting the PRD. The PRD can be structured as:

1. Product Vision and Value Proposition (depends on Decision 2)
2. Target User and Use Cases
3. Phase 0 Onboarding Flow (depends on Decision 3)
4. Feature Scope — MVP / Phase 2 / Phase 3
5. Core User Journeys
6. Data Model Summary (depends on schema additions still pending)
7. Multi-Agent Architecture
8. Privacy Model (depends on Decisions 6–7)
9. MVP Synthesis Artifacts (depends on Decision 4)
10. Non-Functional Requirements
11. Open Questions and Risks
