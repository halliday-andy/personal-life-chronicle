# Step 7 Slice 3 — Globe Place Types & Temporal Line Language

**Date:** 2026-06-12
**Status:** Design validated with Andy. Ready for implementation.
**Supersedes/amends:** the original Slice 3 sketch in `memory/decision_step7_slice_phasing_2026-06-05.md` ("Main Residence, Short-term stay, Vacation place, Professional travel — distinct pin/arc styling"). This design expands it to six types, adds the anchor/tether model and the three-tier line hierarchy, and pins down vacation-vs-second-home.

---

## What we're building

Distinct pin and line styling for six kinds of place on the residential globe, so the globe reads as a layered map of a life — where you *lived* (the backbone) versus where you *went* and where you *worked*.

### The six pin types → relationship codes

The pin's type **is** its `relationships.type_id` (no separate column). Mapping:

| Pin type | Code | New? | Notes |
|---|---|---|---|
| Primary residence | `lived_at` | exists | The connected spine. |
| Workplace | `worked_at` | exists | Office/employer; commute line to its home. |
| Second residence | `owned_residence_at` | exists | A second home you *returned to* — owned, fractional, share-house, or repeat-rental. UI label/help framed around "second home," not ownership. |
| Short-term stay | `lived_briefly_at` | exists | Briefly lived — e.g. a summer sublet during college. |
| Vacation | `vacationed_at` | **new** | A leisure destination you visited (not a second home). Dedicated code rather than the generic `visited`, so the globe's type read is unambiguous. |
| Professional travel | `traveled_for_work_to` | **new** | A transient business trip (distinct from `worked_at`, your stable workplace). |

### The three-tier line hierarchy

1. **Residential spine** — solid, glowing, chevron-marked great-circle arcs through the `lived_at` pins in `sort_order`. The "central transit of the globe." Unchanged from current behavior except it now filters to `lived_at` only.
2. **Commute line** — home → workplace. *Superior* to all other tethers: weightier, its own iconography, signalling the primacy of the work/employment relationship. Distinct from the spine, clearly above leisure.
3. **Trip tethers** — Second residence, Short-term stay, Vacation, Professional travel. Dashed, non-glowing, lower opacity, subordinate. Each dashes to the primary residence it's anchored to.

### Spatial model: spine vs. markers (decision: Model A)

