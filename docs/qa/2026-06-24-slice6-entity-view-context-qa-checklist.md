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
- [ ] A note can be **removed** by the owner (hover a note → Remove). *(In-place **edit** now built — see Phase 6.6.)*

## Phase 6.4 — /memories entity chips + globe link  ·  ◑ mostly built (`474915e`, `04d8acd`)
- [x] A recollection has an **editable detail** — `/memories` cards already have inline Edit (no longer only via globe → pin → Edit). *(Correction 2026-07-06: that Edit was drafts-only. FINAL memories gained revision-preserving Edit + entity-link editing in the owner-edit micro-slice — see `2026-07-06-memories-owner-edit-qa-checklist.md`.)*
- [ ] Each memory card shows **entity chips** below its text; clicking a chip opens that **Entity View** (the path to add context).
- [ ] A **globe pin's** detail card has an **"Open place page ↗"** link to its place's **Entity View**.
- [ ] "Add context" never appears on the recollection editing form (context is entity-scoped — it lives only on the Entity View).
- [ ] *(Deferred)* full-text **search** on /memories — not built yet.

## Phase 6.5 — context capture  ·  ✅ 6.5a built (`9e56a58`); 6.5b built 2026-07-05
**6.5a — attach research from the backlog (the dead-end fix):**
- [ ] On **/review**, a research card (`memory_elaboration_needed`, e.g. the Zaragoza write-up) now shows **"Attach as context…"** (not just Dismiss).
- [ ] Click it → search an entity (people / places / organizations) → pick one → the **full research attaches as a context note** on that entity (visible on its Entity View); a **source URL** in the text is auto-detected.
- [ ] Choose **Shareable** or **Private** before attaching (defaults shareable for background research).
- [ ] After attaching, the review item **resolves** (leaves the queue).

**6.5b — orchestrator auto-proposal  ·  ✅ built (2026-07-05)**
*(Backend `09cf680`, card UI `8f8d8c6`. Proofs: `verify-context-proposal-tool.mjs` — direct dispatch, 9/9 — and `verify-orchestrator-context-proposal.mjs` — a REAL orchestrator run that routed a research paste to propose_context_note only: no Raw Vault memory, no backlog row, nothing persisted before Accept.)*
- [ ] Paste a **research blob** (third-person background about a place/person you have) into the **capture assistant** (⌘K) → the reply proposes it as **context**, and a teal **"Context note"** card appears naming the entity — **no** draft-memory card, and nothing lands on /review.
- [ ] The card shows the note **rendered as markdown**, the **auto-detected source URL**, the visibility (defaults **shareable** for research), and the assistant's rationale. `[taste]` the card density.
- [ ] **Accept** → the note saves to that entity; "Open its page ↗" shows it on the Entity View.
- [ ] **Adjust** → re-pick the entity (typeahead), switch Private/Shareable, edit body/source; Accept then saves the adjusted version.
- [ ] **Decline** → the card dismisses and **nothing** was saved anywhere (Entity View unchanged).
- [ ] Name the entity vaguely (or one you don't have) → the card opens in **picker mode** ("about X — pick the entity below"); Accept is disabled until you choose.
- [ ] A **mixed** submission (a first-person recollection *plus* pasted background) yields BOTH a draft-memory card and a context card, each part routed to the right place.

## Phase 6.6 — context legibility, titles, in-place edit + globe surfacing  ·  ✅ built (2026-06-26)
*(Continued the 6.5b thread. Verified tsc + eslint; `deriveContextTitle` exercised against 11 cases. No component test harness in this project yet, so the UI items below are walk-through proofs.)*

**Markdown rendering of notes (`90aed81`)**
- [ ] A context note written with markdown (`## A heading`, `[label](url)`, `[1]` refs) renders **formatted** on the Entity View — headings styled, links collapsed to their labels — not as raw source. (Mirror of the review-card fix `409b8e2`.)

**Title convention + derivation (`e356815`)**
- [ ] The **Add context** form shows a greyed hint + heading-led placeholder nudging you to start with `## A short title`.
- [x] (proof) `deriveContextTitle()` returns the first markdown heading, else the first ~8 words of the first non-empty line, else "Untitled note" — the label used wherever a note has no title field.

**Edit a note in place (`6f27c90`)** — *(was deferred in 6.3)*
- [ ] Hover a note → **Edit** (beside Remove) opens an inline editor with the **same fields as Add** (body, source label/URL, Private/Shareable).
- [ ] Saving updates the note in place; **adding a `## title`** to a previously untitled note now gives it one.
- [ ] Switching a note's **visibility** in the editor moves it between the shareable and 🔒 private sections on save.
- [ ] **Cancel** discards changes cleanly — reopen Edit and the original text is back (no leakage between edits).
- [ ] Edit is **owner + entity scoped** server-side (a note can't be edited off another entity or across ownership → 404).

**Context on the globe pin card + count-chip disclosure (`b452302`)**
- [ ] Open a globe pin's detail card. The previously always-open lists ("More recollections here", "Anchored here") are now one compact **count-chip row** under the recollection, e.g. `N recollections · N context · N anchored`. `[taste]` the density vs. the old stacked lists.
- [ ] Tapping a chip **expands just that list** inline; tapping again collapses; opening another **closes the first** (single-open) — so the card stays short enough not to occlude its own pin on the globe.
- [ ] A **context** chip appears when the pin's place has context notes; its rows show each note's **derived title** (🔒 on private ones) and link to the place's Entity View.
- [ ] After editing a note's body to add a `## title` on the Entity View, that title is what the **context chip rows** show on the pin card.
- [ ] Switching to another pin **resets** which chip is open.
- [ ] A pin with no recollections / context / anchored shows **no chip row** (just the recollection + photo).

---

## Notes / deferrals
- **Synthesized entity biography** (the derived `syntheses.type='entity_biography'` over these notes) is **out of scope** here — these are the raw source notes.
- **RLS** on `entity_context_notes` lands with the Step 13 Access Cards activation, not here; ownership is enforced at the app layer for now (never exposed via any non-owner read).
