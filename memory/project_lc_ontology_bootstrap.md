---
name: Life Chronicle — Ontology Bootstrapping Theory and Interview Design
description: Dependency-ordered theory of personal ontology elicitation; three-strand Phase 0 protocol (amended 2026-04-30 to remove chapter naming; further amended 2026-05-17 to remove sequential stages — strands run in parallel under capture assistant orchestration); distinction between ontology elicitation and memory collection as separate interview modes
type: project
originSessionId: b93109c0-5f80-46b4-9917-1ba2344df045
---
## Core Insight

A personal life chronicle requires a person-specific ontology — not imported from an external schema, but elicited progressively from the person. The elicitation order matters enormously: some ontology elements are **structurally prior** to others, meaning later elements cannot be reliably placed or integrated without them. The system must bootstrap the ontology before collecting memories in earnest.

**Why:** Memories collected before the scaffold is established are orphans — no reliable temporal home, entity resolution is guesswork, topic classification is inconsistent. Each new session has to re-ask about people and places already mentioned. The cleanup cost is high and user fatigue sets in.

**Informed by:** Nayan Paul's "Ontology-Driven Agents: The Missing Layer for Knowledge Apps" (Medium, March 2026), cross-applied to the personal domain. Key adaptation: enterprise ontologies are imported from institutional schemas; personal ontologies must be *discovered from the person* through structured elicitation.

---

## The Dependency Ordering — Four Tiers

### Tier 1 — Structural Scaffold (must come first; universal across all people)

These are the coordinate systems into which all subsequent content gets placed.

1. **Temporal anchors** — birth, major life transitions, major moves. Establishes the timeline.
2. **Geographic anchoring** — where and when (residential history). Already designed as Phase 0. Sequential, non-overlapping residencies provide bilateral temporal constraints.
3. **Chapter naming** — how does *this person* carve up their own life into periods? ("The Philly years," "before I left finance," "after my father died.") This is where personal ontology first diverges from universal structure, but the question is universal even if the answers differ.

**Why scaffold first:** Without these, every memory is a free-floating data point. With them, every subsequent memory immediately has a candidate home.

### Tier 2 — Entity Seed (second; still relatively universal in structure, personal in content)

4. **Key people** — the 10–15 most important individuals: family members, mentors, partners, formative friendships. Name, relationship type, rough period in life. Does not need to be exhaustive — just the major nodes.
5. **Key organizations** — schools, employers, institutions that shaped the person's life. Provide both temporal anchors (you were at Company X from Y to Z) and relational context.
6. **Relationship quality elicitation** — not just *who* but *what kind*. What does "mentor" mean to this person? Who counts as family (biologically? chosen?)

**Why entity seed second:** Once major entities are seeded, when someone later mentions "my mentor at the agency," the system has a candidate to resolve against rather than treating it as an unknown every time.

### Tier 3 — Topic Map (third; builds on scaffold + entity seed)

7. **Recurring themes and interests** — what did this person spend their mental and emotional energy on across their life?
8. **Professional domains** — what fields, industries, disciplines?
9. **Life preoccupations** — what questions, causes, or challenges recurred?

**Why topic map third:** These dimensions can only be meaningfully mapped once the person's periods and relationships are known. "Music was important to me" means something different if it was a career vs. a private solace vs. a family tradition.

### Tier 4 — Content Collection (only after Tiers 1–3 are established)

10. **Individual memories** — specific recollections, anecdotes, formative moments. Now immediately integrable because they have a home in the scaffold.
11. **Syntheses** — narrative arcs, character portraits, wisdom statements. Can only be trusted once enough content is anchored to the scaffold.

---

## The Universal vs. Personal Structure

**What is universal:** The existence of temporal periods, geographic locations, family, education, work, and relationships. Every human life has these. This is what allows a standardized opening protocol to be designed once and applied to all users.

**What is personal:** How those categories are filled, how they are named, which are most salient, and what they mean to this specific person. The divergence begins in Stage 2 (chapter naming) and deepens from there.

**Implication:** The early interview questions are universal and can be scripted. The depth and direction of follow-up is adaptive — determined by what the person's answers reveal about their life's shape.

---

## Branching / Adaptive Elicitation

Early answers determine which subsequent questions are most valuable. Examples:

- Single long career vs. multiple distinct careers → different professional chapter depth
- Highly geographically mobile vs. rooted in one place → different geographic anchoring depth
- Complex family structure (blended, estrangement, chosen family) → more deliberate family entity elicitation
- Creative or entrepreneurial life → artifact and project entity seeding becomes important early
- Significant loss or disruption as a life organizing event → temporal anchors around those events, not just calendar periods

The Planner Agent should treat this as a decision tree: early answers unlock or suppress branches of elicitation, and the session plan adapts accordingly.

---

## Ontology Elicitation vs. Memory Collection: Two Distinct Interview Modes

These are **different modes** with different agent behaviors, different question types, and different success criteria. Conflating them is a design mistake.

| Dimension | Ontology Bootstrap | Memory Collection |
|---|---|---|
| Goal | Establish structure | Gather content |
| Output | Entity records, period definitions, relationship types | Memory records, tagged and anchored |
| Question style | "Walk me through all the places you've lived, in order" | "Tell me about the summer after you graduated" |
| Success metric | Scaffold coverage complete | Memory count × dimension coverage |
| Agent behavior | Elicit → confirm → formalize | Prompt → transcribe → tag → anchor |
| When to use | Phase 0 + whenever scaffold gaps detected | Phases 1+ after scaffold established |

