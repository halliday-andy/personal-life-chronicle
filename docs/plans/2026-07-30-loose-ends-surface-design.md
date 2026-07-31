# The Loose-Ends surface — unit design

**Date:** 2026-07-30
**Status:** Agreed with Andy 2026-07-30 in a design session. **DESIGN ONLY — no
code, no migration applied.** Build is gated on QA master-sequence Phase 1
(five checklists still open, all Andy's).
**Roadmap position:** Unit 1 of
[`2026-07-17-spine-and-share-roadmap.md`](2026-07-17-spine-and-share-roadmap.md)
§3 — Track A's engine. Absorbs Step 8's unspecced orchestrated strand.
**Pattern:** Journey-doc shape
([`archive/2026-07-05-journey-view-design.md`](archive/2026-07-05-journey-view-design.md)).
**Owner:** Andy Halliday (product); design by Claude Code (Opus 5).

---

## 1. What it is

Not a dashboard, and not a page. The Loose-Ends surface is **two faces on one
idea**, sharing vocabulary and components:

- **The passive face** — *interstices* in the Journey spine. Always present,
  never ranked, encountered only by being in that part of your life.
- **The active face** — the capture assistant, which opens with a reflection
  and keeps the gathered ledger on its desk. **It never speaks unbidden.**

The vestigial `/dashboard` is retired. **No new top-level route is created.**

The framing constraint from the roadmap holds throughout: full elaboration of a
life is a years-long project by nature, so every surface showing remaining work
must be extensive yet undaunting. Completion pressure applies to the spine
skeleton only; everything else is invitation.

### 1.1 Why not a landing page

Andy, 2026-07-30: *"I don't think it's the landing, because I don't want this to
be the chore."* There are two modes of engagement with the chronicle — the
**capture** mode that drives toward a complete spine, and the **reminiscence**
mode (the Stroll) that is its own reward. The way into capture is a reflective
invitation that puts the user in a retrospective state of mind, not a ledger
presented on arrival.

## 2. Decisions (agreed 2026-07-30)

| # | Decision | Detail |
|---|---|---|
| 1 | **Host = assistant's back room + Journey seams** | The assistant is the front door and holds the gathered view; the Journey spine is the navigable face. No new route, no nav entry. |
| 2 | **In-context loose ends are existing behavior, not redesigned** | `components/globe/PinHopper.tsx` already shows a pin's open jots where they belong. Assumed as a floor. |
| 3 | **Presence and promotion are separate bars** | Seams are always present and unranked. Only the assistant's *spoken* invitation needs a significance model. This is what stops the surface reading as a backlog. |
| 4 | **The interstice exists by definition** | Between two adjacent stops there is *always* a space. Nothing is detected, no gap is computed, **no `when_text` is ever parsed** (invariant #5). |
| 5 | **Seam renders as a node on the ember rail** | Not a row in the column. Zero horizontal cost, no card-shaped beat; Journey stays a reading surface with a navigable margin. |
| 6 | **Seam tray = open field first, structure named beneath** | Write-first for the common case; the three structural intents explicitly labelled below it, so intent is never guessed. |
| 7 | **A passage is hosted by the arriving stop** | Flagged as being about the coming-here, rendered in the seam. Follows `move_reason`'s precedent (transition data on the arrival, rendered between). |
| 8 | **A one-way trip may terminate at a primary residence** | `destination` is the *terminus*, not a turnaround. Round trips keep the existing rule. **Gated migration — §7.** |
| 9 | **The assistant speaks only when opened** | FAB tap is the sole trigger. It opens with a reflection about a period already in the data. |
| 10 | **The assistant must be able to say nothing** | When nothing clears the bar: "nothing pressing — want to just wander?" An assistant that always has a suggestion is one you stop believing. Acceptance criterion, not tone. |
| 11 | **Significance is owner-asserted** | Marks in place + occasional proposals + dismissal demotes. Structure is a tiebreaker, **never** a promoter. The analogue of "ordering is the owner's assertion, never date-parsed." |
| 12 | **Significance and emotional register are separate axes** | A funeral and a wedding are both significant and opposite in register. Collapsed, the assistant would promote sad things *because* they are marked sad. |
| 13 | **Session-end triage ships, minimally** | The only piece of this unit that reduces backlog rather than displaying it. |
| 14 | **Nav pares to Globe + Journey** | A rehoming, not a deletion — this unit builds the home for what's demoted (§6). |
| 15 | **Search replaces `/memories` as a destination** | Memories was never a place; it was a query. Search sits at the top of Journey. **Lexical only — §6.2.** |

## 3. The seam (passive face)

### 3.1 Model

The interstice is **adjacency**, not absence. Stop *N* and stop *N+1* are
adjacent, therefore there is a space between them, therefore there is somewhere
to put "there was a summer in between." No analysis decides whether a seam
exists.

Analysis touches the passive face in exactly one way: a seam whose contents the
significance model has something to say about renders at **greater prominence**.
Emphasis only — never existence. Nothing is hidden because analysis didn't flag
it.

### 3.2 Rendering

A node on the ember rail between the two stops. Contents that already exist
(passages, trips) render as rail-marked blocks in the seam, with the `+` node
persisting at reduced weight because more can always go in.

**Empty state copy:** *"Nothing here yet — and it may be that nothing is
needed."* The seam must be able to say a gap is fine. Thirteen seams that each
imply an obligation is precisely the daunting ledger this unit exists to avoid.

**Accessibility:** the rail is `aria-hidden` today. Seam nodes become real
`<button>`s with real labels ("Add something between Ridgewood and Exeter") —
free-with-the-build semantics per `memory/feedback_lc_accessibility_deferral.md`.
Dedicated keyboard reorder remains deferred; this is not that.

### 3.3 The tray — four intents

| Intent | What it does | Machinery |
|---|---|---|
| **Open field** (first) | Saves a **passage** — a recollection about the transition | New flag + render slot; §3.4 |
| ✈ **A trip you took from here** | Pre-fills `origin_relationship_id` = preceding stop, hands to destination-first capture | `create_trip`; guard change §7 |
| ◉ **A place you lived** | Positional insert of a new spine stop | `globe_retype_insert_after_anchor` |
| ↕ **A home you've already added** | Places an unsequenced residence at this position | `unsequenced_residences` |

The unsequenced-homes intent matters disproportionately: **the seam is the only
place in the app where an unplaced home is offered at the position it would
occupy.**

### 3.4 The passage

A recollection hosted by the **arriving** stop, flagged as being about the
coming-here, rendered by Journey in the seam above that stop.

**Mechanism:** `memory_entities.role = 'passage'` against the arriving stop's
place entity. `role` is free `TEXT` with a comment-documented vocabulary
(`documentation/schema_v1.sql:459` — `subject | participant | witness | location
| object | antagonist`) and the table's primary key is
`(memory_id, entity_id, role)`, so this is **additive with no migration**.

Two obligations come with it, both non-optional:

1. **Extend the documented vocabulary in the same change.** It is a controlled
   vocabulary; rule 5 (one definition per controlled vocabulary) applies even
   though no `CHECK` enforces it. A vocabulary documented in one place and used
   in another drifts.
2. **Audit every `role = 'location'` filter.** That role is the standing
   pin-overview discriminator (mentions use `'mentioned'`). A passage carrying a
   third value will silently *not* appear anywhere that filter runs — which is
   correct for the pin overview (a passage is not a recollection *of* that
   place) but must be verified rather than assumed, including in counts and in
   `/memories`. The audit is an L1 deliverable, not a follow-up.

**Known limit, to be pinned in the proof script:** a passage about "the summer
between Exeter and Hanover" lives on Hanover. Insert a new stop between them
later and it renders after the newcomer, which may read wrong. The fix is a
placeless spine member (§8), deliberately deferred.

### 3.5 Why trips belong here

Andy, 2026-07-30: the transition between employments and domiciles is precisely
when relocation-adjacent travel happens — *"an open opportunity outside of work
obligations."* The interstice is a high-yield place for travel memories, not an
edge case. Hence the trip intent sits above the structural ones in the tray.

## 4. The assistant's back room (active face)

**Trigger:** FAB tap only. Never unbidden — no arrival banner, no ambient line,
no event-driven opening, and **no badge or count anywhere in the app.**

**Opening move:** a reflection about a period already represented in the data
("here's something you wrote about Hanover — want to sit with it?"). This
requires no significance model at all, which is what makes cold start work: with
nothing yet marked, the assistant still opens well; it simply doesn't propose
work. It earns the right to suggest as the user tells it what matters.

**The ledger** sits below the conversation in the same sheet: a handful of
invitations, never the full register. What exists (stops placed, span covered,
recollections written) is shown at least as prominently as what is missing.
Every item is one tap from its capture flow.

**Restraint rule (acceptance criterion):** when nothing clears the bar the
assistant says so and offers reminiscence instead.

**Modality:** typed. `input_type: 'voice'` is reserved in
`lib/agents/orchestrator/core.ts:41` "once push-to-talk lands" but is not built.
The trigger logic designed here is modality-agnostic; voice drops into it later.

### 4.1 The significance model

Three inputs, one output — *what earns the right to be spoken first*:

1. **Marks in place.** A quiet "this mattered" affordance wherever the user is
   already reading — a stop, a recollection, a person. An assertion made in the
   presence of the thing asserted about, not a blank-page interview about the
   most loaded question you could ask someone.
2. **Chronicle gravity.** Candidates from what the user's own prose keeps
   orbiting but never lands — a name recurring across stops with no recollection
   of its own. Proposed via the existing `ProposalCard` pattern, confirmed or
   declined. Never acted on silently (words-are-not-actions).
3. **Dismissal demotes.** Waving an invitation off permanently demotes that item
   and its class.

Structural shape (a stop with no recollections, a long span) orders the ledger
the user asked for. **It never promotes anything on its own.**

**Storage:** marks are stored as **rows** in a small polymorphic table —
`user_id`, `subject_type` (`stop` | `recollection` | `entity`), `subject_id`,
`kind` (`mattered` at launch), optional `value`, `created_at` — not as a boolean
column on any existing table. A boolean must be surgically widened when emotional
register arrives; a row simply gains a kind. This costs nothing now and is the
difference between the follow-on being a feature and being a migration
adventure.

## 5. Session-end triage

When the user closes the assistant after it produced drafts, it shows them once:
**save / adjust / discard**, in place.

Rationale (roadmap §3, "prevention beats display"): every other part of this unit
*displays* loose ends more kindly. This is the only piece that produces fewer of
them. Triage cost rises as context decays — the same fragment costs seconds now
and real effort in a month.

Reuses `ProposalCard`. **Does not** grow a fifth propose-and-confirm pattern.
Changes a captured flow, therefore updates its `documentation/knowledge-base/`
article in the same change (standing rule).

## 6. Navigation — a rehoming, not a deletion

Top nav becomes **Globe + Journey**. This is coherent only because this unit
builds the home for what is demoted:

- **Review → dissolves into the back room.** Pending proposals are already one
  of the six loose-end inputs. It stops being a destination and becomes part of
  the ledger.
- **Interview → folds into the assistant**, which is the capture surface now.
- **Entities → stays reachable** from every entity mention and person page, as
  it already is. Life's Cast is its eventual home.
- **Memories → becomes a query, not a place** (§6.1).

`AppNav` currently opts out on `/globe`; unchanged.

**Retiring `/dashboard` has two loose threads the plan must tie off**, both
visible in `components/AppNav.tsx`:

- The **wordmark links to `/dashboard`**. It repoints to `/journey` — the
  reading surface is the natural home, and the globe keeps its own full-screen
  chrome.
- **Sign-out is imported from `app/(protected)/dashboard/sign-out-button`.** The
  component moves before the route dies; deleting the route with the import live
  breaks every page that renders the nav.

Whether the `/dashboard` route is deleted or left as a redirect to `/journey` is
a plan-time call; the design requires only that nothing links to it.

### 6.1 Search at the top of Journey

Andy, 2026-07-30: for a rich chronicle the recollection list is too numerous to
scroll; its primary use is retrieval. Search sits at the top of Journey.

**Interaction = R3.** Type → merged grouped dropdown (stops · people ·
recollections · trips) → jump straight to a result, with **See all** falling
through.

**Exploratory results = R1.** "See all" **filters the spine in place**: matching
stops stay, the rest collapse to a count, recollection hits nest under the stop
they belong to. The result of a search is therefore *where in your life this
appears* — an answer the spine alone can give, and one that needs no new
surface.

**Required behavior:** clear-and-restore must be unmistakable and one tap. The
globe search carries a related trap on record — typing appends to an existing
query, and a stray pick drops a draft pin. This must not be recreated.

**Fallback:** if the filtered spine feels wrong in use, the conventional results
list is roughly what `/memories` already renders — a fallback that exists rather
than a new build.

### 6.2 Retrieval boundary — lexical now, semantic later

What is borrowable from `lib/globe/pin-search.ts` is the **shell** — merged
dropdown, result-group vocabulary, clear-query behavior, suggest-crash guard.
**Not the matcher.** `pin-search` matches names and coordinates; this matches the
prose of recollections, and recollection results need excerpt-with-highlight,
which pin-search has no notion of. Expect modification to both layers.

Andy, 2026-07-30: deep semantic retrieval is what this eventually wants, and it
**waits for Access Cards.** Not for effort reasons — Step 14 requires the privacy
filter to run *before* pgvector similarity, and that filter cannot exist before
card grants do.

**Structural requirement:** define one retrieval interface — query in, grouped
results out — with a lexical implementation now and a semantic one later, and
**put the privacy filter inside that interface**. The ordering requirement then
holds because there is no code path reaching similarity without passing through
the filter. A rule that depends on a future implementer remembering the order is
a rule that eventually gets skipped; a boundary that makes the wrong order
unrepresentable is not.

## 7. Data & migrations

**Additive, ungated:**
- **Passage — no migration at all.** `memory_entities.role = 'passage'` (§3.4);
  `role` is free `TEXT`. The documented vocabulary and the `role = 'location'`
  audit ride the same change.
- **Marks table** (§4.1) — polymorphic, user-scoped, additive `CREATE TABLE`.

**GATED — requires Andy's explicit approval, shown with verify proof before
apply:**

1. **Trip terminus relaxation.** `validate_trip_pin` currently raises *"a primary
   residence cannot be a trip destination"*
   (`20260715130000_trips_travel.sql:80`). Relax to permit a spine destination
   **when `return_to_origin = false`**. `create_trip` needs a
   `return_to_origin` parameter, which **changes its signature** — the exact
   orphan-overload trap hit on 2026-07-26. Requires `DROP FUNCTION` and a
   post-apply proof that exactly one function exists with no orphan overload.
   *Approved in principle 2026-07-30; not applied.*
2. **Live-data repair.** Andy's **Mount Snow chalet → Wendy's apartment** trip is
   currently filed as a `vacation` with a stand-in intermediate destination — a
   workaround for the guard above, and a real distortion in the live chronicle
   (a relocation sitting in the Travel Journal as a holiday). Once (1) applies,
   it becomes a one-way relocation with the apartment as terminus. This is an
   `UPDATE` against an existing row and is **asked separately.**

**Behavior change to expect:** `destination_relationship_id` is
`ON DELETE RESTRICT`. After (1), a home that terminates a trip cannot be deleted
while that trip exists. Arguably correct protection, but it is new and it will
surprise.

**Travel Journal consequence:** the Journal reads all trips, so relocations will
appear among vacations. That may be right — a move *is* travel — or may want a
filter. This design does not decide it; it flags it as inherited.

No new tables beyond marks. No change to `memories` (invariant #1: the Raw Vault
stays append-only; a passage is a normal recollection, a mark is a derived
assertion about one).

## 8. Scope guards (explicitly out)

- **Placeless spine members** ("a passage as a spine object" — the year of
  travel, the stretch between leases). Named, deferred; §3.4's known limit is the
  price.
- **Emotional register typology and the `reflections` table.** Already designed
  in `documentation/schema_v1.sql:1690–1730` — `reflection_type`,
  `emotional_resonance TEXT[]`, and `temporality` (`contemporaneous` |
  `retrospective`, from the follow-up "at the time, or looking back?"). That is
  the Stroll's Pathway B (invariant #6) and belongs to it. Recorded as a **Track
  B §4 design input**: assembling by *feeling* is a second axis for collections,
  alongside assembling around an experience. §4.1's row-shaped marks are the
  only concession made now.
- **Semantic search** — §6.2, waits for Access Cards.
- **Chapters** — the publication object stays deferred
  (`memory/project_lc_thematic_chapters.md`). Marks seed it conceptually; nothing
  is built toward it. A turning point is a *moment*; a chapter is a *span*.
- **Date parsing of any kind.** `when_text` renders verbatim, always.
- **Keyboard reorder**, per the standing deferral.
- **Badges and counts** as attention devices, anywhere.

## 9. Phased plan

Build on `main`; `npx tsc --noEmit` + `npx next lint --dir app --dir components
--dir lib` gate every commit; each phase gets a QA checklist for Andy's live
proof; a KB article update rides any phase changing a captured flow.

| Phase | Scope | Accept |
|---|---|---|
| **L1** | Seam skeleton — rail nodes as real buttons, tray shell, passage save + render | Every adjacency has a node; passages persist and render in the right seam; nothing parses `when_text`; empty-state copy present; keyboard-reachable buttons |
| **L2** | Structural intents — place insert, unsequenced placement, trip handoff with origin pre-fill | Each intent lands in its existing flow; an unsequenced home placed from a seam takes that position; no reorder loses a place |
| **L3** | Gated migration + live repair | Migration shown and approved before apply; exactly one `create_trip`, no orphan overload; one-way trip terminates at a residence; Mount Snow trip repaired after separate approval |
| **L4** | Back room — reflection-first open, ledger, restraint rule | Assistant never opens unbidden; opens with a reflection on a cold chronicle; says nothing when nothing clears the bar |
| **L5** | Marks, dismissal memory, gravity proposals | Marks stored as rows; dismissal demotes durably; proposals use `ProposalCard`; structure never promotes alone |
| **L6** | Session-end triage | Drafts from a session are offered once on close; `ProposalCard` reused; KB article updated |
| **L7** | Journey search (R3 + R1) + nav pare-back | Dropdown groups and jumps; See-all filters the spine; clear-and-restore is one obvious tap and does not append; nav is Globe + Journey with every demoted route rehomed per §6 |

**On the size of this unit.** Seven phases plus a gated migration is large for a
single implementation plan. L1–L3 (the seam, complete and shippable on its own)
and L4–L7 (the assistant, triage, search and nav) are separable, and the seam
delivers standalone value without any of the back-room work. Recommendation:
**two plans, L1–L3 first.** Flagged rather than decided — it is a sequencing
call, not a design one.

**Build gate:** roadmap §2 — QA master-sequence **Phase 1 hard-gates this unit's
build**. Five checklists remain open and all need Andy, not the agent. The design
does not wait; L1 does.

## 10. Cross-references

- Roadmap: [`2026-07-17-spine-and-share-roadmap.md`](2026-07-17-spine-and-share-roadmap.md) §3 (this unit), §5 (what this unit promotes out of "later")
- QA sequence: [`../qa/2026-07-17-master-qa-sequence.md`](../qa/2026-07-17-master-qa-sequence.md)
- Direction: `memory/project_lc_direction_2026-07-17.md`
- Journey doc pattern + spine semantics: [`archive/2026-07-05-journey-view-design.md`](archive/2026-07-05-journey-view-design.md)
- Accessibility policy: `memory/feedback_lc_accessibility_deferral.md`
- Chapters (deferred): `memory/project_lc_thematic_chapters.md`
- Stroll pathways: `memory/project_lc_stroll_feature.md`, `documentation/feature_reminiscence_mode.md`
- Trips schema + guard: `supabase/migrations/20260715130000_trips_travel.sql`
- Migration protocol: project `CLAUDE.md`, `memory/reference_lc_migration_apply.md`
- Session mockups: `.superpowers/brainstorm/39256-1785447644/content/` (gitignored, local)
