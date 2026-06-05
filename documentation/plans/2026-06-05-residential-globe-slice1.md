# Slice 1 — Residential Globe Walking Skeleton (design)

**Date:** 2026-06-05
**Status:** Draft for Andy's review. No feature code until approved.
**Scope authority:** `memory/decision_step7_slice_phasing_2026-06-05.md` (phasing) + `documentation/feature_residential_globe_onboarding.md` v1.1 (canonical UX, amended by the phasing decision).
**Goal:** Prove the residential-capture loop end-to-end and get Andy's own residential history onto the globe. Everything else is later slices.

---

## 1. Scope

**In:** a globe surface with a Find Location search box; place search flies the camera to the area; the user zooms and drags a pin to the precise spot; a modal captures free-form text + an optional date/range; saving writes the full data chain; pins re-render with solid sequential arcs and persist across reloads.

**Out (later slices):** images, pin-click detail card, AI extraction, sidekick chat, side-trip/vacation/professional place types, drag-to-refine after save, insert-before/after, delete, clustering, intra-metro detection, threshold events, mobile, Timeline.

**Place type in Slice 1:** Main Residence only (`relationship_type='lived_at'`).

## 1a. Design direction — "Nocturne / observatory"

Approved 2026-06-05. The Globe is the product's emotional signature; it gets a deliberate aesthetic, distinct from the inherited utilitarian admin UI (Geist + Tailwind-default stone — kept only where it earns its place; not a binding model).

- **Tone:** immersive, dark, observatory-like. You step into a quiet room and your life lights up on a dark earth.
- **Type:** **Fraunces** (variable display serif) for intimate prompts/headings — warm, literary, memoir-appropriate; loaded via `next/font/google`. **Geist** retained as the UI/data sans. Fraunces carries the soul; Geist stays out of the way.
- **Palette (CSS vars, dark):** `--night` deep indigo-black canvas with faint radial glow + grain; cool dark earth; **`--ember` warm amber-gold = the user's own pins ("your life, lit")**; arcs render as a warm gradient thread. Semantic states retuned for dark (no raw `emerald-600`).
- **Material:** floating **glass** (backdrop-blur, hairline light borders) for the Find Location box, pin modal, and pin detail — they hover over the globe, not on a white sheet.
- **Motion:** slow globe settle on load; **pin-bloom** on placement = the signature beat; arcs animate their draw as the journey extends. Restraint elsewhere.
- **Composition:** opening serif prompt holds the lower third on an empty globe, recedes once the first pin lands and the search box takes primacy.

These tokens are established on the globe surface in Slice 1 and become the foundation the admin surfaces can be brought into later (out of scope here).

## 2. Prep dependencies (must be true before build runs)

- Migration 1 applied → `capture_mode` CHECK accepts `globe_onboarding`. (Relationship-type rows it adds aren't used until Slice 3, but the migration is applied whole.)
- Migration 2 applied → `authored_by_actor` column present (Slice-1 inserts set it to `'owner'`).
- `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`.
- `mapbox-gl` installed (+ the search component chosen in §5).

## 3. Route & surface

New protected route `app/(protected)/globe/page.tsx` (server component → auth guard via existing layout) mounting a client `<Globe>` component. Not wired into primary nav yet — reachable directly during alpha. (The Globe-as-first-screen nav change is part of the navigation-surfaces work, not Slice 1.)

## 4. Components

- `components/globe/GlobeView.tsx` (client) — owns the Mapbox map instance (`projection: 'globe'`), renders existing pins + arcs, handles the place-search → fly-to, draggable draft pin, and "place here" confirmation that opens the modal.
- `components/globe/FindLocationBox.tsx` — the forward-geocode search input.
- `components/globe/PinModal.tsx` — free-form textarea (rotating ghost text per spec §6.1) + optional date/range text field + Save / Cancel.
- `lib/globe/geocoding.ts` — thin wrappers over Mapbox forward + reverse geocoding; maps a result's feature type → `place_subtype` (more robust than camera-zoom inference; see §7).
- `app/api/globe/residence/route.ts` — `POST` that performs the persistence chain in §6 in one server-side transaction-like sequence; `GET` returning the user's pins + sequence for initial render.

## 5. Geocoding & map library decision

`mapbox-gl` for the map. For search, recommend **Mapbox Search JS** (`@mapbox/search-js-react`) for the Find Location box — purpose-built, accessible, handles session tokens/billing correctly. Reverse geocoding on pin-drop uses the Geocoding API directly via `lib/globe/geocoding.ts`. Alternative considered: `@mapbox/mapbox-gl-geocoder` (older, heavier styling baggage) — rejected.

## 6. Data flow on Save (the loop)

Server route does, in order, rolling back on failure:
1. Resolve/insert the geographic hierarchy from the reverse-geocode result: upsert `entities` rows for country → region → city → (neighbourhood/address) with `parent_id` chain; the leaf place entity gets `type='place'`, `place_subtype`, `geom` (PostGIS point from drag lat/lng).
2. Insert `relationships`: `subject_user_id = user`, `object_id = leaf place entity`, `relationship_type='lived_at'`, `sort_order = max(existing)+1`, dates if provided, `authored_by_actor='owner'`.
3. Insert `memories`: `content_raw` = verbatim modal text, `capture_mode='globe_onboarding'`, `source='text_entry'`, `authored_by_actor='owner'`.
4. Insert `memory_entities`: memory → leaf place entity, `role='location'`, `is_primary=true`.
5. (Deferred to Slice 2: emit the extraction Inngest event. Slice 1 does **not** emit, to keep the loop synchronous and inspectable.)

`generate_residency_constraints()` fires automatically on the `lived_at` insert (existing schema trigger) — no app code needed; we verify it produced constraint rows.

## 7. Precision / place_subtype

Drive `place_subtype` from the **reverse-geocode result's feature type** (`country`/`region`/`place`/`neighborhood`/`address`), not camera zoom — robust to users zooming for visibility rather than precision (revises spec §5.4). Store the drag lat/lng as `geom` regardless.

## 8. Persistence & re-render

On load, `GET /api/globe/residence` returns pins ordered by `sort_order` with lat/lng + name. `GlobeView` renders a marker per pin and a solid line layer connecting them in sequence. Reload shows the same globe.

## 9. Testing / verification (alpha-appropriate)

Per Andy's standing override, not strict TDD for the local alpha — but every slice ships with verification:
- A `scripts/verify-globe-slice1.mjs` that drives the persistence route with a sample place and asserts the four rows + the constraint row exist, then cleans up (pattern matches existing `scripts/verify-*.mjs`).
- Manual: place 3–4 real pins (Andy's own early residences), reload, confirm persistence + arcs.
- Type-check + build must pass before commit.

## 10. Open micro-decisions for Andy

1. **Date field format** — single free-text "when" field (parsed later), or two fields (from / to)? Recommend single free-text for Slice 1 (matches spec §3.2; structured parsing is Slice 2 extraction).
2. **Route name** — `/globe` good? (vs `/onboarding`, `/residences`.)
3. **Mapbox Search JS** vs plain Geocoding-API-backed custom box — confirm the dependency add.

## 11. Reminder

The §1 "Out" list is hard scope — do not build any of it in Slice 1, even if it's quick. Each belongs to a named later slice.
