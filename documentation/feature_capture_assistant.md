# Feature Spec: Capture Assistant + Orchestrator Agent

**Status:** Draft v1.1 — 2026-05-17. Companion to `feature_residential_globe_onboarding.md` v1.1. This feature is the always-present input surface for the chronicle and introduces a new architectural element — the Orchestrator Agent — that reasons about every new submission before any sub-agent runs.

v1.1 incorporates Andy's review notes (2026-05-17): system prompt restructured to separate generic agent instructions from per-user chronicle context; orchestrator tools expanded beyond memory creation to include external-media search and interactive-interview proposal; user-guidance area reframed as open-ended conversational priming; bulk-upload backlog unified with the "Things to come back to" view into a single review queue workflow; Notion ingest/publish pinned as future bidirectional integration; private user notes added as a schema-level concept (owner-only commentary on a card regardless of its sharing permissions); prompt caching and dream-compaction strategy added for cost and latency efficiency.

**Author note:** This spec captures Andy's design decisions (2026-05-10, refined 2026-05-17): (1) the capture assistant is the primary surface for all new content, not just the interview; (2) an orchestrator LLM with broad chronicle context coordinates the lower-level sub-agents; (3) file upload is anticipated but deferred — the MVP version accepts typed and dictated text, and pasted blocks of arbitrary length; (4) reasoning transparency is a first-class UX requirement; (5) Phase 0 is non-sequential (parallel strands, not stages) — the capture assistant orchestrates strand transitions organically rather than enforcing a sequence (see `feature_residential_globe_onboarding.md` §5.9 and the Decision 3 amendment in `memory/project_lc_prd_readiness.md`).

---

## 1. Concept

A persistent chat affordance — visible from every screen of Life Chronicle, on desktop and mobile — accepts any input the user wants to give it:

- A one-line recollection ("I just remembered the day my dog died")
- A few paragraphs typed or dictated
- A long pasted block (e.g., a Notion page of accumulated thoughts; a copied text-message thread; a transcribed video call)
- Future: a dropped file (.txt, .md, .docx, audio)

The input is received by the **Orchestrator Agent** — a Claude Sonnet 4.5 instance with broad context of the user's chronicle state, the schema, and the architectural conventions. The orchestrator reasons aloud about what the input represents and how it should be placed, then delegates to specialist sub-agents (Tagger, Entity, Temporal, and — future — Source Document) for the lower-level structured work. Every placement decision is shown back to the user with reasoning. The user confirms, corrects, or rejects each placement.

The dialog box is therefore the **single front door** for all post-Phase-0 content. The conversational interview, the Notion-import use case, future transcript ingestion, future quick voice notes — all funnel through the same surface.

## 2. Why a unified capture surface

Three observations drove this design:

1. **Capture friction kills chronicles.** Most life-recording attempts die not from lack of will but from the cost of starting a "session." A persistent dialog where the user can drop a thought in fifteen seconds is the antidote.

2. **Andy already has a corpus.** A Notion database of recollections accumulated over years — recovered now via paste, later via direct file/import — is exactly the kind of latent material that scaffolded interview UIs struggle to absorb. A unified capture surface that handles "process this blob" is the right shape.

3. **The orchestrator pattern lets us upgrade reasoning without reshaping the agents.** Today's sub-agents (Tagger, Entity) do narrow jobs. As the chronicle grows, the reasoning about *what to do with* a new submission gets harder — does this contradict an existing memory? Does it refine a residential pin? Is this an entity refinement or a new entity? Putting that reasoning in a single orchestrator (which can be upgraded over time) keeps the sub-agents simple and the smart layer concentrated.

## 3. The capture assistant — UI surfaces

### 3.1 Desktop — floating button + slide-out panel

- Persistent floating button bottom-right of every Life Chronicle screen, except during full-screen flows (e.g., active Phase 0 globe placement, the Stroll) where it minimises to an icon in the top bar
- Click → slide-out panel from the right edge (40% of viewport width)
- Panel contains: scrollable message thread (user messages + orchestrator responses), input area at the bottom, optional "context" indicator at top (e.g., "Adding to your Madrid residence")
- Keyboard shortcut: `⌘K` to focus the input from anywhere
- The panel persists across navigation — user can pin a memory in the globe and the capture conversation stays open alongside

### 3.2 Mobile — floating action button → full-screen sheet

- Floating action button bottom-right (FAB) on every screen
- Tap → full-screen bottom sheet slides up
- Single-column thread + input
- Swipe down to dismiss; thread state preserved on next open
- Wispr Flow on iOS works at the OS level — the system keyboard's dictation button is sufficient; no separate in-app voice button at MVP

### 3.3 Input modes

| Mode | Trigger | Status at MVP |
| --- | --- | --- |
| Type | Click in text field | ✅ MVP |
| Wispr Flow dictation | Focus field, activate Wispr Flow hotkey, speak | ✅ MVP (works because Wispr Flow types into focused fields) |
| Push-to-talk in-app voice | Mic button → record → release → Whisper API → fills field | Deferred to a near-term post-MVP add (architecture is set up for it; needs `OPENAI_API_KEY`) |
| Paste large block | `⌘V` into field | ✅ MVP — handles blocks up to a reasonable limit (~20k chars per submission) |
| File drop | Drag onto panel | Deferred post-MVP. Capture submissions table has the columns to support it (see §10) |
| System share extension | Future, mobile only | Phase 2 |
| Wake word | Future | Phase 2+ |

## 4. The orchestrator agent

### 4.1 What it is

A Claude Sonnet 4.5 instance invoked on each user submission. The agent's runtime context is assembled from three distinct layers, kept architecturally separate:

| Layer | Scope | Contents | Where it lives |
|---|---|---|---|
| **A. Generic system prompt** | Multi-user, version-controlled | The agent's role definition, tone, output protocol, tool semantics, hard invariants (Raw Vault, RLS, etc.). No user-specific data. | `lib/agents/orchestrator.system.md` (or similar) — single source for all users |
| **B. Per-user chronicle context summary** | User-specific, refreshed periodically | Compact digest of the user's chronicle state: memory counts, residential pins, key entities, dimension coverage, recent activity. Generated by a background "context digester" job (Planner Agent territory). | Stored in user-specific store: a `user_chronicle_digests` table row, refreshed on a schedule or after meaningful chronicle changes. **Cached** as a separate prompt block for the Anthropic API to share across calls. |
| **C. Submission-time inputs** | This call only | The user's submission, any user-supplied guidance (§4.2), the active context (e.g., "user is on the globe placing pins"). | Constructed at call time. |

