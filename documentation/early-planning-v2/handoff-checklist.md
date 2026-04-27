# Life Chronicle — Handoff Checklist (MVP, Async-First, Mobile-Web + SMS)

## 1) Repos & Files
- [ ] Use monorepo layout: `apps/web`, `apps/server`, `packages/ui`, `packages/types`
- [ ] Pull these spec files into the repo:
  - `/docs/Revised_PRD_v2.md`
  - `/docs/lovable-build-spec.v2.md`
  - `/docs/cef-schema.json`
  - `/docs/PRD_Addendum_MobileWeb_SMS.md` (optional reference)
  - `/tools/taxonomy-seeder.ts`
  - `/supabase/migrations/000_init.sql`

## 2) Environment & Keys
- [ ] `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `JWT_SECRET`
- [ ] `OPENAI_API_KEY` (or alternate embeddings provider)
- [ ] `TTS_API_KEY`
- [ ] `ASR_API_KEY`
- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_VOICE_NUMBER` (optional IVR)
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] `PUBLIC_SITE_URL` (e.g., `https://app.yourbrand.com`)

## 3) Supabase Setup
- [ ] Enable extensions:
  - `pgcrypto`, `vector`
- [ ] Apply migration: `/supabase/migrations/000_init.sql`
- [ ] RLS: enabled for `entries`, `events`, `entities`, `media`, `transcripts`
- [ ] JWT claim for visitor tier: `role_tier` (public|professional|family|close_friends)
- [ ] Validate indices exist (see SQL)

## 4) Data Model (Key Tables)
- [ ] Core: `users`, `entries`, `events`, `media`, `transcripts`, `entities`
- [ ] Links: `entry_tags`, `entry_entities`, `relationships`
- [ ] Vectors: `vectors (pgvector)`
- [ ] Moderation & provenance: `flags`, `sources`, `audits`
- [ ] **Taxonomy**: `taxonomy_nodes`, `taxonomy_i18n`, `taxonomy_prompts`, `taxonomy_versions`, `user_taxonomy_coverage`, `entry_taxonomy`

## 5) Taxonomy Seeder (once per environment)
- [ ] Install deps: `npm i @supabase/supabase-js xlsx ts-node typescript -D`
- [ ] Set env: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Run: `ts-node tools/taxonomy-seeder.ts ./WisdomTopicSort.xlsx`
- [ ] Confirm:
  - `taxonomy_nodes` populated (series/topic/question)
  - `taxonomy_prompts` have primary + followups
  - `taxonomy_versions` bumped

## 6) Mobile-Web + SMS Capture (No Native App)
- [ ] **Routes/pages (web):**
  - `/recorder` (deep-link landing)
  - `/history` (last 5 entries)
  - `/settings` (cadence, quiet hours, TTS speed, PWA tip)
  - `/plan` (opens Stripe Customer Portal)
- [ ] **Deep link** service:
  - `POST /api/sms/send` → signed one-time token (TTL ≤10m), prompt id
  - SMS format: `https://app.yourbrand.com/recorder?p=<promptId>&t=<token>`
- [ ] Recorder:
  - Prefer `MediaRecorder` (AAC/Opus), fallback **WAV via AudioWorklet**
  - Client-side silence trim (~ −40 dB, head/tail)
  - Cap: ≤3 min, mono 16–22.05 kHz
- [ ] TTS:
  - Server-render SSML → MP3/M4A
  - Cache key: template-hash + variables
  - Prefetch when SMS is sent
  - Require user tap to play (autoplay policy)
- [ ] Uploads:
  - `POST /api/recordings` → signed URL issuance
  - `POST /api/ingest` → enqueue ASR → create entry → link taxonomy nodes
- [ ] **Optional IVR**:
  - Twilio Voice number plays same prompt → records → posts to `/api/ingest`

## 7) RAG Retrieval (Visitor & User)
- [ ] Filter by **permissions** (SQL/RLS) first
- [ ] Add metadata filters (time, entities, taxonomy)
- [ ] Run pgvector similarity on allowed rows
- [ ] App-level rerank/dedupe

## 8) Billing (Web-only)
- [ ] Stripe **Checkout** for purchase/upgrade
- [ ] Stripe **Customer Portal** for plan management
- [ ] Webhook: `POST /api/billing/webhook` to sync subscription state
- [ ] **No native IAP**; no App Store/Play Store distribution in MVP

