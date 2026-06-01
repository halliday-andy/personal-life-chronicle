# Decision: Phase 0 reframing — three navigation surfaces

**Date:** 2026-05-31
**Status:** Decided. PRD v1.1 published. Canonical spec at `documentation/feature_navigation_surfaces.md`.
**Owner:** Andy Halliday (product), with implementation conversation captured here.

---

## What changed

The MVP's Phase 0 model moved from a **three-stage sequential interview protocol** (with explicit user-declared stage completion and per-stage artifact deliveries) to a **three-surfaces familiarisation model** built around the three primary navigation surfaces the user lives in: Globe, Recollections, Timelines.

The user-facing summary:

- The user's first signed-in screen is the Globe.
- After their first capture, the onboarding agent invites them to the Recollections tab.
- After they have confirmed three person entities via /review, the agent invites them to the Timelines tab with the **Life's Cast** (technically: Significant Relationships) dimension pre-loaded.
- No "Phase 0 complete" button. No stage celebrations. Surfaces are always in the top nav from sign-in; thresholds only gate the agent's *invitations* to visit them.

The lead Timelines dimension is **Life's Cast** — the user-facing branding (Shakespeare resonance preserved from v1) — with **Significant Relationships** as the technical descriptor used in spec language, schema comments, and tooltips. Both names point at the same data.

The visualisation model for Life's Cast is a **swimlane / Gantt-style layout**: one horizontal bar per entity, x-axis = life span, bar length = period of significance, opacity = memory density. Lifelong presences (parent, spouse, lifelong friend) span the full axis as continuous bars; short blooms are visually obvious notches. This explicitly honours the persistence-from-very-early-to-the-end pattern that a per-life-stage cast accordion would fragment.

---

## Why

Two assumptions in the original v1 §3 framing did not survive design contact:

1. **Synthesis artifacts and navigation views are the same thing.** They aren't. The Globe is *both* a synthesis (per-pin entity_biography prose) AND a navigation surface (the pannable map). Conflating them locks navigation behind "synthesis is ready" — which means the user can't explore their own data until the system has rendered prose for it. Separating them lets the surface exist from the first pin; synthesis enriches but doesn't gate.

2. **The user wants a guided sequence with completion gates.** They don't. The target user (40+, building their own legacy) wants to feel they're constructing something real from the first click. Stage gates introduce "first you must…" friction that competes with the engagement we are trying to create.

Andy's framing during the design pass (Step 6g, 2026-05-28): *"the old phase zero description of the onboarding protocol — globe to portrait to players — is being seconded by the primary need to focus on the initial usable UI, which will be the globe view principally, and think about the assisted onboarding process as wanting to introduce the main navigation views."*

Andy's refinement during the spec review pass (2026-05-30): *"timeline for people should appear early enough to encourage them to follow that spine in entering recalled people. Let's narrow it even further and say most significant social or marital relationships — the romance strand. That serves well to walk through the full succession in one go."*

---

## What this preserves from v1

- **The strand-based data model** (residential, entity, topic) introduced in `memory/project_lc_ontology_bootstrap.md` is unchanged. The strands still run in parallel under the hood; the surfaces visualise them.
- **The Residential Spine principle** (per `feature_residential_globe_onboarding.md`): Globe is the highest-priority elicitation surface during onboarding because residential history provides bilateral temporal constraints. This is preserved in PRD v1.1 §3.5.
- **The Shakespeare resonance** of "Life's Cast" / "Life's Players" naming, retained as the user-facing brand even as the underlying scope narrows to Significant Relationships.
- **The two-list MVP scope discipline:** what ships at launch vs what comes incrementally in Phase 2, with no double-counting.

---

## What this deprecates

- The **three-stage sequential protocol** (Stage 1 Residential → Stage 2 Entity → Stage 3 Topic) with explicit Validation Gate. Strands still progress; the gate is gone.
- The **completion gate** after Stage 3 ("memory collection does not begin until the user explicitly confirms"). Capture is available from the moment the user signs in.
- **Life Globe and Life's Players as standalone MVP synthesis artifacts.** Both move to Phase 2 as *enrichments* of their respective surfaces (which themselves are MVP). The surfaces work without the synthesis prose; the synthesis adds polish.
- **Hypothesis H1's stage-based success indicator** ("≥60% of users who begin Stage 1 complete all three stages within 14 days"). Will need a v1.2 update of §2.4 to define the new H1 metric — likely "≥60% of users have ≥3 confirmed person entities AND ≥3 Globe pins within 14 days of first sign-in."

---

## Implementation status

- **Spec:** `documentation/feature_navigation_surfaces.md` v1.0 committed in `796cddd`, patched in `e120be3` (Life's Cast branding).
- **PRD:** Converted to canonical markdown as `documentation/Life_Chronicle_PRD.md` (v1.1). v1.1 .docx and v1.0 .docx archived at `documentation/archive/`. Future PRD edits happen directly in markdown via the Edit tool, retiring the docx-skill / XML / repack overhead. Conversion rationale captured 2026-05-31 — see commit history.
- **Code:** no code changes yet. The MVP build still has `/dashboard`, `/memories`, `/review`, `/interview` as separate pages; the three-surfaces top nav has not been built. The Globe surface (Step 7) and Timelines surface (post-Step 7) are still ahead of us in the build sequence. Step 6h is next.

---

## Follow-ups (captured as tasks)

- **Task #64** (this revision) — closed.
- **Hypothesis H1 update** — needed in next PRD revision (v1.2). The "complete Stage 1 → all three stages" metric needs replacement with a threshold expressed against the new model. Add as a TODO in the PRD or as a separate task. *Not opened yet — Andy may have specific metric preferences.*
- **Task #68** (`/people` view) — directly enables the Life's Cast surface by giving users a tool to manage the person entities that populate it.
- **Build sequence** — Step 7 (residential strand / Globe), Step 11 (synthesis), and the not-yet-numbered Timelines surface build need to align with the v1.1 framing.

---

## Decision record references

- `documentation/feature_navigation_surfaces.md` — canonical spec
- `documentation/Life_Chronicle_PRD.md` — v1.1 (this revision; markdown canonical from 2026-05-31)
- `documentation/archive/Life_Chronicle_PRD_v1.docx` — final v1.1 .docx before the markdown switch
- `documentation/archive/Life_Chronicle_PRD_v1.0.docx` — pre-revision v1.0 .docx backup
- `memory/project_lc_ontology_bootstrap.md` — three-strand data model (unchanged)
- `memory/project_lc_prd_readiness.md` Decision 3 — the parallel-strands amendment from 2026-05-17 that this reframing builds on
- `scripts/archive/prd_v1_to_v1.1.py` — the one-off section-replacement script that generated the v1.1 .docx (archived; no longer needed since the PRD is now markdown-canonical)
