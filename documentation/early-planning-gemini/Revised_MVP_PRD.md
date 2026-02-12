# Life Chronicle Gemini - Revised MVP PRD

## 1. Executive Summary
**Life Chronicle Gemini** is a voice-first, AI-guided biographical agent designed to help users capture their life story with minimal friction. The MVP focuses on establishing the core habit loop: **Prompt → Record → Transcript → Value**.

**Core Philosophy:** "Habit-first, Value-always."
**Target Audience:** Prosumer storytellers and individuals seeking a low-effort way to document their legacy.

## 2. MVP Scope & Objectives
**Goal:** Validate the async voice capture loop and taxonomy-driven planning with real users.
**Success Metric:** 60% SMS-to-Record conversion; 3+ entries per week per active user.

### In-Scope (MVP)
- **Authentication:** Magic Link / Passkey (via Supabase).
- **Capture:** Mobile-web optimized recorder (Deep link access).
- **Planning:** Basic Taxonomy Seeder + "This Week's Plan" (3 prompts/week).
- **Processing:** Async ASR (Speech-to-Text) + Basic Entity Extraction.
- **Review:** "Incomplete Queue" for approving transcripts.
- **Output:** Simple Timeline View + CEF v1 Export (ZIP).

### Out-of-Scope (Deferred)
- **Complex GraphDB:** No complex relationship mapping for MVP.
- **Community/Social:** No public sharing feeds, no "admin flagging" queue (User data is Private by default).
- **Deep Imports:** No full LinkedIn/Drive imports (Manual entry or simple CSV only). **Privacy First:** All imported data starts in a "Staging" state, requiring explicit user approval and tiering before publication.
- **Native App:** Web/PWA only.

## 3. User Experience (UX)

### 3.1 The Core Loop
1.  **Trigger:** User receives an SMS/Email with a "magic link" to a specific prompt (e.g., "Tell me about your first job").
2.  **Capture:**
    - Link opens mobile web recorder.
    - **One-Tap Start:** Prompt audio pre-fetches. User taps ONCE to play prompt and start recording countdown (3s).
    - **Recording:** Visual waveform feedback. "Done" button uploads immediately.
3.  **Processing:**
    - User sees "Processing..." state.
    - Background job handles ASR.
4.  **Review (Async):**
    - Notification when transcript is ready.
    - User opens "Incomplete Queue".
    - **Quick Actions:** "Looks good" (Approve) or "Edit" (Text fix).
    - **Smart Defaults:** If user does nothing, auto-approve after 7 days with "Draft" tag.
5.  **Smart Receipt:** Post-ASR, send a 1-sentence summary via SMS: "Got it! You recorded a memory about [Summary]. View it here: [Link]"

### 3.2 Visual Design Guidelines
- **Aesthetic:** "Premium Personal Archive". Dark mode default. Serif fonts for reading (e.g., Merriweather), clean Sans for UI (e.g., Inter).
- **Feedback:** Rich micro-interactions.
    - *Recording:* Subtle pulsing glow.
    - *Completion:* Satisfying "check" animation and progress bar fill.
- **Dashboard:**
    - **Timeline:** Vertical stream of approved entries.
    - **Memory Map:** A prominent visual progress indicator (e.g., a tree or filling circle) showing "Life Coverage" (Early Life, Career, Family) to visualize data value.

## 4. Functional Requirements

### 4.1 Authentication & User Profile
- **Supabase Auth:** Magic Link primary.
- **Profile:** Name, DOB (for age-based prompting), Timezone.

### 4.2 Taxonomy & Planner
- **Anchor Sprint (Onboarding):** New users begin with a 3-prompt mandatory sequence (Birthplace, First Career Milestone, Key Life Mentor) to seed the taxonomy immediately.
- **Logic:** Select 3 prompts/week from "Open" buckets.
- **Adaptive:** If user misses 2 weeks, switch to "Easy Mode" (1 fun prompt/week).