## 9) CEF v1 Exports (AI-Ready Backups)
- [ ] Export job produces ZIP:
  ```
  /manifest.json
  /users/<user-id>/profile.json
  /users/<user-id>/entities.json
  /users/<user-id>/taxonomy.json
  /users/<user-id>/events.json
  /users/<user-id>/entries/<entry-id>/entry.json
  /users/<user-id>/entries/<entry-id>/transcript.vtt
  /users/<user-id>/entries/<entry-id>/transcript.srt
  /users/<user-id>/entries/<entry-id>/transcript.json
  /users/<user-id>/entries/<entry-id>/media/*
  /users/<user-id>/entries/<entry-id>/embeddings.json (optional)
  ```
- [ ] Include SHA-256 checksums in `manifest.json` and per-entry `entry.json`
- [ ] Delta exports: “since last backup”
- [ ] Validate with `/docs/cef-schema.json`
- [ ] UI: monthly reminder to download backup; optional auto-upload to user cloud

## 10) Analytics (PostHog + OTEL)
**Funnels & events**
- [ ] `sms_sent` → `deeplink_opened` → `tts_played` → `record_started` → `record_uploaded` → `asr_success` → `entry_completed`
- [ ] `entry_followup_required`, `taxonomy_coverage_snapshot`
**Errors**
- [ ] `mic_denied`, `media_recorder_unsupported`, `upload_failed`, `asr_failed`

## 11) Security & Compliance
- [ ] Auth: Passkeys (WebAuthn) + magic link fallback
- [ ] Storage encryption: KMS-managed keys
- [ ] RLS: enforce tier visibility in both SQL & vector queries
- [ ] SEO: only Public tier indexed; others `noindex`
- [ ] Copy: “not medical advice”; HIPAA roadmap (phase 2)

## 12) Cost Guardrails
- [ ] TTS ≤ 20s per prompt; cache aggressively
- [ ] Silence trim client-side; drop >3 min attempts
- [ ] Batch ASR processing; retries capped
- [ ] Compress uploads; show progress

## 13) QA Matrix (browsers/devices)
- [ ] iOS Safari 16+ (record/play/autoplay tap, WAV fallback, upload)
- [ ] Android Chrome 111+ (MediaRecorder happy path)
- [ ] Airplane mode / flaky network (retry, partial capture handling)
- [ ] SMS deep link TTL & invalid token behavior
- [ ] Stripe: Checkout, Portal, Webhook happy paths

## 14) Acceptance Criteria (must-pass)
- [ ] Mobile-web capture works E2E on iOS Safari & Android Chrome
- [ ] Realtime onboarding (web) creates 3–5 anchors + cadence settings
- [ ] Taxonomy coverage meters & “This Week’s Plan” update correctly
- [ ] Permissions enforced in SQL and vector search (no context leaks)
- [ ] Public profile mini-bio renders; non-public routes `noindex`
- [ ] LinkedIn import & Deep Research create **candidate entries** with citations and require user acceptance
- [ ] CEF v1 ZIP exports validate against `/docs/cef-schema.json` and include checksums; delta exports work
- [ ] Billing end-to-end on web (Checkout/Portal/Webhook), no native IAP

## 15) Nice-to-Haves (post-MVP)
- [ ] PWA install & Web Push (installed PWAs only)
- [ ] IVR capture adoption tracking
- [ ] Entity merge/suggest tooling
- [ ] “This Week’s Plan” A/B tests (breadth vs depth prompting)

---

### Quick test commands (illustrative)
```bash
# Send an SMS deep link (dev)
curl -X POST https://app.yourbrand.com/api/sms/send   -H "Authorization: Bearer <admin-token>"   -H "Content-Type: application/json"   -d '{"userId":"<uuid>","promptId":"<uuid>"}'

# Create a signed upload URL
curl -X POST https://app.yourbrand.com/api/recordings   -H "Authorization: Bearer <user-jwt>"   -H "Content-Type: application/json"   -d '{"mime":"audio/webm"}'

# Finalize ingest (simulate after upload)
curl -X POST https://app.yourbrand.com/api/ingest   -H "Authorization: Bearer <user-jwt>"   -H "Content-Type: application/json"   -d '{"uploadId":"<id>","promptId":"<uuid>"}'
```
