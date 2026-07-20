# Design — pin-card reconciliation (detail ↔ edit) + connections sharing

**Date:** 2026-07-20
**Author:** Claude Code (Opus 4.8), from a brainstorm with Andy the same day.
**Status:** Direction agreed with Andy 2026-07-20 (Approach A + the two
directives + "Add New Context" wording). Written for his async review while
he's away; he authorized building it in the meantime. Supersedes nothing.

---

## Problem

The pin has two card surfaces:

- **`PinDetailCard`** (read view; bottom-center popover) — recollection +
  facts + a count-chip row that discloses **recollections / context /
  related-pins / jot** one at a time.
- **`PinEditPanel`** (edit view; full-height right-side panel) — editing,
  photos, the full jots hopper, an "add context ↗" *link*, and a *count*
  ("N more recollections mention this place →").

They render the *same* connected collections but independently, and they've
**drifted**: the larger edit panel actually surfaces *less* of the pin's
connected data than the little detail card — it shows no existing context
notes and no related pins at all. Andy's finding (2026-07-20): "the edit view
loses the references to context and related pins… that page is larger and
should provide the ability to show more data."

Two smaller findings ride along:

1. The detail card's **"N anchored"** chip is opaque — these are pins related
   to this one; the label should say so.
2. The detail card's **add-context** action drops the user on the place page
   with nothing open; it should land with the composer ready.

## Directives (settled with Andy — not re-opened)

- **Rename** the detail-card **"N anchored"** chip → **"N related pin" /
  "N related pins"** (singular/plural). Scope: the literal word "anchored"
  reaches users in only two places — this chip and Journey's "Elsewhere ·
  not yet anchored" header — and they mean different things (chip = *pins
  related to this one*; Journey = *not attached to any home in your
  timeline*). **Rename the chip only**; leave Journey's wording.
- **"＋ Add New Context ↗"** — the add-context action's new label, and it
  **deep-links to the place page with the context composer already open**.

## Approach A — one shared `PinConnections` component

Extract the detail card's connections UI into a single component that **both
cards mount**, so the two surfaces can never diverge again (the root cause of
the drift). This is the compound fix, chosen over (B) copying the markup onto
the edit panel — a second copy that drifts again — and (C) converging the two
surfaces into one, which the genuinely different form factors (bottom popover
vs. full-height side panel) don't warrant.

### `components/globe/PinConnections.tsx`

**Purpose:** render a pin's connected collections — recollections, context,
related pins — as a compact count-chip row with single-open disclosure.

**Props:**

| prop | meaning |
|---|---|
| `entityId` | the pin's `place_entity_id` — for links (memories, entity page) |
| `placeName` | for tooltips/titles |
| `linked: LinkedRecollection[]` | other recollections mentioning this place |
| `context: ContextEntry[]` | context notes on the place entity |
| `anchored: AnchoredPin[]` | pins related to this one (anchored here) |
| `onSelectAnchored: (relationshipId) => void` | open a related pin |
| `variant: 'card' \| 'panel'` | styling + hopper handling (below) |

**Owns:** `openChip` (single-open) and `expandedId` (recollection expand).
The three interfaces (`LinkedRecollection`, `ContextEntry`, `AnchoredPin`)
move here from `PinDetailCard` and are imported back.

**The hopper is per-variant** (the one place the surfaces genuinely differ):

- `variant='card'` — the hopper is the **4th chip**, part of the single-open
  set (so the popover never grows tall enough to occlude its own pin —
  the 2026-06-26 constraint). `PinConnections` mounts `PinHopper variant="card"`.
- `variant='panel'` — `PinConnections` renders **only the 3 collection chips**;
  the edit panel keeps its existing **full** `PinHopper variant="panel"`
  (always-open add/check/delete) mounted separately. No duplication.

### Detail card (read view)

`PinConnections variant="card"` replaces the current inline chip-row + blocks
+ card-hopper. The **context block** already carries the 2026-07-20 fix (notes
first, strong affordance); its add-context link becomes **"＋ Add New
Context ↗"** with the deep-link. The **related-pins chip** shows
**"N related pin(s)"**.

### Edit panel (the workbench)

The edit panel becomes the pin's full workbench. It fetches `context` +
`anchored` from the residence endpoint (already returned; today it reads only
body/images/linked) and mounts `PinConnections variant="panel"`. Removed as
redundant: the "N more recollections mention this place →" count-link (the
recollections chip covers it). The inline "research? → add context" pointer by
the recollection editor is trimmed to a non-CTA hint (PinConnections now owns
the add-context CTA, so two CTAs would confuse). `onSelectAnchored` is wired
through GlobeView, reusing the existing `selectPin` + `flyTo` handler.

## Add-New-Context deep-link mechanics

- The add link points to `/entities/{placeEntityId}?addContext=1`.
- `EntityView` gains `useSearchParams`; on mount, if `addContext` is present it
  `setAdding(true)` (the **main context composer** only — not the person
  recollection form) and scrolls it into view via a ref. The param is a
  one-shot hint; no history rewrite needed.

## Pin-facts data layer (adjacent, separate unit)

Also lands on the edit panel but designed under
[`2026-07-10-pin-facts-editor-enhancement.md`](2026-07-10-pin-facts-editor-enhancement.md).
Its **data layer** (the sticky-merge invariant — owner-edited facts always beat
re-extraction, per-field provenance in `relationships.metadata`, MERGE-only) is
independent of this card layout and is built in the same session with its own
proof. Its editable fields sit near the type/anchor area of the workbench; that
UI wiring follows once this reconciliation lands.

## Verification

- **Pure logic:** the title-leak fix already shipped
  (`verify-derive-context-title.mjs` 15/15). PinConnections is presentational —
  no new pure logic — so it's verified by `tsc` + `next lint` green and a QA
  walkthrough, not a proof script.
- **QA:** `docs/qa/2026-07-20-pin-card-reconciliation-qa-checklist.md`, folded
  into master-sequence Phase 1.

## Out of scope (named so nothing's lost)

- Journey "anchored" wording (different meaning; left alone).
- Converging the two surfaces into one (Approach C — not now).
- The pin-facts *UI* (fields on the workbench) — follows this, per above.
