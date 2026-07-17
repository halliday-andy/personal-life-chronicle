> **ARCHIVED 2026-07-17** — Slice list EXHAUSTED 2026-07-07 (all built). Parked items (pin-visual redesign, Vertical Moments, /memories search) re-homed in `../2026-07-17-spine-and-share-roadmap.md` §5.

# Globe & Entity UX — Revised Slice Roadmap

**Date:** 2026-06-22
**Author:** Claude Code (Opus 4.8), reviewing the [2026-06-22 design brief](2026-06-22-globe-and-entity-ux-enhancements-design.md) against build state.
**Status:** Reviewed and resequenced. Andy's sequencing calls captured (2026-06-22): (1) pull the Entity-View/context substrate forward; (2) Resume View near-term after globe legibility; (3) defer the TypeUI brand preset — keep current nocturne styling.
**Supersedes:** the "Recommended sequencing" section of the brief.

---

## 1. Brief review — agreements, corrections, and pushback

The 7-item brief is sound product intent. This roadmap accepts it with the following resolutions verified against current code/schema.

### Agreements (no change)
- **Item 2 (origin pin)** — purely presentational; keys off `sort_order` position #1; no schema change. Accepted as written.
- **Item 3 (line declutter)** — the active-lines tray + Clear-all is the right model and supersedes the "toggle off then navigate away" idea. Accepted; split into static vs. dynamic (below).
- **Item 7 (Vertical Moments)** — parked, capture-only. Accepted.

