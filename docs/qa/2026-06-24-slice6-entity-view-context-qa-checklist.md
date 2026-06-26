# QA Walkthrough — Slice 6: Entity View + context substrate

**Living document** — updated as each phase lands. App: **http://localhost:3001** (sign in first).

> Slice 6 builds the [2026-06-14 context-layer design](../plans/2026-06-14-context-layer-and-recollection-surfaces-design.md):
> a per-entity **Entity View** that is the home for **context notes** (third-person
> background, distinct from first-person recollections), an editable/searchable
> **/memories**, and entity chips linking the two. It also clears the recurring
> "research has nowhere to go" dead-end (Zaragoza, RAF Mildenhall).

> **Status legend:** ✅ built (ready to proof) · ⏳ in progress · ⬜ not started yet.
> `[taste]` marks subjective calls.

> Architecture invariants in play: context is **never** in the Raw Vault (#1);
> private notes never surface in any non-owner/published path; privacy ultimately
> routes through Access Cards (#3) — app-layer ownership for now, RLS at Step 13.

---

## Phase 6.1 — context-notes data layer + merge repoint  ·  ✅ built (`8dbbcd0`)
*(Mostly invisible; proven by `scripts/verify-entity-context-notes.mjs`. Behaviour you can check once the UI lands.)*
- [x] (proof) `entity_context_notes` table exists; a note can be created, read, and listed for an entity.
- [x] (proof) Merging two entities **repoints** their context notes onto the survivor — no notes orphaned or lost (the bug the design flagged).

## Phase 6.2 — Entity View page  ·  ✅ built (`6ab7481`)
- [ ] From **/entities**, each entity row has an **"Open ↗"** link to its **Entity View** (`/entities/<id>`).
- [ ] The Entity View shows the entity's **name + type** (+ aliases/description), its **context notes**, and the **recollections that mention it** (as links to /memories, not hosted here).
- [ ] **Private** notes render in a visually distinct, clearly owner-only section (amber, 🔒), separate from shareable ones. `[taste]` the separation.
- [ ] Works for **any** entity type (person, place, organization, …), not just places.

## Phase 6.3 — Add context  ·  ✅ built (`6ab7481`)
- [ ] An **"Add context"** action on the Entity View takes a note **body**, an optional **source label + URL**, and a **Private / Shareable** choice.
- [ ] Saving adds the note; it appears immediately under the right section (private vs shareable).
- [ ] Notes accumulate (many per entity — a footnotes/bibliography model); nothing is overwritten.
- [ ] A note can be **removed** by the owner (hover a note → Remove). *(In-place edit deferred — remove + re-add for now.)*

## Phase 6.4 — /memories entity chips + globe link  ·  ◑ mostly built (`474915e`, `04d8acd`)
- [x] A recollection has an **editable detail** — `/memories` cards already have inline Edit (no longer only via globe → pin → Edit).
- [ ] Each memory card shows **entity chips** below its text; clicking a chip opens that **Entity View** (the path to add context).
- [ ] A **globe pin's** detail card has an **"Open place page ↗"** link to its place's **Entity View**.
- [ ] "Add context" never appears on the recollection editing form (context is entity-scoped — it lives only on the Entity View).
- [ ] *(Deferred)* full-text **search** on /memories — not built yet.

## Phase 6.5 — context capture  ·  ◑ 6.5a built (`9e56a58`); 6.5b (orchestrator auto-proposal) pending
**6.5a — attach research from the backlog (the dead-end fix):**
- [ ] On **/review**, a research card (`memory_elaboration_needed`, e.g. the Zaragoza write-up) now shows **"Attach as context…"** (not just Dismiss).
- [ ] Click it → search an entity (people / places / organizations) → pick one → the **full research attaches as a context note** on that entity (visible on its Entity View); a **source URL** in the text is auto-detected.
- [ ] Choose **Shareable** or **Private** before attaching (defaults shareable for background research).
- [ ] After attaching, the review item **resolves** (leaves the queue).

**6.5b — orchestrator auto-proposal (pending):**
- [ ] *(not built)* Pasting research into the capture assistant is **proposed** as context on an identified entity, with **Accept / Adjust / Decline** + source pre-fill — so it never reaches the backlog in the first place.

---

## Notes / deferrals
- **Synthesized entity biography** (the derived `syntheses.type='entity_biography'` over these notes) is **out of scope** here — these are the raw source notes.
- **RLS** on `entity_context_notes` lands with the Step 13 Access Cards activation, not here; ownership is enforced at the app layer for now (never exposed via any non-owner read).