### 4.3 Recorder (Web)
- **Tech:** HTML5 MediaRecorder API.
- **Features:**
    - Silence detection (client-side trim).
    - Resumable upload (TUS protocol if possible, or chunked).
    - Max duration: 5 minutes.

### 4.4 Data Model (Simplified)
- `users`: id, email, preferences.
- `entries`: id, user_id, audio_url, transcript_text, status (draft, approved), prompt_id.
- `prompts`: id, text, category (taxonomy_node).
- `taxonomy_nodes`: id, name (e.g., "Career", "Childhood").

### 4.5 Export
- **Format:** CEF v1 (Common Export Format).
- **Content:** ZIP file containing:
    - `manifest.json` (Metadata)
    - `/audio` (Original MP3/WebM)
    - `/text` (Markdown files of transcripts)
- **CEF v1 Validator:** Technical check in the export pipeline to ensure ZIP compliance with manifest schema and checksums before notification.

## 5. Technical Architecture

### 5.1 Recommended Stack: Supabase + React
**Rationale:** While Google Firebase is excellent, **Supabase (PostgreSQL)** is recommended for Life Chronicle because:
1.  **Structured Data:** The relationship between `Users`, `Taxonomy`, `Prompts`, and `Entries` is inherently relational. SQL enforces data integrity better than NoSQL (Firestore) for this use case.
2.  **Vector Search:** `pgvector` is native to Postgres, allowing seamless integration of semantic search (for "Recall" features) without external services.
3.  **AI Compatibility:** Strong typing and SQL schemas allow Antigravity (the AI) to generate more reliable, bug-free database code compared to flexible NoSQL schemas.

### 5.2 Detailed Specifications

#### Frontend (Client)
- **Framework:** React 18+ (Vite)
- **Language:** TypeScript (Strict mode)
- **State Management:** React Query (TanStack Query) for server state; Context API for local UI state.
- **Styling:** TailwindCSS + `shadcn/ui` (Radix Primitives) for accessible, premium components.
- **Routing:** React Router v6.

#### Backend (Serverless)
- **Database:** Supabase PostgreSQL.
- **API Layer:** Supabase Client (direct RLS access) for CRUD; Edge Functions (Deno/Node) for privileged logic (ASR, Payments).
- **Auth:** Supabase Auth (Magic Links).

#### Infrastructure Services
- **Hosting:** Vercel or Netlify (for React frontend).
- **Storage:** Supabase Storage (S3-compatible) for:
    - `/raw/{user_id}/{entry_id}.webm` (Original upload)
    - `/processed/{user_id}/{entry_id}.mp3` (Normalized)
- **Compute:** Supabase Edge Functions for:
    - `process-audio`: Triggered on upload. Calls ASR API.
    - `generate-plan`: Cron job to assign weekly prompts.

#### AI Services
- **ASR (Speech-to-Text):** OpenAI Whisper API (via Edge Function).
    - *Fallback:* Deepgram Nova-2 (lower latency).
- **LLM (Intelligence):** Gemini Pro or GPT-4o (via Edge Function) for:
    - Transcript cleanup (removing "ums").
    - Title generation.
    - Taxonomy classification.

### 5.3 Schema Overview (Core Tables)
- **`profiles`**: Extends auth.users (preferences, timezone).
- **`taxonomy_nodes`**: The master list of life topics (hierarchical).
- **`prompts`**: Template questions linked to taxonomy nodes.
- **`user_prompts`**: The "Plan". Links `profiles` + `prompts` + `status` (pending, skipped, completed).
- **`entries`**: The core record. Links `user_prompts` + `transcript` + `audio_path`.
- **`embeddings`**: Vector store for entry text (for future "Ask my life" features).

## 6. Roadmap to Beta
1.  **Week 1:** Scaffold Repo, Auth, Basic Recorder.
2.  **Week 2:** ASR Pipeline (Edge Function), Taxonomy Seeder.
3.  **Week 3:** Dashboard/Timeline UI, Incomplete Queue.
4.  **Week 4:** Polish, Export, End-to-End Testing.