**Why the separation matters:** the generic system prompt is the same for every user and every call. It should never carry a specific user's chronicle state. The per-user digest is loaded as a separate context block, marked for prompt caching, and the submission is the only freshly-streamed content. This makes the agent multi-tenant safe by construction and significantly cheaper per submission (see §4.5).

The orchestrator's runtime invocation has:

- **System prompt** (layer A) — the generic agent instructions
- **Cached context block** (layer B) — the per-user chronicle digest
- **Tool definitions** for the specialist agents and external integrations (see §4.3)
- **The user's submission and active-screen context** (layer C)

It produces a response with:

- A **conversational reply** to the user
- **Reasoning** about what it inferred from the submission
- **Proposed actions** — each visible as a card the user can approve, modify, or reject. Actions are not limited to memory creation; see the tools list in §4.3.
- Optionally **follow-up questions** if context is ambiguous

### 4.2 Conversational priming, not a form

The capture panel does **not** present a structured form when the user opens it. The orchestrator's opening line is itself the guidance — an open invitation that accommodates the full range of submission types the user might bring.

**Where the priming appears:** in the conversation thread itself, as the orchestrator's most recent message. When the panel is first opened, the orchestrator's opener (per §5.1) sets the frame: *"Drop in anything — a fresh memory, a thought you don't want to lose, a chunk of notes, a transcript. I'll figure out where it fits."*

When the user begins typing or dictating, the orchestrator does not interrupt. When the user clicks Send (or pauses long enough for the system to infer the submission is complete in a future voice mode), the orchestrator receives the submission and, if anything about the submission warrants clarification before processing, asks. The clarification is a conversation, not a form.

**The range of submissions the orchestrator must handle gracefully:**

- A brief memory stub ("I just remembered the day my dog died")
- A longer dictated narration (Wispr Flow producing a 500-word recollection in one go)
- A pasted `.md` block listing dozens of fragment memories from Notion
- A dictated reminder note ("remind me to look into the Mildenhall years more — I need to ask Mom about that")
- A request for an interactive interview ("Can you help me develop the memory I started about my grandfather?")
- A transcript of a conversation with another person (text exchange, video call transcription)
- A tangential observation that may or may not be a memory ("Funny — I just realised that summer was the same year my dad changed jobs")
- A correction to existing chronicle content ("Actually, the trailer park was in Ohio, not El Paso")
- A request for help reasoning about the chronicle ("How does my career story look so far? Where are the gaps?")

The orchestrator's job on receipt is to **engage and reason aloud with the user** to figure out what the submission is and what to do with it. For ambiguous submissions, it asks. For obvious ones, it proceeds with reasoning visible.

**When the user opts to provide structured priming:**

For bulk pastes or future file uploads, the user can volunteer context up front. A "Tell me about this first" affordance (collapsible, not modal) lets the user supply hints before pressing Send:

> *Optional — anything I should know about what you're sharing?*
>
> Examples: *"These are old Notion notes about my childhood." / "This is a text conversation with my sister about our parents. She has good memory; I don't." / "These are work-life reflections I jotted over the last year."*

The priming field is a single text area, not a structured form — it accommodates anything the user wants to say. When provided, it's prepended to the submission as the orchestrator's instruction context.

This addresses both the casual short capture (no priming needed) and the high-value source ingestion case (priming dramatically improves the orchestrator's reasoning about attribution, confidence, and placement).

### 4.3 The tools the orchestrator can call

The orchestrator's actions are not limited to creating memory cards. Each tool produces a structured side-effect that flows into either the chronicle (with the user's approval) or the unified review queue.

**MVP tools:**

| Tool | What it does | Returns |
| --- | --- | --- |
| `create_memory` | Insert into `memories` with `content_raw`, source, capture_mode, draft state | memory_id |
| `propose_entity` | Generate an entity stub or proposed refinement of an existing entity | proposal_id |
| `propose_temporal_constraint` | Create a relative ordering or anchor constraint with confidence and provenance | constraint_id |
| `update_residential_scaffold` | Propose a change to an existing `lived_at` relationship — always goes to review_queue | proposal_id |
| `classify_dimensions` | Run the Tagger sub-agent against a memory_id | tags array |
| `extract_entities` | Run the Entity sub-agent against a memory_id | mentions array |
| `search_chronicle` | Find existing memories/entities related to the submission (contradictions, refinements, dedup) | matches |
| `propose_interview` | Suggest an interactive follow-up interview to develop a stub or fill in a gap | proposal_id (review_queue entry) |
| `propose_research_reminder` | Capture a user note to themselves ("I need to ask Mom about Mildenhall") as a non-memory task item | reminder_id |
| `flag_for_private_notes` | Surface that the submission contains content the user may want kept private (see §10.3) | suggested_visibility |
| `add_to_backlog` | Route a card from a bulk upload to the unified review queue rather than the timeline | item_id |

**Post-MVP tools (anticipated, not built at MVP):**

| Tool | What it does |
| --- | --- |
| `search_external_media` | Search Google Photos / iCloud / connected media stores for images near a memory's date/place |
| `propose_card_publish` | Push a finalised card to an external publishing surface (e.g., Notion via integration) |
| `ingest_notion_database` | Pull pages from a connected Notion scratchpad database into the backlog queue |
| `propose_source_document` | Treat a long pasted/uploaded transcript as a multi-speaker source document (the future Source Document Agent) |
| `propose_correction_chain` | When a submission contradicts existing chronicle content, generate a structured proposal to revise/append rather than overwrite |

The orchestrator's reasoning for each tool call is captured in `assumption_log` with `assumption_type='orchestrator_reasoning'`, including the input, the chosen tools, and the rationale string.

### 4.4 What the orchestrator does NOT do

- **It does not modify the residential scaffold directly.** Scaffold updates from external sources always route to the review queue. Owner approval is required.
- **It does not edit existing memories' `content_raw`.** Raw Vault invariant remains absolute. Refinements become `memory_revisions` entries.
- **It does not silently merge entities.** Entity merge proposals always go to the review queue.
- **It does not act on the user's behalf during voice/dictation pauses.** No "I think you meant X" autocorrect. Wispr Flow handles transcription cleanup; the orchestrator works with the final text.

### 4.5 Prompt caching and chronicle context compaction

A naïve implementation would re-send the user's full chronicle context summary on every submission, costing tokens and adding latency. The capture assistant must be designed from day one to take advantage of two efficiency mechanisms.

