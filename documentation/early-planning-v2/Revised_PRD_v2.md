# Life Chronicle — Product Requirements Document (PRD) — **v2**
**Date:** 2025-10-12

**Mode:** Async‑first voice collection (MVP = async‑only) with a single realtime onboarding interview  
**Platforms:** Web (responsive) for capture & review. **MVP mobile via mobile‑web + SMS**; optional PWA.  
**Deploy:** Lovable Cloud (MVP) → GCP‑ready (future)  
**Data:** Supabase (Postgres + pgvector) with strict RLS  
**Primary users:** Prosumers; founders/bloggers (secondary)  
**Working name:** _TBD_

---

## 1) Vision & Goals
Create a **self‑directed biographical agent** that, over years, prompts the user via short, timely nudges and captures **voice‑first recollections**. The agent:
1) Fills **retrospective timelines** of life events.  
2) Captures **ongoing observations** attached to the timeline.  
3) Solicits **thoughts/opinions** derived from lived experience.  
4) Generates **media‑rich representations** (post‑MVP).  
5) Provides **retrospectives** for memory rehearsal (no health claims).  
6) Acts as the **privacy‑controlling reservoir** for tiered visitor access.  
7) Drives a **taxonomy‑guided interview plan** toward timeline completeness.  
8) Ensures **AI‑ready portability** via **CEF v1** backups.

**MVP stance:** All capture is **asynchronous** (TTS → user record → batch ASR). One **guided realtime** onboarding interview bootstraps personalization.

---

## 2) Personas & Jobs‑to‑be‑Done
- **Prosumer:** time‑poor, wants agent‑led journaling and a curated timeline.  
- **Founder/blogger:** ingest LinkedIn & selected posts; seed future memoir.

Jobs: “Prompt me briefly and often”; “Make it searchable & shareable by audience”; “Keep my data portable.”

---

## 3) Scope
### MVP
- **Mobile‑Web + SMS capture** (no native app). Optional PWA; optional IVR fallback (phone call).
- **Taxonomy‑driven interview** with anchors, coverage maps, ≤2 follow‑ups.
- **Pause & Branch to Note**; fuzzy dates with confidence.
- **Permissions:** Private, Close Friends, Family, Professional, Public; safety defaults (medical/legal/financial → Private).
- **Public profile:** 60–90s voice‑cloned short bio over still image (disclosed).
- **Imports:** LinkedIn positions/education + user‑selected posts; local docs (PDF/DOCX/MD) → proposed entries.
- **Deep Research (opt‑in):** skeleton entries with citations; user acceptance required.
- **Community flagging** (public entries) → Admin queue.
- **Exports:** **CEF v1** ZIP + delta exports; checksums; optional cloud upload.
- **Analytics:** cadence/duration, SMS→record latency, incomplete→complete, **taxonomy coverage**.

### Later
- Tier‑aware avatar Q&A; auto reels; relationship/residence maps; bulk photo/calendar/email ingest; quarantine; Executor role; on‑device ASR/TTS; age‑regressed avatar guidance.

---

## 4) Experience Architecture
### Mobile‑Web capture flow
1) **SMS deep link** (`/recorder?p=<id>&t=<token>`, TTL ≤10m).  
2) User taps **Play** to hear cached **TTS** prompt (≤20s).  
3) Tap **Record** (30–120s) → client‑side **silence trim** → upload.  
4) **Batch ASR** → entry saved as draft; agent may send **≤2 follow‑ups** via SMS.  
5) `/history` shows recent entries; `/settings` manages cadence; `/plan` opens Stripe Portal.

### Realtime onboarding (once)
Web onboarding (WebRTC) sets goals, identifies anchors, and cadence/tone.

### Navigation
Home (Today’s prompts, Incomplete queue, **This Week’s Plan**), Series Dashboards (coverage meters), Timeline (filters), Entry View (media, transcript, tags), Public Profile (mini‑bio + selected public entries).

---

## 5) Privacy & Permissions
- Tiers: Private, Close Friends, Family, Professional, Public (+ future Executor).  
- RLS at DB layer; non‑permitted rows never leave DB or enter embeddings.  
- Indexability: only Public entries in sitemap; others `noindex` + auth.  
- Community flagging → Admin actions: Set Private, Unlist, Dismiss; audit trail.

---

