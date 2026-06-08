# Slice 4a — Edit / Relocate / Delete a residence pin (design)

**Date:** 2026-06-05
**Status:** Approved in design; build plan next. No feature code until the plan is approved.
**Builds on:** Slice 1 (`2026-06-05-residential-globe-slice1.md`), phased per `memory/decision_step7_slice_phasing_2026-06-05.md`.
**Why now:** First real use immediately needed pin correction; edit/relocate/delete is the highest-value next slice.

---

## 1. The editing model (architectural decision)

Two distinct operations, deliberately separated:

- **Editing (correcting) the owner's own account.**
  - **Drafts:** edit `content_raw` freely in place (existing system rule).
  - **Finalized:** the **owner** may correct their own verbatim — direct edit (simple), but the system **auto-writes the prior `content_raw` into `memory_revisions`** before overwriting (non-destructive backstop for the rare "show me the original" case). No revision-management UI.
- **Enhancing over time** (new perspectives, invited contributors' comments, better facts) is **additive, not an edit** — new linked memories / contributions / Stroll reflections accrete around the original. Out of scope here; it's the contribution/Stroll/share model.

**Raw Vault amendment (to record in CLAUDE.md + memory):** `content_raw` is immutable to **agents and synthesis**; the **owner** may correct their own verbatim, and every finalized correction is silently revision-backed.

**Create change:** globe recollections are now created `is_draft=true` (editable until finalized), so the immediate correction need is met by plain draft editing.

## 2. Scope

**In (4a):** select an existing pin; edit name / when / recollection; relocate by dragging the selected pin; delete (two-click confirm).

**Deferred (4b):** insert-a-pin-then-choose-before/after sequence correction; returning-residence vs. intra-metro detection.

**Fast-follow (related, not bundled):** bring `/api/memory/[id]` PATCH in line with the owner-edit-revision policy so `/memories` finalized edits work too.

## 3. UI

- **Unselected pins are fixed** (panning never nudges them).
- **Click a pin** → it becomes draggable and a **right-side glass panel** opens (globe stays visible). The marker click stops propagation, so clicking empty globe still drops a *new* draft pin — edit vs. add stay distinct.
- **Panel** = the pin's card (also the Slice 2 detail view, pulled forward): editable **name**, **when**, **recollection** + actions **Save**, **Delete**.
- **Relocate:** drag the selected pin → panel shows "Moved — Save to keep" with the re-geocoded name; **Save** commits, **Cancel**/close reverts. No toggle.
- **Delete:** **hard delete** (no undo — decided for MVP; no soft-delete/retain). The confirm UX must make permanence explicit: first click reveals a clear warning ("Delete permanently — this can't be undone"), second click commits. Removes pin + recollection atomically; panel closes. (Lesson from losing a hard-deleted recollection: deletion must *announce* its permanence, even if we don't retain.)
- **Live:** count chip + arc update after any change; Esc cancels a pending relocation; closing deselects.

## 4. Data & API

Two atomic, PostGIS-safe RPCs with an internal ownership guard (`user_id = p_user_id`):

- **`update_residence_pin(relationship_id, user_id, lng, lat, name, place_subtype, country_code, when_text, body)`** — updates place entity (`canonical_name`, `place_subtype`, `country_code`, `geom` via `ST_MakePoint` when coords change), relationship `metadata.when_text`, and the recollection:
  - draft → update `content_raw` in place;
  - finalized → insert prior `content_raw` into `memory_revisions`, then update;
  - no memory + body provided → create memory + link;
  - body emptied + memory exists → remove that memory (pin stays).
- **`delete_residence_pin(relationship_id, user_id)`** — delete linked memories (cascades link), relationship, then place entity (only if no other relationship references it — forward-safe for 4b).

**Routes:** `app/api/globe/residence/[relationshipId]/route.ts` — `PATCH` (edit/relocate; reverse-geocode on coord change before the RPC) and `DELETE`. Auth via cookie client; ownership enforced in route and RPC.

**Create change:** `create_residence_pin` → `is_draft=true`.

**Build-time check:** confirm `memory_revisions` column shape so the backstop insert matches exactly.

## 5. Testing

`scripts/verify-globe-slice4.mjs` exercising: draft edit; finalized edit → revision row written + original preserved; relocate (geom moves, re-geocode); delete (rows gone, revision retained); with cleanup. Plus a clean production build and a live in-browser pass (edit + relocate + delete your real pins).

## 6. Out of scope

Insert-before/after, returning-residence/intra-metro detection (4b); images (Slice 2); AI extraction (Slice 2); place types (Slice 3); sidekick; the general `/api/memory` PATCH policy change (fast-follow).
