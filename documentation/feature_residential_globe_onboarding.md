# Feature Spec: Phase 0 Stage 1 — Residential Globe Onboarding

**Status:** Draft v1.1 — 2026-05-17. Replaces the text-interview approach for Phase 0 Stage 1 in `LC_Development_Sequence.md` Step 7. Collapses Steps 7 and 10 into a single build sequence. v1.1 incorporates Andy's review notes (2026-05-17): adds a Timeline UI surface, removes explicit stage-completion gates, introduces the vacation-home pin type, distinguishes intra-metro relocation from returning residences, and adds ghost-text guidance in the modal.

**Author note:** This spec captures Andy's design decision (2026-05-10) to make the Life Globe the input surface for the residential spine, not a downstream synthesis of completed text interviews. The artifact and the act of building it are the same thing.

---

## 1. Concept

The user's first meaningful interaction with Life Chronicle is an empty Mapbox globe. The system asks: *"Where were you born?"* The user pans, zooms, and clicks. A pin appears; the globe begins to fill. Each subsequent click adds the next place the user lived. By the time the user is done placing pins, the residential temporal spine is built, the globe is populated, and Phase 0 Stage 1 is complete.

**The artifact is the entry surface.** No separate "complete the interview, see the globe" step. Every click is positive reinforcement.

## 2. Rationale — why globe-first replaces text-first

The text-interview approach surfaced a real cognitive cost during alpha testing (Andy, 2026-05-10): recalling the names and approximate dates of places lived 50+ years ago is hard precisely because the textual handle (the address, the city name) is what's been lost. The spatial handle — "somewhere southeast of Madrid, near the coast" — is often still intact. Looking at the satellite imagery of the old neighbourhood is itself a memory prompt: you may not remember the street name, but you'll recognise the shape of the blocks.

| Cost | Text interview | Globe-first |
|---|---|---|
| Recall load | Recall and verbalise the place name | Point to where it was |
| Reward delay | Complete the interview, then see the globe | Globe fills as you go |
| Imprecision | Must verbalise uncertainty ("somewhere in Spain, can't remember the town") | Click at country zoom — precision = zoom level |
| Sequence | Must state "after that, we moved to…" | Implicit in click order |
| Memory prompting | None during entry | Spatial context triggers recall |

This pattern aligns with the Temporal Agent invariant in `project_lc_temporal_agent.md`: *never ask for years directly; ask for orderings.* Globe-first asks for orderings implicitly via the sequence of clicks.

## 3. The four surfaces

### 3.1 The Globe (primary)

Mapbox GL JS, 2D/2.5D view (Cesium 3D deferred). Pannable, zoomable, accepts clicks at any zoom level. Reverse-geocodes each click via Mapbox Geocoding API to populate the geographic entity hierarchy (continent → country → region → city → neighbourhood).

### 3.2 The Modal (per-pin detail capture)

Opens automatically when a pin is placed. Contains:
- **Single free-form text field** (large textarea): user describes the place in their own words — house type, neighbourhood, household, anything memorable. Wispr Flow types into it directly; users without Wispr Flow type or (future) use push-to-talk STT.
- **Date or date range** (optional): "approximately 1962–1968," "early 70s," "I don't know." Accepts any text the user provides; Claude later parses it into structured form.
- **Residence type marker** (radio): Main residence / Lived briefly here. Default = Main; user selects "Lived briefly" for sojourns within a longer residency period.
- **Save / Save and continue / Cancel.**

The verbatim text is preserved exactly as the user wrote/dictated it (Raw Vault sanctity applies — `memories.content_raw` is never modified). Claude extracts structured fields from the same text and stores them separately (see §6).

### 3.3 The Sidekick Chat (parallel narrative capture)

A side panel beside the globe. Always present, with context awareness of the currently-active pin. Behaviour:
- Opens with a warm prompt: *"Welcome. Let's build the map of where you've lived. Start by placing a pin where you were born — and tell me anything you want about that place as you go."*
- After each pin: the agent acknowledges and invites further detail. *"Marbella. Tell me about that house, or just point to the next place you moved."*
- User can dictate (Wispr Flow) or type freely. Captures become `memories` rows anchored to the active pin (the most recently placed or selected).
- Detects when the user shifts attention to a different pin and rebinds the conversational context.
- The agent does not block progress. The user can place 12 pins with no chat input and that's fine. Conversely, the user can talk extensively about one pin before moving on.

This is the **conversational sidekick** model from option 2 of our discussion. It folds the free-form interview into the scaffold-building rather than treating them as separate stages.

### 3.4 The Timeline (companion read/export view)

A parallel view to the globe that presents the same underlying data as a chronological list of memory cards. The globe answers "where"; the timeline answers "when" — and serves as the primary surface for retrieval and export.

**Composition:**
- Each card represents one memory (or one residence, with its associated memories nested)
- Cards are ordered chronologically using the temporal envelope's `time_estimate` (with visible indication of uncertainty when precision is below year)
- Each card shows: the verbatim memory text, the linked place(s), entities mentioned, life stage, dimensions, and a metadata strip
- Metadata strip is collapsible — minimised by default, expandable per card

