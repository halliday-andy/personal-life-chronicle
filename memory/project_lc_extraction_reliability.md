---
name: Project: LC entity extraction reliability & the context-layer boundary
description: Orchestrator-created memories only get entities/dimensions if the model does its second tool-use turn; finalize now backfills. Research/3rd-person "context" yields no personal entities by design — associating it needs the context-layer feature, not extraction.
type: project
---

Established 2026-06-17 from a QA finding (Andy's "Sir William Wallace" context paste). Two related lessons about how memories acquire entity links and why "context" material doesn't auto-associate.

## Extraction is model-dependent — and finalize now guarantees it

Orchestrator-created memories (`metadata.created_by='orchestrator'`) only get `memory_entities` / `memory_dimensions` rows if the model performs its **second** tool-use turn (`extract_entities` / `classify_dimensions` with `persist=true`), per the orchestrator system prompt §3 + the tool-call sequencing rule. The model **sometimes skips that turn**, leaving a finalised memory with **zero entities** — no people/places extracted, no pin association — while the chat reply may still over-claim that it was "saved and associated."

**Fix (commit `7ef6b96`):** `POST /api/memory/[id]/finalize` now re-emits `memory/ingested` when the memory has **zero** `memory_entities`, so the async Entity + Tagger listeners run with `persist=true`. Gated on zero entities (the model-did-its-job path skips the extra LLM calls); the cores upsert with `onConflict`, so it's idempotent. Proof: `scripts/verify-finalize-extraction-backfill.mjs`.

**Repair pre-fix memories:** `node scripts/backfill-memory-extraction.mjs <memory_id>` (runs runEntity + runTagger, idempotent, content_raw untouched). The context-layer design doc §"Known gaps" already predicted this exact need ("entity extraction must be reliable… consider a backfill/repair sweep").

## "Context" ≠ recollection — association is a context-layer job, not extraction

Even with extraction guaranteed, third-person **research/genealogical** text yields **no personal entities by design**: the Entity sub-agent targets people/places *in the user's life*, so a historical figure like Sir William Wallace (13th century) is correctly NOT extracted, and if the pasted text never names the pin (Andy's text had 0 mentions of "castle"), there is nothing to link it to that pin anyway. The "+ Add context" box in the capture panel feeds `user_guidance` (model steering), **not** an entity link — so naming a pin there never created an association.

This is exactly what the **context layer** resolves: see [[project_lc_capture_assistant]] and the spec `docs/plans/2026-06-14-context-layer-and-recollection-surfaces-design.md` — context is a first-class content type attached to the **entity it is about** (new `entity_context_notes` table) via a **propose-and-confirm** "attach as context?" flow, reachable for places from the globe pin. Until that ships, associating context to a pin/entity must be done by hand (a `memory_entities` row, or the backfill script). The Wallace note was hand-linked to its castle place entity on 2026-06-17 as a one-off repair.

## Physical locations are places, not organizations (2026-06-17, the cause fix)

Andy challenged the deeper logic: a thing with a physical location the user
*was at* (a base, a school) is, for a memoir product, a **place** — only the
place row carries `geom` + the residence relationship and belongs on the globe.
The old extraction prompt did the opposite — it told the model to type named
institutions as `organization` ("since it's a named institution") and even
listed schools under organizations in the tool description — which is what
mis-typed Loring/Mather/Damon. **Rule now (commit `38017d8`): physical location
wins.** A named thing the user was in/at/lived/worked/studied/stationed/visited
is a `place` even when an institution shares the name; `organization` is reserved
for institutions experienced as membership/employment with no single site (an
employer, a military *command or unit* like SAC or the 69th Bomb Squadron, a
club). A base and the commands stationed on it are **different entities**. Proof:
`scripts/verify-entity-typing.mjs` (LLM eval — Loring/Damon → place, SAC → org,
person/town controls). The merge tolerance below stays as defense-in-depth for
residual model flips and already-mis-typed data; this prompt change removes the
cause. Decided via brainstorming with Andy (LLM-dialogue disambiguation is a
post-MVP nicety, not required).

## Place/organization are mergeable peers — and merge_entities() must agree (2026-06-17)

The `candidateTypes()` blur has a counterpart it must stay in sync with:
`merge_entities()`. Because resolution searches both `place` + `organization`,
it queues **cross-type** merge proposals (an extracted `organization` duplicate
of an existing `place` pin). The original `merge_entities()` (migration
`20260528222311`) hard-rejected **every** cross-type merge, so those proposals
dead-ended in the UI with *"cannot merge entities of different types:
organization vs place."* Andy hit this in QA merging an extracted "Loring Air
Force Base" (organization, from a recollection) into his "Loring AFB, Limestone
Maine" globe pin (place).

**Fix (migration `20260617130000`, `CREATE OR REPLACE`, commit `8c910e2`):** a
merge is permitted when **both** entities are within `{place, organization}`;
the hard guard stays for every other cross-type pair. The **place is always the
survivor** — the function swaps source/target if needed — because only the place
row carries the globe identity columns (`geom`, `place_subtype`, `country_code`)
and the residence relationship; `merge_entities` never copies those, so the pin
must never be the deleted side. Proof: `scripts/verify-entity-merge-place-org.mjs`
(org→place keeps pin + aliases the org + repoints `memory_entities`; place→org
keeps the pin via swap; person/vehicle still rejected).

**Durable invariant:** the "mergeable peer types" set now lives in **two**
places — `candidateTypes()` (TS, `lib/agents/entity/core.ts`) and
`merge_entities()` (SQL) — with reciprocal keep-in-sync comments. Extend both
together or resolution will queue proposals the DB refuses to run. Also added
`scripts/db-query.mjs` (read-only SELECT helper for QA/debugging).

## Related capture fix — verbatim formatting (item 7)

Same QA pass: the orchestrator was flattening pasted markdown (stripping headings/bullets/line breaks and `[1,2]` citations) when writing `content_raw`. Fixed by an explicit verbatim-capture rule in invariant 1 of the system prompt (`SYSTEM_PROMPT_VERSION` → `2026-06-17.0`, commit `a6b39c5`), plus a shared markdown renderer for recollections (`components/Markdown.tsx`, commit `8e1d787`). content_raw stays verbatim under Raw Vault; rendering just honours its structure.
