# Life Chronicle — Standing Instructions for Claude

This file is loaded automatically at the start of every Claude session in this workspace, regardless of which model is active. Its purpose is to ensure that critical protocols and architectural invariants survive model switches, session boundaries, and context resets.

For full project context, read `memory/MEMORY.md` (the index) and the individual memory files linked there. This file captures only what must be known without reading anything else.

---

## Critical Protocol: Dual-Write for Memory Files

**Every write, edit, or deletion of a memory file must be applied to BOTH locations:**

1. Auto-memory: `~/Library/Application Support/Claude/local-agent-mode-sessions/<session>/<env>/spaces/<space>/memory/`
2. Workspace mirror: `/Users/andyhalliday/Desktop/_LOCAL-DEV.nosync/Personal-Life-Chronicle/memory/`

Both folders must be identical after every change. The workspace mirror is git-tracked and is how Andy reviews decisions outside Claude sessions. If a write to the workspace mirror fails, surface the error rather than proceeding silently.

This protocol was established with Opus 4.7 in April 2026 after the mirror fell three files behind auto-memory without detection. See `memory/feedback_lc_memory_dual_write.md` for full rationale.

---

## Project Identity

**Life Chronicle / MemRec** — a personal memory collection and chronicle system. Users record memories through voice and text interviews; the system organizes them across 10 life dimensions, builds synthesis outputs (relationship portraits, period narratives, wisdom distillations), and presents them back through a navigable life journey.

Andy Halliday is the product owner, designer, and architect. He is building this as both a personal project and a commercial product.

---

## Architectural Invariants

These are decisions that have been made and should not be relitigated without Andy explicitly opening them:

**1. Raw Vault is immutable.** The `memories` table is append-only. `content_raw` is never modified after creation. All corrections go through `memory_revisions`. All synthesis is a derived layer, never merged back into source records.

**2. Platform is PostgreSQL + pgvector on Supabase.** No Neo4j, no separate vector store, no SurrealDB. Graph traversal via recursive CTEs on the existing schema. Revisit only if relationship graph exceeds ~500k edges per user.

**3. Privacy is Access Cards, not privacy_tier ENUM.** The five-tier ENUM is deprecated and scheduled for removal in the Access Cards migration. Do not add new code that depends on `privacy_tier` columns. New privacy work targets the cards/contacts/card_holders/record_card_grants tables. Canonical spec: `documentation/access_cards_requirements.md`.

**4. Ontology bootstrapping precedes memory collection — as parallel strands, not sequential stages.** Phase 0 is a **three-strand ontology bootstrap**: residential (temporal/geographic spine), entity (key people/institutions), and topic (life dimensions). The strands run in parallel; the user engages with whichever the capture assistant prompts next based on chronicle state. **There is no user-declared stage completion** — the system detects data thresholds and ships artifacts (Life Globe → Entity Portrait → Life's Players) without the user ever pressing a "done" button. Chapter naming is not a Phase 0 strand (removed 2026-04-30; chapter structure emerges from analysis once collection is rich enough). The dependency theory (residential is structurally prior to entity, which is structurally prior to topic) is enforced by the orchestrator's reasoning, not by UI sequencing. See `memory/project_lc_ontology_bootstrap.md` (canonical), `memory/project_lc_prd_readiness.md` Decision 3 (resolved + amended 2026-05-17), `documentation/feature_residential_globe_onboarding.md` (residential strand spec), and `documentation/feature_capture_assistant.md` (the orchestrating surface).

**5. Temporal Agent uses constraint graphs, not direct date entry.** Fuzzy memories accumulate an uncertainty envelope that narrows through relative constraints, never through asking for years directly. The residential spine is built first as the primary temporal scaffold.

**6. The Stroll (reminiscence mode) has three response pathways.** Pathway A: adjacent memory stub. Pathway B: reflection (feeds wisdom_distillation synthesis). Pathway C: memory revision (non-destructive, original preserved). Revisions layer over memories; synthesis agents must JOIN memory_revisions before rendering. See `documentation/feature_reminiscence_mode.md`.

---

## Key Documents

| Document | Location | Purpose |
|----------|----------|---------|
| Schema | `documentation/schema_v1.sql` | Full PostgreSQL schema |
| Architecture | `documentation/DB_Architecture_Design_v1.md` | Design rationale + next steps |
| Access Cards | `documentation/access_cards_requirements.md` | Privacy model canonical spec |
| Reminiscence | `documentation/feature_reminiscence_mode.md` | The Stroll feature spec |
| Memory index | `memory/MEMORY.md` | All project decisions indexed |
| Marketing | `documentation/Life_Chronicle_Market_Brief.md` | Positioning and messaging |

---

## Note for Future Claude Sessions

If you are reading this as a newly initialized session (perhaps with a different model than a prior session), the decisions above have been agreed with Andy and should be followed without re-litigating. If Andy explicitly asks to reconsider something, do so — but do not second-guess architectural choices just because you haven't seen the full prior conversation.

Read `memory/MEMORY.md` for the full decision index. Read individual memory files when you need full detail on a specific topic.