**Selection and assembly:**
- The user can multi-select cards (checkbox or shift-click)
- Selected cards form an ordered set
- "Export to PDF" action produces a chronological PDF of the selected cards' contents — useful for sharing a specific period or theme with family, or for personal review

**Search:**
- The timeline is the primary surface for retrieval (search by entity, dimension, date range, free-text)
- Results render as cards in chronological order
- Search uses pgvector similarity + RLS filter (in that order; the privacy invariant)

**Globe ↔ Timeline cross-links:**
- Click a pin on the globe → filter the timeline to memories anchored to that place
- Click a card in the timeline → highlight the corresponding pin on the globe
- The two views are different lenses on the same data

**Future media support:**
At MVP the cards are text-only. Future versions attach photos, audio, video — the card layout reserves space for media thumbnails. Schema already supports this via `media` and `memory_media` linking.

**Why the Timeline matters at MVP:**
- Provides a non-spatial retrieval surface (some memories are temporal without strong spatial anchoring)
- Supports the "I want to send my sister a PDF of our childhood memories" use case
- Gives the user a sense of accumulated content that the globe alone doesn't convey (you can see your chronicle as a *body of work*, not just a map)

## 4. Place types — two tiers

| Type | When | Schema | Visual |
|---|---|---|---|
| **Main residence** | The user's primary domicile during a period of life (≥ several months as a primary address) | `relationships.relationship_type = 'lived_at'` | Solid pin, larger, primary colour; arcs between sequential main residences are solid lines |
| **Lived briefly here** | A meaningful stay of ≥1 month that is *not* the primary domicile of that period (e.g., summer jobs during college, study-abroad terms, extended secondments) | `relationships.relationship_type = 'lived_briefly_at'` (new value) | Smaller pin, secondary colour (lighter shade); arcs from main path to side trip are dashed or in an accent colour |

**Rationale for the 1-month threshold:** A week-long vacation isn't a "lived place." A three-month study-abroad term is. The threshold is approximate; the user has discretion. Trips below this threshold are deferred to a future "Trips" feature.

**Example — Andy's college years:** Main residence: Hanover, NH (4 years, lived_at). Within that period: three summers in three different cities (each lived_briefly_at) + one term in a language-study country (lived_briefly_at). Five side-trip pins associated with the same four-year main-residence period.

**Visual handling of distant side trips:** A summer in Japan during the college years routes an arc across the Pacific. This may visually dominate the globe. Mitigations: dashed arc; option to hide side trips and show only main residences; pin clusters at the same place auto-collapse with an expand control.

## 5. Interaction model

### 5.1 Initial state
- Empty globe centred at a reasonable starting view (default: world view, slight tilt)
- Sidekick panel open with the opening prompt
- "Done with Stage 1" button disabled until at least one pin is placed

### 5.2 Placing the first pin (birthplace)
- User pans/zooms and clicks
- Pin appears with a placement animation
- Reverse geocoding fires; entity hierarchy populated (country → city → neighbourhood)
- Modal opens with the geocoded name as the default title
- User adds free-form description and optional date; clicks Save
- Behind the scenes:
  - `entities` row created (`type='place'`, `place_subtype` inferred from zoom level, `geom` set, parent chain populated)
  - `relationships` row created (`subject_user_id`, `object_id = place entity`, `relationship_type='lived_at'`, dates if provided, `sort_order = 1`)
  - `memories` row created from the free-form text (`content_raw` verbatim, `capture_mode='globe_onboarding'`, `source='text_entry'`)
  - `memory_entities` link: memory → place entity, `role='location'`, `is_primary=true`
  - Claude extraction job emitted (Inngest event) → produces structured tags
  - `generate_residency_constraints()` fires (no prior residence yet, so only a lower-bound constraint emerges)

### 5.3 Placing subsequent pins
- Sidekick prompts: *"Where did you move to next?"*
- User clicks the next location
- Pin appears; arc renders between previous and current main residence (solid line)
- Modal opens; same flow as 5.2
- `sort_order` increments
- `generate_residency_constraints()` fires and produces bilateral constraints (upper bound on previous, lower bound on current)

### 5.4 Refining a pin
- Click an existing pin → pin enters edit mode (visual: highlighted)
- Drag to refine location. As pin moves, reverse geocoding updates the entity name. User confirms by releasing or undoes with Esc.
- Pin precision is derived from zoom level at the time of placement / refinement:
  - Click/refine at country zoom → `place_subtype='country'` (pin pulses to indicate low precision)
  - Click/refine at city zoom → `place_subtype='city'`
  - Click/refine at street zoom → `place_subtype='address'`
- A pin can be promoted in precision later by zooming in and dragging to the specific address.

### 5.5 Inserting a pin between two existing pins (sequence correction)

**Primary use case:** correcting the order of main-residence pins in early use. When the user has placed several pins and realises the sequence is wrong (or that a forgotten residence belongs between two existing ones), the arc-drag affordance is how they fix it without deleting and re-placing.

