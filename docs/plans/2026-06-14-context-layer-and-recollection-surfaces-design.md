# Context Layer & the Recollection → Entity Journey

**Date:** 2026-06-14
**Status:** Design validated with Andy in a working session. Resolves the forward UX journey for **non-recollection context** and the **recollection editing/navigation surfaces** it depends on, so current development can build toward it. Implementation phasing is TBD; this is the spec.

---

## What this resolves

Andy hit a dead-end: research he pasted (the Zaragoza / Operation Reflex writeup) was correctly recognized as *context, not a recollection*, but had nowhere to go — it landed in the review backlog as a Dismiss-only card. The root cause is that the system had one mature content type (recollections / Raw Vault) and no home for the others. This design defines **context** as a content type and the surfaces/journey around it.

## The content model

Two distinct kinds of user content, kept architecturally separate:

1. **Recollections** — first-person memories. The **Raw Vault** (`memories`), verbatim and immutable once finalized. The interviewee's quotes.
2. **Context** — third-person background/research that makes recollections legible ("here's the narrator's quote about X, and here are interesting things about X"). **Attached to the entity it is about**, never standalone.

**Relationship:** context attaches to **entities**; a recollection *inherits* the relevant context through the entities it references (`memory_entities`). Context is never attached directly to a recollection. Write the background once on the entity, and it frames *every* quote that touches that entity — reusable and clean.

**Any entity type** can carry context — not just places. People, organizations, `event_series` (e.g. a concert series the user attended), vehicles, artifacts. (`entity_biography` is already keyed to any entity.)

## Context data model (decision: B — many notes per entity)

Each entity accumulates **many context notes** — a footnotes/bibliography platform — nothing is overwritten:

- A context note has: `entity_id`, `body` (the text), optional **`source_label` + `source_url`** (the Zaragoza paste carried a Gemini URL — notes act as real citations later), `created_by` (`owner` | `assistant`), `created_at`.
- **Schema check at build time:** confirm whether `entity_biography` is one-row-per-entity or many; if one-row, add a dedicated `entity_context_notes` table (many per entity). Do not force a single curated "about" — that's lossy (a second paste would fight the first).
- **Deferred:** a *synthesized* biography/precis derived from notes + recollections. It will *draw from* context notes (not be limited to them) when we build the compilation/presentation step. Mirrors the recollection→synthesis pattern. Out of scope here.

## Capture flow (decision: propose-and-confirm)

The assistant classifies a paste and **proposes**, the user confirms — the system's standard draft pattern, and precisely what was missing when Zaragoza dead-ended:

1. Assistant interprets: (a) *this is context, not a recollection*, and (b) *it is about entity X* (identified from the text).
2. It proposes a card: **"This looks like background about [Zaragoza Air Base] — attach it as context there?"** with **Accept** (attach) / **Adjust** (pick a different/another entity) / **Decline**.
3. On Accept, the note attaches to the entity. The current Dismiss-only backlog card for `memory_elaboration_needed` is **replaced** by this attachment proposal.

Not fully automatic (user keeps control of the association); not pure manual (the assistant does the recognition and entity-matching).

## Surfaces & navigation

- **Entity View (the home for context).** A per-entity page showing: the entity's **context notes** (with sources), the **recollections that mention it**, and an **"Add context"** action (paste/type a note + optional source). For place entities this is reachable from the globe pin; for all entities from `/entities`.
- **`/memories` — searchable, editable recollection home (companion requirement).** Today a recollection is only editable via globe → detail card → Edit (too deep). `/memories` must become the primary searchable list with an **editable recollection detail**. On that detail (the read view, not the edit form) the recollection's **entity chips** appear and **link to each entity's View** — the navigation path to "add context" when needed.
- **Recollection editing stays pure.** No "add context" on the editing form. Context is entity-scoped; you navigate to the entity to add it.
- **Globe.** A place pin's detail card links through to that place's Entity View (where its context lives), unifying the globe with the entity/context surfaces.

## Known gaps / to-dos surfaced by this session

- **RAF Mildenhall has no extraction** (`globe_extraction=false`) → no fact chips, and its entities may be unextracted. Likely an Inngest-down event loss. Re-trigger `globe/pin.saved` for it. **Broader:** entity extraction must be reliable for the chip→entity navigation to work; consider a backfill/repair sweep for pins/memories missing extraction.
- **`entity_biography` cardinality** must be confirmed before building the notes store.
- **`/memories` actions** — it is currently read-only bare-bones; making it the editable, searchable home is a prerequisite workstream for this journey.

## Alignment guidance for current development

Build *toward* this even before the context layer ships:
1. Keep recollections entity-linked and ensure extraction reliability (the chips are the connective tissue).
2. When building `/memories` actions, design the detail view with **entity chips that link to an Entity View** (even a thin one first).
3. Treat the backlog `memory_elaboration_needed` card as a **temporary** stand-in for the future attachment proposal — don't over-invest in it.
4. Keep context strictly out of the Raw Vault and out of recollection editing.

## Cross-references
- `docs/plans/2026-06-14-interview-dialogue-to-recollections-design.md` (sibling: the journalist/synthesis layer).
- Invariants #1 (Raw Vault), #6 (revisions/synthesis) — project `CLAUDE.md`.
- `project_lc_shareable_artifacts.md`, `project_lc_access_cards.md` (publication + privacy, downstream).