Only **primary residences** form the connected sequence. The other five types are **time-anchored markers** that do not reorder the spine. Rationale: the primary residential spine is the temporal scaffold (architectural invariant #5); vacations, work trips, second homes, and sublets are episodic color that must not corrupt the backbone the Temporal Agent relies on.

### Anchoring (decision: Model A — explicit at placement)

A marker acquires its tether anchor explicitly: when you place a non-primary pin, you pick which primary residence you were living in at the time (reusing the existing "Where does this fall in your life?" picker, rephrased "Which home were you living in then?" / for Workplace, "Which home did you commute from?"). Stored as `relationships.anchor_residence_id`. Optional — unset means a standalone marker with no tether. No date-parsing required.

### Temporal markers (decision: Model A — use what we capture)

Each pin already stores a free-text `when_text` ("1959 to 1960", "early 70s"). Slice 3 surfaces that phrase as a compact **time chip** when a pin is selected, so traversing the spine shows "where you are in time." Proportional timelines and **era-coloration of segments** are deferred to the Temporal Agent (which produces structured dates from fuzzy phrases) — the anchor model does not preclude them.

---

## Data model changes

`relationships` table, both additive/nullable (no destructive migration):

- **`anchor_residence_id UUID REFERENCES relationships(id) ON DELETE SET NULL`** — a marker's tethered primary residence. `SET NULL` so deleting a primary turns its markers into standalone pins rather than cascading them away.
- `sort_order` semantics tighten: it applies only to `lived_at`. Markers get `sort_order = NULL`.

Two new `relationship_types` rows (+ inverses): `vacationed_at`/`was_vacation_spot_of`, `traveled_for_work_to`/`hosted_work_trip_of`.

---

## Backend (RPCs)

All in migration `20260613130000_globe_place_types.sql`. Because parameters/return shapes change, each is `DROP FUNCTION IF EXISTS <explicit signature>` then recreated (the Slice 4b pattern), not bare `CREATE OR REPLACE`.

- **`create_residence_pin`** + `p_type_code TEXT DEFAULT 'lived_at'`, `p_anchor_residence_id UUID DEFAULT NULL`. `lived_at` keeps the `sort_order`/`p_position` insert-and-shift; other types write `sort_order = NULL` + the anchor, skipping the shift. Preserves finalize-on-save (memories created `is_draft=false`).
- **`update_residence_pin`** + `p_type_code`, `p_anchor_residence_id`. Re-typing *to* `lived_at` appends to the spine and resequences; re-typing *away* drops from the spine and resequences the remainder.
- **`get_residence_pins`** returns `type_code` + `anchor_residence_id` added to existing fields; spine ordered by `sort_order`, markers following with their anchor.
- **`reorder_residence_pins`** constrained to `lived_at`; rejects any non-spine id.
- **`nearest_residence`** (proximity) scoped to primary residences only — "returning/intra-metro" is about where you lived.

Backward compatibility: new params have defaults, so the existing `app/api/globe/residence` routes keep working until updated.

---

## Globe rendering (`GlobeView`)

Split the loaded pins by type:

- **Spine** = `lived_at`, ordered by `sort_order` → existing great-circle chevron builder (solid, glowing). Inbound/outbound selection emphasis unchanged.
- **Markers** = the other five types → typed pin elements; each with `anchor_residence_id` draws a tether to the anchor's coordinates.
  - Workplace tether = **commute line** (tier 2): solid-ish, weightier, own iconography, no chevrons, but clearly above the dashed tier.
  - Other markers = **dashed tether** (tier 3): `line-dasharray`, low opacity, no glow.

Per-type pin styles (CSS classes, nocturne ember palette): Primary = bright ember bloom; Workplace = distinct workplace iconography (most prominent marker); Second residence = double-ring ember; Short-term = small dim dot; Vacation = softer amber/rose (leisure); Professional travel = cooler desaturated (work-trip).

A collapsible **legend** keys the six pin styles + three line tiers.

---

## Capture & edit UI

- **PinModal**: a **type selector** (default Primary). Contextual picker below — Primary → sequence position; others → anchor picker ("Which home were you living in then?" / Workplace: "Which home did you commute from?", plus "Not sure / standalone").
- **PinEditPanel**: a **type dropdown** (re-classify) + anchor selector for non-primary types. Re-typing to/from Primary adjusts the spine.
- **PinDetailCard**: shows type label + icon and the `when_text` time chip ("Second residence · 1985–1992").
- Verbatim narrative capture, ghost text, photo gallery, linked recollections — all unchanged; type/anchor are structured fields around the Raw Vault text, never inside it.

---

## Verification

`scripts/verify-globe-place-types.mjs` (relative-only, self-cleaning):
- typed create (primary + vacation anchored to it) → types + anchor stored; spine has only the primary; marker carries its anchor;
- re-type vacation→primary (enters spine) and back (leaves);
- delete anchor primary → marker's `anchor_residence_id` goes NULL, marker survives;
- `reorder_residence_pins` rejects a non-spine id;
- `get_residence_pins` returns the two new fields.

Plus `tsc --noEmit` + `npm run lint` gates on the frontend.

---

## Deferred (explicitly out of Slice 3)

- **Promote-a-type-to-its-own-transit toggle/filter** — a future slice letting the user surface a *second central transit* (e.g. a professional-life through-line connecting workplaces in sequence), parallel to the residential spine, with selectable arc styles. The anchor-based model does not preclude it.
- **Era-coloration & proportional timelines** — wait for the Temporal Agent to produce structured dates from `when_text`.
- **A workplace spanning multiple residences** — MVP anchors a workplace to one home; multi-home workplaces are later.

---

## Implementation phases

1. **Migration + RPCs** — write `20260613130000_globe_place_types.sql`, show it, apply via `db-apply`, author + run `verify-globe-place-types.mjs`. Commit.
2. **API routes** — thread `type_code` + `anchor_residence_id` through `POST`/`PATCH` `/api/globe/residence` and surface them in `GET`. Commit.
3. **Globe rendering** — type splitting, per-type pin styles, commute line + dashed tethers, legend. Commit.
4. **Capture/edit UI** — PinModal type+anchor selector, PinEditPanel type dropdown + anchor, PinDetailCard type chip. Commit.
5. **Manual proof** — Andy places one of each type, confirms styling, tethers, re-typing, and the time chip in the live app.

Build directly on `main` (project convention; Andy proofs the live dev server on `main`).