- User clicks the arc between two sequential main-residence pins
- Cursor changes to "insert" affordance
- User drags along the arc and releases at the desired location
- Pin is created; `sort_order` of all subsequent pins shifts; modal opens
- Used when the user remembers "wait, I forgot — we lived in Lisbon for two years between Madrid and London"

**Sequence correction without insertion:** If the user just needs to swap the order of two existing pins (e.g., placed Madrid before London when London actually came first), they drag a pin to a different slot in the timeline view (the Timeline UI in §3.4 supports drag-reorder of cards) and the globe's `sort_order` updates to match. The globe's arc rendering automatically follows the updated sequence.

### 5.6 Adding a side-trip pin within a main-residence period

**MVP scope:** support `lived_briefly_at` (≥1 month sojourns) and a new **vacation home** pin type. Defer the richer travel taxonomy (vacations, work trips, study abroad, etc.) to a post-MVP iteration.

**MVP flow:**
- While a main-residence pin is selected, the sidekick or a UI control offers: *"Add a place you lived briefly during this period, or a vacation home you owned."*
- User selects type: `lived_briefly_at` or `vacation_home_owned`
- User clicks the location (anywhere on the globe — can be far from the main residence)
- Modal opens; same field set as main residence
- New pin renders in the appropriate visual style; arc from the main residence to this side trip uses the type's distinct styling
- The temporal bounds of a `lived_briefly_at` sit within the main residence's temporal bounds; the temporal bounds of a `vacation_home_owned` may span multiple main-residence periods

**The vacation home pin type (new for MVP):**

This addresses the simultaneous-residence case at the level of fidelity the MVP target user actually has — a vacation home or second home owned and visited regularly, but not the primary domicile.

| Attribute | Value |
|---|---|
| Relationship type | `owned_residence_at` (new value alongside `lived_at` and `lived_briefly_at`) |
| Visual | A pin styled similarly to main residence (indicating ownership and significance) but visually distinguished — e.g., main residence is solid filled circle; vacation home is solid filled circle with a distinct outline/badge |
| Arc | Solid arc from the contemporaneous main residence(s), but in a secondary colour |
| Temporal bounds | May span multiple main-residence periods (e.g., a family lake house owned for 30 years across three different primary domiciles) |
| Frequency hint | Optional field in modal: "How often did you visit?" — annual / seasonal / weekly / sporadic — surfaces visually as line weight or annotation |

**Explicitly out of scope at MVP:** high-net-worth multi-home cases (four primary residences around the world). Those would need a richer concurrent-residence model and are deferred indefinitely.

**Post-MVP — the full side-trip taxonomy:**

The post-MVP iteration expands the "side trip" notion into a typed system. The use case (per Andy 2026-05-17): users want to record significant travel — vacations, study abroad, work trips, holiday traditions — as part of the chronicle, with each type visually distinguishable on the globe so the user can read the texture of their travel life.

Proposed types (deferred to post-MVP):

| Type | Typical duration | Visual treatment |
|---|---|---|
| `lived_briefly_at` (already MVP) | ≥1 month | Smaller pin, dashed arc, secondary colour |
| `owned_residence_at` (already MVP) | Long-term ownership | Solid pin with ownership badge, secondary colour arc |
| `vacation_travel` | 1–4 weeks | Small pin, dotted arc, distinct accent colour |
| `work_trip` | Days to weeks | Smallest pin, thin dotted arc, professional palette |
| `holiday_visit` | Days | Tiny seasonal-icon pin, festive accent |
| `study_abroad` | 2 weeks – months | Medium pin, dashed-double arc, education palette |
| `pilgrimage` / `expedition` | Variable | User-selected; reserved for meaningful one-offs |

The post-MVP build adds:
- A type-selector in the "Add side trip" modal
- Globe filter controls in MVP (§14 OQ-G4) — toggle visibility per type
- A "travel rhythm" view in the Timeline UI that aggregates travel patterns over time
- Linkage to the future Places Worked timeline (see §5.8) for work_trip type

### 5.7 Editing or removing a pin
- Click pin → edit mode; Edit / Delete / Promote-to-main / Demote-to-side-trip controls in the modal
- Delete cascades to the relationships row but **does not** delete the place entity if other relationships reference it
- Deleted memories anchored to the pin are flagged but not deleted (Raw Vault sanctity)

### 5.8 Returning residences vs. intra-metro relocations

Two distinct cases that the UI must handle separately, because they have different semantics.

**Case A — Returning residences (same place, different times):**
- User clicks the same location they pinned earlier (e.g., childhood home in retirement)
- System detects the click is within close proximity (e.g., <100m) of an existing place entity and offers: *"You already pinned this place. Lived here again?"*
- If yes: a new `relationships` row is created against the same `entities` row with different dates; pin renders as a single point with a "lived here twice" indicator
- If no: user can override and create a new place entity

**Case B — Intra-metro relocations (different addresses, same metropolitan area):**

A user who lived in five apartments across New York City over twenty years has five distinct residences — not one returning residence. This is a common pattern that needs first-class support.

