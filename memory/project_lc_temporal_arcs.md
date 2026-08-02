---
name: "Project: LC temporal arcs of engagement (2026-08-01)"
description: Brainstorm — arcs of engagement (cars, bicycles, philosophies, musical genres) as a second co-scrolling column beside the Journey spine. Andy's one-stop-lifetime objection is evidence that invariant #5's spine-as-temporal-scaffold assumption fails for a class of user. EXPLORATORY, unscheduled; the Temporal Agent fork is OPEN.
metadata:
  type: project
---

Canonical: `docs/plans/2026-08-01-temporal-arcs-brainstorm.md`. This is the
summary; read the doc for detail.

**Origin:** a side-chat brainstorm between Andy and another Claude thread that
lost tool access before writing anything; handed over as prose and recorded at
Andy's instruction 2026-08-01. **Exploratory, unscheduled**, sitting behind
Phase-1 remediation and the Loose-Ends unit. Andy's pending ask is *notional
designs for the Journey view* — not started.

## The structural insight

**The thing with temporal extent is the RELATIONSHIP, not the entity.** A car
has no span; *owning* it does. A genre has no span; *engaging with* it does.
So cars and philosophies are the same kind of object: `vehicle`+`owned` (both
already exist) and `concept`+**a stance type that does not exist yet** (a seed
row, not a migration).

Because relationships are rows, one pair can have several — **recurrence comes
free**. Into jazz at twenty, out at thirty, back at fifty is three rows, and
the gap between them is expressive.

## The finding that matters beyond this feature

The other thread proposed anchoring arcs to spine stops. **Andy rejected it,
and his counter-example is the most important thing in the brainstorm:**
someone who lived in one place their whole life has **one stop**, so every arc
collapses onto it. **The spine's temporal resolution is a function of how often
the user moved.**

> That is evidence that **invariant #5's central assumption — the residential
> spine IS the temporal scaffold — has a class of user it does not serve.**
> Worth the project knowing regardless of what happens to this feature.

## Verified against the live DB (2026-08-01) — changes the problem

`started_at` / `ended_at` / `is_ongoing` exist on `relationships` but are
**dead columns: ZERO rows populated, every relationship type.** Residences
carry no year data anywhere — not in columns, not in `metadata`. Spine time is
**entirely** `sort_order` + prose `when_text`. Meanwhile **trips carry
`year_hint` on 5 of 6 rows** — the typed-year axis is live and Andy uses it.

Consequences: the tangible case is **not** "surface only" (there is no data to
render, so capture must be built), and **trips already have the axis the spine
lacks**.

## OPEN — do not treat as settled

**Is this the Temporal Agent conversation arriving** (design the time axis once
for arcs + stops + trips) **or a contained feature** with its own typed years?
It trips the roadmap §5 trigger by design: *"any new feature adding another
per-feature time workaround should trigger the 'is it time?' conversation."*
Recommendation on file: **draw both** — the comparison is what settles it.

## Guardrails

- Typed years are fine (the trips precedent); **inferred years never** —
  `when_text` stays verbatim (invariant #5).
- **"Chapter" is reserved** and `user_periods` stays dormant
  ([[project_lc_thematic_chapters]]) — do not repurpose or name anything here a
  chapter.
- **Not Vertical Moments** — that parked idea is about perspective elevating,
  a different concept; don't merge them just because both are parked.
- Journey is the **reading** surface (rule 10); an arc column must not turn it
  into a workbench. Expanding a lane trips rule 13 (keep the element in view).

Related: [[project_lc_temporal_agent]], [[project_lc_thematic_chapters]].
