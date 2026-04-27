# Lovable.dev Build Spec — Life Chronicle (Async‑First MVP) — **v2**
**Date:** 2025-10-12

**Mode:** Async capture by default; single realtime onboarding interview (feature‑flag)  
**Targets:** Web (responsive) + iOS (React Native optional later). **MVP mobile = mobile web + SMS; optional PWA.**  
**Infra:** Lovable Cloud + Supabase (Postgres + pgvector + RLS)  
**Stack:** TypeScript end‑to‑end; React (Web); (Future) React Native (iOS); tRPC APIs; REST webhooks (Twilio, exports)  
**Vendors:** Twilio (SMS and optional IVR), TTS_PROVIDER (neural TTS + cache), ASR_PROVIDER (Whisper or Google STT), Stripe (Checkout + Customer Portal)

---

## 0) Repo & Env
Monorepo: `apps/web`, `apps/server`, `packages/ui`, `packages/types` (mobile later).

Env vars
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
OPENAI_API_KEY=            # embeddings (pluggable)
TTS_API_KEY=
ASR_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_VOICE_NUMBER=       # optional IVR
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PUBLIC_SITE_URL=
```

---

## 1) Supabase
Enable extensions:
```sql
create extension if not exists "pgcrypto";
create extension if not exists "vector";
```
Run schema from `/supabase/migrations/000_init.sql` (includes taxonomy tables, vectors, RLS scaffolding).

---

## 2) Taxonomy‑Driven Interview System
**Tables:** `taxonomy_nodes`, `taxonomy_i18n`, `taxonomy_prompts`, `taxonomy_versions`, `user_taxonomy_coverage`, `entry_taxonomy`.

**Planner:**
- Anchors per series (Career/Education, Residences, Relationships, Vehicles, Hobbies/Creative/Sports, Travel, Financial, Major Life Events).
- Chooses prompts to close timeline gaps, improve date confidence, balance breadth; **≤2 follow‑ups** per entry.
- Renders **This Week’s Plan** and per‑series coverage meters.

**Prompts (SSML):**
- Primary ≤ 20s; micro follow‑ups for date/person/place; variables `{person}`, `{place}`, `{year_guess}`.
- TTS cached by template hash + variables; prefetched when sending SMS.

**Seeder:**
- Node/TS ETL to ingest `WisdomTopicSort.xlsx` → taxonomy. (See `tools/taxonomy-seeder.ts`.)

---

## 3) Mobile‑Web + SMS Capture (No native app in MVP)
**Flow:** SMS deep link → `/recorder` → user taps to play cached TTS → records 30–120s → upload → batch ASR → entry draft → agent may issue ≤2 follow‑ups via SMS.

**Auth:** Magic links + one‑time deep link tokens (TTL ≤10m; scoped to prompt + user).

**Recording:** Prefer `MediaRecorder` (AAC/Opus). Fallback: **WAV via AudioWorklet**. Client‑side silence trim (≈−40 dB). Upload cap 3m; mono 16–22.05 kHz.

**PWA (optional):** manifest + service worker; Web Push only for installed PWAs (SMS remains primary).

**Optional IVR fallback:** Twilio voice line plays the same prompt (TTS) and records; posts to `/api/ingest` with metadata.

**Pages (web):**
- `/recorder`: Play prompt, record, waveform, send; errors (mic, upload, network).
- `/history`: last 5 entries; transcript + tier; quick share for Public.
- `/settings`: cadence (1–5/day), quiet hours, TTS speed, PWA install tip.
- `/plan`: “Manage Plan” → Stripe Customer Portal.

---

## 4) Billing (Web‑only)
- Stripe Checkout for purchase and upgrades; Stripe Customer Portal for plan management.  
- Do **not** implement native IAP; no App Store/Play Store distribution in MVP.

---

## 5) APIs (tRPC & REST)
tRPC namespaces:
- `entries`: `createFromUpload`, `getTimeline`, `searchHybrid`, `markTier`, `markIncomplete`
- `taxonomy`: `getPlan`, `getCoverage`, `createCustomNode`, `mergeSuggestion`
- `flags`: `create`, `resolve`
- `export`: `createFull`, `createDelta`, `status`, `download`

REST/webhooks:
- `POST /api/sms/send` → creates signed deep link token + sends SMS.
- `POST /api/recordings` → signed upload URL issuance.
- `POST /api/ingest` → finalize upload, enqueue ASR, create entry + taxonomy links.
- `GET /api/prompts/:id` → returns TTS URL + metadata (cached).
- `POST /api/billing/webhook` → Stripe events (customer.subscription.*, checkout.session.completed).

---

## 6) Retrieval & Generation (RAG)
- Permission‑first SQL filter (RLS) → metadata filters (time/entities) → pgvector similarity → rerank/dedupe.  
- Never load non‑permitted rows into the context window; store model name with embeddings.

---

## 7) Export — **CEF v1**
ZIP layout:
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
- JSON UTF‑8; ISO‑8601; optional schema.org `@type`.  
- Checksums (SHA‑256) in manifest and per entry.  
- **Delta exports** (since last backup). Optional auto‑upload to user cloud.

JSON Schema provided at `docs/cef-schema.json`.

---

## 8) Analytics
- Events: `sms_sent`, `deeplink_opened`, `tts_played`, `record_started`, `record_uploaded`, `asr_success`, `entry_completed`, `entry_followup_required`, `taxonomy_coverage_snapshot`.
- Error events: `mic_denied`, `media_recorder_unsupported`, `upload_failed`, `asr_failed`.
- KPIs: SMS→record conversion, % entries completed in 7 days, taxonomy coverage growth, 90‑day retention ≥ 25%.

---

## 9) Security & Compliance
- Passkeys + magic links. KMS‑managed encryption for storage. RLS‑first.  
- HIPAA roadmap phase 2 (BAAs, expanded audit logs). Public tier indexable; others `noindex` + auth.

---

## 10) Testing & SLOs
- Browsers: iOS Safari 16+, Android Chrome 111+.  
- SLOs: deep‑link open ≤2s TTFB; TTS tap→play ≤300ms (cached); 2‑min upload ≤10s LTE.  
- Verify RLS enforcement in SQL and vector search; export validates against `cef-schema.json`.

