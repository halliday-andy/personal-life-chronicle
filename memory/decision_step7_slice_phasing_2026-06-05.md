# Decision: Step 7 phased into build slices (residential globe)

**Date:** 2026-06-05
**Status:** Agreed with Andy. **Slice 1 SHIPPED 2026-06-05**, **Slice 4a SHIPPED 2026-06-07**, **Slice 4b SHIPPED 2026-06-09**, **Slice 2 SHIPPED 2026-06-10** (detail card + pin image + Claude extraction; no SQL migration needed). **Slice 3 (place types) is the main slice remaining.** Supersedes the all-at-once 7a–7j sequencing in `feature_residential_globe_onboarding.md` §12. Build details per slice: `project_lc_build_progress.md`.
**Owner:** Andy Halliday (product), in a resumed session reviewing the design from a fresh standpoint.

---

## Why

The canonical residential-globe spec bundled the entire product surface (Mapbox + geocoding + modal + AI extraction + sidekick + side trips + vacation homes + drag-to-refine + arc-drag-insert + clustering + intra-metro + a full Timeline with PDF export + mobile) into one Step 7 with ~30 acceptance criteria. Building all of that before placing a single real pin contradicts the project's own origin story (globe-first came *from* alpha friction). Decision: cut to a walking skeleton, get Andy's own residential history in, let real use drive the rest.

## The slices

- **Slice 1 — the loop (search-first walking skeleton):** Globe (`projection: 'globe'`, auto-flattens to mercator at full zoom) → **Find Location search box** (forward geocode → camera flies to area) → user zooms and **drags pin to precise spot** → reverse-geocode final position → modal (free-form text + optional date/range, **main residence only**) → persist full chain (`entities` place + `geom`/`place_subtype`/parents, `relationships` `lived_at` + `sort_order`, `memories` `content_raw` + `capture_mode='globe_onboarding'`, `memory_entities` link) → pins render with solid sequential arcs → persists on reload. **No** image, sidekick, side-trips, or AI extraction yet.
- **Slice 2 — richness:** pin-click detail card below globe + small on-globe image overlay card + single-image upload per pin (uses `pin_images` bucket) + Claude extraction job (modal text → structured fields via Inngest).
- **Slice 3 — place types:** Main Residence, Short-term stay (`lived_briefly_at`), Vacation place, Professional travel — distinct pin/arc styling. Needs a migration: prep migration only added `lived_briefly_at` + `owned_residence_at`, so Professional travel (work-trip) and a distinct Vacation-place code must be added, and "vacation place = owned vs visited" pinned down at build time.
- **Slice 4 — editing & sequence:** drag-to-refine precision, insert-pin-then-choose-before/after, delete, returning-residence vs. intra-metro detection.
- **Slice 5+:** sidekick context mode, clustering/filter, `chronicle/threshold.reached` events, mobile.

## Design decisions confirmed this session

- **Modal-first on pin-drop; sidekick stays quiet until the user engages it** (avoids "which box do I type in?" at first contact). Revises spec §6.2.
- **Globe projection**, not flat web-mercator — emotional/brand payoff of "Life Globe"; auto-flattens at high zoom for free.
- **Search-first interaction** via a Find Location box (solves the blank-globe "where do I click?" problem). Both geocoding directions used: forward (search→fly) + reverse (final pin→name/parents).
- **Arc-drag-insert: DELETED** (spec §5.5). Replaced by "insert a new pin, then choose before/after an existing pin." Impractical hit-testing not worth it.
- **Image-on-pin is IN MVP** (resolves the PRD §4.2 vs globe-spec §3.2 conflict in the PRD's favour) but lands in **Slice 2**, not the bare skeleton.
- **Timeline is its own separate surface**, decoupled from the globe/residential sequence. Out of Step 7. (Aligns with the navigation-surfaces reframing: Globe / Recollections / Timelines are distinct surfaces.)

## Globe rendering enhancement (Andy, 2026-06-05, deferred)

Approved the dark stylized globe (`dark-v11`) for the zoomed-out view. **Future enhancement:** as the user zooms into a local view, transition the map from the dark, sparse, stylized style toward something richer in colour and detail — up to and including a **satellite view** at close zoom. Implementation likely a zoom-driven style/source swap (e.g. `dark-v11` → `satellite-streets-v12`) with a smooth transition. Not in the MVP slices; revisit after Slice 1–4.

## Editing/correction capability (surfaced 2026-06-05)

First real use immediately hit the need to **relocate a pin and correct a recollection** — there is no edit/relocate/delete UI in Slice 1 (it's Slice 4), and globe memories are saved `is_draft=false` so they fall under the Raw Vault invariant (no in-place `content_raw` edit; corrections via `memory_revisions`, unbuilt). Interim fix path: a guarded dev script deletes a pin (memory→relationship→place) so the user re-places it. **Implication: Slice 4 (edit/relocate/delete) is the highest-value next slice** — correcting entries is fundamental to real chronicling. Also reconsider whether globe memories should be drafts (reviewable/editable) rather than final on creation.

## Deferred (explicitly)

- **Multi-photo gallery per pin (Andy, 2026-06-10, after first Slice 2 use):** the edit panel should eventually allow attaching *multiple* photos to a residence, while the pin/detail-card photo stays single — it's whichever is flagged primary. Schema already supports this (`entity_media` many-per-entity + `is_primary`); the one-image limit lives only in `attachPinImage`'s replace-on-attach behaviour, so the change is additive: append non-primary rows, add a gallery + "make primary" UI in the edit panel. Pairs with the also-deferred image preprocessing (client-side HEIC→JPEG conversion + ~2MB compression — HEIC uploads work today but only render in Safari).

- Multi-home / seasonal-domicile **concurrent** display — special pin + connector graphics for families maintaining several simultaneous domiciles used seasonally/intermittently. See `feature_residential_globe_onboarding.md` §5.6 (the high-net-worth multi-home case).
- **Bucket-list / aspirational pin type** — see [[project_lc_future_pin_types]].

## Prep state as of 2026-06-05 (verified via SQL)

Nothing applied. Both prep migration files exist in the repo but are **uncommitted and never run** against the DB. `capture_mode` CHECK still the old three-value version (no `globe_onboarding`); no `lived_briefly_at`/`owned_residence_at` relationship types; no `authored_by_actor` column; no `pin_images` bucket or policies; no Mapbox token in `.env.local`; no Mapbox npm dependency. Slice 1 needs: both migrations committed + applied, Mapbox token, `mapbox-gl` (+ a search component) installed. The `pin_images` bucket waits for Slice 2.

## Cross-references

- `documentation/feature_residential_globe_onboarding.md` v1.1 — canonical UX spec (this decision phases and amends it)
- `memory/decision_step7_prep_checklist_2026-06-04.md` — the prep steps (still mostly undone)
- `memory/decision_step7_image_storage_2026-06-04.md` — pin-image schema verification (relevant Slice 2)
- `memory/decision_phase0_reframing_2026-05-31.md` — Globe / Recollections / Timelines as distinct surfaces