## 6) Data Model
Core tables: `users`, `entities` (people/places/orgs/topics), `events`, `entries`, `media`, `transcripts`, `entry_tags`, `entry_entities`, `relationships`, `vectors`, `flags`, `sources`, `audits`.

**Taxonomy tables:** `taxonomy_nodes`, `taxonomy_i18n`, `taxonomy_prompts`, `taxonomy_versions`, `user_taxonomy_coverage`, `entry_taxonomy`.

Indexes: `entries(user_id,tier)`, `events(user_id,start_at)`, `vectors(owner_type,owner_id)`, taxonomy and link tables.  
RLS on `entries`, `events`, `entities`, `media`, `transcripts` (tier policies).  
Embeddings: store text fields’ vectors with model name in `vectors` (pgvector).

---

## 7) Retrieval (RAG)
Permission filter (SQL/RLS) → metadata filters (time/entities/taxonomy) → pgvector similarity → rerank. Strip non‑permitted content; attach citations for imported items.

---

## 8) Taxonomy‑Driven Interview
Seed taxonomy from spreadsheet (the eight series above).  
Anchors per series (e.g., Career: first_job, first_promotion, toughest_setback; Residences: childhood_home, first_independent_home, significant_move).  
**Planner:** maximize gap closure, date confidence, breadth; respect cadence; **≤2 follow‑ups**.  
**Prompts:** SSML‑ready primary + micro follow‑ups; variables; TTS cached & prefetched.  
**Coverage dashboards** + “This Week’s Plan.”  
User‑defined custom nodes; agent suggests merges and generates 3–5 starter prompts.

---

## 9) Imports & Deep Research
LinkedIn mapping to Career series; prompt to add achievements/lessons.  
Local docs → date/entity extraction → proposed entries.  
Crawler (opt‑in) → candidate entries with citations; require acceptance.

---

## 10) Exports — **CEF v1 (AI‑ready backups)**
**Promise:** work never gets trapped. Regular reminders to download standards‑based, assistant‑agnostic backups.

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
- Transcripts: WebVTT + SRT + rich JSON.  
- Media: WAV/M4A audio; MP4 video; PNG/JPEG images.  
- Checksums: SHA‑256 in manifest + per entry.  
- **Delta exports** since last backup; optional auto‑upload to user cloud.  
- JSON Schema provided at `docs/cef-schema.json`.

---

## 11) Voice, SMS, Media Pipeline
- Twilio SMS deep links with one‑time tokens.  
- TTS: server‑rendered (cached by template hash + variables); require user tap to play.  
- Recording: MediaRecorder preferred; WAV fallback; silence trim; upload caps.  
- ASR: Whisper or Google; SRT + text stored; diarization later.  
- Cost controls: brief TTS; trim silence; batch ASR; retries capped.

---

## 12) Billing (Web‑only)
- Stripe Checkout for purchase; Stripe Customer Portal for management.  
- No native IAP; avoid App Store/Play Store revenue share in MVP.

---

## 13) Analytics & KPIs
Events: `sms_sent`, `deeplink_opened`, `tts_played`, `record_started`, `record_uploaded`, `asr_success`, `entry_completed`, `entry_followup_required`, `taxonomy_coverage_snapshot`.  
KPIs: SMS→record conversion; 7‑day completion rate; taxonomy coverage growth; retention ≥ 25% at 90 days.

---

## 14) Security & Compliance
Passkeys (WebAuthn) + magic link fallback; KMS‑managed encryption; RLS.  
HIPAA roadmap phase 2; “not medical advice” copy.

---

## 15) Tech Stack & Deployment
Lovable.dev + Supabase (pgvector, RLS). TS E2E; React (web); tRPC; workers for embeddings/ASR/exports; Twilio + Stripe.  
Future GCP: Cloud SQL (Postgres+pgvector), Cloud Run, GCS.

---

## 16) Acceptance Criteria (MVP)
- Mobile‑web capture end‑to‑end on iOS Safari and Android Chrome.  
- Realtime onboarding (web) creates 3–5 anchors + cadence.  
- Taxonomy coverage meters & “This Week’s Plan” render and update.  
- RLS tier isolation holds in SQL and vector search.  
- Public profile (mini‑bio) indexable; private routes `noindex`.  
- LinkedIn import + Deep Research produce candidate entries with citations; acceptance required.  
- Export produces **valid CEF v1** ZIP + delta exports; checksums verify.  
- Billing fully managed on web (Stripe).

