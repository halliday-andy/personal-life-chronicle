# R22 — give the owner the destination change

**Date:** 2026-08-03
**Status:** **SPEC — agreed with Andy, not built.** Sized at roughly an
afternoon. Written for a fresh session; everything needed is here.
**Why it exists:** R6 made a trip's destination changeable **at the data
layer only**. `retarget_trip` is applied and proven, but nothing calls it —
so the capability is reachable only by an agent running SQL. Andy: *"Is this
because I can't make the modifications myself?"* Yes, and that is the gap.

---

## 1. What is already done

| | |
|---|---|
| `retarget_trip(user, trip, new_destination, demote_old_to_stop = true)` | **applied** `20260803130000_retarget_trip.sql` |
| Proof — 8/8, runs in a rolled-back transaction | `scripts/verify-retarget-trip.mjs` |
| The destination guard that blocked homes as destinations | **removed** `20260803120000_...`, proof `verify-trip-destination-guard.mjs` 9/9 |

So the database is ready. **Only the API and the UI are missing.**

## 2. What to build

### 2a. API — `app/api/trips/[tripId]/route.ts`

The PATCH handler currently calls **only** `frame_trip`, which has no
destination parameter. Accept two new optional fields:

```
destinationRelationshipId?: string   // triggers the retarget
demoteOldToStop?: boolean            // default true
```

When `destinationRelationshipId` is present, call `retarget_trip` **before**
`frame_trip`. The two touch disjoint columns so order is not strictly
required, but retargeting first means the trip is in its final shape before
the other fields land, and a failure leaves the simpler state.

Surface `retarget_trip`'s exceptions as readable errors — the framing panel
already renders `b.detail || b.error`.

### 2b. UI — `components/globe/TripFramePanel.tsx`

The panel states the destination as a fact today:

> *"The destination is saved. Origin → destination is enough to complete the
> trip…"*

That sentence is what sent Andy hunting for a control that did not exist.
**Rule 11's cousin: a panel that names a field it cannot edit should either
say so or offer the edit.**

Add, directly beneath the existing **"Where did the trip start?"** selector:

- **"Where did it end?"** — a destination selector, same shape and same pin
  list as the origin one. Pre-selected to the current destination.
- When the selection differs from the current destination, reveal a
  checkbox: **"Keep {old destination} as a stop along the way"**, default
  **on**. That default matters — the old destination is usually the story of
  the journey, not something to discard.

`TripFramingContext` gains `destinationRelationshipId: string` so the
selector can pre-select. GlobeView already has it on `TripRow`.

**Reuse the origin selector's markup**; two selectors that differ only in
label must not drift into two implementations (the pin-card reconciliation
lesson).

### 2c. Copy

Replace the "destination is saved" sentence, which is now false in spirit —
it can be changed. Something like: *"Origin → destination is enough to
complete the trip. Change either if you recorded it differently."*

## 3. The QA fixture — deliberately left broken

**Do NOT correct Andy's 1978 trip with SQL.** It is preserved on purpose as
the end-to-end test case for this feature (his call, 2026-08-03: fixing it
now "loses this as a QA test case for verifying the utility of the new R22").

Current state — trip `594fa9aa-64de-4ed3-a2ea-3e1bf9305b56`:

| | |
|---|---|
| title | *The epic solo road trip in the overloaded Fiat 128* |
| origin | My Mt. Snow Chalet |
| destination | **Wendy's shared apartment** ← wrong |
| `return_to_origin` | already `false` |
| stops | none |

**The correction Andy should be able to make himself:**

```
My Mt. Snow Chalet → stop: Wendy's shared apartment → SSV Day Lodge Room
```

**Acceptance for R22 is that Andy performs exactly that in the UI**, and:

- the destination becomes SSV Day Lodge Room (a **primary residence** — only
  possible because the guard was removed);
- Wendy's apartment appears as an **outbound stop**;
- **the title survives** — "The epic solo road trip in the overloaded Fiat
  128" is his sentence, and `retarget_trip` protects it, but the UI path must
  be checked too;
- the globe draws chalet → Wendy's → SSV as a one-way route with no return
  arc.

## 4. Watch for

- **Do not re-add a destination-type guard.** Rule 20: a constraint keyed on
  a mutable classification misjudges history. A trip may end at a home; that
  is a relocation, and `return_to_origin` carries the distinction.
- **Order is load-bearing inside `retarget_trip`** — already handled in SQL,
  but do not "simplify" it: `add_trip_stop` refuses the *current*
  destination, so the repoint must land first.
- **`ON DELETE RESTRICT`** on `destination_relationship_id` means a pin that
  is a trip's destination cannot be deleted. Retargeting *frees* the old pin
  and *locks* the new one — worth a line in the QA checklist, since it will
  surprise someone eventually.

## 5. Cross-references

- Register + build order: [`2026-07-30-phase1-remediation-plan.md`](2026-07-30-phase1-remediation-plan.md) (F6 / R6)
- Where this was first sketched: [`2026-07-30-trip-strip-into-pin-card-design.md`](2026-07-30-trip-strip-into-pin-card-design.md) §5
- Migrations: `supabase/migrations/20260803120000_*`, `20260803130000_*`
- Proofs: `scripts/verify-trip-destination-guard.mjs`, `scripts/verify-retarget-trip.mjs`
