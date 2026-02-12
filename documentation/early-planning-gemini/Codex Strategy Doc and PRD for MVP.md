diff \--git a/life-chronicle-strategy.md b/life-chronicle-strategy.md  
new file mode 100644  
index 0000000000000000000000000000000000000000..4bd7ed99dd26a60fa59f00d57d4e9e04ab75a73c  
\--- /dev/null  
\+++ b/life-chronicle-strategy.md  
@@ \-0,0 \+1,62 @@  
\+\# Life Chronicle Architecture & Design Strategy  
\+  
\+\#\# 1\. Product Principles  
\+- \*\*Habit-first, value-always:\*\* Design every flow to reduce capture friction while returning an immediate sense of progress (recaps, coverage deltas, streaks without pressure).  
\+- \*\*Privacy as a feature:\*\* Make tiering and exportability visible; default to safest tiers for sensitive domains.  
\+- \*\*Taxonomy-guided completeness:\*\* Let coverage targets drive prompts, follow-ups, and analytics; avoid random journaling.  
\+- \*\*Voice-primary, text-assisted:\*\* Optimize around async voice capture, but keep low-friction text edits for titles, dates, and tags post-ASR.  
\+  
\+\#\# 2\. System Architecture (MVP-ready)  
\+- \*\*Frontend:\*\* Responsive React web \+ PWA fallback; SMS deep links into recorder (\`/recorder?p=\<id\>\&t=\<token\>\`). Client-side silence trim; upload capped and resumable.  
\+- \*\*APIs:\*\* tRPC for app calls; REST for webhooks (Twilio, Stripe, ASR). Shared TypeScript domain models to prevent drift.  
\+- \*\*Data:\*\* Supabase Postgres with pgvector; strict RLS on \`entries\`, \`events\`, \`media\`, \`transcripts\`, \`entities\`. Permission-tier materialized views for fast filtering.  
\+- \*\*Background jobs:\*\* Queue for TTS rendering, ASR batches, follow-up scheduling, export generation, and backfills. Centralized retry with exponential backoff and dead-letter logging.  
\+- \*\*Storage:\*\* Supabase Storage (abstracted) with migration path to GCS; media keyed by user and entry; pre-signed upload URLs; checksum capture at upload.  
\+- \*\*Observability:\*\* OpenTelemetry traces from request → job → DB; structured logs with user/entry IDs redacted to tier-safe hashes. Error budgets for SMS/ASR/TTS failure rates.  
\+  
\+\#\# 3\. Capture & Prompting  
\+- \*\*Prompt lifecycle:\*\* Cache TTS by template hash \+ variables; invalidate on template change. Prefetch next prompt audio on link open. Auto-play with a 3s countdown when the recorder opens (user tap allowed for autoplay-restricted browsers).  
\+- \*\*Adaptive cadence:\*\* Start at 2–3 prompts/week; adjust via completion rate and user sentiment. Offer pause/snooze plus “memory sprint” bundles (3 prompts/10 minutes).  
\+- \*\*Follow-ups:\*\* Max two micro follow-ups per entry; auto-suggest metadata (title, fuzzy dates, entities, tier) post-ASR for quick confirmation.  
\+- \*\*Serendipity:\*\* Daily “Today’s memory” gentle nudge outside the planned coverage to keep variety high.  
\+  
\+\#\# 4\. Taxonomy Planning & Coverage  
\+- \*\*Anchors first:\*\* During onboarding, lock 3–5 anchors per series; seed coverage map. Planner prioritizes anchor gaps, then breadth, then depth.  
\+- \*\*Coverage scoring:\*\* Track per-series coverage and confidence (dates/entities). Use “This Week’s Plan” to show the next 3–5 prompts plus reasons (“fills Career: promotions gap”).  
\+- \*\*User feedback loop:\*\* Allow “Not relevant” and “Already covered” signals to prune future prompts; log to \`user\_taxonomy\_coverage\` with reasons.  
\+  
\+\#\# 5\. Permissions, Trust, and Sharing  
\+- \*\*Tier defaults:\*\* Medical/legal/finance auto-Private; public routes \`noindex\` except explicit Public entries. Badge tier on every entry view.  
\+- \*\*Community safety:\*\* Public entries support flagging → admin queue with actions (Private/Unlist/Dismiss) plus audit trail.  
\+- \*\*Sharing modes:\*\* Mini-bio with disclosed voice clone; capsule collections (e.g., “Career Highlights”) mapped to tiers. Watermark public media and include attribution for imports.  
\+  
\+\#\# 6\. Imports & Deep Research  
\+- \*\*MVP sources:\*\* LinkedIn positions/education \+ one local doc ingest. Map to taxonomy nodes; generate candidate entries with citations and user approval.  
\+- \*\*Deep research guardrails:\*\* Opt-in only; store citations; route results through the same acceptance flow and tiering defaults.  
\+  
\+\#\# 7\. Exports (CEF v1)  
\+- \*\*Pipelines:\*\* Background job to produce ZIP with manifest checksums; supports full and delta exports. Include WebVTT/SRT/JSON transcripts and optional embeddings.  
\+- \*\*Portability UX:\*\* Remind users to download; provide human-friendly PDF recap alongside structured ZIP for perceived value.  
\+  
\+\#\# 8\. Analytics & Success Metrics  
\+- \*\*Events:\*\* \`sms\_sent\`, \`deeplink\_opened\`, \`tts\_played\`, \`record\_started\`, \`record\_uploaded\`, \`asr\_success\`, \`entry\_completed\`, \`entry\_followup\_required\`, \`taxonomy\_coverage\_snapshot\`, \`export\_started/completed\`.  
\+- \*\*KPIs:\*\* SMS→record conversion, 7-day completion, taxonomy coverage growth, streak adherence, export completion, retention ≥25% at 90 days.  
\+- \*\*User-facing insights:\*\* Weekly recap (“+3 entries, \+2 anchors, Career coverage \+8%”).  
\+  
\+\#\# 9\. Security & Compliance Readiness  
\+- \*\*Auth:\*\* Passkeys (WebAuthn) with magic link fallback. Enforce short-lived deep-link tokens and IP/device binding where possible.  
\+- \*\*Data handling:\*\* KMS-managed encryption for secrets; scoped service-role use; audit access to non-public entries and exports.  
\+- \*\*PII minimization:\*\* Strip non-public text from embeddings; ensure vector search applies tier filters before similarity.  
\+  
\+\#\# 10\. Delivery Roadmap (MVP → Post-MVP)  
\+- \*\*MVP Hardening:\*\* Finish async capture loop, RLS enforcement, coverage meters, export pipeline, Stripe billing, observability, queue-backed ASR.  
\+- \*\*Engagement Boost:\*\* Adaptive cadence, memory sprints, quick review/approve UI, mini recaps.  
\+- \*\*Value Amplification:\*\* Quarterly retrospectives, capsule collections, reactions/comments with tier enforcement.  
\+- \*\*Scale & Trust:\*\* Enhanced audit dashboards, storage abstraction to GCS, on-device ASR/TTS exploration, executor role.  
\+  
\+\#\# 11\. Operating Guidelines  
\+- \*\*Instrumentation-as-default:\*\* New flows must emit analytics \+ traces; define SLOs for SMS delivery (\<5s), ASR latency (p50/p95), and export success.  
\+- \*\*Template hygiene:\*\* Store prompt templates and versions; hash for cache keys; localize via \`taxonomy\_i18n\`.  
\+- \*\*DX:\*\* Provide seed data with taxonomy coverage, mock TTS/ASR adapters, and a replayable “test user day” script for QA.  
\+  
\+This strategy aligns the MVP toward habit-friendly capture, durable trust (privacy \+ exports), and a resilient architecture that can scale to richer storytelling and collaboration.

MVP PRD

diff \--git a/option-a-prd.md b/option-a-prd.md  
new file mode 100644  
index 0000000000000000000000000000000000000000..9084a708d067514d50a962c6a6654fb207f47a66  
\--- /dev/null  
\+++ b/option-a-prd.md  
@@ \-0,0 \+1,153 @@  
\+\# Life Chronicle MVP PRD — Option A (Fastest Path to Delivery)  
\+  
\+\#\# 1\. Purpose & Goals  
\+Deliver a lean, reliable async voice capture product to validate taxonomy-driven prompting and the core data model with minimal integrations and the fastest feasible path to shipping. Success is defined by real users completing the SMS → record → transcript loop on mobile web, seeing plan updates, and exporting their data via CEF v1.  
\+  
\+\#\# 2\. In-Scope (MVP)  
\+- \*\*Platforms:\*\* Responsive web (mobile-first). No PWA/offline. No native apps.  
\+- \*\*Capture:\*\* SMS deep link to \`/recorder?p=\<id\>\&t=\<token\>\` (TTL ≤10 minutes). Cached TTS prompt (≤20s). Single-record flow with client-side silence trim; upload cap enforced. Batch ASR to transcript; draft entry auto-saved.  
\+- \*\*Prompts & Planner:\*\* Seeded taxonomy with anchors per series. Static cadence presets (e.g., 2/week, 4/week). “This Week’s Plan” shows 3–5 prompts. Max two follow-ups per prompt. Simple feedback: \*\*Not relevant\*\* only.  
\+- \*\*Review & Edit:\*\* Recent entries list with tier badge. Quick edit for title/date/tier. Accept/reject ASR transcript corrections. Basic tag suggestions (non-blocking).  
\+- \*\*Imports:\*\* LinkedIn positions/education via OAuth (preferred) or CSV fallback. Imported items become draft entries requiring acceptance.  
\+- \*\*Permissions:\*\* Tiers \= Private, Close Friends, Family, Professional, Public. Sensitive categories default to Private. Public entries indexable; others \`noindex\` \+ auth.  
\+- \*\*Exports:\*\* Manual \*\*CEF v1\*\* ZIP on demand with checksum manifest.  
\+- \*\*Analytics (internal):\*\* Funnel: \`sms\_sent\` → \`deeplink\_opened\` → \`tts\_played\` → \`record\_started\` → \`record\_uploaded\` → \`asr\_success\` → \`entry\_completed\`; \`taxonomy\_coverage\_snapshot\`.  
\+- \*\*Admin:\*\* Minimal flag queue for public entries with actions: Set Private, Unlist, Dismiss; audit trail for admin actions.  
\+  
\+\#\# 3\. Out of Scope / De-scopes (MVP)  
\+- Realtime onboarding interview; avatar Q\&A.  
\+- Adaptive cadence, memory sprints, and serendipity prompts.  
\+- Custom taxonomy nodes; reactions/comments; capsule collections.  
\+- Delta exports; scheduled exports; PWA/offline; IVR fallback.  
\+- Doc ingestion beyond LinkedIn; no bulk media or email/calendar/photo ingest.  
\+  
\+\#\# 4\. Users & Primary Jobs  
\+- \*\*Prosumer storytellers:\*\* Time-poor individuals seeking agent-led journaling with minimal setup.  
\+- \*\*Founders/bloggers (secondary):\*\* Want quick import from LinkedIn to seed a career timeline.  
\+  
\+Jobs-to-be-done:  
\+- “Prompt me briefly and often, without setup complexity.”  
\+- “Let me capture voice quickly and fix basics (title/date/tier) without heavy editing.”  
\+- “Keep my data safe, exportable, and under my control.”  
\+  
\+\#\# 5\. Experience Overview  
\+1) \*\*Prompt delivery:\*\* Twilio SMS with deep link. Link opens mobile web recorder preloaded with TTS prompt.  
\+2) \*\*Capture:\*\* User plays prompt (tap to play), records 30–120s. Client trims silence and uploads.  
\+3) \*\*Processing:\*\* Background job runs batch ASR. Draft entry created with transcript. Up to two follow-up prompts may be sent.  
\+4) \*\*Review:\*\* User sees a dedicated \*\*Incomplete queue\*\* of recent recordings requiring finalization (last 7–10 days), with clear count and urgency badges. Each item shows tier badge, status ("needs title/date" or "transcript ready"), and quick actions (Play audio, Accept transcript, Set tier). Users can swipe/tap to mark done or defer; full edit (title/date/tier) remains available.  
\+5) \*\*Plan updates:\*\* “This Week’s Plan” shows remaining prompts; completed items update within minutes of ASR success.  
\+6) \*\*Imports:\*\* User connects LinkedIn (or uploads CSV). Imported positions/education appear as draft entries with default tier and taxonomy mapping.  
\+7) \*\*Export:\*\* User can request a CEF v1 ZIP; job generates manifest with checksums and notifies user when ready.  
\+  
\+\#\# 6\. Functional Requirements  
\+\#\#\# 6.1 Prompting & Planner  
\+- Seed taxonomy (anchors per series) stored in DB; versioned templates with hashes for TTS caching.  
\+- Static cadence presets selectable in settings; default 2/week.  
\+- Planner produces weekly plan (3–5 prompts) using coverage gaps and anchors; supports up to two follow-ups per prompt.  
\+- “Not relevant” feedback removes prompt instance and logs reason; does not create new nodes.  
\+  
\+\#\#\# 6.2 Capture & Media  
\+- Deep-link tokens TTL ≤10 minutes; one-time use. Expired tokens prompt re-request flow.  
\+- Recorder supports tap-to-play TTS, then tap-to-record; handles iOS/Android mobile browsers.  
\+- Client-side silence trim; enforce size/duration caps. Upload via pre-signed URL with checksum.  
\+- Background ASR job transcribes audio; attaches SRT/text transcript to draft entry.  
+- **Smart Receipt:** Post-ASR, send a 1-sentence summary via SMS: "Got it! You recorded a memory about [Summary]. View it here: [Link]"
\+  
\+\#\#\# 6.3 Entries & Editing  
\+- Draft entry auto-created with transcript, prompt metadata, taxonomy node reference, and tier default based on category.  
\+- Recent entries list plus \*\*Incomplete queue\*\* shows status (draft/completed), tier badge, created date, and prompt source (planner/follow-up/import). Queue prioritizes drafts needing minimal confirmation (title/date/tier acceptance) and drops items once completed.  
\+- Quick edit UI: title, fuzzy date (year/month/day), tier dropdown. Transcript correction accept/reject per suggestion. Provide \*\*one-tap finalize\*\* that accepts transcript \+ default tier for users who cannot edit immediately; edits remain possible later.  
\+- Tag suggestions displayed; user can ignore; acceptance adds to \`entry\_tags\`.  
\+  
\+\#\#\# 6.4 Imports (LinkedIn)  
\+- OAuth for LinkedIn; CSV fallback with documented template. Map positions/education to taxonomy nodes and default tiers (Professional).  
\+- Imported items become draft entries in a **Staging** state, requiring explicit user acceptance and tiering before publication or inclusion in any public/shared views.
+- Acceptance logs source and checksum for future graph provenance.
\+  
\+\#\#\# 6.5 Permissions & Admin  
\+- Tier enforcement via RLS on \`entries\`, \`events\`, \`media\`, \`transcripts\`, \`entities\`.  
\+- Public entries indexable; others \`noindex\` and require auth. Tier badge shown on entry detail and list views.  
\+- Public entries can be flagged; admin queue shows entry, reason, and actions (Set Private, Unlist, Dismiss) with audit log.  
\+  
\+\#\#\# 6.6 Exports (CEF v1)  
\+- User-initiated export creates background job. Output ZIP structure per CEF v1; includes manifest with SHA-256 checksums for all files.  
\+- Supports full export only (no delta). Notify user when ready; provide download link with short TTL pre-signed URL.  
\+  
\+\#\#\# 6.7 Analytics & Observability  
\+- Emit funnel events with user/session IDs (hashed where required). Capture timestamps and prompt IDs.  
\+- Capture taxonomy coverage snapshots nightly or upon entry completion.  
\+- Basic health dashboard: SMS delivery success, ASR latency p50/p95, export success rate.  
\+  
\+\#\#\# 6.8 Incomplete Queue UX (for low-interaction users)  
\+- Dedicated \*\*Incomplete\*\* tab/card stack on Home showing recordings awaiting confirmation; badge shows count and oldest age.  
\+- Each item supports voice-first review: play/pause audio, short transcript preview, and two primary buttons: \*\*Finalize\*\* (accept transcript \+ default tier) and \*\*Mark Private\*\* (one-tap tier change \+ finalize). Secondary action: "Edit details" for title/date edits when time allows.  
\+- Offline-friendly reminder email/SMS summarizing pending items (count \+ deep link) if queue exceeds threshold (e.g., \>3 drafts or oldest \>7 days).  
\+- Auto-batching: multiple drafts can be finalized in sequence via a minimal loop (Play → Finalize → Next) without returning to list.  
\+  
\+\#\# 7\. Non-Functional Requirements  
\+- \*\*Performance:\*\* Recorder load ≤2s on 4G; TTS play latency ≤1s after tap; ASR turnaround target ≤10 minutes p50, ≤30 minutes p95.  
\+- \*\*Reliability:\*\* Deep-link delivery success ≥98%; export job success ≥95% on first attempt with retries.  
\+- \*\*Security:\*\* Short-lived deep-link tokens; KMS-managed secrets; service role keys never exposed to client. Strip non-public text from embeddings.  
\+- \*\*Compliance posture:\*\* RLS enforced for all tiered tables; audit admin actions; \`noindex\` on non-public routes.  
\+- \*\*Accessibility:\*\* Recorder and lists navigable via screen reader; visible tier badges; color-contrast compliant.  
\+  
\+\#\# 8\. Data Model Notes (aligned to Option A)  
\+- Core tables: \`users\`, \`entities\`, \`events\`, \`entries\`, \`media\`, \`transcripts\`, \`entry\_tags\`, \`entry\_entities\`, \`taxonomy\_nodes\`, \`taxonomy\_prompts\`, \`taxonomy\_versions\`, \`user\_taxonomy\_coverage\`, \`vectors\`, \`flags\`, \`audits\`, \`sources\`.  
\+- Defaults: entries from sensitive domains auto-Private; LinkedIn imports default Professional.  
\+- Vector storage for transcripts (\`vectors\` with model \+ tier). Enforce RLS filters before similarity search.  
\+  
\+\#\#\# 8.1 GraphDB Readiness — Data Collection Prerequisites  
\+- \*\*Stable identifiers:\*\* Assign deterministic \`entity\_id\` and \`event\_id\` keys plus \`source\` provenance; require \`sources\` rows for imports to make future graph edge provenance auditable.  
\+- \*\*Relationship capture:\*\* Collect structured relationship types during data entry and import (e.g., \`relationship\_type\`: mentor, manager, peer, family, collaborator) between \`entities\` and the user or other entities; store in \`relationships\` with timestamps.  
\+- \*\*Role \+ timeframe:\*\* For people/org relationships, capture \`role\` and fuzzy date ranges (\`start\_at\`, \`end\_at\`, confidence) to support temporal edges.  
\+- \*\*Entity normalization:\*\* Require minimal attributes for dedup (name, type, primary handle, optional external IDs) and log confidence scores; store proposed merges but keep originals to avoid premature loss.  
\+- \*\*Edge-level tiering:\*\* Apply tier/visibility on relationship edges (not just entries) so future graph queries respect permissions.  
\+- \*\*Prompts to structure:\*\* When prompting, request key graph facts: who/where/role, approximate dates, relationship type, and outcome; nudge for missing entities after ASR (lightweight confirmations only for MVP).  
\+- \*\*Embeddings & graph parity:\*\* Keep text spans used to derive edges alongside vectors; tag vectors with \`owner\_type\` (entry vs. entity vs. relationship) to align future hybrid search (vector \+ graph traversal).  
\+  
\+\#\# 9\. User Flows (happy path summaries)  
\+1) \*\*Prompt → Capture → Draft\*\*  
\+   \- Planner schedules prompt → SMS deep link sent → user opens recorder → plays TTS → records → upload → ASR job → draft entry visible with transcript.  
\+2) \*\*Plan Update\*\*  
\+   \- User completes prompt → ASR success → plan marks prompt complete → remaining prompts reorder if needed.  
\+3) \*\*Quick Edit\*\*  
\+   \- From Recent entries → select draft → edit title/date/tier → save → entry marked completed.  
\+4) \*\*LinkedIn Import\*\*  
\+   \- User connects LinkedIn → positions/education pulled (or CSV uploaded) → draft entries created → user accepts/rejects each.  
\+5) \*\*Export\*\*  
\+   \- User requests export → job builds CEF v1 ZIP \+ manifest → email/SMS notification → user downloads via time-bound link.  
\+  
\+\#\# 10\. Dependencies  
\+- Twilio (SMS), TTS provider (cached), ASR provider (batch), LinkedIn API, Supabase (Postgres \+ pgvector \+ Storage), Stripe (billing already assumed), background job runner/queue.  
\+  
\+\#\# 11\. Risks & Mitigations  
\+- \*\*Mobile browser quirks (autoplay/recording):\*\* Require user tap to play; provide fallback instructions; test on iOS Safari/Android Chrome.  
\+- \*\*ASR latency:\*\* Batch jobs with retries and alerting; cap audio length to control costs/latency.  
\+- \*\*LinkedIn API variance or rate limits:\*\* Provide CSV fallback; cache OAuth tokens securely; progressive disclosure of import status.  
\+- \*\*User trust on privacy:\*\* Prominent tier badges; clear \`noindex\` defaults; easy set-to-Private action; export availability highlighted.  
\+- \*\*Plan staleness:\*\* Trigger plan recalculation on completion and nightly; show timestamp of last update.  
\+  
\+\#\# 12\. Rollout Plan  
\+- \*\*Alpha (internal):\*\* Smoke-test capture loop, ASR, and plan updates with seeded taxonomy.  
\+- \*\*Beta (invite-only):\*\* 20–50 users; monitor funnel metrics; harden RLS and export validation.  
\+- \*\*MVP Launch:\*\* Broader release with support docs; monitor p50/p95 ASR and SMS→record conversion; backlog only critical fixes.  
\+  
\+\#\# 13\. Success Metrics (MVP)  
\+- ≥60% SMS→record conversion in first week of use.  
\+- ≥70% ASR jobs complete within 30 minutes.  
\+- ≥50% of active users complete at least 3 prompts in Week 1\.  
\+- ≥1 successful CEF v1 export per active user within first month.  
\+- \<1% of public entries flagged and confirmed as policy violations post-admin review.  
\+  
\+\#\# 13.1 Pre-Development Refinements (recommended)  
\+- \*\*Acceptance criteria alignment:\*\* Define a short acceptance list tied to each critical loop (capture → ASR → draft; Incomplete finalize loop; LinkedIn import; export generation) so QA can validate end-to-end with fixture accounts.  
\+- \*\*Error and recovery states:\*\* Add UX states for expired/invalid deep links, ASR failure (retry or re-record), and export failures with retry guidance; ensure SMS copy includes re-request paths.  
\+- \*\*Cadence guardrails:\*\* Decide whether to cap concurrent pending prompts/drafts to avoid overwhelming the Incomplete queue (e.g., pause new prompts when \>5 drafts older than 7 days).  
\+- \*\*Tier safety defaults:\*\* Require explicit confirmation before publishing any entry to Public when transcript confidence is below threshold or missing title/date; provide “make Private” as the safest default in the finalize loop.  
\+- \*\*Mobile resilience checks:\*\* Document minimum browser/device support, microphone permission handling, and fallback guidance for autoplay restrictions to reduce launch-day surprises.  
\+- \*\*LinkedIn import verifications:\*\* Specify mapping validations (e.g., detect duplicate positions, missing dates) and the minimal fields required to create a draft entry; log skipped records for QA.  
\+- \*\*Observability baseline:\*\* Predefine alert thresholds for SMS delivery drop, ASR latency, export failure rate, and queue backlog so SRE can set monitors before beta.  
\+- \*\*Accessibility review:\*\* Schedule a quick WCAG pass on recorder, Incomplete queue, and list interactions (focus order, keyboard/touch targets, transcript readability) before beta.  
\+  
\+\#\# 14\. Open Questions  
\+- Should default cadence be 2/week or 3/week for first-run users?  
\+- Do we enforce maximum of one active deep-link token per user to avoid confusion?  
\+- Is tag suggestion model rule-based (taxonomy-derived) or embedding-based at launch?

