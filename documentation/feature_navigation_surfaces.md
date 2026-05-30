# Feature Spec: The Three Navigation Surfaces

**Status:** Draft v1.0 — 2026-05-30. New canonical spec capturing Andy's reframe (Step 6g design pass, 2026-05-28) of the MVP navigation model. Supersedes the strict three-stage Phase 0 framing in PRD v1 §3 and the standalone "Life's Players" framing in PRD v1 §9.

**Author note:** This spec records the architectural decision that the MVP user interface is organised around three primary navigation surfaces — **Globe**, **Recollections**, **Timelines** — rather than around the older "ontology bootstrap → synthesis artifact" sequence. The three surfaces are persistent, parallel, and complementary; they are how the user reads and explores their chronicle. The capture assistant is a fourth, always-on surface for writing.

---

## 1. Concept

A chronicle is multi-dimensional. The same body of memories can be navigated geographically (*where did this happen?*), chronologically (*what happened around this time?*), or thematically (*who was in my life during this period? what was I working on?*). No single view captures all three; forcing the user to choose one privileges arbitrary salience over the user's actual mode of recall in the moment.

The MVP exposes three top-level navigation surfaces, each tuned to one of these reading modes:

| Surface | Reading mode | Anchors | Lead in onboarding |
|---|---|---|---|
| **Globe** | Where | Geographic places (entities of type `place`) | ✓ first usable UI |
| **Recollections** | What | Memories (the Raw Vault, searchable) | introduced as memories accumulate |
| **Timelines** | When (and through whom / through what) | Progressive dimensions across the life span | introduced once enough entities exist to render a meaningful timeline |

The user moves freely between them. Each surface can deep-link into the others (a globe pin opens its memories in Recollections; a Recollections card with a place opens it on the Globe; a Timelines entry opens its supporting memories in Recollections).

**The three surfaces are also the *idiom* the system uses to onboard the user.** Phase 0 is not "complete three stages of an interview"; Phase 0 is "the user becomes fluent in the three surfaces." Each surface is introduced when the user's data supports a non-trivial rendering — Globe first because it works from the first pin, Recollections next once at least one memory exists, Timelines third once at least one dimension (typically Players) has enough mass to show progression.

---

## 2. Rationale — why three surfaces replace the stage-and-artifact model

