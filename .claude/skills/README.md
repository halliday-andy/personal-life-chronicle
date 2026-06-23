# Project skills — designer/UX context for Claude Code

These skills are auto-discovered by Claude Code from `.claude/skills/*/SKILL.md` and give it
structured UI/UX design knowledge while we refine the Life Chronicle interface (globe, detail
cards, Resume View, the Hopper, person entity pages, capture-assistant flows).

## What's here (48 skills, vendored 2026-06-22)

Curated subset of the **Owl-Listener `designer-skills`** marketplace (MIT, (c) MC Dean) — the four
plugins most relevant to finalizing UI elements and transactional UX:

| Source plugin | Skills | Why it's here |
|---|---|---|
| `ui-design` | 14 | Visual language: grids, color, type, spacing, hierarchy, dark mode, Gestalt laws |
| `interaction-design` | 16 | Transactional/flow logic: forms, state machines, error/loading/feedback, onboarding, search; Hick's/Miller's/Fitts'/Doherty |
| `design-systems` | 11 | Finalizing UI elements: component specs, tokens, naming, theming, motion, a11y |
| `visual-critique` | 7 | Auditing existing screens -> prioritized fix lists (iteration loops) |

Skills were flattened into this folder (no name collisions). Each is a self-contained `SKILL.md`.

## Not vendored (deliberately)

- Commands (slash-workflows like `/critique-screen`, `/design-screen`) live in the plugins, not in
  plain project skills. To get them, install the full marketplace (below).
- Process/planning plugins (`design-research`, `ux-strategy`, `prototyping-testing`, `design-ops`,
  `designer-toolkit`) — useful in planning phases; add via the marketplace if/when needed.
- TypeUI style preset — a single, mutually-exclusive, app-wide visual system. Choosing one is a
  brand decision (see `documentation/designer_skills_setup.md`); not auto-applied.

## Getting the full collection (with commands)

    /plugin marketplace add Owl-Listener/designer-skills

Then enable the plugins you want. See `documentation/designer_skills_setup.md` for the full
recommendation, TypeUI preset candidates, and the source audit in
`documentation/research/designer_skills_audit_report.pdf`.

## License / attribution

Owl-Listener `designer-skills` — MIT License, (c) 2026 MC Dean
(https://github.com/Owl-Listener/designer-skills). Full text: `LICENSE.designer-skills`.
