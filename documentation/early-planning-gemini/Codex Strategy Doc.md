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

