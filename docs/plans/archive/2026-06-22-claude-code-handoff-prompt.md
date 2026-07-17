# Claude Code handoff prompt — Globe & Entity UX enhancements

*Copy everything below the line into Claude Code at the start of a session in this repo.*

---

We have a new set of UX/UI enhancements to design and build for the Life Chronicle globe and relationship-entity interfaces. A Cowork session (Opus 4.8 + Andy) produced an agreed design brief and also added designer/UX skills to the repo for you to use. Your job is to **review and refine the brief, then fit it into the build plan in the most correct and efficient way** — including the schema/migration calls and the slice sequencing. The brief is agreed product intent, **not** frozen implementation: you are explicitly invited to push back and improve it, especially on finalizing the UI elements and the transactional (interaction) design.

## 1. Familiarize yourself first (read in this order)

- `CLAUDE.md` — standing protocols and architectural invariants (auto-loaded; re-read the invariants).
- `memory/MEMORY.md` — decision index. Then the two new memories:
  - `memory/project_lc_globe_entity_ux_brief.md` — the 7-item brief at a glance + its **review-pending** status.
  - `memory/reference_lc_designer_skills.md` — what designer skills were added and why.
- `docs/plans/2026-06-22-globe-and-entity-ux-enhancements-design.md` — **the canonical brief.** Full intent, decisions, and the "Open items for Claude Code to resolve" list. This is the document to refine.
- `docs/plans/2026-06-12-globe-place-types-design.md` — Slice 3 (six place types + three-tier line hierarchy + Model A anchoring). Items 1–3 of the new brief are extensions of this; read it so you can decide what folds into Slice 3 vs. lands as a fast-follow.
- `memory/decision_step7_slice_phasing_2026-06-05.md` — current Step 7 slice state (Slices 1/2/4a/4b shipped; Slice 3 next).

## 2. Use the new designer skills

48 UX/UI skills are vendored in **`.claude/skills/`** (auto-discovered), a curated subset of Owl-Listener `designer-skills`: `ui-design`, `interaction-design`, `design-systems`, `visual-critique`. Apply them as you design:
- **`interaction-design`** (`form-design`, `state-machine`, `error-handling-ux`, `loading-states`, `feedback-patterns`, `onboarding-design`, `search-ux`, Hick's/Miller's/Fitts'/Doherty) → the **transactional design** of the active-lines tray, hover/click/persist states, the Hopper capture loop, and capture-assistant interview flows.
- **`design-systems`** (`component-spec`, `design-token`, `theming-system`, `motion-system`, `naming-convention`, `accessibility-audit`) → **finalizing the UI elements** (pin chips, origin pin, tray chips, Resume View cards, person page).
- **`ui-design`** + **`visual-critique`** → visual language for the nocturne globe and a fix-list pass on existing screens.
- Setup notes, the marketplace install for the full collection (incl. slash-commands), and the **TypeUI style-preset recommendation** (a brand decision still pending Andy's call): `documentation/designer_skills_setup.md`. Source research: `documentation/research/designer_skills_audit_report.pdf`.

## 3. What to produce

1. A **review of the brief** — agreements, and any refinements/pushback (call out anything that conflicts with the invariants or the shipped globe code; verify claims against current code, don't assume).
2. **Resolution of the open architecture items** in the brief:
   - Item 1: does a short place "placard" field already exist, or add one?
   - Item 5 (Hopper): stub storage vs. **Raw Vault immutability (invariant #1)** — draft-status `memories` vs. a separate `memory_stubs` table; the promote/consume-on-expansion path; host-agnostic design across **pin** and **person** entities.
   - Item 6 (Person page): chronological ordering basis (first-mention vs. relationship start); the "promote to Life's Cast" flag; open/private commentary via **Access Cards (invariant #3)**, not `privacy_tier`.
   - Items 1–3: how much folds into **Slice 3** vs. a fast-follow.
3. An **updated slice sequencing** that slots all 7 items into the Step 7 plan (the brief proposes 1–3 first → 4+5 → 6 → 7 parked; refine as you see fit), with **acceptance criteria** per slice.
4. Any **migrations** proposed (e.g. placard column, hopper table, anchor/promotion columns) — show the DDL and its verify proof. **Respect the Migration Safety Checkpoint**: additive/reversible changes can be applied; anything that alters/drops existing data STOPS for Andy's approval.

## 4. Protocols to honor

- **Dual-write** every memory change (auto-memory + `memory/` mirror) and update `MEMORY.md`.
- **Don't relitigate** architectural invariants (Raw Vault append-only; primary-residence spine as the temporal scaffold #5; Postgres+pgvector; Access Cards privacy) unless Andy opens them.
- Lowercase file/folder names; never `npm run build` while `next dev` is live; `origin/main` is a continuous backup (auto-push hook is wired).
- **Vertical Moments (brief item 7) is parked** — capture only, no work until Andy supplies examples.

## 5. Housekeeping note

The Cowork session left new files **untracked/modified** (didn't commit). Before committing, decide `.gitignore` treatment for the vendored `.claude/skills/` (~48 third-party MIT files) and for `.claude/settings.local.json`.
