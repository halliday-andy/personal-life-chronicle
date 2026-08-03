---
name: project_lc_dual_track_final_review
description: Standing commitment — end-of-development full code + UI/UX review comparing both Life Chronicle implementations (PLC/Claude Code vs CODEX/Codex)
metadata:
  type: project
---

Andy is building Life Chronicle as **two parallel implementations**: this workspace (PLC, developed with Claude Code) and `~/Desktop/_LOCAL-DEV.nosync/CODEX Life Chronicle Project` (developed with the Codex app). As of 2026-07-07 both harnesses carry the same tooling — compound-engineering 3.18.0 and the 48 designer-skills ([[reference_lc_designer_skills]]) — so the comparison is tooling-fair.

**The commitment (requested 2026-07-07):** at the very end of development of these two projects, Claude is to review the full codebase of each, and opine on the code quality as well as the UI and UX of each accomplished application — a comparative assessment of both tracks.

**Why:** the parallel build is partly an experiment in agent-assisted development; the final review is how Andy evaluates the two tracks against each other.

**How to apply:** when Andy declares development complete (or asks for "the final review"), run a full-codebase code review of both repos plus a UI/UX critique of each running app (the designer-skills critique-* skills are the natural instrument), and deliver a comparative opinion. Also recorded in `~/.claude-os/INVENTORY.md` next-steps.

## Early payoff — pin separation (2026-08-01)

The end-of-development comparison paid out months early. Andy hit pin
occlusion on the PLC globe (a workplace hiding a primary residence in
Queenstown; **no `z-index` on pins anywhere**, so stacking is DOM insertion
order) and supplied three Codex screenshots showing it solved.

Reading the Codex source directly — `lib/globe/marker-layout.ts` — turned
inference into fact, and **corrected a worse design this side had proposed**:
radial displacement along each pin's bearing, which distorts BOTH axes. Codex
instead constrains the offset to `[dx, 0]`, so **latitude is never altered**
and vertical relationships survive exactly; only longitude is normalised, with
an explicit sort to preserve west→east order across zoom thresholds.

**Constraining displacement to one axis keeps the other honest** — the durable
lesson, and it came from reading the sibling build rather than reasoning alone.

Preliminary design: `docs/plans/2026-08-01-pin-separation-preliminary-design.md`.
**When a problem here looks solved over there, read the source before
designing.**