- User clicks a new location within a metro area where they've previously placed pins
- System detects proximity at the *metro* level (e.g., same `city` entity in the parent chain) but not at building level
- Modal opens with a hint: *"Looks like another place in New York. Was this your next address there?"* — the modal recognises this is a *new* residence in the same city
- A new `entities` row is created (separate place entity for the specific address) with `parent_id` linking to the existing city entity
- A new `relationships` row is created with `relationship_type='lived_at'` and dates appropriate to the intra-city move
- The globe shows multiple pins clustered at the city; on zoom-in they separate
- The Timeline UI shows them as sequential, distinct residences

**The Places Worked timeline (forward concept, post-MVP):**

A common pattern: residence moves correlate with employment changes. Some users will have a residence change driven by a new job in a new city; others will change jobs while remaining in the same residence (remote work, in-city employer change). Both patterns need first-class representation.

For MVP, the residential timeline is the focus. The Places Worked timeline is a forward concept that will:
- Treat employers as entities (`type='organization'`, already in schema)
- Treat the user's relationship to an employer as a `relationships` row (`relationship_type='worked_at'` or similar) with start/end dates and a `work_location_entity_id` linking to where the work happened
- Render as a parallel track alongside the residential timeline in the Timeline UI
- Allow correlation: zoom into a period and see both residence and employer simultaneously
- Allow filtering: "show me all my moves that were driven by a job change"

This is captured here so the residential globe spec doesn't preclude it. The schema already supports the underlying entities and relationships; the UI is what comes later.

### 5.9 No explicit completion — organic progression

**There is no "I'm done with Stage 1" button.** Per Andy's review (2026-05-17), explicit stage completion gates were removed from this design. The user should never be asked to declare the residential spine "complete" — a life chronicle is genuinely open-ended, and memories of forgotten places surface over months and years, not in one session.

**How progression actually works:**

1. **No user-declared completion.** The user places pins as memory surfaces. Returning weeks later to add a forgotten residence is normal expected behaviour, not a "Phase 0 reopening."

