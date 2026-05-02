# Feature Spec: The Stroll
**Roadmap Placeholder — Reminiscence & Memory Rehearsal Mode**
*Life Chronicle | Phase 2 Roadmap | Status: Concept / Pre-Design*

---

## Vision

Between active memory collection sessions, Life Chronicle fades to silence — a missed opportunity. *The Stroll* is a gentle, agent-initiated experience that surfaces a single memory from the user's chronicle, presents it as a compact, emotionally resonant narrative, and invites the user to linger inside it. It is not an interview. It is not a prompt to record more. It is the application saying: *here is something you lived — let it land.*

The Stroll serves two purposes simultaneously. For the user, it is a rehearsal of memory — the cognitive and emotional act of revisiting a moment reinforces its structure in long-term recall and validates the significance of experiences that might otherwise recede into noise. For Life Chronicle, it is a re-engagement surface: a reason for the user to return on days when they have nothing new to add, and a mechanism for surfacing adjacently-related memories that may trigger new entries organically.

---

## Core Interaction Model

The session is initiated either by the agent (push notification or dashboard prompt on a cadence) or by the user selecting "Take a Stroll" from the main interface. The agent selects a single memory event from the chronicle using the curation engine (described below), composes a short narrative rendition of it, and presents it to the user. The user receives the memory, can navigate forward into adjacent memories, or can capture a newly triggered recollection before returning to where they started.

The session has four distinct modes:

| Mode | Description |
|------|-------------|
| **Recollection** | The default state. One memory is being presented and reflected upon. The agent is listening. |
| **Adjacency** | The user has stepped into a connected memory to explore it. Breadcrumb navigation back is always visible. |
| **Capture** | The user has been triggered to record something new. The capture interface appears inline; the recollection session is suspended, not closed. |
| **Reflection** | The user has articulated a present-tense insight, lesson, or distillation from the presented memory. The agent captures this as a distinct entry type and may invite elaboration. |

---

## Component Specifications

### 1. Memory Curation Engine

The engine selects a single memory event from the user's chronicle for each Stroll session. Selection is probabilistic, not deterministic, and is weighted by several factors:

- **Temporal resonance**: events whose anniversary falls near the current date are weighted higher. The feeling of "this happened around this time of year" is itself a form of memory rehearsal.
- **Relational density**: events with rich relationship tagging (multiple named people, a significant organization, a life stage boundary) are surfaced more frequently because they tend to carry disproportionate meaning.
- **Emotional valence**: the engine should not select exclusively positive memories. Formative difficulties, losses, and resolved conflicts belong in rehearsal — but the *cadence* should lean warm, particularly for early-stage users who are still building trust with the application.
- **Recency in the chronicle, not in life**: recently *recorded* events should be de-prioritized (the user just lived them) in favor of events recorded longer ago, which benefit more from rehearsal.
- **Synthesis gap**: events that have been recorded but not yet surfaced in any synthesis output (Relationship Portrait, Period Narrative, etc.) are good candidates — rehearsal primes them for eventual inclusion.
- **Explicit user signals**: events the user has previously flagged as significant, starred, or manually returned to should receive elevated weight.

> **Open Question OQ-1**: Should the curation engine ever surface an *incomplete* memory — one with tagged uncertainty or known gaps — as a gentle invitation to fill it in? This blurs the line between rehearsal and interview. Probably a separate mode, but worth deciding.

---

### 2. Reminiscence Presentation Format

The selected memory is rendered as a short narrative passage — 100 to 200 words — composed by the agent in a warm, second-person voice. It is not a transcript of what the user said during recording. It is a *distillation*: the meaningful shape of the event, rendered as the user might tell it to a close friend in a quiet moment.

