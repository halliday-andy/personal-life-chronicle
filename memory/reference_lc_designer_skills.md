---
name: reference_lc_designer_skills
description: Designer/UX skills — now GLOBAL in ~/.claude-os/skills/ (moved 2026-07-07 from project .claude/skills); source audit PDF + TypeUI preset recommendation locations
metadata:
  type: reference
---

**Moved to global 2026-07-07:** the 48 skills now live in `~/.claude-os/skills/` (source of truth, symlinked into `~/.claude/skills/`), so every project — including CODEX Life Chronicle — inherits them. The PLC project copy at `.claude/skills/` was removed the same day (commit 35a4097) to avoid duplicate definitions. Attribution moved with them: `~/.claude-os/skills/LICENSE.designer-skills` + `README.designer-skills.md`. Manifest: `~/.claude-os/INVENTORY.md`.

Original vendoring context: to give Claude Code UX/UI design context for the globe/entity refinement work ([[project_lc_globe_entity_ux_brief]]), 48 skills were vendored 2026-06-22 into `.claude/skills/`. They are a curated subset of the MIT-licensed **Owl-Listener `designer-skills`** marketplace (https://github.com/Owl-Listener/designer-skills, © MC Dean):

- `ui-design` (14), `interaction-design` (16), `design-systems` (11), `visual-critique` (7) — flattened, no name collisions. Chosen for *UI-element finalization* (design-systems) + *transactional design* (interaction-design) per Andy's emphasis; Tier-1 visual + Tier-2 transactional core.

NOT vendored (deliberately): the slash-**commands** (live in the plugins — get them via `/plugin marketplace add Owl-Listener/designer-skills`), and the process/planning plugins (`design-research`, `ux-strategy`, `prototyping-testing`, `design-ops`, `designer-toolkit`).

**TypeUI** (77 mutually-exclusive, app-wide style presets via `npx typeui.sh pull <slug>`) was NOT applied — picking one is Andy's brand decision. Recommended candidates for the chronicle's tone: `refined` / `editorial` (reading surfaces), `cosmic` (globe-adjacent, echoes the nocturne globe).

Locations:
- Vendored skills + attribution: `~/.claude-os/skills/` (`README.designer-skills.md`, `LICENSE.designer-skills`) — global since 2026-07-07
- Setup/recommendation doc: `documentation/designer_skills_setup.md`
- Source research: `documentation/research/designer_skills_audit_report.pdf` ("Designer Skills Collection Audit," June 2026; covers Owl-Listener + TypeUI, 4-tier classification, transactional-flow + Nielsen-heuristic matrices)

Note: this Cowork session cannot install Claude Code plugins or run `/plugin`; the skills were physically vendored so Claude Code picks them up with no further action. Full marketplace (with commands) is one command away if needed.
