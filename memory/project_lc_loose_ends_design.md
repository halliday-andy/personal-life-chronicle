---
name: Project: LC Loose-Ends surface design (2026-07-30)
description: Unit 1 of the Spine & Share roadmap, designed with Andy 2026-07-30. Two faces — Journey seams (passive) + the assistant's back room (active). Canonical doc at docs/plans/2026-07-30-loose-ends-surface-design.md. DRAFTED, awaiting Andy's review; build gated on QA Phase 1.
metadata:
  type: project
---

Canonical: `docs/plans/2026-07-30-loose-ends-surface-design.md` (commit
`6c2fd11`). This is the summary; read the doc for detail.

**Status 2026-07-30:** design drafted and committed, **not yet reviewed by
Andy**. No code, no migration applied, no live data touched. Andy is walking
the five remaining QA Phase-1 checklists next; roadmap §2 hard-gates the build
on that walk, not the design.

## What it is

Not a dashboard and not a route. Two faces on one idea:

- **Passive** — *interstices* in the Journey spine, always present, unranked.
- **Active** — the capture assistant, which **never speaks unbidden** and opens
  with a reflection about a period already in the data.

`/dashboard` is retired; nav pares to **Globe + Journey**.

## Decisions that should not be relitigated

- **The interstice exists by ADJACENCY, not detection.** Two stops are adjacent,
  therefore there is a space between them. Nothing is computed; no `when_text`
  is ever parsed (invariant #5). Analysis only changes a seam's *prominence*,
  never its existence.
- **Presence and promotion are separate bars.** Only the assistant's spoken
  invitation needs a significance model. This is what stops the surface reading
  as a backlog.
- **Significance is the owner's assertion, never sentiment-computed** — the
  analogue of "ordering is the owner's assertion, never date-parsed" (07-26).
  Marks in place + gravity proposals + dismissal demotes; structure is a
  tiebreaker, never a promoter.
- **Significance and emotional register are separate axes.** Collapsed, the
  assistant would promote sad things *because* they are marked sad.
- **The assistant must be able to say nothing.** Acceptance criterion.
- Seam renders as a node on the ember rail (not a column row); tray is
  write-first with trip / new place / unsequenced home named beneath.
- A **passage** = `memory_entities.role='passage'` on the arriving stop — no
  migration, but it obliges an audit of every `role='location'` filter (the
  standing pin-overview discriminator) in the same change.

## Gated, approved in principle, NOT applied

- **Trip terminus relaxation** — a one-way trip (`return_to_origin = false`) may
  terminate at a primary residence; `destination` is the terminus, not the
  turnaround. Alters `validate_trip_pin` + `create_trip` (signature change →
  `DROP FUNCTION` → orphan-overload proof required).
- **Live-data repair** — Andy's **Mount Snow chalet → Wendy's apartment** trip is
  filed as a `vacation` with a stand-in destination, a workaround for that
  guard. Becomes a one-way relocation once the guard relaxes. Asked separately.

## Recorded for later, deliberately not built

- **Emotional register typology.** Andy's idea (mark a recollection's emotional
  import so collections can later be assembled by feeling) is already designed:
  `reflections` at `documentation/schema_v1.sql:1690-1730` carries
  `reflection_type`, `emotional_resonance TEXT[]` and `temporality`
  (contemporaneous vs retrospective). It belongs to the Stroll's Pathway B
  ([[project_lc_stroll_feature]]) and is a **Track B §4 input** — assembling by
  feeling is a second axis for collections. The only concession made now: marks
  are stored as rows, so register arrives as a new kind, not a migration.
- **Placeless spine members** ("a passage as a spine object" — the year of
  travel, the stretch between leases). The §3.4 known limit is the price of
  deferring it.
- **Semantic search waits for Access Cards** (Andy's directive): Step 14 needs
  the privacy filter to run *before* pgvector similarity, and that filter cannot
  exist before card grants do. This unit ships **lexical** retrieval only, behind
  one swappable interface with the filter *inside* it — so the wrong order is
  unrepresentable rather than merely discouraged.
- Chapters stay deferred ([[project_lc_thematic_chapters]]). A turning point is
  a *moment*; a chapter is a *span*.

## Open when Andy returns

1. His review of the design doc.
2. **Two plans or one** — seven phases plus a gated migration is large; L1–L3
   (the seam) is shippable standalone. Recommendation: two plans, seam first.
   Sequencing call, his.
