# Brainstorm — temporal arcs of entity engagement

**Date:** 2026-08-01
**Origin:** a side-chat brainstorm between Andy and another Claude thread, which
lost tool access before it could write anything. Handed over as prose and
**recorded here verbatim in substance** at Andy's instruction (2026-08-01).
**Status:** **EXPLORATORY — unfinished, unscheduled, no design produced yet.**
Not sequenced against Phase-1 remediation or the Loose-Ends unit.
**Andy's pending ask:** notional designs for presenting arcs **in the Journey
view**. Not started; §8's fork should be settled — or drawn both ways — first.

---

## 1. What Andy is describing

Temporal arcs of **engagement** with things, across a life:

- **tangible** — cars owned or driven, bicycles
- **intangible** — philosophies embraced for a time, musical genres that held
  his interest in certain periods, passions that came and went

His questions: should cars be an entity type? Do intangibles work the same way?
How is the migration of the user's *stance* over time presented, where does it
sit in the UI, and what is the right graphical treatment?

## 2. Verified against the repo and the live database

The handover asserted the schema facts; **all were re-checked here**, and the
one it flagged as unverified was resolved — with a result that changes the
problem.

**Confirmed in the schema:**

| Claim | Verified |
|---|---|
| `vehicle` is an entity type | ✅ `schema_v1.sql:117` — *"car, motorcycle, boat, plane — owned with temporal relationship"* |
| `owned` / `was_owned_by` seeded | ✅ `:289–290`, commented for vehicles/artifacts/property, `started_at` = acquired, `ended_at` = sold |
| `relationships` carries `started_at DATE`, `ended_at DATE`, `is_ongoing BOOLEAN` | ✅ |
| `concept` is an entity type | ✅ — a philosophy or genre is expressible; a *stance* relationship type is not seeded |
| `user_periods` exists and is dormant | ✅ `:1921` — **reserved for the deferred chapters concept; do not repurpose** |

**RESOLVED — the handover's open question, and it is decisive:**

| | Rows | `started_at` | `ended_at` | typed year |
|---|---|---|---|---|
| `lived_at` (the spine) | 18 | **0** | **0** | **0** |
| every other relationship type | 21 | **0** | **0** | — |
| `trips` | 6 | — | — | **5 of 6 carry `year_hint`** |

`started_at` / `ended_at` / `is_ongoing` are **dead columns — nothing in the
app has ever written to them.** Residences carry no year data anywhere, not in
columns and not in `metadata` (`year_hint`: 0, `moved_in_precision`: 0). Time
on the spine is **entirely** `sort_order` plus prose `when_text`.

**Two consequences the brainstorm did not have:**

1. **The tangible case is NOT free.** "No new schema, only surface" is true of
   the columns and false of the feature: there is no data to render, so arcs
   require building the **capture path that writes those dates** — i.e. asking
   the user for time. Even cars run straight into the temporal question.
2. **Trips already have the axis the spine lacks**, and Andy uses it (5 of 6).
   The typed-year pattern is proven acceptable in practice, not just in
   principle.

**NOT Vertical Moments.** That parked idea
(`docs/plans/archive/2026-06-22-globe-and-entity-ux-enhancements-design.md` §7)
is about moments when perspective elevates — gratitude, continuity. Different
concept; do not merge them merely because both are parked and temporal.

## 3. The unifying structural insight

**The thing with temporal extent is the RELATIONSHIP, not the entity.** A car
has no span; *owning it* does. A genre has no span; *engaging with it* does.
That makes cars and philosophies the same kind of object:

| | Entity | Arc-carrying relationship |
|---|---|---|
| Fiat 128 | `vehicle` ✅ | `owned` ✅ |
| Bicycles | `vehicle` ✅ | `owned` ✅ |
| Stoicism / bebop / a passion | `concept` ✅ | **missing — a stance type** (a seed row, not a migration) |

Because relationships are rows, **the same pair can have several**, which gives
**recurrence for free**: into jazz at twenty, out at thirty, back at fifty is
three rows, not one awkward span. Recurrence is what makes intangibles feel
unlike cars — and the model already handles it.

## 4. Andy's decisive objection — the key content of this brainstorm

The other thread proposed anchoring arcs to **spine stops** (owner-asserted, no
dates, consistent with every temporal decision the project has made). **Andy
rejected it, correctly:**

- entities span multiple stops; stops span multiple engagements; the cadences
  do not align
- **the killer case: someone who lived in one place their whole life has ONE
  stop.** Every arc collapses onto it.

So **the spine's temporal resolution is a function of how often the user
moved.** That is a flaw, not a cost.

> **This is evidence that invariant #5's central assumption — the residential
> spine IS the temporal scaffold — has a class of user it does not serve.**
> That is worth the project knowing regardless of what happens to this feature.

