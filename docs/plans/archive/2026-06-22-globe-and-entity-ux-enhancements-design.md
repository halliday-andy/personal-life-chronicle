> **ARCHIVED 2026-07-17** — Product-intent record for the (now exhausted) 2026-06-22 roadmap. Everything shipped or re-homed; see `../2026-07-17-spine-and-share-roadmap.md`.

# Globe & Entity UX Enhancements — Design Brief

**Date:** 2026-06-22
**Status:** Design discussion captured with Andy. Ready for Claude Code to refine and slot into the work plan.
**Scope:** Seven enhancements spanning globe legibility, two new surfaces/workflows (Resume View, the Hopper), the Person Entity page behind Life's Cast, and a parked new taxonomy axis (Vertical Moments).
**Relationship to existing plans:** Builds on shipped Step 7 work (Slices 1, 2, 4a/4b) and the still-pending **Slice 3** (`docs/plans/2026-06-12-globe-place-types-design.md`, six place types + three-tier line hierarchy + Model A anchoring). Items 1–3 below should be read as **amendments/extensions to Slice 3's line and pin language**; items 4–7 are largely new.

---

## Purpose of this document

This is a product/UX brief, not an implementation plan. It records the *intent and agreed behavior* for each enhancement so Claude Code can (a) fit each into the existing slice sequence at the right point, (b) make the schema/architecture calls, and (c) propose acceptance criteria. Where a decision touches an architectural invariant (Raw Vault immutability, the residential spine as temporal scaffold, Access Cards privacy), that is flagged inline.

A recommended sequencing is given at the end as a starting point — Claude Code should adjust it to the most efficient fit with the current build state.

---

## 1. Pin legibility — at-rest temporal chip + hover reveal

**Problem.** A pin on the globe is not self-describing. The user must click it to learn what it is, and there is no at-a-glance sense of *when* in the life journey it sits or how much time elapsed between stops.

**Agreed behavior.**