**Architectural implication:** `interview_sessions.session_type` should distinguish between at minimum: `ontology_bootstrap`, `memory_collection`, `temporal_resolution`, `entity_resolution`, `review_and_correction`. The agent prompts, evaluation criteria, and downstream processing differ substantially across types.

---

## Phase 0 Protocol (current — three parallel strands)

Phase 0 is the **Ontology Bootstrap Protocol** — the structured elicitation that must be substantially complete before memory collection enters its mature phase. Residential history is one strand, not the entirety.

**Amendment history:**

- **2026-04-30 (Decision 3, original):** Reduced four stages to three by removing chapter naming. Reason: asking a user to pre-define broad life chapter labels before any collection has occurred is impractical and artificial. `user_periods` remains in the schema for post-collection use; not populated in Phase 0.
- **2026-05-17 (parallel-strands amendment):** Eliminated explicit user-declared stage completion entirely. The three remaining strands run in parallel under the capture assistant's orchestration. No "Stage 1 → Stage 2 → Stage 3" gating; no "I'm done with Stage 1" button. The user engages with whichever strand the orchestrator prompts next based on chronicle state; the system internally tracks data accumulation and ships artifacts when thresholds are met.

**The three strands (canonical 2026-05-17):**

| Strand | What it builds | Primary surface | Threshold artifact |
|---|---|---|---|
| Residential (was Stage 1) | Temporal/geographic spine — places lived, in sequence, with available date precision | Life Globe pinning UI (`feature_residential_globe_onboarding.md`) + Timeline UI | Life Globe (delivered when ≥3 main-residence pins with ≥1 date hint) |
| Entity (was Stage 2) | Seed of key people, institutions, organisations | Capture assistant conversation + entity-confirmation cards in Review Queue | Entity Portrait of a key person (≥3 person entities with non-trivial context) |
| Topic (was Stage 3) | Confirmation of active life dimensions; recurring themes | Capture assistant conversation + dimension confirmation UI | Life's Players (lifes_cast) synthesis (≥5 person entities across multiple life stages + ≥3 residential pins) |

**Threshold events** fire as `chronicle/threshold.reached` (replacing the obsolete `phase0/stage.completed`) and trigger downstream synthesis.

**Dependency theory unchanged:** Tier 1 structural scaffold (residential) is conceptually prior to Tier 2 entity seed, which is conceptually prior to Tier 3 topic map. The orchestrator enforces this internally — it prompts toward the residential strand first when the user is new, weaves in entity prompts once enough residential structure exists, and starts surfacing topic-mapping prompts once entity content is dense enough for theme inference.

**No validation gate before memory collection.** The earlier model had an explicit "Phase 0 complete?" gate. That's gone. Memory collection and Phase 0 strand-building interleave naturally — every memory the user enters also populates entity stubs, dimension hints, and (if location is mentioned) place-resolution candidates against the residential spine.

**Canonical sources:**

- `documentation/feature_residential_globe_onboarding.md` v1.1 — residential strand UX
- `documentation/feature_capture_assistant.md` v1.1 — orchestrator + strand prompting strategy
- `memory/project_lc_prd_readiness.md` Decision 3 (amended 2026-05-17) — the decision record
- `CLAUDE.md` item 4 — the architectural invariant (updated 2026-05-17 to reflect parallel strands)

**Earlier sections of this file (the four-tier dependency theory, ontology vs. memory-collection modes, gap-aware reasoning implications) remain valid as theory and are unchanged. Only the user-facing protocol manifestation changed from sequential stages to parallel strands.**

---

## User Experience Value

Beyond the architectural benefit, the bootstrapping protocol solves a major UX problem: it eliminates the blank canvas problem. Asking someone to "tell me their life story" is overwhelming. Walking them through structured, relatively easy questions ("where have you lived?", "who are the most important people in your story?") gives a quick sense of progress and shapes the task. It also builds trust — the system demonstrates that it understands the structure of a life before asking anyone to fill it in.

The bootstrap interview is also a **trust-building protocol**: the user sees the system take their scaffold seriously, reflect it back accurately, and build on it — before any emotionally significant memory work begins.

---

## Relationship to Gap-Aware Reasoning (Ontology-Driven Agent Pattern)

The ontology bootstrap is also what enables gap-aware reasoning across the full system. Once the scaffold is established:

- The Planner Agent can identify not just "this topic is uncovered" but "this topic cannot be synthesized until prerequisite entities X and Y are resolved" — dependency-aware gap detection.
- The Synthesis Agent can flag when a synthesis is incomplete because the ontology says it requires elements that are missing.
- The Temporal Agent's constraint graph has known anchor points to work from immediately, rather than inferring them from scratch.
- An **assumption log** (not yet in the schema) should capture every agent inference and disambiguation decision as a traceable, reviewable record — when a synthesis is wrong, the user needs a path to correction.

**Why:** Without the ontology scaffold, agents produce plausible-sounding outputs that a careful user might notice are subtly wrong in untraceable ways. With it, every output is grounded in a structure the user has confirmed, and gaps are explicit rather than hidden.