**Prompt caching (Anthropic API):**

The Anthropic API supports `cache_control` annotations on prompt blocks. Cached blocks are stored on Anthropic's side; subsequent calls referencing the same block pay a much lower cache-hit price and respond faster. For the capture assistant:

- **Layer A (system prompt)** — marked `cache_control` with long TTL. Same across every user and every call; stable.
- **Layer B (per-user chronicle context digest)** — marked `cache_control`. Stable across a session unless the chronicle changes meaningfully. When meaningful change occurs (a batch of new memories, a synthesis published), the digest is regenerated and the cache key changes naturally — next call seeds a fresh cache entry.
- **Layer C (submission + active context)** — never cached. Always fresh.

**Compact context via dream-compaction (the "dreaming function"):**

Andy's reference to the "dreaming function" maps to Claude's context-compaction capability. The per-user chronicle context digest (Layer B) is itself an output of a compaction pass — a background job that:

1. Reads the user's chronicle state (recent memories, entity counts, residential pins, dimensions activated, last synthesis outputs)
2. Produces a compact summary (target: 1–3k tokens) suitable for inclusion in every orchestrator call
3. Stores it in `user_chronicle_digests` with a hash of its source state
4. Schedules its own re-run on a cadence (e.g., nightly) and on triggered events (after N new memories, after a synthesis publication)

The Planner Agent (Step 3 stub, expanded in later steps) owns this compaction job.

**Session cost target:**

With caching and compaction, the per-submission cost target is:

- Cache hit on Layers A + B: $0.001–$0.005 per submission depending on submission size
- Cache miss (rare — only on fresh sessions or after digest invalidation): $0.02–$0.08

For an active user submitting 10 things a day with mostly cache hits: ~$1–$2/month rather than the $10/month back-of-napkin in the OQ-CA-7 estimate from v1.0.

**Implementation note:**

The orchestrator's invocation should always send the layers in the order `[A system prompt, B context digest, C submission]` with `cache_control` markers on A and B. This is enforced by a thin wrapper around the Anthropic SDK call in `lib/agents/orchestrator.ts`.

## 5. The conversational interaction model

### 5.1 First contact

When the panel opens for the first time, the orchestrator greets:

> *Hi. Drop in anything — a fresh memory, a thought you don't want to lose, a chunk of notes from Notion, a transcript of a conversation. I'll figure out where it fits and you'll always see my reasoning before anything's saved.*

### 5.2 A typical short capture

**User:** *"I just remembered — the day my dog died, it was the same day my parents told me they were getting divorced. I was twelve."*

**Orchestrator:** *I've made this a memory. Here's how I'm placing it:*

- **Memory:** *"I just remembered — the day my dog died, it was the same day my parents told me they were getting divorced. I was twelve."*
- **Temporal:** I'm marking this at age 12 (~1966 if your birth year is 1954). Precision: year.
- **Entities I noticed:** your parents, your dog (no name given), the divorce event. Want me to make a stub for the dog?
- **Dimensions:** Relationships & Family, Transitions & Endings (significant emotional content noted).
- **Suggested follow-up:** would you like to develop this further now, or come back to it later?

**[Accept all]  [Adjust]  [Decline]**

### 5.3 A large bulk upload — the backlog flow

**User:** *[pastes 8,000 words spanning many recollections from a Notion subject collection]*

**Orchestrator:** *This is a large block — I count roughly 40+ distinct recollections in here. I'll process this as a backlog rather than asking you to approve them all in one sitting. Here's what I'm proposing:*

- *I'll create draft cards for each recollection I identify and route them to your **Review Queue**. They won't appear on your timeline yet — they'll wait there for you to finalise.*
- *I'll do a first pass at temporal placement, entity detection, and dimension classification for each. Each card will show its proposed placement and my reasoning.*
- *You can work through them at your own pace — finalise a few, leave others for later, decline ones that don't belong.*
- *If you'd like to give me priming first ("these are mostly childhood memories from before 1970"), I can use that to improve placement before I start.*

*Starting the pass now. I'll let you know when it's done — should take a minute or two for 40 cards.*

**Why route to a backlog rather than process interactively:** When the volume exceeds a small handful of recollections, the conversational review-each-card-now flow would be exhausting. The orchestrator instead creates the cards as drafts in the unified review queue (§6) and lets the user work through them at their own pace.

**The orchestrator's job during a bulk pass:**

1. Segment the input into individual recollections using markdown structure, paragraph breaks, and semantic shifts
2. For each, create a draft `memories` row (`is_draft = true`, `capture_mode = 'assistant_paste'`)
3. Run the inline Tagger and Entity tools to attach a first-pass dimension and entity set
4. Run inline temporal-placement reasoning ("this seems to be around 1972 based on context")
5. Route each card to the unified review queue with `item_type = 'memory_finalization_needed'`
6. Surface the count and a "Go to Review Queue" call-to-action in the conversation thread

The user's next step is the **Review Queue view** (§6) — not more dialogue in the capture panel.

### 5.4 Ambiguity handling

When the orchestrator is uncertain, it asks rather than guessing:

**User:** *"the move to Boston"*

**Orchestrator:** *You've mentioned Boston before — your residence from 1985 to 1990. Is this referring to that move, or a different one? If it's the same move, I can append this detail to that residence. If different, I'll create a new entry.*

## 6. The unified Review Queue — one workflow regardless of source

Per Andy's review (2026-05-17): there is **one** queue and **one** workflow for any draft memory card awaiting the user's finalisation, regardless of how it entered the system. The earlier separation between "stubs from quick capture" and "backlog from bulk paste" was unnecessary — both produce the same artefact (a draft card) that needs the same kind of attention (review, refine, finalise or decline).

### 6.1 What ends up in the Review Queue

Any of the following produce a `review_queue` row with the relevant `item_type`:

| Source | item_type | How it gets there |
|---|---|---|
| Short capture stub | `memory_finalization_needed` | Single short submission → draft `memories` row with `is_draft=true`, queued for elaboration |
| Bulk paste cards | `memory_finalization_needed` | Multi-recollection paste → orchestrator segments, creates N draft `memories` rows, queues each |
| Future file upload cards | `memory_finalization_needed` | File parsed → drafts created → queued |
| Orchestrator's "this is incomplete, come back to it" | `memory_finalization_needed` | User mentions something in passing the orchestrator flags as worth developing |
| Planner-suggested elaboration | `memory_finalization_needed` | Background pass identifies sparse memories and queues them |
| Proposed entity needing user confirmation | `entity_proposal` | Medium-confidence entity → user must confirm name/type/relationship |
| Proposed scaffold update | `scaffold_update_proposal` | Refinement to an existing residential pin or relationship from new content |
| Source document import (future) | `source_document_review` | Multi-speaker transcript proposals (the future Source Document Agent) |
| Contribution from share comment | `contribution_review` | External party's comment on a shared memory |