PRD v1 §3 described Phase 0 as a three-stage interview sequence (Temporal/Geographic → Entity Seed → Topic Map), with each stage closing in a deliverable artifact (Life Globe, Entity Portrait, Life's Players). That framing made two assumptions that didn't survive contact with the design:

**Assumption 1: synthesis artifacts and navigation views are the same thing.** They aren't. The Life Globe is *both* a synthesis (the entity_biography prose attached to each pin) AND a navigation surface (the pannable map you click to browse). Conflating the two locks the navigation behind "synthesis is ready" — which means the user can't explore their own data until the system has rendered prose for it. Separating them lets the navigation surface exist from the first pin; synthesis enriches the surface but isn't a precondition.

**Assumption 2: the user wants a guided sequence with completion gates.** They don't. The target user (40+, building their own legacy) wants to feel they're constructing something real from the first click. Stage gates introduce a "first you must…" friction that competes with the very engagement we're trying to create. Strands run in parallel under the hood (per `project_lc_ontology_bootstrap.md`); navigation surfaces are introduced organically when the data supports them.

The three-surfaces model preserves the value of the original stages — Globe corresponds to the residential strand's payoff, Timelines/Players corresponds to the entity strand's payoff, Recollections is the always-available "what did I capture" view — while removing the explicit gating.

| Cost | Stage-and-artifact model | Three-surfaces model |
|---|---|---|
| First useful UI | After Stage 1 interview completes | Globe is the first screen the user sees |
| User feels progress | At stage transitions (every 15–30 min) | On every captured memory + every globe pin |
| Synthesis dependency | Globe artifact needs entity_biography for every place | Globe surface works without synthesis; synthesis enriches over time |
| Mental model | "Complete the interview to see your story" | "These three views are your chronicle; they get richer as you add to it" |
| Cross-surface navigation | Each artifact is its own page | Every surface deep-links to the others |

---

## 3. The Globe surface

### 3.1 Purpose

The geographic view of the chronicle. Each significant place the user has lived, worked, or visited is a pin; each pin opens to the memories anchored there and (when synthesis exists) to the place portrait.

### 3.2 Data backing

- `entities WHERE type='place'` — pin locations (`geom`), display names, hierarchy via `location_entity_id`
- `memory_entities` JOIN `memories` — memories attached to each place
- `syntheses WHERE synthesis_type='entity_biography' AND entity_id = <place>` — prose portraits, when generated
- `life_journey_geojson()` — pre-computed FeatureCollection for animation

### 3.3 Primary interactions

- Pan, zoom, click — the map is the navigation
- Pin click → side panel with the place's memories (deep link to Recollections filtered by entity)
- Temporal transit animation (auto-play on first view) — camera traces the user's residential arc chronologically
- "Add a place" — opens the residential-globe onboarding modal (see `feature_residential_globe_onboarding.md`)

### 3.4 MVP behaviour

Live from the first pin. Animates when ≥3 lived-at relationships exist. Synthesis prose populates per-pin lazily.

---

## 4. The Recollections surface

### 4.1 Purpose

The chronological / searchable list of every memory in the Raw Vault. The "what did I capture?" view, and the destination for any deep-link from another surface.

### 4.2 Data backing

- `memories WHERE user_id = current_user AND redacted_at IS NULL`
- Optional filters: entity (any), dimension, time range (`time_estimate`), source (`session_id` / `submission_id`), draft-or-final
- Search: full-text on `content_raw` + pgvector cosine on `content_embedding` (Phase 2 — MVP is filter + sort only)

### 4.3 Primary interactions

- Card list, newest first by `time_estimate` (with `created_at` as fallback when `time_estimate IS NULL`)
- Filter chips: by entity, by dimension, by date band
- Click a card → memory detail (inline expand or modal — TBD)
- Card actions: edit (drafts only — see existing `PATCH /api/memory/[id]`), share, "explore on Globe" (if memory has a place entity), "see this person's timeline" (deep link to Timelines)
- Drafts visually distinguished from finalised memories (current `/memories` page already does this)

### 4.4 MVP behaviour

The current `/memories` page is the proto-Recollections surface. The MVP build of this spec hardens it with filtering, entity chips, and the cross-surface deep links.

---

## 5. The Timelines surface

### 5.1 Purpose

The chronological view of *progressive dimensions* — facets of the user's life that evolved over time. Players (the cast of significant people) is the canonical example: who entered, who exited, who remained across life stages. Other dimensions follow the same pattern: career arc, education arc, recurring themes.

### 5.2 Why this is one surface, not many

Players, Career, Education, Themes are all the same shape of data: a time-ordered series of entities-or-concepts with entry and exit points, supporting memories, and prose summary per period. Rendering them as separate top-level pages would multiply navigation cost without adding insight. Treating them as **dimensions of a single Timelines surface** lets the user switch lenses (Players → Career) without losing position, and lets the system add new dimensions over time without UI surgery.

### 5.2a Persistence — the lifelong-presence problem

The most important relationships in a chronicle often persist with continuity from very early in life to the present day: a parent who was there from birth, a spouse who's been there for thirty years, a childhood friend who's still in your life at 70. Any rendering that organises Timelines as "the cast present at each life stage" risks making these continuous presences feel discontinuous — the same person re-appearing in each stage slot, when their truth is a single uninterrupted bar across the entire life span.

The visualisation model the MVP commits to is therefore a **swimlane** (or Gantt-style) layout, not a per-stage cast list. Each entity gets one horizontal bar that runs from their entry point to their exit point (or to "present" if they're still around). Bars stack vertically; sort order is by entry date or by significance weight. Lifelong presences are visually obvious — their bar spans the full axis. Short blooms are visually obvious too — their bar is a short notch. Memory density is conveyed by bar opacity or by tick-marks along the bar.

A per-life-stage cast accordion can be a secondary view layered on top of the swimlane (filter the swimlane to "who's present in this stage"), but the swimlane itself is the canonical representation. This is the durability test for any chronicle visualisation — the form has to honour the user's actual lived continuity, not the system's segmentation of it.

### 5.3 Data backing

A general timeline-of-dimension view is parameterised by dimension type. Per dimension:

- **Players**: time-ordered groups of `entities WHERE type='person'`, with per-life-stage cast composition. Backing the `lifes_cast` synthesis but accessible without synthesis having run.
- **Career** (Phase 2): time-ordered groups of `entities WHERE type='organization' AND relationship='employed_by'`.
- **Education** (Phase 2): time-ordered groups of `entities WHERE type='organization' AND relationship='attended'`.
- **Themes** (Phase 2): time-ordered groups of `dimensions WHERE dimension_type='topic'`.

Common scaffolding: life stages on the time axis (eight standard stages — childhood, adolescence, early adulthood, etc., per `dimension_types`), entities/concepts grouped per stage, expandable per entity to show supporting memories.

### 5.4 Primary interactions

- Dimension selector at top (MVP: Players only; Phase 2: dropdown of all dimensions)
- Life-stage scroll or accordion — each stage shows its cast
- Per-entry expand → entity name, period of significance, prose summary, supporting memory IDs (link to Recollections)
- Entity name click → Globe (if it has a place) or Recollections (filtered by entity)

### 5.5 MVP behaviour and the lead dimension

The MVP ships one Timelines dimension: **Significant Relationships** (a.k.a. the romance strand). This is deliberately narrower than the "Players / Life's Cast" framing in the original PRD. The Significant Relationships dimension covers the people who occupied the central emotional roles in the user's life — partners, deepest friendships, the family figures who shaped them. Casual acquaintances and professional contacts are visible in Recollections (as entity chips on memory cards) but don't populate this dimension.

The narrowing matters for onboarding (see §8.3). Asking the user to map out "all the significant people" is overwhelming. Asking them to start with the romance strand — the partners, the longest friendships, the lifelong family figures — is a sequence they can walk through in one sitting. It also produces a satisfyingly visual timeline very quickly: three or four bars on a swimlane, some spanning decades.

The surface renders from the first confirmed person entity. Lifes_cast synthesis (when Phase 2 ships it) enriches the per-entry summaries; without synthesis, the entry shows name + period of significance + memory count + a first-line excerpt from the most recent memory. **The surface works without synthesis. Synthesis enriches; it doesn't gate.**

Career, Education, Themes are Phase 2 dimensions — same swimlane mechanism, different filter on entity_type / relationship.

---

## 6. Relationships between surfaces

The three surfaces are different lenses on the same underlying chronicle. Every cross-surface action is a deep link with preserved context.

| From | Action | Lands on |
|---|---|---|
| Globe pin | Click | Recollections filtered by that place entity |
| Globe pin | "View portrait" | Recollections filtered + synthesis prose if present |
| Recollections card with place | "On Globe" | Globe centred on that pin |
| Recollections card with person | "This person's timeline" | Timelines/Players, focused on that entity's row |
| Recollections card with org | "This org's arc" (Phase 2) | Timelines/Career or /Education |
| Timelines entry | "Supporting memories" | Recollections filtered by entity + life-stage time band |
| Timelines person row | "Where they appear" | Globe with their associated places highlighted (Phase 2) |

No surface is a precondition of another; the user can land on any one directly via URL.

---

## 7. The capture assistant — the fourth, always-on surface

The capture assistant (per `feature_capture_assistant.md`) is the **writing** surface. It is not one of the three navigation surfaces and isn't placed in the nav structure; it is always present as a floating panel / FAB so the user can drop a memory in from any context. Submissions create drafts which surface in Recollections (with a draft badge) and propagate to Globe and Timelines once finalised.

The three navigation surfaces are intentionally read-leaning. Inline edits exist (rename entity, edit draft text, accept/decline proposals on cards), but the *primary* writing flow goes through the capture assistant. This keeps each surface focused on the cognitive task it serves.

---

## 8. Phase 0 onboarding via the three surfaces

Onboarding's job is not to extract a complete ontology before memory collection begins. It is to familiarise the user with the three surfaces and the mechanisms for adding memories, by giving each surface enough data to render meaningfully.

### 8.1 The lead-in: Globe

The user's first signed-in screen is the empty Globe with the welcome prompt *"Where were you born?"* (Per `feature_residential_globe_onboarding.md`.) The user places pins and writes/dictates per-pin context. Each pin is a residency `memory` plus `lived_at` relationship plus place entity.

### 8.2 Introducing Recollections

After the first pin (or first capture-assistant submission, whichever comes first), the system surfaces a Recollections tab: *"Here's what you've shared so far — searchable any time."* The user sees their captures as cards. They learn that the chronicle has a chronological face, not just a geographic one.

### 8.3 Introducing Timelines — early, narrow, and inviting

The Timelines surface is introduced **as soon as the user has confirmed three person entities through the entity verification UI** (the /review confirmations from Step 6g — the user has explicitly said "yes, this is a person in my life, and this is the correct spelling"). Three is enough to render a non-trivial swimlane. The introduction is active: the onboarding agent draws the user to Timelines with copy along the lines of *"You've named a few significant people — take a look at how the start of your life's relationship arc is shaping up."*

The lead dimension is the **Significant Relationships** / romance strand (see §5.5). The framing matters: the user isn't being asked to enumerate everyone they've ever known. They're being invited to walk through the partners, lifelong friends, and family figures who anchor their life — a narrow but high-payoff narrative spine that's easy to enumerate in one sitting. Even at three or four bars the swimlane gives the user a visceral sense of how the chronicle is starting to render their life back to them.

Critically, the threshold for surfacing Timelines is *not* "the dimension is full." It's "the dimension has enough mass to render something meaningful at all." Sparse is fine; the swimlane handles sparse data gracefully (a few short bars with lots of axis showing the user where future entries can land). The intent is to bring the user to the surface early, while the system can still encourage continued capture by showing them the shape of what they're building.

### 8.4 No explicit completion gate

There is no "Phase 0 complete" event. The system's internal state (per `project_lc_ontology_bootstrap.md`) tracks data accumulation across three strands (residential, entity, topic). When thresholds are met, synthesis artifacts (entity_biography for the most-mentioned place, lifes_cast for the cast) generate in the background and enrich the existing surfaces. The user never presses a "done" button; the surfaces simply get richer.

---

## 9. MVP scope vs Phase 2

| Concern | MVP | Phase 2 |
|---|---|---|
| Globe surface | Pins, animation, click-to-Recollections, residential modal | Cesium 3D, satellite memory prompts, video pin attachments |
| Recollections | Card list + filter chips + entity chips + draft badge + cross-surface links | Full-text + semantic search; saved searches; chapter grouping when chapters exist |
| Timelines — Players | Render from entity seed; expand per-entity; deep links to Recollections | Lifes_cast synthesis enrichment; "where they appear" Globe highlight |
| Timelines — other dimensions | None | Career, Education, Themes |
| Cross-surface deep links | All the read-direction ones | Globe-from-Timelines, Recollections-saved-view-from-anywhere |
| Capture assistant integration | Drafts visible everywhere they apply | Inline cross-surface previews while drafting |
| Mobile | Bottom nav: Globe / Recollections / Timelines + capture FAB | Per-surface gestures, swipe between surfaces |

---

## 10. Open questions

**OQ-NS-1. RESOLVED.** Recollections sort order: `time_estimate DESC NULLS FIRST, created_at DESC` — surface untimed memories first, then timed ones reverse-chronological. (Approved 2026-05-30.)

**OQ-NS-2. RESOLVED.** Every surface's empty state includes a one-line invitation to capture. Copy is *directional* and *depersonalised* — e.g. *"Click the chat bubble to record a memory"* — not personalised (*"your first memory"*). Surfaces never feel like dead ends. (Approved 2026-05-30.)

**OQ-NS-3. RESOLVED.** Silent on the third milestone (Timelines unlocked). No banner, no congratulatory toast. Matches the no-completion-gate philosophy. (Approved 2026-05-30.)

**OQ-NS-4. RESOLVED.** The Stroll (reminiscence mode, `feature_reminiscence_mode.md`) launches as a mode entered from within Recollections or Timelines, not as a fourth navigation surface. (Approved 2026-05-30.)

**OQ-NS-5. RESOLVED.** Hybrid layout: **top tabs for the three primary reading surfaces** (Globe / Recollections / Timelines) + **slim left rail for utility items** (Review queue with open-count chip, Settings, Sign out). Timelines' dimension selector lives on the destination page — sub-dimensions (Career, Education, Themes) are not promoted into the nav chrome; they're discoverable inside Timelines itself. Capture stays as a floating FAB (⌘K on desktop). This preserves the chronicle-feel of top tabs while giving utility items a dedicated home. (Approved 2026-05-30.)

---

## 11. Navigation chrome — the resolved layout

```
┌────┬─────────────────────────────────────────────────────────────────────┐
│ LC │   Globe    Recollections    Timelines              user@email │ ⏻ │
├────┼─────────────────────────────────────────────────────────────────────┤
│ ⌗3 │                                                                     │
│ ── │                                                                     │
│ ⚙  │                       ACTIVE SURFACE                                │
│ ↩  │                                                                     │
│    │                                                            ┌──────┐ │
│    │                                                            │  💬  │ │
│    │                                                            └──────┘ │
└────┴─────────────────────────────────────────────────────────────────────┘
  Top:  3 primary reading surfaces · user identity · sign-out
  Rail: Review queue badge · Settings · (utility items as they arise)
  FAB:  Capture (always-on writer; ⌘K shortcut on desktop)
```

The Timelines surface owns its own dimension selector at the top of the active-surface area (`▼ Significant Relationships  ·  Career †  ·  Education †  ·  Themes †`) — these dimensions are not promoted into the global nav. This keeps the global nav scoped to the three reading lenses, with dimension choice scoped to the context where it matters.

Mobile collapses the top tabs into a bottom nav (three icons + capture FAB centred), and the utility rail becomes accessible from the LC logo / hamburger.

## 12. References

- `documentation/feature_capture_assistant.md` — the always-on writing surface
- `documentation/feature_residential_globe_onboarding.md` — Globe's onboarding flow
- `documentation/feature_reminiscence_mode.md` — the Stroll, a mode of engagement with memories
- `memory/project_lc_ontology_bootstrap.md` — the three-strand data model that the three surfaces visualise
- `documentation/schema_v1.sql` — `memories`, `entities`, `syntheses`, `dimensions` tables
- `documentation/Life_Chronicle_PRD_v1.docx` — to be revised in v1.1 to reference this spec instead of carrying the old stage-and-artifact framing