2. **System-detected thresholds.** The system internally tracks data thresholds and ships artifacts when criteria are met — invisibly to the user. Example thresholds (tunable):
   - ≥3 main-residence pins with at least one having a date or rough date range → Life Globe artifact published (the globe itself; no separate render needed since it's the same surface)
   - ≥3 person entities with non-trivial context → first Entity Portrait synthesis generated
   - ≥5 person entities across multiple life stages + ≥3 residential pins → first Life's Players synthesis generated
   - Each threshold emits `chronicle/threshold.reached` (replaces the old `phase0/stage.completed` event)

3. **The sidekick chat handles "what's next" organically.** As the chronicle fills out, the sidekick naturally pivots prompts: *"You've got a great spine of places forming. Want to start telling me about the people who matter most across these years?"* No screen change, no modal, no "stage gate." Just a conversational invitation when the moment is right.

4. **Phase 0 becomes an internal concept, not a user-facing one.** Users do not see "Stage 1 of 3" anywhere. The system uses Phase 0 internally to organise the *kinds* of bootstrap activities (residential, entity, topic) but never exposes the staged structure.

**Architectural implications (downstream changes needed):**

- The `phase0/stage.completed` event is renamed `chronicle/threshold.reached` with payload `{threshold_type, threshold_id, user_id}`. Existing stub agents listening on `phase0/stage.completed` need to be updated.
- `LC_Development_Sequence.md` Steps 7–9 (Phase 0 Stage 1/2/3 UI) collapse from three sequential UI builds into three *parallel strands* that the user can engage with in any order — residential strand, entity strand, topic strand. The sidekick chat orchestrates which strand to prompt next based on chronicle state, not on staged ordering.
- `memory/project_lc_ontology_bootstrap.md` (which currently describes three sequential stages) needs to be reframed: the dependency theory is unchanged (residential scaffold structurally precedes entity seeding precedes topic mapping), but the *user experience* of bootstrap is non-sequential and non-explicit. The system enforces the dependencies internally.

**Why this is the right call:**

The user's instinct here is sound. A staged onboarding wizard imposes artificial closure on something that should feel open. Real chronicling is iterative — places remembered years later, relationships re-evaluated, themes recognised in retrospect. A UI that says "you're done with Stage 1, moving to Stage 2" subtly tells the user "we don't expect more from this strand," which is exactly the wrong message.

Instead: the globe and the timeline are always there. The sidekick is always there. Memories enter via any modality at any time. The system handles the bookkeeping of when enough material exists to ship a synthesis. The user just chronicles.

## 6. Modal text capture, ghost-text guidance, and AI extraction

The free-form text in the modal is the verbatim memory. Claude is invoked separately to extract structured fields from that text. Both are stored. The modal and the sidekick chat work together to elicit the kinds of detail that produce good extractions, without the user feeling interrogated.

### 6.1 Ghost-text guidance in the modal

The free-form text field shows placeholder ghost text suggesting the kinds of detail that would help — drawn directly from what the extraction prompt looks for. The ghost text rotates between several phrasings on each modal open so it doesn't become invisible from repetition.

Sample ghost-text variants (rotated):
- *"What kind of place was it? Who lived there? Why did you move here? Any people or places worth mentioning?"*
- *"Tell me what you remember — the house, the neighbourhood, the family, what brought you here."*
- *"A house, an apartment, a base? Who else lived there? What kind of life did you have here?"*
- *"Just write what comes to mind — I'll figure out the structure."*

The ghost text disappears the moment the user starts typing (or Wispr Flow starts dictating).

### 6.2 Sidekick suggestive prompting at pin placement

When a pin is placed and the modal opens, the sidekick chat simultaneously offers a conversational version of the same prompt. This is **not** redundant — the two surfaces serve different cognitive modes:

- The **modal** captures one consolidated memory entry per pin
- The **sidekick** offers an open-ended conversation about the place that can sprawl across multiple memories and tangents

The sidekick's prompt at pin placement might be:
> *"Marbella. Tell me whatever you'd like about that house, that neighbourhood, the people, what brought you there. Or just point to where you moved next when you're ready."*

The user can:
- Fill the modal and ignore the sidekick
- Fill the modal then expand in the sidekick
- Skip the modal entirely (Save with no detail) and pour everything into the sidekick
- Skip both and just place the next pin

All paths are valid. The system absorbs whatever the user provides through whatever surface.

### 6.3 Extraction prompt

**Extraction prompt (sketch):**
> The user described a place where they lived. Extract any of the following you can confidently identify:
> - residence_type: apartment | house | dormitory | military_base | rental | family_home | other (with sub-description)
> - household_composition: who lived there with them
> - move_reason: career_relocation | military_posting | marriage | divorce_separation | education | family_care | financial | retirement | health | displacement | adventure | unknown
> - mentioned_people: any people named (returns as stubs for the Entity Agent to resolve)
> - mentioned_organisations: any orgs named (schools, employers)
> - rough_temporal_range: any time clues in the text ("right after college," "the year my father died")
> Return strict JSON; missing fields are null.

The output populates:
- `relationships.residence_type` (column to be added to schema if not present; check schema_v1.sql)
- `relationships.move_reason` (already in schema per `project_lc_temporal_agent.md`)
- `entities` stubs for any mentioned people/orgs → Entity Agent picks these up later for resolution
- `temporal_constraints` rows if the text contains relative ordering ("before we left Spain")

The original verbatim text is preserved in `memories.content_raw`. The extraction output goes into the structured columns and into `assumption_log` with `assumption_type='globe_modal_extraction'`. The user can override any extracted field; overrides are recorded as confirmations or corrections.

## 7. Sidekick chat behaviour

### 7.1 Context model
The sidekick chat maintains awareness of:
- The **active pin** (the most recently placed, or the most recently selected)
- The **session phase** (initial / placing pins / refining / about to complete)
- The **count of pins placed** (used to phrase prompts naturally)

### 7.2 Prompting strategy
- **Pre-first-pin:** *"Where were you born? Click anywhere on the globe — country level is fine if you don't remember the town."*
- **After first pin, awaiting next:** *"Marbella. Tell me anything you want about that place, or point to where you moved next."*
- **Repeated transitions:** rotates phrasings to avoid feeling scripted (*"And after that?"*, *"Next move?"*, *"Then where?"*)
- **Long silences:** offers prompts (*"Take your time. There's no rush. If you're ready, just point to the next place."*)
- **Stuck moments:** if the user seems unsure, offers an out (*"It's fine to skip ahead. We can come back to this part later."*)

### 7.3 Memory anchoring
Every utterance from the user becomes a `memories` row with:
- `content_raw`: verbatim text or transcribed audio
- `source`: 'text_entry' (Wispr Flow) or 'voice_interview' (push-to-talk STT, when added)
- `capture_mode`: 'globe_onboarding'
- `source_session_id`: the active interview session
- `memory_entities` linking to the active pin's place entity (role='location', is_primary=true)

### 7.4 No interruptions for confirmation
The sidekick does not block the user with confirmation modals. If Claude extracts something the user might not have meant, it surfaces as a soft suggestion ("I noted that your father is mentioned here — should I create a placeholder for him?") rather than a required confirmation. Aggressive prompts erode the flow state.

## 8. Mobile UX

The mobile experience is **scaffold-only**. The user can place pins at coarse resolution (country/city) and write/dictate short descriptions. The refined work — drag-to-precise-address, long-form descriptions, side-trip placement — is expected on desktop later.

- **Pin placement:** long-press (300ms) to drop a pin at the long-press location
- **Reduced precision:** zoom levels are clamped to country/city max — finer placement is greyed-out with a hint to "refine on desktop"
- **Sidekick chat:** opens as a full-screen modal when activated; closes back to the globe; not always visible
- **Modal layout:** single-column, scrollable, larger touch targets
- **Side trips:** can be added on mobile but not refined visually; defer the visual styling tweaks to desktop

The session syncs to the user's account immediately. A user who starts on mobile during a commute can finish refining on desktop later.

## 9. Schema implications

The schema is largely sufficient. Specific notes:

- `entities.place_subtype`: already supports `country | region | city | neighborhood | address | landmark | natural_feature | transit_hub | military_base | vessel`. Good.
- `entities.geom`: PostGIS GEOGRAPHY column already present. Good.
- `entities.parent_id`: self-referencing for geographic hierarchy. Good. Reverse geocoding populates this from city up to country.
- `relationships.relationship_type`: needs the new value `lived_briefly_at` added alongside `lived_at`. (Add via migration.)
- `relationships.residence_type` and `relationships.move_reason`: check if columns exist; add if needed.
- `memories.capture_mode`: needs the new value `globe_onboarding` accepted (the column already exists from the Stroll work).
- `memory_entities`: existing table covers the place anchor with `role='location'`.
- `generate_residency_constraints()`: already in the schema. Fires automatically on `lived_at` insert. May need to extend to also fire on `lived_briefly_at`.
- `assumption_log`: existing table receives one row per Claude extraction; `assumption_type='globe_modal_extraction'`.

**One open schema question:** how do we represent simultaneous main residences (a bicoastal user with two homes)? Two `lived_at` rows with overlapping dates. Both pins render at full visual weight; arcs to both are solid. The user-facing concept is fine; the constraint propagator needs to handle overlap without flagging contradictions in this specific case (residence_type='primary_simultaneous' or similar marker).

## 10. Edge cases

### 10.1 Unknown dates
Acceptable. Sequence (sort_order) is sufficient. The Temporal Agent will resolve dates later via the constraint graph and Phase 1 questioning.

### 10.2 Conflicting dates
Two main residences with overlapping date ranges (and not marked simultaneous): surface as a `contradiction_flag` synthesis. Prompt: *"You said you lived in Madrid 1985–1990 and in London 1988–1992. Was one of these a 'lived briefly' rather than a primary residence?"*

### 10.3 Sequence vs. dates
If dates are provided and they conflict with click order (user pinned A then B, but dated B earlier than A), the system trusts dates over click order and offers to reorder pins.

### 10.4 Birthplace ≠ first home
*"I was born in this hospital city, but my parents lived in a different town."* Solution: pin the birth city with no `lived_at` relationship (just a `born_at` relationship — separate type) **OR** the user pins the actual first home and the birth event is captured as a separate memory anchored to a different place. UX choice; recommend the latter for simplicity (birth event is a memory, not a residence).

### 10.5 Returning residences
See §5.8.

### 10.6 Same-city multiple addresses
Five apartments within New York City over twenty years. Each is its own pin with a more precise address. The globe auto-clusters them at zoomed-out views with a "5 places in NYC" expansion control; on zoom-in, individual pins appear.

### 10.7 No surviving address information
*"I know we lived somewhere in Naples for a year, but I can't remember anything specific."* User clicks Naples at city zoom; `place_subtype='city'`; no street-level precision; that's a valid stub. The Temporal Agent and the sidekick can revisit this in Phase 1.

## 11. Acceptance criteria

The residential globe onboarding feature is functionally complete when:

**Globe surface:**
- [ ] User can place pins on a Mapbox globe at any zoom level
- [ ] Each pin generates an `entities` row with `geom`, `place_subtype` from zoom, reverse-geocoded `name` and parent chain
- [ ] Each main residence generates a `relationships` row with `relationship_type='lived_at'` and `sort_order`
- [ ] Each lived-briefly residence generates a row with `relationship_type='lived_briefly_at'` linked to the active main residence's date range
- [ ] Each vacation home generates a row with `relationship_type='owned_residence_at'`, distinct pin styling, and optional frequency-of-visitation field
- [ ] User can drag pins to refine location; precision updates based on zoom
- [ ] User can drag the arc between two pins to insert an intermediate pin (sequence correction)
- [ ] Side trips and vacation homes render in distinct visual styles (size, fill, arc styling)
- [ ] User can toggle/filter the display of side trips on the globe (per OQ-G4)
- [ ] Pin clusters at zoomed-out views auto-collapse with expand-on-zoom behaviour (per OQ-G1)
- [ ] Returning residence (same place, different times) creates two relationships against one entity, rendered as one pin with a multi-occupancy indicator
- [ ] Intra-metro relocation creates a new place entity (different address, same city parent) — does not collapse into a returning residence
- [ ] Globe persists across sessions; reopening shows all pins placed
- [ ] Mobile users can place pins at country/city resolution; finer resolution is greyed-out

**Modal:**
- [ ] Modal opens automatically when a pin is placed
- [ ] Free-form text field shows rotating ghost-text guidance suggesting the kinds of detail to provide
- [ ] Modal captures verbatim memory; Claude extraction stores structured fields separately
- [ ] User can save with no detail (just the pin) or save with rich detail

**Sidekick:**
- [ ] Sidekick chat is always present alongside the globe
- [ ] Sidekick provides suggestive prompting at pin placement, complementary to the modal ghost text
- [ ] Sidekick captures user utterances as memories anchored to the active pin (`memory_entities` with `role='location'`, `is_primary=true`)
- [ ] Sidekick rebinds context when the user shifts attention to a different pin
- [ ] Sidekick handles "what's next" transitions organically — no explicit stage gates

**Timeline:**
- [ ] Timeline UI accessible from the dashboard or as a tab/view alongside the globe
- [ ] Timeline renders memories as chronologically-ordered cards
- [ ] Each card shows verbatim memory, linked place(s), entities, life stage, dimensions, expandable metadata strip
- [ ] User can multi-select cards and export the selection to PDF in chronological order
- [ ] Search interface produces card-list results in chronological order
- [ ] Click a pin on globe → filters timeline; click a card in timeline → highlights pin

**Schema and events:**
- [ ] `generate_residency_constraints()` fires on each `lived_at`, `lived_briefly_at`, and `owned_residence_at` insert
- [ ] Reverse geocoding fills the entity parent chain (country → region → city → neighbourhood)
- [ ] `chronicle/threshold.reached` event fires when data thresholds are met (no user-triggered completion gate)
- [ ] Conflicting dates surface as `contradiction_flag` syntheses with resolution prompts

## 12. What this collapses in the build sequence

`LC_Development_Sequence.md` Steps 7 and 10 merge into a single feature build, broken into substeps:

| Substep | What |
|---|---|
| 7a | Mapbox base + pin placement + reverse geocoding + entity creation |
| 7b | Modal with rotating ghost-text guidance + free-form text capture + Claude extraction job + Inngest wiring |
| 7c | Sidekick chat integration + context-aware suggestive prompting + memory anchoring |
| 7d | Side trips (`lived_briefly_at`) and vacation homes (`owned_residence_at`) + distinct visual styling per type |
| 7e | Drag-to-refine + drag-arc-to-insert (sequence correction) |
| 7f | Pin clustering / zoom-expand for dense pin areas; side-trip visibility filter |
| 7g | Intra-metro relocation handling (proximity detection at city level vs. building level; new-entity vs. returning-residence prompt) |
| 7h | Timeline UI — chronological card list, search, multi-select, PDF export |
| 7i | Mobile adaptation (coarse pin placement, deferred refinement) |
| 7j | Data-threshold detection emits `chronicle/threshold.reached` events; Synthesis Agent generates initial `place_portrait` entries when thresholds met |

Original Step 10 (Life Globe synthesis + rendering) is absorbed; there is no separate "render the globe" step because the globe **is** the input surface. The synthesis layer (place_portrait per pinned place) emerges from accumulated memories over time, not from a one-shot post-Phase-0 build.

## 13. Out of scope for this spec

- **The full side-trip taxonomy** (vacation_travel, work_trip, holiday_visit, study_abroad, etc. — see §5.6 post-MVP table). MVP supports `lived_briefly_at` and `owned_residence_at` only; the richer typed travel system is a post-MVP feature build.
- **Places Worked timeline.** See §5.8. Treats employers as entities and renders alongside the residential timeline. Forward concept; schema already supports the underlying entities and relationships.
- **High-net-worth multi-home cases** (four simultaneous primary residences around the world). Deferred indefinitely; the MVP vacation-home pattern covers most realistic cases.
- **Bootstrap entity strand (people seeding) and topic strand (dimension confirmation).** These were the old Phase 0 Stages 2 and 3 — they don't go away, but they're now parallel strands the sidekick can prompt the user toward, not sequential UI builds. Each strand will get its own design pass (likely separate feature specs).
- **Temporal Agent's constraint-resolution Q&A.** Phase 2 work; uses the constraint graph this feature seeds.
- **Cesium 3D globe.** Deferred; Mapbox 2D/2.5D is sufficient for MVP. Toggle to 3D in post-MVP iterations (per OQ-G2).
- **Voice push-to-talk in the sidekick.** Wispr Flow handles this on Andy's machine; explicit push-to-talk STT for non-Wispr-Flow users is a later add (alongside Whisper API integration).
- **Full place_portrait synthesis.** Deepens over time as memories accumulate; initial version when threshold is reached is a stub.
- **Media attachments on timeline cards.** Text-only at MVP. Schema already supports media linkage; the timeline card layout reserves space.

## 14. Open questions

### 14.1 Resolved (Andy review 2026-05-17)

| OQ | Resolution |
|---|---|
| OQ-G1 (pin clustering) | ✅ Auto-cluster at zoomed-out views; zoom-in expands clusters to separate pins for selection. MVP. |
| OQ-G2 (3D/2D toggle) | ✅ Mapbox 2D/2.5D for MVP. Toggle between 3D and 2D views deferred to post-MVP. |
| OQ-G3 (simultaneous primary residences) | ✅ Vacation home (`owned_residence_at`) handles the realistic MVP case (see §5.6). High-net-worth multi-home is deferred indefinitely. |
| OQ-G4 (side trips visual filter) | ✅ User can toggle/filter side trips on the globe view in MVP. |
| OQ-G5 (Stage 1 completion) | ✅ Explicit stage completion eliminated entirely (see §5.9). Bootstrap progression is organic; system detects data thresholds and ships artifacts without user-declared closure. |
| OQ-G6 (geocoding costs) | ✅ Mapbox free tier (~50k requests/month) sufficient for alpha and MVP. Revisit at scale. |
| OQ-G7 (birthplace vs. first home) | ✅ First pin is the first home the user lived in (the residence the parents brought them home to). Birth as a hospital/city event is a separate memory primitive, not a residence pin. |

### 14.2 New open questions raised by v1.1 review

| OQ | Question | Initial recommendation |
|---|---|---|
| OQ-G8 | Vacation home pin distinctiveness — what visual? | Main residence: solid filled circle. Vacation home: solid filled circle with a distinct outline (e.g., a thin ring) and a small badge icon (suggesting "owned"). Final visual treatment decided in 7d. |
| OQ-G9 | Frequency-of-visitation for vacation home — required field or optional? | Optional. Surfaced as a visual hint (line weight on the arc from the contemporaneous main residence) when provided; absent indication otherwise. |
| OQ-G10 | Timeline UI access pattern — separate page, side panel, or tab toggle? | Recommend a top-level tab toggle alongside the globe ("Globe" / "Timeline"). Both views are first-class; the user moves between them freely. The sidekick chat persists across both. |
| OQ-G11 | Data thresholds for shipping artifacts — what are the numbers? | Initial proposed thresholds (tunable): Life Globe ≥3 main-residence pins; Entity Portrait ≥3 person entities; Life's Players ≥5 person entities across multiple life stages. Will be revisited after first internal use. |
| OQ-G12 | How does the sidekick chat decide which "strand" (residential, entity, topic) to prompt next? | Use chronicle state: if residential strand has only 1 pin, prompt for more places. Once ≥3 residential pins, start interleaving entity prompts ("Tell me about the people who mattered most when you were in Madrid"). Topic strand emerges last. The orchestrator (per `feature_capture_assistant.md`) handles this reasoning. |
| OQ-G13 | Intra-metro relocation — proximity threshold for offering "another place in [city]" vs. treating as a new isolated pin? | If new pin's lat/lng is within the bounding box of an existing pinned city's geocoded extents → offer "another place in [city]" prompt. Otherwise create new city entity. Edge cases (e.g., suburbs that aren't formally part of the city) will need adjustment after first use. |
| OQ-G14 | PDF export of timeline cards — visual design? | Simple, printable: each card on its own section with verbatim text in body, metadata in a small header strip, generated chronologically. Use a typography-forward template (Charter / Georgia / similar). Header includes user name, date range of selection, "Generated by Life Chronicle." MVP version is plain; richer template variants are a Phase 2 add. |
| OQ-G15 | Pin-to-pin "previous/next" navigation — what does the sequence include? | **MVP (shipped 2026-06-17):** ← / → on the detail card walk the **residential spine only** (primary residences in order) and fly the globe to each. **Deferred design discussion** (Andy, 2026-06-17): once the globe is more fully populated, fold *significant marker children* into the forward sequence — workplaces and second residences anchored to a residence, but **not** vacations or professional travel (likely too many for an overview walk). Open: ordering of children relative to their parent residence, whether they're a sub-level or inline, and whether the user can toggle their inclusion. Revisit after hands-on use of the spine-only version. |

## 15. Memory and reference updates required when this spec is accepted

- `memory/project_lc_ontology_bootstrap.md` — major reframe: Stage 1 description replaced with globe-onboarding model; the "three sequential stages" structure replaced with "three parallel strands" (residential, entity, topic) driven by the sidekick chat. The dependency theory (Tier 1 structural scaffold → Tier 2 entity seed → Tier 3 topic map) is unchanged conceptually but no longer manifests as sequential user-facing stages. Cite this spec as canonical for the residential strand.
- `memory/project_lc_temporal_agent.md` — note that the residential spine is built via click sequence; `generate_residency_constraints()` fires on each pin placement.
- `memory/project_lc_build_progress.md` — replace Phase 0 sequential stages with parallel-strands model; add globe-onboarding to "what's next."
- `memory/MEMORY.md` — add pointer to this spec under "Architecture & schema."
- `memory/project_lc_prd_readiness.md` Decision 3 — append amendment: "Phase 0 is non-sequential. The three strands (residential, entity, topic) run in parallel; the sidekick chat handles transitions organically; there is no user-facing stage completion. System detects data thresholds for artifact publication." (Per Andy 2026-05-17.)
- `documentation/LC_Development_Sequence.md` — replace Steps 7, 8, 9, 10 with two new entries: (a) Step 7 = the residential-strand build (this spec, substeps 7a–7j), and (b) Steps 8 and 9 become "entity-strand UX" and "topic-strand UX" respectively, deferred until their feature specs are written.
- `documentation/DB_Architecture_Design_v1.md` — add a brief Part XVII: globe is an input surface, not a downstream synthesis; bootstrap is non-sequential; data-threshold events trigger artifact publication.
- `CLAUDE.md` (project root) — update §Architectural Invariants item 4 to reflect that Phase 0 is non-sequential parallel strands, not three sequential stages. The three-stage description was correct as a *theoretical* structure but the *user experience* is non-sequential.
- Inngest events — rename `phase0/stage.completed` to `chronicle/threshold.reached` and update the stub synthesis agents listening on it.

## 16. Approval

This spec is in draft. Andy's review and refinement notes should be captured here. Once approved, the memory and reference updates in §15 are made and the build of substeps 7a–7g begins.