The passage leads with the sensory or situational anchor of the event (a place, a person's name, a felt quality), not with the date or category. It closes with something that gestures toward why this memory belongs in a life — what it says about who the user was or was becoming at that time.

The format should be optimized for being *spoken*, not read. Sentence length, rhythm, and word choice should feel natural aloud. This is foundational to the voice delivery implementation described below.

**Structural template (internal, not visible to user):**

```
[Anchor]: where/who/when in felt terms
[Event body]: what happened, rendered concretely
[Relational or emotional beat]: who else was present, what was at stake
[Resonance close]: what this moment carries forward
```

---

### 3. Voice & Avatar Delivery *(Future State — Phase 3)*

In a future implementation, the agent will deliver the reminiscence passage in a synthesized voice derived from the user's own recordings. The premise is compelling: hearing your own voice recount your own memory has a qualitatively different impact than reading text — it is closer to the phenomenology of actual remembering.

The avatar form (visual representation of the user speaking to themselves) is a further extension of this concept. Implementation depends on voice model quality, user consent architecture, and privacy infrastructure that is not yet in scope.

**Placeholder requirements for current implementation that enable future voice delivery:**

- The narrative passage must be stored as discrete, speakable segments with clear prosodic structure.
- Speaker-attributed voice samples from recordings should be preserved and tagged in the media layer of the memory schema.
- The TTS model selection and consent flow should be treated as a first-class privacy decision, governed by the Access Cards framework.

> **Open Question OQ-2**: Should voice delivery be opt-in by default, or presented as the obvious primary mode with text as fallback? This is a significant UX and trust question for first adoption.

---

### 4. Adjacent Memory Navigation

While in a Stroll session, the user can see a small set of *adjacent memories* — related events surfaced by the agent based on relational, temporal, or thematic proximity to the current memory being rehearsed. These are presented as a short list of short titles or anchors (not full narrative passages), visible at the edge of the presentation without demanding attention.

**Adjacency dimensions the agent uses:**

- Same person or relationship (a different memory involving the same named individual)
- Same period of life or life stage
- Same location or location type
- Thematically connected (both involve career transition, both involve loss, both involve a specific recurring activity)
- Causally or narratively connected (one memory was recorded as a follow-on to another)

The user taps or selects an adjacent memory to *step into it*. The current session does not close — it suspends. The adjacent memory is rendered in the same Stroll format. The user is now one level deep in an adjacency walk.

**Navigation state:**

The breadcrumb trail is always visible. The user always knows where they started and how many steps they have taken from that origin. The "return" action is always one gesture away. There is no depth limit enforced, but the agent should note when a user has traveled more than three steps from origin and offer a soft prompt to return.

The adjacency walk is logged as a *session trace* in the user's chronicle, recording which memories were visited in which order. This trace is itself a form of data about what the user finds meaningful and how their memories cluster subjectively — it feeds back into the curation engine over time.

> **Open Question OQ-3**: Should adjacent memories be surfaced in the same narrative-passage format, or as a lighter "memory card" (fewer words, more anchor-focused) to preserve the sense that the user has stepped into something smaller? Lighter format may be preferable — it signals that the adjacent view is a detour, not a new destination.

---

### 5. The Listening Pause & Response Routing

After the reminiscence passage is delivered, the agent does not immediately ask a question. It goes quiet.

This silence is intentional and load-bearing. The presentation has just placed a memory in the room. The first thing the agent does is get out of the way and listen for what naturally surfaces. In a voice context, this means the microphone stays open with a soft listening indicator. In a text context, the input field is open and unadorned — no prompt text, no suggested responses.

**If the user responds spontaneously**, the agent receives whatever arrives and routes it (see classification below).

**If no response comes within a defined silence threshold** (suggested: 6–10 seconds in voice; or user closes the listening window in text), the agent delivers a single open-ended prompt:

> *"What does thinking about this past event make you recall or think about now as we're talking about it?"*

This question is carefully constructed. It does two things simultaneously: it invites the user backward into connected memories ("make you recall") and forward into present-moment understanding ("think about now"). It also anchors the reflection as a conversational, present-tense act ("as we're talking about it"), which lowers the threshold for response — the user doesn't need to articulate a polished thought; they can think aloud.

The agent listens again. If still no response, it delivers one more permissive release: *"No need to say anything — just take it with you."* The session ends gracefully.

---

#### Response Classification

When the user does respond, the agent classifies the response into one of two primary pathways, or identifies it as both:

**Pathway A — Adjacent Memory Expansion**

The user recalls something related: a connected event, a person who appears again, an earlier version of this situation, a sequel. Linguistic signals include: *"That reminds me of..."*, *"I forgot that..."*, *"The last time something like this happened..."*, *"Before that, there was..."*

The agent captures this as a **memory stub** linked to the origin memory (see Section 6 for stub schema) and offers it back: *"Do you want to add a little more about that, or come back to it another time?"* Either answer is acceptable. The stub enters the intake queue regardless.

**Pathway B — Wisdom Distillation**

The user articulates a present-tense understanding that the memory gave them: a lesson absorbed, a belief formed or revised, a regret acknowledged, a gratitude named. Linguistic signals include: *"That's when I realized..."*, *"I've always thought since then..."*, *"Looking back, what I understand now is..."*, *"I never did figure out why..."*

This response is a qualitatively different kind of entry — not a memory event in time, but a **reflection**: an insight that exists in the present and is causally linked to a past event. The agent captures it as a first-class `reflection` entry (see schema below), and may ask one light elaborating question if the thought is incomplete: *"Is that something you came to understand at the time, or more in hindsight?"* This single question helps the agent tag whether the wisdom was contemporaneous or retrospective — a distinction that matters for synthesis.

**Pathway C — Correction or Revision of the Original Record**

Hearing a memory narrated back — in a different voice, in the third person, in prose the user didn't write — creates a kind of cognitive distance that internal recollection does not. Psychologists call this *self-distancing*: when you hear your own story told from outside yourself, you can evaluate it more dispassionately. Details that felt settled may suddenly seem wrong. Framings that felt accurate may reveal themselves as self-serving or incomplete. The emotional weight of an event may shift when it arrives through a different channel.

The Stroll should treat this as a gift, not a problem. When the user hears the reminiscence passage and responds with a correction — *"That's not quite how it was"*, *"I got that wrong when I recorded it"*, *"It was more complicated than that"*, *"Actually, I think I've always told it that way but it wasn't true"* — the agent should receive this without friction and capture it as a **revision** linked to the original memory record.

Linguistic signals for Pathway C include: *"That's not right"*, *"Actually..."*, *"I don't think that's accurate"*, *"I've been telling myself..."*, *"Wait, I think I mixed that up with..."*

The revision may be one of several types:

- **Factual correction**: a detail is simply wrong (a date, a name, a sequence of events)
- **Emotional reframe**: the facts are right but the feeling assigned to the memory has changed — what was recorded as a triumph may now be understood as a lucky escape, or vice versa
- **Context update**: new information acquired since the original recording changes the meaning of the event (e.g., learning later why someone acted as they did)
- **Narrative revision**: the user has been carrying a version of this story — perhaps for years — that they now recognize as a construction rather than a record

**The original entry is never overwritten.** This is a foundational principle. The version that existed at the time of recording is historically true — it represents who the user was and what they understood when they first told this story. The revision sits alongside it as a new layer, dated to the present, with the relationship between them preserved. The chronicle is richer for having both: the original account and the corrected one together are more revealing than either alone.

**Pathway A+B (compound response)**

Users will frequently offer both in a single utterance: a triggered memory that includes their retrospective understanding of it. The agent should capture both — the adjacent stub and the reflection — as separate linked entries derived from the same response.

**Compound responses involving Pathway C**

Corrections often arrive together with reflections. The user hears the narration, says *"that's not right — and actually, what I've come to understand is..."* and delivers both a factual revision and a wisdom distillation in one breath. The agent should capture both, linking them to each other and to the origin memory. This A+B+C compound is not unusual; it may in fact be among the most generative responses the Stroll produces.

**Unclassifiable or exploratory responses**

Some responses won't fit either category cleanly — the user may trail off, ask a question back, or share a feeling rather than a thought. The agent should receive these with warmth and not force classification. A simple *"That makes sense to sit with"* closes gracefully. If a feeling is expressed, the agent may optionally tag it as emotional resonance metadata on the origin memory record, without surfacing that tagging to the user.

---

#### Reflection Entry Type & Schema

Reflections are a new first-class entry type in the chronicle — distinct from memory events, which are anchored in the past, and distinct from intake stubs, which are unfinished memory seeds. A reflection is present-tense wisdom that has its source in the past.

```sql
CREATE TABLE reflections (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id),
    source_memory_id        UUID REFERENCES memory_events(id),  -- the memory that surfaced it
    stroll_session_id       UUID,                               -- the Stroll session in which it arose
    content                 TEXT NOT NULL,                      -- verbatim or lightly cleaned user utterance
    reflection_type         TEXT CHECK (reflection_type IN (
                                'lesson_learned',
                                'belief_formed',
                                'belief_revised',
                                'regret',
                                'gratitude',
                                'unresolved_question',
                                'other'
                            )),
    temporality             TEXT CHECK (temporality IN (
                                'contemporaneous',   -- understood at the time of the event
                                'retrospective',     -- understood in hindsight
                                'uncertain'
                            )),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    emotional_resonance     TEXT[],                             -- optional tags from unclassifiable responses
    synthesis_ready         BOOLEAN DEFAULT FALSE               -- flagged when sufficient to feed Wisdom Distillation
);
```

Reflections are the primary raw material for the **Wisdom Distillation** shareable artifact. They are also frequently the catalyst for Pathway C revisions — the act of articulating a lesson often reveals that the original record of the event was incomplete or subtly distorted.

---

#### Revision Entry Type & Schema

Revisions are a non-destructive correction layer over existing memory records. The original entry is immutable once written; revisions append to it without replacing it.

```sql
CREATE TABLE memory_revisions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id),
    source_entry_id         UUID NOT NULL REFERENCES memory_events(id),  -- the record being revised
    stroll_session_id       UUID,                                         -- if triggered during a Stroll
    triggered_by_reflection UUID REFERENCES reflections(id),             -- if a reflection catalyzed this revision
    revision_type           TEXT CHECK (revision_type IN (
                                'factual_correction',    -- a detail was simply wrong
                                'emotional_reframe',     -- the facts stand; the felt meaning has changed
                                'context_update',        -- new information changes the event's meaning
                                'narrative_revision'     -- the user recognizes their version as a constructed account
                            )),
    original_excerpt        TEXT,    -- the specific portion of the original that is being revised (optional)
    revised_content         TEXT NOT NULL,  -- the corrected or updated account
    user_note               TEXT,    -- why the revision is being made, in the user's own words
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

The `original_excerpt` field is optional but valuable when the revision is surgical (correcting a single date or name) rather than holistic. When the entire emotional register of a memory is being revised, `original_excerpt` may be left null and the `revised_content` will stand as a complete re-account.

Synthesis agents that produce Period Narratives or Relationship Portraits must check for revisions before rendering any memory event. Where a revision exists, the synthesis should reflect the most current understanding — but the original account and the revision history should be accessible in the detailed record view, because the *arc* of how a person has understood their own experience over time is itself meaningful. Over time, a user who regularly completes Stroll sessions will accumulate a body of reflections that can be organized by theme, relationship, life stage, or reflection type — and eventually distilled into a coherent, readable account of what this life has taught them.

> **Open Question OQ-4**: When a user provides a response the agent classifies as Pathway B, should it offer the reflection back immediately in a brief rendered form — "So: you learned that trusting your instincts costs less than talking yourself out of them" — as a kind of mirror? This risks feeling presumptuous but could be deeply validating when done well. The risk is high if the agent's paraphrase is wrong.

---

### 6. Capture of Triggered Recollections

One of the most valuable things the Stroll can do is trigger memories the user has not yet recorded. When a presented memory resonates and calls up something else — a forgotten detail, a related event, an earlier cause — the user should be able to capture it immediately without losing their place.

The capture interface appears inline as a lightweight drawer or overlay. It operates in a reduced mode compared to the full interview intake: the user gives a brief verbal or typed account of what surfaced, and the agent captures it as a *stub entry* tagged to the current Stroll session, marked as triggered by the specific memory being rehearsed.

The stub is not a complete memory record — it is a seed. It enters the intake queue to be developed in a future interview session. The relationship between the triggering memory and the triggered stub is preserved as a narrative link in the schema.

After capturing, the user returns to exactly where they were in the Stroll — the same memory, the same place in the adjacency walk. The capture is an excursion, not a diversion.

**Capture stub schema additions required:**

```sql
-- Additions to the existing memory_events or staging table
triggered_by_event_id   UUID REFERENCES memory_events(id),
triggered_in_session    UUID,  -- the Stroll session ID
capture_mode            TEXT CHECK (capture_mode IN ('stroll', 'interview', 'freeform'))
```

---

## UX Flow

```
[Agent prompt / user initiates]
    ↓
Curation engine selects memory
    ↓
Reminiscence passage presented (text / voice)
    ↓
Agent goes quiet — listening window opens
    ↓
    ├─ [Spontaneous response arrives]
    │       ↓
    │   Agent classifies response
    │       ↓
    │   ├─ [Pathway A: Adjacent memory triggered]
    │   │       ↓
    │   │   Memory stub captured, linked to origin
    │   │       ↓
    │   │   Agent offers: "Add more now, or come back to it?"
    │   │       ↓
    │   │   Stub enters intake queue regardless
    │   │       ↓
    │   │   Returns to Stroll (listening window re-opens)
    │   │
    │   ├─ [Pathway B: Wisdom / reflection articulated]
    │   │       ↓
    │   │   Reflection entry captured (typed + linked to origin memory)
    │   │       ↓
    │   │   Agent asks: "Did you understand that at the time, or more in hindsight?"
    │   │       ↓
    │   │   Reflection tagged with temporality → enters synthesis queue
    │   │       ↓
    │   │   Returns to Stroll (listening window re-opens)
    │   │
    │   ├─ [Pathway C: Correction or revision surfaced]
    │   │       ↓
    │   │   Agent receives: "That's not right" / "Actually..."
    │   │       ↓
    │   │   Agent asks: "What would you change about the way it's recorded?"
    │   │       ↓
    │   │   Revision captured (type tagged, original preserved)
    │   │       ↓
    │   │   Agent confirms: "Got it — the original stays, this sits alongside it"
    │   │       ↓
    │   │   Returns to Stroll (listening window re-opens)
    │   │
    │   └─ [Compound A+B+C]
    │           ↓
    │       Stub + reflection + revision captured as linked set
    │           ↓
    │       Returns to Stroll
    │
    ├─ [No response within silence threshold]
    │       ↓
    │   Agent delivers fallback prompt:
    │   "What does thinking about this past event make you
    │    recall or think about now as we're talking about it?"
    │       ↓
    │   Response arrives → routes to Pathway A / B / A+B (above)
    │       ↓
    │   [Still no response]
    │       ↓
    │   Agent: "No need to say anything — just take it with you."
    │       ↓
    │   Session ends gracefully
    │
    ├─ [User navigates to adjacent memory manually]
    │       ↓
    │   Adjacent memory rendered (lighter card format)
    │       ↓
    │   [Breadcrumb: N steps from origin — always visible]
    │       ↓
    │   Listening window re-opens at new memory
    │       ↓
    │   User can go deeper, capture, reflect, or return
    │
    └─ [User closes / session ends at any point]
            ↓
        Session trace logged (visit order, stubs, reflections)
        Curation engine updated with engagement signals
```

---

## Relationship to Existing Features

| Feature | Relationship |
|---------|-------------|
| Interview / Intake | Stroll is explicitly *not* this. No probing questions, no completion pressure. Capture stubs created in Stroll feed back into the interview queue. |
| Access Cards | All memories surfaced in Stroll should respect the user's access card settings. A memory marked private-only should not appear in Stroll sessions initiated from a shared context. |
| Synthesis Outputs | Stroll serves as informal rehearsal for memories that will later be shaped into Period Narratives, Relationship Portraits, etc. Session trace data can inform synthesis priority. |
| Temporal Agent | The curation engine can consult the temporal constraint graph to identify memories that are still date-uncertain — these can be de-prioritized from Stroll (too fragmentary to resonate well) or flagged with a gentle prompt to the Temporal Agent. |
| Five Shareable Artifacts | Stroll is a precursor to sharing: rehearsing a memory privately is how a user decides it's worth sharing. Reflections captured in Stroll sessions are the primary input for the **Wisdom Distillation** artifact. No other feature generates this data type. |

---

## Out of Scope for This Placeholder

- Algorithmic mood matching (selecting memories based on inferred user emotional state)
- Social Stroll (sharing a reminiscence with another person in real time)
- Stroll-based annotation (the user editing the memory record during a Stroll session)
- Scheduled delivery via email or push outside the application

---

## Open Questions Summary

| # | Question | Implication |
|---|----------|-------------|
| OQ-1 | Should incomplete/uncertain memories be surfaced? | Blurs rehearsal/interview modes; needs intentional design |
| OQ-2 | Voice delivery opt-in vs. opt-out default? | Affects trust, onboarding, and consent architecture |
| OQ-3 | Adjacent memory in full narrative vs. lighter card format? | Affects depth signaling and session pacing |
| OQ-4 | Should the agent mirror a Pathway B response back as a paraphrase? | Deeply validating if accurate; risks feeling presumptuous or wrong — high-variance interaction |
| OQ-5 | When a revision is captured, should the agent note if the revision changes the meaning of other chronicle entries that reference the same event? | Could surface important downstream corrections; also risks feeling like the chronicle is interrogating the user |
| OQ-6 | Should a pattern of `narrative_revision` type corrections — the user repeatedly revising how they've told a story — be surfaced as a signal to the user? This might be the chronicle's most honest mirror: "You've revised this memory three times over five years." | High value; also potentially confronting |

---

*Last updated: 2026-04-29 — v3: added Pathway C (correction/revision), self-distancing mechanism, memory_revisions schema*
*Owner: Andy Halliday*
*Phase: 2 (Post-MVP)*
