---
name: Project: LC future pin types (deferred)
description: Deferred globe pin-type ideas not in the residential-globe MVP — the aspirational bucket-list pin and the multi-home concurrent-domicile display.
type: project
---

Deferred pin-type ideas for the Life Globe, captured so they aren't lost. Neither is in the residential-globe MVP slices (see [[decision_step7_slice_phasing_2026-06-05]]).

## Bucket-list / aspirational pin type (Andy, 2026-06-05)

A pin type that is **not** about historical residences but about **places the user wants to visit or possibly relocate to** — a bucket list rendered on the same globe. Distinct, selectable UI separate from the residential pin flow.

**Why it's worth building:** it broadens the app's appeal and engagement — the globe becomes both a record of the past *and* a canvas for aspiration. A user records places they'd like to vacation in, or even relocate to in future. Natural adjacency to the Vacation-place residential type (Slice 3) but semantically forward-looking rather than historical.

**Open design questions (for when it's built):** how aspirational pins visually differ from lived/visited pins; whether they live on the same globe view with a filter toggle or a separate mode; whether a bucket-list place can later be "promoted" to a real residence/vacation pin once visited.

## Multi-home concurrent-domicile display (deferred from Slice 3)

For families maintaining **several simultaneous domiciles** used seasonally or intermittently, the pin graphics and the connector to the period's main residence need a way to show multiple concurrent homes. Deferred from the Slice 3 place-types work. See `feature_residential_globe_onboarding.md` §5.6 (the high-net-worth multi-home case, deferred indefinitely there too) and §9 (the simultaneous-residence schema question).

## How to apply

When the residential globe MVP (Slices 1–4) is in real use and validated, revisit these as enhancement candidates. The bucket-list pin is the higher-appeal, more self-contained of the two — likely the better first post-MVP pin-type addition.

**Update 2026-07-15:** the bucket-list pin is now SCHEDULED as "Future Places" (U8, working code `wants_to_visit`) in the Trips & Travel Journal plan — `docs/plans/2026-07-15-001-feat-trips-travel-journal-plan.md`. The plan resolves its open design questions: same globe with its own type/styling row in the selector (no separate mode), and promotion via re-type or "start a trip here." The multi-home concurrent-domicile display remains deferred.
