---
name: Life Chronicle — Ontology Bootstrapping Theory and Interview Design
description: Dependency-ordered theory of personal ontology elicitation; four-stage Phase 0 protocol; distinction between ontology elicitation and memory collection as separate interview modes
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

## Phase 0 Redefinition

Phase 0 is broader than "residential history." It is the full **Ontology Bootstrap Protocol** — a structured, staged interview that must be completed (or substantially complete) before memory collection begins. Residential history is Stage 1 of Phase 0, not the entirety of it.

Proposed Phase 0 stages:

**Stage 1 — Temporal/Geographic Skeleton** (~15–20 min)
- Birth year and location
- Complete residential history in order (place, household, approximate dates, reason for move)
- Major life transitions (marriages, divorces, career pivots, deaths of close family)

**Stage 2 — Chapter Naming** (~10–15 min)
- "How do you think about the major chapters of your life?"
- Elicit the person's own vocabulary for their life periods
- Confirm the system's inferred periodization and correct it
- This vocabulary becomes the canonical period naming used in all subsequent sessions

**Stage 3 — Entity Seed** (~20–30 min)
- Key family members (name, relationship type, period of significance)
- Key professional figures (mentors, managers, collaborators, adversaries)
- Key institutions (schools, employers, organizations joined)
- Note: aim for completeness on the most significant; long tail can be filled in during memory collection

**Stage 4 — Topic Map** (~10–15 min)
- Main areas of interest, passion, professional domain
- Recurring life themes or preoccupations
- What this person considers the "spine" of their story (if they have a sense of it)

**Validation gate before memory collection:** After Stage 4, the system presents its understanding of the person's ontology scaffold — the periods, major entities, and topic domains — and asks the person to confirm, correct, or expand. Memory collection does not begin until this is confirmed.

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
