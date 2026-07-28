---
name: project-lc-thematic-chapters
description: Thematic chapters are user-defined PUBLICATION objects (a relationship arc, a career association) spanning any number of stops and overlapping each other — near-identical to Shareable Collections. Deferred to Track B; user_periods stays dormant. Also fixes the "chapter" vs "stop" vocabulary.
metadata:
  type: project
---

## What a chapter is (Andy, 2026-07-26)

A **thematic chapter is a publication object**, not a capture structure. The
user creates a *thematic thread* that defines the chapter for the purpose of
sharing — the collection of recollections, pins, and commentary that makes up
a published chapter of a life.

Andy's examples, both organized around an **entity dimension**:

- a **primary relationship** — its recollections through to a separation, which
  ends that chapter and begins a new one with a new partner;
- a **professional employer** — a decade-plus association that "was a parent to
  your professional life."

Two structural properties follow, and neither is satisfiable by the spine:

1. **A chapter spans many stops** (or ignores residence entirely).
2. **Chapters overlap.** A chapter around an employer can start and end inside
   a chapter defined around a different entity dimension.

The schema anticipated exactly this in the initial migration: *"Periods may
overlap — a period named 'when I was raising kids' and 'my years at IBM' may
share years without contradiction."* Andy's employer example is almost verbatim.

## The near-identity with Shareable Collections

**Andy: publication-oriented chapters are "nearly the same thing as a
shareable collection."** The roadmap §4 defines a collection as "a curated set
of recollections (plus context, photos, trip routes) around an experience."
A relationship arc and a career arc are that, thematically threaded.

**Do not build both.** The §4 Collections design must decide, before any code,
whether a chapter and a collection are one object or two. Evidence they are one:

- `user_periods` is already referenced in **Access Cards `scope_rules` as
  `period_ids`** — the privacy model's existing unit of "share this slice of a
  life," which is precisely the collection share gate;
- it already backs `life_period_narrative` synthesis (the Period Narrative, one
  of the five shareable artifacts) and is described in-schema as "the organizing
  unit for memoir chapter presentation."

If they converge, `user_periods` + `memory_periods` may already be the backing
store, and the §4 work is UI plus the thematic-threading step rather than a new
object. Open question for that design, not settled here.

## Status: deferred, and the 2026-04-30 decision is reinforced

`user_periods` stays **dormant and unpopulated**. Chapter naming was removed
from Phase 0 on 2026-04-30 because "asking a user to pre-define broad life
chapter labels before any collection has occurred is impractical and
artificial." Andy's framing strengthens rather than reverses that: a chapter is
assembled *over material you already have*, for publication — so it belongs to
**Track B**, behind a body of captured recollections, not to Track A capture.

## Terminology (binding, 2026-07-26)

**"Chapter" is reserved for the user-defined publication object above.** The
pin-scoped thing — one primary residence plus the pins anchored to it — is a
**STOP**, in code *and* in user-facing copy. Andy's reason: "stop" is already
the numeration on the spine ("stop 8 of 14") and implies a physical place the
user spent time at.

This was a real collision: a stop is 1:1 with a residence pin by construction
(`anchor_residence_id` is a single FK, so an anchored place belongs to exactly
one home), whereas a chapter spans many and overlaps others. Renamed 2026-07-26
before the reorder UI shipped — `lib/journey/stop-order.ts`,
`PATCH /api/globe/residence/[id]/stop-order`, `Stop*` symbols, and the four KB
articles that had been calling a home's era a "chapter" since 2026-07-19. No DB
change: the column is `anchor_sort_order`, which never said chapter.

## Dual-track note

The Codex implementation's Journey shows a quoted, chipped **"College Years"**
label above a stop's places (screenshot 2026-07-26). That may mean Codex has
activated named periods. Worth examining in the standing dual-track review
[[project_lc_dual_track_final_review]] — it is direct evidence about whether
waking `user_periods` earns its keep, and how it reads when it does.

## How to apply

Never use "chapter" for a pin-scoped grouping. When the §4 Shareable
Collections design opens, start from the question "is a chapter a collection?"
rather than designing them separately. See [[project_lc_direction_2026-07-17]]
and [[project_lc_shareable_artifacts]].