- **At-rest temporal chip.** Every pin carries a compact year-range chip rendered on the globe without interaction — e.g. `1971–75`. The current/open-ended residence renders as `2019–now`. The chip is **plain text only**; *no* visual proportionality (no arc-length or spacing encoding of duration) for MVP. This keeps proportional-timeline encoding where it belongs — deferred to the Temporal Agent (architectural invariant #5). The chip is simply pin `when_text` / the start–end range we already capture.
- **Hover reveal.** Hovering a pin surfaces a compact card with the pin **name** plus a short **user-written placard** (a one-line description of the location). The hover card is intentionally minimal — name + placard for MVP — but the design should anticipate additional compact data points later (e.g. place type, duration, count of linked recollections, people present). Treat the placard as a new short free-text field on the place pin if one does not already exist.
- **Progression read.** Together, the chevroned spine + per-pin year chips let a user rotate the globe or step Next/Previous and develop a felt sense of elapsed time between pins A→B→C *without opening any detail card*.
- **Chevrons.** Enlarge and make the spine chevrons more visibly directional than today, reinforcing sequence and direction at a glance. (Coordinates with the directionality work already shipped 2026-06-11 and Slice 3's per-type line styling.)

**Notes for Claude Code.**
- The placard is the only new persisted field implied here; everything else is rendering. Confirm whether a suitable short-description field already exists on the place entity/relationship before adding one.
- The hover card and the detail card (click) are distinct: hover = glanceable orientation; click = full detail card.

---

## 2. The origin pin — "the beginning"

**Problem.** Nothing marks where the life journey *starts*. The first pin should anchor the eye as the origin.

**Agreed behavior.**

- **Keys off sequence position #1, not a semantic "birth" field.** Whatever pin the user places first *is* the origin. We do **not** model birthplace as a special attribute. (Discussed edge cases — base-hospital births abroad, adoptees/immigrants whose earliest remembered home ≠ birth location — resolve cleanly this way: if a user wants to distinguish a birth hospital from a first home, those are simply two ordinary pins.)
- **Distinct appearance.** Pin #1 renders larger and more graphically interesting than any other pin — an "infancy of the journey" treatment. A gentle oscillation/glow is acceptable, but the goal is **differentiation as the first**, not pulling focus or distracting a returning user. Prefer a calm treatment that reads as "start here" rather than an attention magnet.
- **Label.** Pin #1 shows its **start year** as the origin marker (its own year chip, framed as the beginning). This is just position-1's start year — not a separate birth attribute.
- **Hover.** As with all pins, hover reveals the full duration range + placard text to orient a new visitor before they click through to the detail card.

**Notes for Claude Code.** Purely presentational; no schema change. The "first pin" is whatever sorts first in the residential `sort_order` spine.

---

## 3. Line decluttering — default to spine, reveal-on-demand, persistent line tray, type filters

**Problem.** As the primary-residence sequence has filled in, side-trip / vacation / workplace tethers intersecting the spine make the globe cluttered and hard to read — compounded by similar line coloration against the black background.

**Agreed behavior.**

- **Default view = primary residential spine only.** All non-primary tethers (workplace commute, second residence, short-term stay, vacation, professional travel — the Slice 3 types) are hidden by default.
- **Hover = transient preview.** Hovering a pin previews *that pin's* associated side lines; they clear on mouse-out and never persist.
- **Click = persist into an "active lines" tray.** Clicking a pin persists its side-line set **and** adds a small dismissible chip to an *active-lines tray* docked with the pin-type selector at bottom-left of the globe (e.g. `Dartmouth ✕`, `Blois ✕`).
  - Each chip's **✕** removes just that set.
  - A **Clear all** control resets the globe to the bare spine.
  - This decouples line persistence from the detail card, which solves the original problem: when the user clicks a pin, reveals its side trips, then clicks a *side* pin (changing the detail card), the previously revealed sets remain listed and controllable in the tray rather than being orphaned.
- **Detail-card toggle.** The detail card still carries a "keep side lines on/off" toggle for the current pin, but it is just a shortcut into the same tray state (not a separate mechanism). Default on-click is side lines ON for the clicked pin.
- **Multi-pin support (a goal, not an accident).** Because persistence lives in the tray, the user can deliberately leave one pin's lines on, select another pin, and add its set — comparing multiple side-journeys at once.
- **Type-level filters.** In addition to per-pin reveal, provide class-level filters on the globe — show/hide all Workplaces, all Vacations, all Professional travel, etc. **Integrate these into the existing pin-type selector UI at bottom-left** (the same control region as the active-lines tray). Interaction model: type filters set the *baseline* of what's shown; per-pin chips add *specific* reveals on top of that baseline.

**Notes for Claude Code.**
- This supersedes any "toggle off then navigate away to keep clean" interim idea. The tray + Clear all is the agreed model.
- Coordinate the line styling with Slice 3's three-tier hierarchy (spine / commute / trip tethers) and address the coloration/contrast issue noted above (the side tethers should be visually distinct from the glowing spine, not just dimmer versions of the same color).

---

## 4. Resume View — a scrollable, card-oriented sequence of the life journey

**Problem.** Today the residential sequence is only legible *inside* the globe. The Memories view lists recollections with no sense of *where* in the life journey each sits. There is no way to read the journey as a scrollable list of detail cards.

**Agreed behavior.**

- **New surface.** A card-oriented, vertically scrollable list of the residential pins **in chronological sequence**. (Confirmed: no existing plan slot — this is new. The screenshot Andy referenced is a Codex-built "Pin sequence" panel from a different Life Chronicle implementation; it is a reference, not our current UI.)
- **Each row = a pin's detail card**, from which the user can drill down to:
  - linked **recollections**,
  - **photo collections**,
  - the **full edit panel** for modifying the detail-card text.
- **Nesting.** Associated recollections and side/related pins display **indented as children** under their parent primary residential stop.
- **Bidirectional globe sync — build it, but it's low-criticality.** Selecting a row centers the globe on that pin, and selecting a pin on the globe scrolls the list to center its card. Rationale for low-criticality: in practice the globe and the list are hard to view simultaneously, so the back-and-forth has limited live utility — but keeping the two centered on the same selection means that when the user *switches* surfaces they land already oriented on their last attended stop.
- **The Hopper is explicitly NOT shown here** (see item 5) — the Resume View stays a compact, readable sequence; the hopper can be long and noisy.

**Notes for Claude Code.** Reuses existing detail-card, recollection, and photo-collection components. The new work is the list surface, the nested/indented child rendering, and the scroll-sync wiring. Fits the navigation-surfaces frame (Globe / Recollections / Timelines) as a distinct way to read the residential strand.

---

## 5. The Hopper — a memory-stub notepad / recollection checklist

**Problem.** A full recollection takes time and concentration. When a user sets a pin, ideas, fragments, and "I should write about X" prompts occur faster than they can be developed. There is no lightweight place to capture those stubs as a to-do list of recollections to make.

**Agreed behavior.**

- **What it is.** A "hopper" of short-phrase captures / sketches of *to-be-recollected* memories — a checklist of recollections still to be made.
- **Consumable checklist.** Hopper entries are **checked off / consumed** once expanded into a full recollection. (No long-term provenance link required — it's a to-do list, not an audit trail.)
- **Two hopper types, one consistent design.** Design the hopper so it is **consistent and reusable across two hosts**:
  1. a **place/pin** hopper (memory stubs about a location), and
  2. a **person-entity** hopper (memory stubs about a person — see item 6).
  Same interaction and component, different host entity.
- **Where it lives.** Accessible from the **Detail Card**, residing on the **full edit panel** of the pin (and, symmetrically, on the person entity page). **Not** surfaced in the Resume View (item 4) — it can grow long and unintelligible to a reviewer, which would clutter the compact sequence list.
- **Capture-assistant integration (the point of it).** The hopper is a primary input to the Capture Assistant's interviewer role:
  - The assistant can pick a hopper stub and **prompt/interview** the user to flesh it out into a full recollection.
  - During that interview, newly triggered memories that deserve their own expansion should prompt the assistant to **offer to add them to the hopper** as new stubs.
  This makes the hopper the connective tissue between quick capture and structured recollection.

**Notes for Claude Code.**
- Architecture call: how a hopper stub relates to the `memories` table. Given Raw Vault immutability (invariant #1), candidate approaches include a draft/stub status on `memories` vs. a separate lightweight `memory_stubs` table that is "promoted" into a real memory on expansion. Recommend the approach that keeps the Raw Vault clean and supports check-off/consumption without violating append-only semantics.
- The host-agnostic design (pin **or** person) should inform where the stub's foreign key(s) point.

---

## 6. Person Entity page — the detail surface behind Life's Cast

**Problem.** People surface only as extracted mentions scattered across recollections. There is no place to aggregate everything about a person, add commentary that isn't tied to a pin, or curate who actually matters (Life's Cast).

**Agreed behavior.**

- **A page per identified person — but not all are promoted.** Entity extraction already identifies people. Each may have an (effectively blank) entity page, but Life's Cast must **not** auto-populate with every name ever mentioned.
  - Provide a **toggle/filter** that shows only entity pages with actual content vs. the full list of all mentioned entities.
  - **No automatic promotion.** The user, after fleshing out a person's page, **promotes it** to visibility in Life's Cast. Promotion is a deliberate user act.
- **Primary mode = aggregation/index.** The page assembles the recollections that mention the person — recollections that already live on **pins** (residential or other). These appear as **short descriptors that link out** to the recollection (which continues to live with its pin). The recollection itself is **never hosted on the person page** — the page is an aggregator/index, not a content home. (Confirmed.)
- **Person-anchored recollections that have no pin.** The page also lets the user add recollections **about that person that do not appear on the pin sequence** — meaningful exchanges, events, and shared experiences not anchored to a place in the Life Transit / globe view.
- **Open and private commentary.** The page is a place for the user to write both open and private commentary about the relationship. *Privacy here routes through the Access Cards model (architectural invariant #3), not the deprecated `privacy_tier` ENUM.*
- **Chronological progression.** Entries on a person page are ordered chronologically — giving a read of how that relationship advanced over time, and (across Life's Cast) how important people entered and progressed through the user's social and family life. (Ordering basis — first appearance / relationship start — to be confirmed in implementation; chronological is the agreed intent.)
- **This page IS the detail page behind the already-planned Life's Cast / Significant Relationships timeline.** It is not a separate concept — Life's Cast is the curated roster; the Person Entity page is what you open from it.
- **Hopper on the person page.** Carries a person-type Hopper (item 5) for stub-capturing memories about that person.

**Notes for Claude Code.**
- Largest-scope item here; likely decomposes into its own slice(s). Leans on existing `memory_entities` (role = person) for the aggregated mentions, plus a new path for person-anchored recollections that have no place pin.
- The "promote to Life's Cast" act needs a persisted flag/state on the person entity.
- Reconcile with `documentation/feature_navigation_surfaces.md` (Life's Cast as Timelines lead) and the Relationship Portrait shareable artifact — this page is the navigable substrate those build on.

---

## 7. Vertical Moments — parked future taxonomy axis

**Status: captured and parked.** Not for design now; awaiting Andy's fuller description and examples.

**The idea.** Moments when a person's perspective on life and its passage suddenly elevates — a "70,000-foot view" that looks back and forward from a place of appreciation, contentment, and gratitude for life. Such moments also create a felt **personal continuity** with all the other vertical moments — a sense of unity with one's whole life experience.

**Structural intent.** Vertical Moments is an **additional axis on the dimension taxonomy** (beyond the current 10) — possibly chronological, but it does not lean on a timeline as heavily as other dimensions. Andy notes there may be **further axes** discovered together while building out his own life timelines, so the taxonomy should be treated as extensible. (Consistent with the schema-extensibility constraint already recorded in the architecture decisions.)

**Action for Claude Code.** Record as a future item only. Do not implement; do not relitigate the 10-axis taxonomy now. Revisit when Andy supplies examples.

---

## Recommended sequencing (starting proposal — adjust to build state)

This is a recommendation for Claude Code to refine against the actual slice plan, not a fixed order.

1. **Globe legibility (items 1–3)** — first. They are presentational/interaction extensions of already-shipped globe work and the pending Slice 3 line language, and they deliver the most immediate intelligibility gain. Ideally folded *into* Slice 3 (place types + line hierarchy) since they share the line/pin rendering and the bottom-left selector UI.
   - 1: temporal chip + hover placard + bigger chevrons
   - 2: origin-pin treatment
   - 3: default-spine + hover preview + active-lines tray + type filters
2. **Resume View (item 4)** + **Hopper (item 5)** — next. The Resume View reuses existing card/recollection/photo components; the Hopper introduces the capture-assistant interview loop and the stub data model. Sequence the Hopper's stub-storage decision before wiring the assistant.
3. **Person Entity page / Life's Cast (item 6)** — larger, likely its own slice(s); depends on the Hopper's host-agnostic design and connects to the planned Life's Cast timeline and Relationship Portrait artifact.
4. **Vertical Moments (item 7)** — parked; no work until examples arrive.

---

## Open items for Claude Code to resolve

- Item 1: does a short place "placard" field already exist, or add one?
- Item 5: hopper-stub storage vs. Raw Vault immutability — draft status on `memories` vs. separate `memory_stubs` table; promotion path on expansion.
- Item 6: ordering basis for the person page's chronological entries (first-mention vs. relationship start); the "promote to Life's Cast" flag; privacy via Access Cards for open vs. private commentary.
- Cross-cutting: confirm how much of items 1–3 can merge into Slice 3 vs. land as a fast-follow.