### Corrections (verified against the repo)
1. **Item 1 placard — the field already exists.** `entities.description TEXT` is in the initial schema and currently unused for places. The placard ("one-line description of the location") is about the *place*, so it lands in `entities.description`. **No migration needed.** (A per-*stint* note would be relationship-level — `relationships.notes` exists too — but the brief's intent is per-place, so `description` is the home.)
2. **Item 1 year chip — the "1971–75" format presupposes structured dates we don't capture.** The globe flow stores a *free-text* `when` phrase ("1959 to 1960", "early 70s"), not structured years. `relationships.started_at/ended_at DATE` columns exist but the globe onboarding deliberately leaves them null (temporal work is deferred to the Temporal Agent, invariant #5). **MVP renders the `when` phrase as-is** in the chip; clean year-range normalization waits for either a lightweight best-effort parse or the Temporal Agent. Do not promise `1971–75` formatting for MVP — promise "the `when` phrase, glanceable on the globe."
3. **Item 6 (Person page) is NOT greenfield — it is the person-specialization of the already-designed [context-layer / Entity-View design (2026-06-14)](2026-06-14-context-layer-and-recollection-surfaces-design.md).** Verified: `entity_context_notes` is **not built**, there is **no per-entity Entity View page** (only the `/entities` management list), and `/memories` is read-only. That earlier design already specifies item 6's hard parts — open/private commentary (`entity_context_notes.visibility = shareable|private`, with "sensitive notes on a person" named as the canonical case), the mentions-aggregator + entity chips, and editable `/memories`. **Building the general Entity View substrate first gives item 6 cheaply and clears the context dead-end (Zaragoza, RAF Mildenhall) that keeps recurring.** This is the central resequencing decision (Andy: pull forward).
4. **`lifes_cast` already exists as a `synthesis_type` ENUM value** — Life's Cast is modeled as a synthesis (curated roster). The Person page's "promote to Life's Cast" act is still a net-new *entity-level* flag, but the roster concept is not new.

### Pushback / architecture calls
- **Item 5 (Hopper) → a dedicated `memory_stubs` table, not draft `memories`.** Checkable/deletable throwaway stubs in the Raw Vault fight invariant #1 (append-only + finalize/revision lifecycle). A lightweight host-agnostic table (`host_entity_id` FK → works for both a pin's place entity and a person entity) gives check-off/consumption cleanly; "promotion" = the assistant seeds a real recollection from the stub, then marks the stub consumed. The brief explicitly requires no provenance link, which makes the clean separation free.
- **Items 1–3 fold into the Slice-3 region but split by risk.** Items 1, 2, and the *static* parts of 3 (default-spine, type filters, hover preview) share the existing pin/arc/selector renderer → fold into the Slice 3 close-out. Item 3's *active-lines tray* is a genuinely new stateful interaction → its own micro-slice (3.5) with its own acceptance criteria, even though it lives in the same bottom-left region.

---

## 2. Open architecture items — resolved

| Item | Question | Resolution |
|---|---|---|
| 1 | Placard field exists? | **Yes** — reuse `entities.description`. No migration. |
| 1 | Year chip format | MVP renders the free-text `when` phrase; structured `1971–75` deferred to Temporal Agent. |
| 5 | Stub storage vs Raw Vault | **New `memory_stubs` table** (host-agnostic, `status open\|consumed`). Keeps the vault append-only. |
| 6 | Person page substrate | **The Entity View from the 2026-06-14 design**, specialized for persons. Build the general substrate first. |
| 6 | Open/private commentary | `entity_context_notes.visibility` (`shareable`\|`private`). App-layer ownership now; RLS at Step 13 Access Cards (per the 2026-06-14 RLS-timing decision). Honors invariant #3. |
| 6 | Chronological ordering basis | MVP: order by the memory's temporal anchor where present, else `created_at` (first-mention). Relationship-start ordering waits for the Temporal Agent. |
| 6 | "Promote to Life's Cast" flag | Net-new additive entity flag — `entities.metadata.in_lifes_cast` (boolean) for MVP, promotable to a real column if it earns querying. Promotion is a deliberate user act; no auto-population. |
| 6 | Person-anchored recollection w/o pin | Already supported by the schema — a `memories` row linked via `memory_entities` to the person, no location entity. New *capture path*, not a new table. |

---

## 3. Migrations proposed (all additive / reversible — no safety-gate stop)

All conform to repo conventions: `gen_random_uuid()`, `user_id UUID NOT NULL` with no `auth.users` FK, `SET search_path TO public, extensions`. Each ships with a relative-only, self-cleaning `verify-*.mjs` proof and is shown before apply.

**M1 — `entity_context_notes`** (from the 2026-06-14 design, built now):
```sql
CREATE TABLE entity_context_notes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL,
    entity_id    UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    body         TEXT NOT NULL,
    source_label TEXT,
    source_url   TEXT,
    created_by   TEXT NOT NULL CHECK (created_by IN ('owner','assistant')),
    visibility   TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('shareable','private')),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_entity_context_notes_lookup ON entity_context_notes(user_id, entity_id, visibility);
```
+ **`merge_entities()` must repoint `entity_context_notes.entity_id`** (source→target) or notes orphan on merge. This is a change to an existing function — show + verify, but it's a `CREATE OR REPLACE` of logic (no data rewrite), so additive.

**M2 — `memory_stubs`** (the Hopper):
```sql
CREATE TABLE memory_stubs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL,
    host_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    body           TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','consumed')),
    created_by     TEXT NOT NULL CHECK (created_by IN ('owner','assistant')),
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    consumed_at    TIMESTAMPTZ
);
CREATE INDEX idx_memory_stubs_host ON memory_stubs(user_id, host_entity_id, status);
```
Host-agnostic: `host_entity_id` points at the pin's place entity **or** a person entity — one table, one component, two hosts. `merge_entities()` repoints `host_entity_id` too.

**M3 — Life's Cast promotion flag:** no DDL for MVP — `entities.metadata.in_lifes_cast` boolean. (Promote to a real column only if list queries need it.)

**M4 — "Log" pin type + generalized anchoring (Slice 3.6, Phase-5 finding 3):** two new `relationship_types` rows (`logged_at` + inverse); replace `validate_residence_anchor()` with `validate_pin_anchor()` (anchor must be any of the user's own globe pins, not only `lived_at`) — `CREATE OR REPLACE`, loosens a check, **no data rewrite**; `create`/`update_residence_pin` call the generalized helper and gain `logged_at` in their valid-type list; `get_residence_pins` widens to include the new type. Finding 2's `metadata.prior_anchor_residence_id` round-trip restore is metadata-only (no DDL). All additive/reversible — no safety-gate stop.

No new columns for items 1, 2, 4 or Resume View (placard reuses `description`; chips/tray/origin/refine-button/Resume are rendering + metadata).

---

## 3a. Phase-5 proof findings (Andy, 2026-06-22) — reshaping the globe-legibility track

Andy ran the six-type live proof and surfaced five items. Verified against code:

1. **Drag-refine is gated to edit mode** (`GlobeView.tsx:423`, `draggable only while editing`) → refining a placed pin requires click → Edit → drag, which reads as "no way to refine on the globe surface." **Resolution:** add a **"Refine location"** action on the detail card that arms dragging without opening the full edit panel (Andy's choice — deliberate, no accidental moves). True auto-declutter / spiderfy of overlapping markers is **deferred to Slice 5**.
2. **Re-type round-trip loses the anchor/tether (bug).** marker→primary→marker drops the anchor: `validate_residence_anchor()` clears it on the primary leg, and nothing remembers it on revert, so the picker falls to "not sure/standalone" and no tether redraws. **Resolution:** stash the prior anchor in `relationships.metadata.prior_anchor_residence_id` on re-type-to-primary; restore it (and the tether) on revert; default the picker to the temporally-nearest primary when no stash exists. Additive (metadata only).
3. **New neutral pin type — "Log"** (MVP trial label; candidate names parked: Waypoint / Relic / Capture / Log — "a log entry in the journal of life"). A place marked purely because something memorable happened there, making no category claim. Two capabilities: (a) the new type, and (b) **generalized anchoring** — a marker may associate with **any** of the user's own globe pins (primary *or* marker, incl. a vacation), enabling "places visited around a vacation destination." Plus **recollection roll-up**: a pin's detail card includes recollections from pins anchored to it. → its own micro-slice (3.6).
4. **Orphan-on-retype test** — Andy defers until the Log type exists (the "standalone" landing state should resolve into a Log association). Blocked on 3.6, agreed.
5. **Workplace icon overwhelms the primary residence at zoom-out** (Queenstown / Coronet Peak Ski School screenshot). Visual hierarchy is inverted — the primary residence should dominate. **Deferred to the pin-visual redesign** (coloration / iconography / type styling pass), per Andy. Captured in §4 "Deferred."

These items live entirely in the pin/anchor/type code region (not the entity/context substrate), so they extend the globe-legibility track: items 2 + (1) fold into the Slice 3 close-out; item 3 becomes Slice 3.6; item 5 parks to the visual redesign.

## 4. The revised slice roadmap

Numbering continues the Step-7 slice line. Build directly on `main` (project convention); each phase commits atomically; `tsc + eslint` gate every commit; Andy proofs live.

### Slice 3 — close-out (globe legibility, static)  ·  ✅ BUILT 2026-06-23 (awaits Andy's live batch-proof)
Shipped in 7 atomic commits (`12a3392`…`a9183ce`): finding 2 backend+frontend, finding 1 refine button, item 1 placard (persistence + chip/hover render), item 2 origin pin, item 3 default-spine + hover preview, chevron enlarge + tether contrast. **Type filters moved to Slice 3.5** (they live in the bottom-left selector with the tray, per the brief's grouping). Folds in brief items 1, 2, the static half of 3, **plus Phase-5 findings 1 (refine button) and 2 (re-type anchor restore)** alongside the place-types proof.
**Includes:** per-pin `when`-phrase chip (item 1); hover card = name + `description` placard (item 1); enlarged directional chevrons (item 1); origin-pin treatment for `sort_order` #1 (item 2); default-view = spine only + hover-preview of a pin's side lines + class-level type filters in the bottom-left selector (item 3 static); the coloration/contrast fix so tethers read distinct from the spine glow; **"Refine location" detail-card action** (finding 1); **re-type anchor/tether restore** via `metadata.prior_anchor_residence_id` (finding 2).
**Acceptance:**
- Every pin shows its `when` phrase without interaction; current/open residence reads "…–now".
- Hover reveals name + placard; placard is editable on the edit panel and persists to `entities.description`.
- Pin #1 is visibly the origin (larger, calm treatment) and shows its start phrase.
- Default globe shows only the `lived_at` spine; hovering a pin previews its tethers; mouse-out clears them.
- Type filters in the bottom-left selector show/hide whole classes (Workplaces, Vacations, …).
- "Refine location" arms drag on a selected pin without the full edit panel; an inspecting click never moves a pin.
- marker→primary→marker round-trips losslessly: the original anchor and dashed tether are restored, not orphaned to standalone.
- All six place types + 3 line tiers proof-checked live (the held Phase 5). `tsc + eslint` clean.

### Slice 3.5 — line visibility (item 3, dynamic)  ·  ✅ BUILT 2026-06-23 (`87ffe44`); REWORKED 2026-06-24 (`cfa7202`)
**Reworked after QA (Andy 2026-06-24):** the active-lines tray + per-pin "Side lines on/off" were **removed** — their OR-logic created an on-can't-be-overridden conflict and a bug (selecting a pin auto-added it to the tray, so "off" did nothing). New model: **line visibility is global only** — per-class filters in Legend & filters, plus a **"Side lines in view"** toggle that reveals on-screen pins' side lines but only past a regional zoom (`LINES_IN_VIEW_MIN_ZOOM`), so the world view stays clean; hover remains a transient peek. Decouples "reveal lines" from "open card" (which obscured the map). The original tray build is below for history. Apply `interaction-design` skills (`state-machine`, `feedback-patterns`, Fitts'/Hick's for the bottom-left cluster). **Now also owns the class-level type filters** (moved here from Slice 3 — they share the bottom-left selector region and the line-visibility state, per the brief).
**Acceptance:**
- Click a pin → its tether set persists + a dismissible chip appears in the tray docked with the type selector.
- Each chip ✕ removes just that set; Clear-all resets to the bare spine.
- Selecting a *different* pin and adding its set leaves prior sets intact (multi-pin compare).
- The detail-card "keep side lines" toggle is a shortcut into the same tray state (not a parallel mechanism); default on click = lines ON for the clicked pin.
- Type filters (in the bottom-left selector) set the baseline of what's shown; per-pin chips add on top. State survives detail-card changes (no orphaned sets).

### Slice 3.6 — the "Log" pin: generalized anchoring + recollection roll-up  ·  ✅ BUILT 2026-06-23 (`3219462`/`3650151`/`f19b39d`)
A seventh, category-neutral pin type plus the anchor-model generalization it needs. Shipped as 3.6a (backend: `logged_at` type + `validate_pin_anchor` + RPCs), 3.6b (frontend: pin-types entry, CSS, any-pin anchor picker), 3.6c (recollection roll-up + route allowlists). Unblocks Phase-5 finding 4 (orphan-on-retype can now resolve into a Log association).
**Includes:**
- **New type** — code working-name `logged_at` (+ inverse), label **"Log"** (MVP trial; rename is a one-line change in `lib/globe/pin-types.ts` — candidates Waypoint / Relic / Capture parked). Non-spine; optional dashed tether; its own pin styling row. Two new `relationship_types` rows.
- **Generalized anchoring** — replace `validate_residence_anchor()` with `validate_pin_anchor()`: a non-null anchor must be any of the user's own **globe pins** (primary or marker), not only `lived_at`. Column `anchor_residence_id` keeps its name (rename is churn) but its *semantics* widen to "anchor pin"; the validation, not the column, changes. Both `create_residence_pin` and `update_residence_pin` call the generalized helper. **Additive** (loosens a CHECK, no data rewrite).
- **Per-type picker scoping** — the DB is permissive (any pin); the *UI picker* stays guided: Workplace still offers primaries ("which home did you commute from?"); a Log offers **all** pins ("associated with which place?"). One DB rule, sensible per-type UX.
- **Recollection roll-up (direct-anchor, MVP)** — a pin's detail-card linked-recollections includes the globe recollections of pins whose `anchor_residence_id` = this pin. So a Log anchored to a primary surfaces under that primary; a Log anchored to a vacation surfaces under that vacation. **Transitive roll-up** (Log→vacation→primary) is **deferred** — YAGNI until asked.
**Acceptance:**
- A Log pin can be placed and associated with a primary *or* a vacation (or any pin); it draws a dashed tether to that anchor.
- The anchored pin's detail card lists the Log's recollection among its linked recollections (direct anchor).
- `validate_pin_anchor` accepts any own globe pin and still rejects another user's pin / a non-pin relationship (multi-tenancy preserved). Proof script asserts both.
- Re-typing still adjusts the spine correctly; a Log never enters the spine. `tsc + eslint` clean.
- With Log shipped, **Phase-5 finding 4** can be tested: orphan-on-retype resolves into a Log-style association rather than bare standalone.

### Slice 6 — Entity View + context substrate  ·  *pulled forward (was "#3 NEXT")*
Builds the 2026-06-14 design as the shared foundation. Serves **all** entity types (places included), so it also upgrades the globe pin's "add context" path and clears the Zaragoza/Mildenhall dead-end.
**Includes:** M1 migration + `merge_entities` repoint; per-entity **Entity View** page (`/entities/[id]`) showing context notes (with sources) + recollections that mention it + "Add context" (body + optional source + Private/Shareable choice); **`/memories` becomes searchable + editable** with entity chips on the recollection detail linking to each Entity View; propose-and-confirm context capture replacing the Dismiss-only `memory_elaboration_needed` card.
**Acceptance:**
- `entity_context_notes` proof passes incl. merge-repoint (no orphaned notes after a merge).
- Entity View renders notes + linked recollections + Add-context for any entity type; private notes in a visually distinct owner-only section; published/synthesis paths read only `shareable`.
- `/memories` lists, searches, and edits recollections; detail shows entity chips that navigate to the Entity View.
- A pasted research blob is proposed as context-on-entity (Accept/Adjust/Decline), with source auto-fill when a URL is present.

**Deferred within Slice 6 (queued together, 2026-07-06):** `/memories` full-text
search, and **row-level deep links into `/memories`** — a per-memory anchor
(`/memories?entity=X#<memory_id>`, scroll-to + highlight) so surfaces that list
individual recollections can land on the exact one. Driver: the Entity View's
mention rows (built 2026-07-06) all target the same filtered list — fine at 2–3
mentions, inadequate at 20. Journey's expanded cards (J3) will want the same
anchor, so build it with (or just before) the /memories search pass.

### Slice 7 — Person page + Life's Cast + the Hopper  ·  *rides on Slice 6*
The person-specialization of the Entity View, plus the host-agnostic Hopper (the person page hosts one; so does the pin edit panel — same component, two hosts).
**Includes:** M2 + M3 migrations; Person Entity View variant = mentions aggregator (links out, never hosts recollections) + open/private commentary via `entity_context_notes` + person-anchored-recollection-without-a-pin capture path + "promote to Life's Cast" act + a content-only filter (hide blank entity pages); the **Hopper** component on both the pin edit panel and the person page (`memory_stubs`, open/consumed, check-off); capture-assistant interview loop — pick a stub → interview to flesh into a recollection → mark consumed; newly triggered memories during an interview → offer to add as new stubs.
**Acceptance:**
- A person page aggregates that person's mentions as out-links; opening one navigates to the recollection on its pin.
- Person-anchored recollections with no place pin can be added and appear in chronological order.
- Open vs. private commentary persists with the right `visibility`; private never surfaces in any non-owner/published path.
- Promotion is a deliberate act; Life's Cast never auto-populates; the content-only filter hides blank pages.
- Hopper: add/check-off/consume on both a pin and a person; consuming a stub via the assistant produces a real recollection and marks the stub consumed; the assistant offers newly-triggered memories back into the hopper.

### Resume View (item 4)  ·  *near-term, slot after Slice 3.5*  ·  ⚠ SUPERSEDED 2026-07-05
> Renamed **Journey** and redesigned — canonical spec is now
> [2026-07-05-journey-view-design.md](2026-07-05-journey-view-design.md)
> (standalone `/journey` route, URL-param handoff instead of live sync,
> summary-card rows + lazy detail, ember-spine emotional layer, mobile-first).
> The section below is retained as the original intent record.
Per Andy: near-term, after globe legibility. Low-risk, reuse-heavy. Independent of Slices 6/7 — can land in parallel or interleave.
**Includes:** new vertically scrollable, chronological, card-oriented list of residential pins; each row = the pin's detail card drilling to recollections / photo collections / full edit panel; associated recollections + side/related pins nested indented as children; bidirectional globe↔list selection sync (low-criticality — keeps both centered on last-attended stop on surface switch); **Hopper explicitly NOT shown here.**
**Acceptance:**
- Pins render in chronological sequence as detail cards; children nest indented under their parent primary stop.
- Selecting a row centers the globe; selecting a pin scrolls the list to it.
- Reuses existing detail-card/recollection/photo components (no forked rendering).

### Deferred to the pin-visual redesign (Phase-5 finding 5)
**Workplace icon overwhelms the primary residence at zoom-out** (Queenstown / Coronet Peak). The primary residence should be the dominant marker; the workplace (and all tether-types) should read as subordinate to it. Fold into the dedicated pin coloration / iconography / type-styling pass — *not* a Slice 3 gate (Andy's call). Pairs naturally with the deferred "tether highlight on selection" and "static era gradient" polish already recorded in the Slice 3 design doc.

### Vertical Moments (item 7) — parked
Capture-only. No work until Andy supplies examples. Taxonomy treated as extensible (consistent with the schema-extensibility constraint).

---

## 5. Suggested execution order

1. **Slice 3 close-out** (live proof + items 1, 2, 3-static + Phase-5 findings 1 & 2) — smallest, unblocks the visible legibility win and fixes the re-type bug.
2. **Slice 3.5** (active-lines tray) — finishes the globe-legibility interaction arc.
3. **Slice 3.6** (the "Log" pin + generalized anchoring + roll-up) — completes the place-type model and unblocks Phase-5 finding 4.
4. **Resume View** — near-term quick win; independent, can interleave.
5. **Slice 6** (Entity View + context substrate) — the foundation; also fixes the recurring context dead-end.
6. **Slice 7** (Person page + Life's Cast + Hopper) — rides on Slice 6.
7. **Vertical Moments** — parked; **pin-visual redesign** (finding 5) slots whenever the styling pass is scheduled.

Rationale: the globe-legibility track (3 → 3.5 → 3.6) is presentational/interaction work in one code region — fast, visible, and it closes out the place-type model cleanly before the bigger entity/context substrate. Resume View is independent and low-risk. The Entity-View substrate is the long pole and unblocks both the Person page *and* the context dead-end, so it precedes Slice 7, which is a thin specialization on top.

---

## 6. Housekeeping (from the handoff §5)

Before committing, decide `.gitignore` treatment for the vendored `.claude/skills/` (~48 third-party MIT files) and `.claude/settings.local.json`. Recommendation: **track** `.claude/skills/` (they're project tooling the next agent needs; keep the `LICENSE.designer-skills` + `README.md` attribution) and **ignore** `.claude/settings.local.json` (machine-local). Confirm with Andy before the commit that adds them.

## 7. Cross-references
- Brief: [2026-06-22-globe-and-entity-ux-enhancements-design.md](2026-06-22-globe-and-entity-ux-enhancements-design.md)
- Context layer (now Slice 6): [2026-06-14-context-layer-and-recollection-surfaces-design.md](2026-06-14-context-layer-and-recollection-surfaces-design.md)
- Slice 3 place types: [2026-06-12-globe-place-types-design.md](2026-06-12-globe-place-types-design.md)
- Slice state: `memory/decision_step7_slice_phasing_2026-06-05.md`, `memory/project_lc_build_progress.md`
- Invariants: project `CLAUDE.md` (#1 Raw Vault, #3 Access Cards, #5 temporal scaffold)