All of these surface in one Review Queue view in the IA — distinguishable by `item_type` filter chips, but unified by workflow.

### 6.2 The card lifecycle

Every card has two distinct states:

| State | Description | Where it lives |
|---|---|---|
| **Draft** | The orchestrator's proposal — initial structure, reasoning, and inferred metadata. May be sparse. Not visible on the timeline or globe. | `memories.is_draft = true`; Review Queue surface |
| **Finalised** | The user has reviewed, adjusted if needed, and promoted the card. Now part of the chronicle's canon. | `memories.is_draft = false`; Timeline + Globe + Search |

The orchestrator **always creates drafts**, never finalised cards. The user always promotes. This separation matters: the timeline should never contain content the user hasn't deliberately approved, and the user should be able to leave drafts in the queue indefinitely without them polluting the chronicle.

### 6.3 The Review Queue UI

A dedicated tab on the dashboard (per Andy's resolution of OQ-CA-3). Layout:

- **Card list** — drafts ordered by recency, with filter chips for `item_type`, source (capture assistant vs. import vs. share-comment vs. planner), and date range
- **Card detail view** — the verbatim text, the orchestrator's reasoning, the inferred metadata (entities, date, dimensions, life stage, linked place), and the user's controls (Edit, Finalise, Decline, Defer)
- **Conversational refinement** — the capture assistant panel can be opened alongside any card to develop it interactively ("Tell me more about this grandfather memory")
- **Batch actions** — multi-select cards for batch finalise/decline (useful when the orchestrator's bulk-paste pass produced many well-structured cards)
- **Empty state** — when there are no drafts, a short message: "No drafts to review. Drop something into the capture assistant and I'll line them up here."

### 6.4 Promoting a draft to a finalised card

The user can promote through three paths:

1. **From the Review Queue card detail view** — click Finalise. The card's `is_draft` flips to false; the memory appears on the timeline and (if linked to a place) the globe.
2. **Through conversational refinement in the capture assistant** — once a stub has been developed enough, the orchestrator suggests: *"This is in good shape. Want me to finalise it?"* User confirms.
3. **Through the Planner Agent** — for cards that the user repeatedly opens but doesn't finalise, the Planner schedules a focused follow-up interview to develop them.

When promoted, the elaborating content is **appended** to `content_raw` (separated with a turn marker) rather than overwriting — Raw Vault invariant preserved. Each elaboration session is a discrete turn in the memory's history.

### 6.5 Why this matters

The Review Queue is the linchpin of trust in the capture assistant. The orchestrator can be aggressive about creating drafts (low cost, high recall) because the user retains absolute authority over what reaches their canon. Conversely, the user can be casual about quick captures (no need to "complete" them in the moment) because the queue absorbs whatever isn't yet finalised.

This pattern also future-proofs the system: as more capture sources are added (file upload, Notion sync, share-comment contributions, etc.), they all funnel through the same queue and the same finalisation workflow. No new UX is needed for each source.

## 7. Reasoning transparency

This is a hard requirement, not a nice-to-have.

Every action the orchestrator proposes includes:

- **What** it's doing (creating memory, proposing entity, etc.)
- **Why** it inferred this (one or two sentences citing the user's text or guidance)
- **Confidence** (high / medium / low — surfaced as a small visual marker, not a percentage)
- **What the user can do** (accept, modify, decline)

The orchestrator's full reasoning trace is written to `assumption_log` for audit. The user-facing summary is concise; the assumption log is exhaustive.

This pattern serves two purposes:
1. The user can catch mistakes before they pollute the chronicle
2. When a future synthesis seems wrong, the user has a traceable path back to the source decision

## 8. Notion-import flow, file upload, and Notion integration

The capture assistant must handle three import shapes — at different levels of investment.

### 8.1 MVP — copy-paste from Notion (single workflow)

Andy has accumulated short recollections in a Notion database over time. For the MVP, copy-paste is sufficient:

1. User opens the capture assistant
2. Provides optional priming (per §4.2): *"These are old notes from Notion — childhood material, mostly before 1970."*
3. Copies a Notion page (or several pages stacked) and pastes
4. Orchestrator detects multiple recollections, segments them, and routes draft cards to the Review Queue (per §5.3 and §6)
5. User works through the Review Queue at their own pace

Notion lets a user select a page and copy it as plain text or export it as `.md`. Either path works for the MVP paste flow.

**Note from Andy (2026-05-17):** The MVP relies on Andy's own corpus being in Notion. For users without a pre-existing recollection database, the capture assistant's conversational interview style must work fully without an import path — short, frequent, piecemeal captures should produce a satisfying chronicle without any bulk paste at all. This is a UX requirement on the orchestrator's prompting strategy: never assume the user is bringing material from elsewhere.

### 8.2 Post-MVP — direct file upload

The capture submission flow is architecturally ready for file upload (the `capture_submissions.source_file_id` column and `input_type='file_upload'` value are already specified in §10). What's deferred is the UI exposure and a file-parsing agent.

**The file-parsing agent (deferred feature, sketch):**

When file upload ships, the orchestrator will route uploaded files to a **File Analysis sub-agent** rather than processing the file content directly. The sub-agent:

1. Detects the file type (`.md`, `.txt`, `.docx`, `.pdf`, audio)
2. Extracts text content (with appropriate tools per type: pandoc for docx, pdf-text-extract for PDFs, Whisper for audio)
3. Reads enough of the content to characterise it: *"This is a 50-page memoir draft" / "This is a transcript of a 90-minute conversation" / "This is a structured taxonomy table"*
4. Reports back to the orchestrator with the characterisation and the extracted text
5. The orchestrator then decides processing strategy: segment as recollections (memoir draft), route to a Source Document Agent (transcript), or treat as a different artefact

This split keeps the orchestrator focused on reasoning and routing while the parsing sub-agent handles the mechanical extraction.

### 8.3 Post-MVP — Notion integration (bidirectional)

**Pin from Andy (2026-05-17):** A future feature should support a direct Notion connection, not just paste. Two purposes:

| Purpose | Description |
|---|---|
| **Ingest** | Point the capture assistant at a Notion database that holds memory recollections. A specialised "Notion Ingest" sub-agent pulls pages, parses them, and routes draft cards to the Review Queue. Useful for users (like Andy) who maintain a scratchpad database in Notion that accumulates between Life Chronicle sessions. |
| **Publish** | When a memory card is finalised, optionally publish it to a connected Notion database. This provides an additional publishing surface — Notion is widely used as a static-publishing platform, and some users will want their chronicle content accessible there for sharing or archival. |

**Distinction from the in-app Share feature:** The Life Chronicle share function (Step 12 in the development sequence) is different from a Notion publish. The share function exists to allow commentary and refinement of memories by people associated with the event — it's a collaboration surface. A Notion publish is a static, read-only artefact for distribution. Both surfaces will exist; they serve different purposes.

**Implementation sketch:**

- Notion connection lives at the user level (OAuth, stored as a credential)
- A new sub-agent (Notion Ingest / Notion Publish) handles bidirectional sync
- Ingest is poll-based or webhook-based; new Notion pages are picked up and routed to the Review Queue
- Publish is triggered explicitly per card or via a rule ("auto-publish all finalised memories tagged Career")
- Mapping between Notion page properties and chronicle metadata is configurable
- Privacy: the Notion publish never exposes private user notes (see §10.3); only the public content of a card is published

### 8.4 Why these are pinned not built

Both file upload and Notion integration are deferred to post-MVP for one reason: the MVP needs to prove the conversational-capture-and-finalisation loop works before adding ingestion sophistication. If the orchestrator + Review Queue pattern feels right at MVP, file upload and Notion sync drop in as natural extensions. If the pattern needs revision, doing that revision against a small capture surface is cheaper than rebuilding against an integration-heavy one.

The pins exist here so the architecture doesn't preclude them — `capture_submissions` is shaped to accept file uploads, and the sub-agent pattern in §4.3 is shaped to accept new specialist agents (File Analysis, Notion Ingest, Notion Publish) without rework.

## 9. Mobile UX specifics

- FAB always visible on the dashboard, globe, and other primary screens; hidden in single-task flows (active interview)
- Tap FAB → full-screen capture sheet
- Wispr Flow on iOS is invoked through the system keyboard — no in-app voice button at MVP
- Push-to-talk in-app button is the deferred path (Whisper API) for non-Wispr-Flow users; design space reserved
- Paste works normally (iOS/Android clipboard)
- File drop is desktop-only at MVP
- Reasoning cards in the response are single-column, generously sized for thumbs
- Action buttons (Accept/Adjust/Decline) are full-width on mobile

## 10. Schema implications

The schema needs three small additions:

### 10.1 `capture_submissions` table (new)

Every distinct capture event is a row. This is the orchestrator's input log.

```
capture_submissions
  id                   UUID PK
  user_id              UUID
  submitted_at         TIMESTAMPTZ
  input_type           TEXT  -- 'typed' | 'dictated' | 'pasted' | 'file_upload' | 'voice'
  input_text           TEXT  -- the raw input as received
  user_guidance        TEXT  -- the optional "what is this" hints
  source_file_id       UUID  -- (nullable, future) media table reference for uploaded files
  orchestrator_run_id  UUID  -- links to assumption_log entries
  status               TEXT  -- 'processing' | 'awaiting_review' | 'integrated' | 'declined'
  created_at           TIMESTAMPTZ
```

Memories, entity proposals, and constraints generated from a submission all carry a `source_submission_id` so the lineage is traceable.

### 10.2 New enum values

| Enum | New values |
| --- | --- |
| `memories.capture_mode` | `quick_capture`, `assistant_paste` (alongside existing `interview`, `stroll`, `freeform`, `globe_onboarding`) |
| `memories.source` | `external_witness_account` (for future source-ingestion; reserve now) |
| `temporal_constraints.provenance` | `witness_corroborated`, `orchestrator_inferred` (alongside existing `user_explicit`, `user_confirmed`, `agent_inferred`) |
| `review_queue.item_type` | `memory_elaboration_needed`, `orchestrator_proposal`, `entity_confirmation_needed` (alongside existing `entity_merge_proposal`, `contribution_review`, etc.). The `entity_confirmation_needed` value was added in migration `20260520182927_entity_confirmation_queue.sql` and is described in §10.5 below. |
| `assumption_log.assumption_type` | `orchestrator_reasoning`, `orchestrator_dispatch` |

### 10.3 Private user notes (new schema concept — applies to all memories, not just capture-assistant ones)

**Concept (per Andy 2026-05-17):** Every memory card has two layers of content:

| Layer | Visibility | Purpose |
|---|---|---|
| **Public content** | Governed by Access Cards (Private / Close Friends / Family / Professional / Public, or custom cards) | The recollection as the user wants it represented to whichever audience the card grants |
| **Private notes** | Owner-only, regardless of Access Card assignment | The user's own commentary, side notes, private observations, social-context reminders, drafts, second thoughts |

**Why this is a separate layer (not just another "private" Access Card):** A card's Access Card setting governs *who can see the card at all*. Private notes are a layer *within* a card — even on a card that is broadly shared via Family or Professional, the private notes remain owner-only. The user can put a memory of a workplace event on the Professional card and still keep their honest assessment of a colleague in the private notes layer, never exposed.

**Schema addition:**

A new column on `memories`:

```
memories.private_notes TEXT  -- owner-only commentary; never exposed via Access Cards or shares; visible only to the chronicle owner
```

Alternative: a separate `memory_private_notes` table if we want to track multiple distinct private notes per memory over time. The single-column approach is sufficient for MVP; the table approach is a forward option if private-note history becomes important.

**RLS and Access Cards interaction:**

- `viewer_can_access(viewer, owner, 'memory', memory_id)` returns true based on Access Card scope — but the `private_notes` column is **excluded from the returned row** unless the viewer is the owner
- The `viewer_can_access` function (when fully implemented in Step 13) needs an additional check: even if a card grants memory access, the `private_notes` field is owner-only and filtered out of the projection for non-owner viewers
- This must be enforced at the database / RLS layer, not just the application layer

**UI implications:**

- The memory card UI has a distinct "Private notes — for your eyes only" section, visually subdued or marked with a lock icon
- The section is collapsed by default to keep the card focused on its public content
- When the user views a card as a card holder (via "View as holder" mode in Step 13), the private notes section is hidden entirely (not even a placeholder)
- The capture assistant can write to `private_notes` when the user signals "this should be private" — the `flag_for_private_notes` tool in §4.3 lets the orchestrator surface candidate private content for the user's decision

**Capture assistant interaction with private notes:**

When the orchestrator detects content that the user might want private (e.g., critical observations about identified people, or content the user labels as "between you and me"), it surfaces a suggestion in the proposal card: *"This passage seems more personal — would you like me to put it in the private notes layer rather than the main memory content?"*. The user decides; the orchestrator never decides on its own.

### 10.4 No structural schema rework beyond the above

The proposal flow uses the existing `review_queue` table. Memory drafts use the existing `is_draft` column. Entity refinement proposals use the existing entity-proposal pattern. The orchestrator slots in cleanly above the existing infrastructure. The only schema deltas are: the new `capture_submissions` table, the new enum values in §10.2, the new `private_notes` column in §10.3, the new `user_chronicle_digests` table referenced in §4.5, and the new `entity_confirmation_needed` item_type covered in §10.5 below.

### 10.5 Entity confirmation queue — tap-to-confirm pattern (added 2026-05-20)

Parallel to face recognition's "Is this Alice?" tap-to-confirm flow. When the Entity Agent extracts a new named entity from a memory, it cannot reliably know whether the captured name is correct, whether it's actually a person (vs. a misclassified noun), or whether it should be merged with an existing entity. Asking the owner to verify is the right pattern; doing it asynchronously via the Review Queue keeps the capture flow uninterrupted.

**Trigger:** When the Entity Agent core (`lib/agents/entity/core.ts`) creates a new entity with `action='created_new'` and `type='person'`, it writes a `review_queue` row with:

| Column | Value |
|---|---|
| `item_type` | `'entity_confirmation_needed'` |
| `item_id` | The newly created entity's id |
| `context_json` | `{ extracted_name, type, role, source_memory_id, context_quote, extraction_confidence }` |
| `priority` | 3 (normal) |

The `context_quote` is a short snippet of the source memory's `content_raw` centred on the extracted name, giving the user the linguistic context that produced the extraction.

**Card UI in the Review Queue (Step 6g):**

```
┌────────────────────────────────────────────────┐
│ NEW PERSON                                     │
│                                                │
│ "Leola Lapides"                                │
│                                                │
│ First mentioned: "In my sophomore year at      │
│ Dartmouth, Leola Lapides, my high school       │
│ girlfriend came to visit me for Winter         │
│ Carnival from Bennington…"                     │
│                                                │
│ [ Confirm ]  [ Edit name ]  [ Add aliases ]    │
│ [ This isn't a person ]  [ Merge with… ]       │
└────────────────────────────────────────────────┘
```

**User actions and their effects:**

| Action | Effect |
|---|---|
| **Confirm** | `assumption_log` records the confirmation; the entity is treated as verified for future resolution. (Could become a flag column on `entities` in a future iteration — for MVP we infer "verified" from the absence of an open confirmation queue row.) |
| **Edit name** | Updates `entities.canonical_name`. Old name optionally added to `aliases` so prior memory_entities links remain resolvable. |
| **Add aliases** | Appends to `entities.aliases` array. Future Entity Agent runs use these for matching. |
| **This isn't a person** | Soft-deletes the entity (or sets a `dismissed=true` flag — implementation decision in 6g). The `memory_entities` link is preserved as historical record but the entity is hidden from future surfaces. |
| **Merge with…** | User picks an existing entity; `memory_entities` rows are repointed to the chosen entity; the now-duplicate is soft-deleted. This is the same merge mechanism used by `entity_merge_proposal`. |

**Compound effect:** Every confirmation makes the next memory's extraction more accurate. Confirmed canonical names + aliases become reliable reference data for the Entity Agent. Soft-deleted false positives provide negative training signal for prompt refinement. Confirmed merges populate the aliases array, so future variants (e.g., "Leo" → "Leola Lapides") resolve cleanly without re-queueing.

**Scope at MVP:** Persons only. Place entities have their own verification surface via the Residential Globe (Step 7). Organisations and other entity types may be added to this flow post-MVP based on observed misclassification rates.

**Inngest path interaction:** The Entity Agent runs as an Inngest listener on `memory/ingested` and writes confirmation rows during that async pass. The Orchestrator (Step 6b) using the inline `extract_entities` tool with `persist=true` will also write confirmation rows via the same code path.

**Backfill:** The `scripts/backfill-entity-confirmations.mjs` one-off was used 2026-05-20 to retroactively queue confirmation rows for the 5 person entities created during Step 6a verification (Leola Lapides, Bob, Bob Katz, Leo, Lori). Idempotent — safe to re-run if new historical person entities surface.

## 11. Architecture — orchestrator + sub-agents

### 11.1 Hierarchy

```
                  ┌─ User submission ─┐
                  │                   │
                  ▼                   ▼
       ┌─────────────────────┐
       │  Orchestrator Agent │  Claude Sonnet 4.5, synchronous
       │  (broad context)    │  Tool use over sub-agents
       └─────────────────────┘
            │       │       │       │
            ▼       ▼       ▼       ▼
        ┌──────┐┌──────┐┌──────┐┌────────┐
        │Tagger││Entity││Temporal│Search  │  Lower-level specialists
        │Agent ││Agent ││Agent  │Agent   │  Sonnet 4.5 or Haiku 4.5
        └──────┘└──────┘└──────┘└────────┘
                │       │
                └───┬───┘
                    ▼
              ┌──────────────┐
              │ review_queue │  Owner-mediated promotion
              │ + scaffold   │  to the chronicle's canon
              └──────────────┘
```

### 11.2 Synchronous vs. asynchronous

| Pass | When | Purpose |
| --- | --- | --- |
| **Orchestrator inline** | At submission time, blocking the user response | Produce the user-facing reasoning, create memories, generate proposals |
| **Sub-agent fanout** | Async, after `memory/ingested` is emitted | Deeper tagging, fuller entity resolution, embedding generation, temporal constraint propagation |

The user sees the orchestrator's immediate response; the sub-agents enrich the record over the next minute or so. The user can always refresh to see what's deepened.

### 11.3 Sub-agent role shifts

This changes the sub-agent design slightly:

- **Tagger Agent** (Step 6) — keep as Inngest function listening to `memory/ingested`. Add an inline-callable version (a tool definition) the orchestrator can use for synchronous classification.
- **Entity Agent** (Step 6) — same: Inngest async listener AND an inline-callable tool. The orchestrator uses inline for the immediate response; the async pass does the heavier resolution work.
- **Temporal Agent** (Phase 2) — when built, integrates the same way.

This is a meaningful architectural addition to Step 6. The sub-agents should be designed from the start as both event listeners and as tools — sharing a core function called by both paths.

## 12. Acceptance criteria

The capture assistant is functionally complete when:

**UI surfaces:**
- [ ] Floating button visible on dashboard, globe, timeline, and interview UIs (desktop); FAB visible on mobile
- [ ] `⌘K` opens the panel on desktop
- [ ] Input field accepts typed text, Wispr Flow dictation, and paste of up to ~20k characters
- [ ] Conversational priming (orchestrator opener) is shown on first open; optional "Tell me about this first" hint field collapses by default and accommodates free-text priming
- [ ] Mobile FAB → full-screen sheet works; thread state persists across opens
- [ ] No fixed orchestrator name in MVP; copy refers to "your chronicle assistant" (per OQ-CA-6)

**Orchestrator behaviour:**
- [ ] Orchestrator's system prompt is a generic, user-agnostic file under version control
- [ ] Per-user chronicle context is loaded from a separate `user_chronicle_digests` row, marked for prompt caching
- [ ] Anthropic API calls structure: system prompt + cached context block + submission (in that order, with cache_control on first two)
- [ ] Orchestrator responds with conversational reply, reasoning, and proposal cards
- [ ] Each proposal card shows confidence, reasoning, and Accept/Adjust/Decline actions
- [ ] Reasoning trace is preserved in `assumption_log` with `assumption_type='orchestrator_reasoning'`

**Submission processing:**
- [ ] Submission creates a `capture_submissions` row with raw input and metadata
- [ ] All capture-assistant-created memories carry `source_submission_id` linking to their submission row
- [ ] Short single-recollection submissions: orchestrator creates a draft memory and queues it for finalisation (per OQ-CA-1)
- [ ] Long bulk-paste submissions: orchestrator segments, creates N draft memories, queues all of them
- [ ] Low-confidence entities surface as proposal cards in the queue for user clarification of relationship/type (per OQ-CA-2)
- [ ] Contradictions with existing chronicle content are flagged in the proposal card (per OQ-CA-5)
- [ ] Detected attribution to other people defaults the card to Private visibility with a surfaced alert (per OQ-CA-8)

**Review Queue (unified workflow):**
- [ ] Dedicated tab on the dashboard for the Review Queue
- [ ] Filter chips for `item_type`, source, date range
- [ ] Card detail view shows verbatim text, orchestrator reasoning, inferred metadata, edit controls
- [ ] Draft cards do NOT appear on the timeline or globe — only after finalisation
- [ ] Finalise action flips `is_draft = false` and surfaces the card on timeline + globe
- [ ] Decline logs in `assumption_log` and removes from queue without writing to canon
- [ ] Batch select for multi-card finalise/decline
- [ ] Capture assistant panel can be opened alongside any card for conversational refinement

**Private notes:**
- [ ] Every memory card UI exposes a "Private notes — for your eyes only" section
- [ ] `memories.private_notes` column is owner-only via RLS (excluded from non-owner projections)
- [ ] When viewing-as-holder, the private notes section is hidden entirely
- [ ] Orchestrator can surface candidate private content for user decision (does not auto-classify)

**Cost and performance:**
- [ ] Per-user chronicle digest job is in place (background, schedule-driven + change-triggered)
- [ ] Prompt caching is enabled for layers A (system) and B (digest) of each call
- [ ] Cache-hit cost per submission below target (sketch: $0.005 or less for typical short captures)

## 13. What's in MVP vs. deferred

### 13.1 MVP

- Floating button / FAB UI on all primary screens
- Typed and dictated input (via Wispr Flow on Andy's machine)
- Paste of large blocks
- Orchestrator with reasoning, tool use over Tagger and Entity sub-agents
- Memory creation, entity proposals, temporal constraint proposals (relative orderings — strict date inference deferred until Temporal Agent built)
- Memory stubs and elaboration queue (basic view; full Review Inbox is Step 15)
- Reasoning transparency in every card
- `assumption_log` writing

### 13.2 Deferred

- **File upload** (drag-and-drop of .txt, .md, .docx, audio files). Architecture is prepared (`capture_submissions.source_file_id`, `input_type='file_upload'`). UI exposure waits for post-MVP demand signal.
- **Push-to-talk in-app voice** (Whisper API). Needs `OPENAI_API_KEY`. Deferred per Andy's directive.
- **Wake word activation.** Phase 2+.
- **System share extension** (mobile). Phase 2.
- **Multi-speaker conversation analysis** at the level of the transcript example. The capture assistant can ingest it via paste and produce reasonable proposals at MVP, but the full Source Document Agent (with speaker attribution, witness corroboration confidence levels, contradiction detection across the existing chronicle) is a richer Phase 1+ feature.
- **Real-time contradiction detection** against the full chronicle. MVP does basic similarity checks; full constraint-graph reasoning is Phase 2 with the Temporal Agent.
- **Embedding-based de-duplication** of pasted memories. MVP relies on user review to catch dupes.

## 14. Insertion point in the build sequence

This feature is best built **as part of Step 6**, not as a separate step. The reason: the orchestrator and the sub-agents are designed together. Building Tagger and Entity Agents as pure event listeners first and then bolting an orchestrator on top later would be wasted effort — they should be designed from day one to be both event listeners *and* synchronous tools.

**Proposed revision to ****`LC_Development_Sequence.md`**** Step 6:**

> **Step 6 — Capture Assistant + Orchestrator + Tagger + Entity Agents**
>
> **Substep 6a:** Tagger and Entity sub-agents as dual-mode functions (Inngest listener + synchronous tool).
> **Substep 6b:** Orchestrator agent (Claude Sonnet 4.5) with tool definitions for the sub-agents.
> **Substep 6c:** Capture assistant UI — floating button, panel/sheet, input field with guidance area.
> **Substep 6d:** Proposal cards UI with reasoning, confidence, accept/adjust/decline.
> **Substep 6e:** `capture_submissions` table and migration; enum extensions; `assumption_log` integration.
> **Substep 6f:** "Things to come back to" stub view.
> **Substep 6g:** Mobile FAB + bottom sheet.

After Step 6 (in this expanded form), the residential globe (Step 7 per `feature_residential_globe_onboarding.md`) becomes much easier to build because the capture assistant can be the sidekick chat for Phase 0 Stage 1. The sidekick chat panel proposed in the globe spec is **literally the capture assistant in a context-aware mode**.

This is a virtuous collapse: one persistent capture surface used everywhere, with context-awareness driving the orchestrator's prompts (sidekick mode during globe placement; free-form mode otherwise).

## 15. Open questions

### 15.1 Resolved (Andy review 2026-05-17)

| OQ | Resolution |
|---|---|
| OQ-CA-1 (auto-create vs. propose) | ✅ Incomplete memory card is **created on submission** after Inngest classifies submission type. The card is always in **Draft** state — never directly published to the timeline. Drafts live in the Review Queue until the user explicitly finalises them (see §6 card lifecycle). |
| OQ-CA-2 (entity confidence threshold) | ✅ Where confidence is not high (sparse context, ambiguous match), the capture assistant **presents the entity to the user for clarification** of relationship type and nature in the memory's context. No silent auto-creation of low-confidence entities. |
| OQ-CA-3 (queue location in IA) | ✅ Separate navigable tab on the dashboard for MVP — the unified Review Queue. |
| OQ-CA-4 (chronicle context size) | ✅ Use the dream-compaction pattern (per §4.5). Background "context digester" produces a compact 1–3k-token per-user digest, stored separately, marked for prompt caching. Design for prompt caching from day one so the system prompt + digest aren't re-delivered on every call. |
| OQ-CA-5 (contradiction handling) | ✅ Flag in the proposal card. The card shows: "This contradicts your earlier memory of X — would you like to update X, append this as a different version, or note them as separate?" Full constraint-graph contradiction-detection is Phase 2 with the Temporal Agent. |
| OQ-CA-6 (orchestrator name) | ✅ No name in MVP. In future versions the persistent capture assistant's name should be **user-definable** in settings. |
| OQ-CA-7 (token cost) | ✅ MVP doesn't optimise aggressively for cost — alpha will have very few users. Architecture supports prompt caching and dream-compaction so future cost optimisation is straightforward. Revisit when scaling. |
| OQ-CA-8 (PII in pasted content) | ✅ The overall chronicle is **not publicly available** in MVP; only specific cards can be shared explicitly. When the orchestrator detects content attributed to or about another person entity, **the card defaults to Private visibility** and an alert is surfaced ("This includes things attributed to or about someone else — I've set it to Private. Adjust the visibility if you want to share it."). |

### 15.2 New open questions raised by v1.1 review

| OQ | Question | Initial recommendation |
|---|---|---|
| OQ-CA-9 | Where exactly does `private_notes` get edited in the UI? A field always visible on the card detail, or a "+ Add private notes" affordance that reveals an editor? | Recommend: collapsed section labelled "Private notes — for your eyes only" with a lock icon; expandable on click. Always present on every card so users discover the affordance. |
| OQ-CA-10 | When the capture assistant suggests content for private notes (the `flag_for_private_notes` tool), what's the UX? A separate proposal card, or an inline option on the main proposal card? | Inline option on the main proposal card: "Move this passage to private notes" toggle. Keeps the user oriented to a single memory. |
| OQ-CA-11 | Should Notion ingest (when built) write directly to the Review Queue, or pass through the orchestrator first? | Pass through the orchestrator. The orchestrator's reasoning is what makes each card a high-quality draft. Notion Ingest sub-agent feeds the orchestrator; orchestrator routes to the queue. |
| OQ-CA-12 | For bulk pastes that produce many cards, what's the orchestrator's progress communication? | The conversation thread shows: "Processed 15 of 40 so far — they're appearing in your Review Queue. I'll let you know when I'm done." Final message includes a link/button to jump to the queue. |
| OQ-CA-13 | The `user_chronicle_digests` table — schema sketch? | `user_chronicle_digests(user_id PK, digest_text TEXT, source_state_hash TEXT, generated_at TIMESTAMPTZ, version INT)`. Hash invalidation triggers regeneration. Job owned by Planner Agent. |
| OQ-CA-14 | How does the orchestrator know about active screen context (e.g., "user is on the globe placing pins")? | The capture panel's parent component passes a `context_hint` field with each submission: `{ active_view: 'globe', selected_pin_id?: '…', selected_memory_id?: '…' }`. The orchestrator's system prompt instructs it to use this hint to scope the conversation. |
| OQ-CA-15 | Does declining a proposal log the user's reason (for orchestrator improvement)? | MVP: just records the decline in `assumption_log`. Future: a small "Why?" reason field on decline that feeds a feedback loop into orchestrator prompt refinement. |
| OQ-CA-16 | Does the Review Queue have a "snooze" action separate from accept/decline? | Yes — defer indefinitely without declining. Cards in deferred state still appear in the queue but visually subdued. Planner Agent can resurface them with a fresh prompt over time. |

## 16. Memory and reference updates required when this spec is accepted

- `memory/project_lc_build_progress.md` — note the expanded Step 6 shape (substeps 6a–6h+ — adjusted from v1.0 to include private notes and the unified Review Queue)
- `memory/MEMORY.md` — add pointer to this spec
- `memory/reference_lc_dev_sequence.md` — update Step 6 description
- `documentation/LC_Development_Sequence.md` — replace Step 6 prompt and acceptance criteria with the expanded substeps
- `documentation/DB_Architecture_Design_v1.md` — add Part XVII: Orchestrator Agent + dual-mode sub-agents + private notes layer + prompt caching strategy
- `memory/project_lc_db_architecture.md` — add a paragraph on the orchestrator pattern as a new architectural layer; note `memories.private_notes` as a second content layer governed by ownership rather than Access Cards
- `memory/project_lc_access_cards.md` — note that private notes are a separate visibility layer *below* Access Cards (owner-only regardless of card grants)
- New memory file `project_lc_capture_assistant.md` summarising the design and pointing here
- `memory/project_lc_prd_readiness.md` Decision 3 — append parallel-strands amendment (per the residential globe spec §15)
- `CLAUDE.md` (project root) — update item 4 (Phase 0 is parallel strands, not sequential stages)
- Inngest events — rename `phase0/stage.completed` to `chronicle/threshold.reached` and update stub agents

## 17. Approval

This spec is in draft. Andy's review and refinement notes should be captured here. Once approved, the memory and reference updates in §16 are made and Step 6 expands to incorporate the substeps. The next build step after expansion of Step 6 is the residential globe (`feature_residential_globe_onboarding.md`), which reuses the capture assistant in its sidekick role.