**Arcs need their own axis, independent of the spine.** But Andy explicitly
liked: *"having that timeline presentation be a column that, like the spine,
the user can scroll while maintaining the primary residence spine in view."*

## 5. The coordinate problem

Stops are **ordered** (`sort_order`). Arcs must be **spaced** (time elapses).
Two columns co-scroll meaningfully only if they share a vertical coordinate;
otherwise the alignment is decorative.

**The sanctioned precedent for typed-not-parsed time is `year_hint` on trips.**
The framing panel states the rule out loud: *"The year orders your Travel
Journal — only what you type here is used, never a guess from the phrase."*
Years the user **types** are assertions, like `sort_order`. Years the system
**infers from prose** are forbidden. `when_text` stays verbatim.

So arcs can carry optional typed start/end years without violating invariant
#5. **But** putting the spine on that same axis means a *second* typed-year
field, on stops — and §2 shows the spine currently has **none**, so this is
new capture, not exposure of existing data.

## 6. This trips a wire the roadmap set deliberately

`docs/plans/2026-07-17-spine-and-share-roadmap.md` §5, Temporal Agent:

> *"`year_hint` was the first structured-time workaround; when_chips,
> 'Sometime' groups, and capture-order listings all accumulate pressure. Not
> scheduled — but **any new feature adding another per-feature time workaround
> should trigger the 'is it time?' conversation.**"*

**This feature is that trigger**, and Andy's one-stop example is the argument:
a life needs a time axis that does not depend on having moved house.

## 7. Design direction so far (input to the notional Journey designs)

- **Spine stays the left rail** — landmarks, unchanged, still the ember thread.
- **Arcs render as vertical ribbons** in a second, co-scrolling column, each
  spanning its extent. Concurrency = parallel lanes. **The packing rule is the
  real design work** — six overlapping enthusiasms must not become confetti.
- **Lanes group by entity type** (cars / bicycles / genres / philosophies),
  collapsible.
- **The Entities page becomes the INDEX into lanes**, not a second timeline —
  one card per type showing arc count and overall span, opening its lane.
  Andy's original instinct, and it survives.
- **Recurrence is two ribbons on one lane with a gap**, and the gap is
  expressive — returning to jazz at fifty *looks* like a return.
- **Unplaced arcs need a tray**, mirroring unsequenced residences and Journey's
  "Elsewhere · not yet anchored" — much intangible material may never get a year.
- **The payoff to design toward:** reading the two columns together answers
  what neither answers alone — *what was I driving when I lived there; what was
  I reading the year I moved.*

## 8. OPEN — Andy has not answered this

**Is this the Temporal Agent conversation finally arriving** — design the time
axis once, properly, for arcs + stops + trips together — **or a contained
feature** carrying its own typed years, deferring the general problem again?

The other thread argued for the former on Andy's own evidence. **§2's data
strengthens that argument**: the spine has no time data at all, so a
feature-local axis would leave the two columns unable to share a coordinate
without *also* adding typed years to stops — which is the general problem
wearing a disguise.

**Do not treat this as settled.** Recommendation carried over from the
handover, and endorsed here: **draw both**, because the comparison is probably
what settles it.

## 9. Constraints any design must respect

- **Invariant #5:** `when_text` renders verbatim; nothing is parsed into dates,
  ever. Typed years are fine; inferred years are not.
- **Ordering and significance are owner assertions** (2026-07-26, 2026-07-30) —
  arcs should follow the same grain.
- **"Chapter" is reserved** for the deferred publication object;
  `user_periods` stays dormant. Do not name anything here a chapter.
- **Journey is the READING surface.** Rule 10 (2026-07-30): work-shaped
  controls do not belong where reading happens — the arc column must not turn
  Journey into a workbench.
- **Rule 13 (2026-07-30):** a mode switch that changes an element's height must
  keep that element in view. Expanding a lane will do exactly that.
- **Not scheduled.** Phase-1 remediation is mid-flight
  (`2026-07-30-phase1-remediation-plan.md`) and the Loose-Ends unit
  (`2026-07-30-loose-ends-surface-design.md`) is designed but unbuilt, two
  plans, seam first. This is exploratory and sits behind both.

## 10. Cross-references

- Temporal Agent trigger: [`2026-07-17-spine-and-share-roadmap.md`](2026-07-17-spine-and-share-roadmap.md) §5
- Temporal design of record: `memory/project_lc_temporal_agent.md`
- Chapters / `user_periods` (do not repurpose): `memory/project_lc_thematic_chapters.md`
- Invariants: project `CLAUDE.md` (#5 temporal scaffold)
- Vertical Moments (distinct): `docs/plans/archive/2026-06-22-globe-and-entity-ux-enhancements-design.md` §7
