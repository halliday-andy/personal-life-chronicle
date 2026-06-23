# Designer Skills — Setup & Recommendation for Life Chronicle UX/UI work

**Date:** 2026-06-22
**Purpose:** Give Claude Code structured UI/UX design knowledge as we refine the globe, detail cards, Resume View, the Hopper, person entity pages, and capture-assistant flows (per `docs/plans/2026-06-22-globe-and-entity-ux-enhancements-design.md`).
**Source research:** `documentation/research/designer_skills_audit_report.pdf` ("Designer Skills Collection Audit," June 2026).

---

## What was added to the project (done)

48 skills vendored into **`.claude/skills/`** (auto-discovered by Claude Code), a curated subset of the MIT-licensed **Owl-Listener `designer-skills`** marketplace — the four plugins most relevant to *finalizing UI elements* and *transactional UX design*:

- **`ui-design`** (14) — visual language: grids, color, typography, spacing, visual hierarchy, dark mode, Gestalt laws.
- **`interaction-design`** (16) — the transactional layer: `form-design`, `state-machine`, `error-handling-ux`, `loading-states`, `feedback-patterns`, `onboarding-design`, `search-ux`, plus the cognitive laws (Hick's, Miller's, Fitts', Doherty).
- **`design-systems`** (11) — `component-spec`, `design-token`, `naming-convention`, `theming-system`, `motion-system`, `accessibility-audit`.
- **`visual-critique`** (7) — screen audits across 7 dimensions → prioritized fix lists, for iterating on existing UI.

See `.claude/skills/README.md` for the inventory and license/attribution.

### Why these four (and not the rest)

The audit's "minimum useful set" for most projects is `ui-design + interaction-design + visual-critique` plus one style preset. We added **`design-systems`** as well, because Andy's emphasis for the upcoming work is explicitly *finalizing the UI elements* (component specs/tokens) and *transactional design* (interaction-design). These four are the Tier-1 (visual) + Tier-2 (transactional) core. The Tier-3/4 process plugins were left out to avoid diluting the skill set with planning/ops knowledge not central to immediate UI/UX refinement — they're a one-command marketplace install away if a planning phase needs them.

---

## Recommended but NOT auto-applied: a TypeUI style preset

TypeUI ships 77 mutually-exclusive, **app-wide** visual presets (`npx typeui.sh pull <slug>`). Loading one defines the whole product's visual system, so picking it is a **brand decision for Andy**, not something to vendor silently — Life Chronicle already has an established look (dark "nocturne" globe on black; warm cream residence cards).

Candidates that fit the chronicle's emotional, content-first, memory-keeping tone:

| Preset | Fit for Life Chronicle |
|---|---|
| `refined` | Precise spacing, subtle contrast; calm and trustworthy. Strong default. |
| `editorial` / `publication` | Magazine/long-form typographic hierarchy — suits narrative recollections, period stories. |
| `elegant` | Graceful whitespace, delicate type; upscale, personal. |
| `cosmic` | Deep-space tones, luminous accents — visually echoes the glowing nocturne globe. |

Recommendation: try `refined` or `editorial` first for the reading surfaces; `cosmic` is worth a look specifically for globe-adjacent screens, but because presets are global, test before committing. Decision left to Andy.

---

## How to extend (for Claude Code / Andy)

Full collection **with slash-command workflows** (`/design-screen`, `/critique-screen`, `/map-states`, `/error-flow`, `/audit-system`, …):

```
/plugin marketplace add Owl-Listener/designer-skills
```

Companion repos worth knowing about (separate installs): `Owl-Listener/inclusive-design-skills` (accessibility), `Owl-Listener/ai-design-skills` (AI-native product patterns — relevant to the capture assistant).

TypeUI preset:

```
npx typeui.sh pull refined     # or editorial / elegant / cosmic
```

---

## Where things live

- Vendored skills: `.claude/skills/` (+ `README.md`, `LICENSE.designer-skills`)
- This setup doc: `documentation/designer_skills_setup.md`
- Source audit PDF: `documentation/research/designer_skills_audit_report.pdf`
- The UX brief these support: `docs/plans/2026-06-22-globe-and-entity-ux-enhancements-design.md`
