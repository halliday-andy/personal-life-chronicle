# Design — the trip strip moves onto the pin card

**Date:** 2026-07-30
**Author:** Claude Code (Opus 5), from Andy's live QA of the
[trip-from-here checklist](../qa/2026-07-19-trip-from-here-qa-checklist.md).
**Status:** DESIGN ONLY — Andy's agreement required before build. No code
changed; the F1 blocker is deliberately **not** patched (Andy, 2026-07-30:
the redesign matters more than an intermediate fix, and he can navigate
around it meanwhile).
**Extends:** [`2026-07-20-pin-card-reconciliation-design.md`](2026-07-20-pin-card-reconciliation-design.md)
— same problem family, same Approach-A remedy (one shared component mounted
by both card surfaces). That doc is built and awaiting QA; this is its
sibling, not an amendment.

---

## 1. The finding

Andy went looking for **"Start a trip from here"** in the pin detail card and
the edit panel, and couldn't find it. It lives in globe chrome — a floating
glass strip at `GlobeView.tsx:1671`, `top-20`, centred under the search box.

His reasoning generalizes past this control:

> The search box means **acquire a place I don't have**. Pin actions mean
> **elaborate a place I do**. These are independent intentions, and
> proximity assigns a control to its neighbour's.

That is why the hunt failed: the app's own conventions say pin-scoped actions
live on the pin's surfaces, and every other one does —
`PinFactsEditor`, `PinConnections`, `PinHopper`. The trip strip is the lone
exception.

**And the misplacement produced a functional bug, not just a discoverability
one.** The strip (`z-30`, `top-20`) paints over the search dropdown (`z-20`,
`top-6`, expanding downward), hiding the "Your pins" group that renders at the
top of the merged results — F1 in the checklist. The control that shouldn't be
in the search box's lane is physically covering the search box's output.

### Class of bug (new — earned here)

> **A control scoped to a selected object belongs on that object's surface.**
> Rendered into global chrome — especially adjacent to a global control — its
> position assigns it to the wrong intention, and users hunt for it where the
> app's conventions say it should be. **The tell:** an action that reads
> `selectedId` but renders outside the selected thing's card.

No static guard is proposed, and inventing one would be dishonest — the check
is "does this render inside the selected object's component subtree", which is
a judgement about intent, not a shape a linter can see. The durable artifact
is the rule plus the fact that every pin-scoped control now lives in one
place, so the next exception is conspicuous.

## 2. What the strip actually holds

Three variants render in that band today:

| Variant | Condition | Contents |
|---|---|---|
| **Home** (`:1671`) | spine pin selected | "N trips originated here" · **home base** chip · **Start a trip from here** · **Travel Journal →** |
| **Unframed** (`:1701`) | non-spine pin, no trips | invitation ("This was a journey? Frame it as a trip:" / for `wants_to_visit`, "Been there now?…") · three subtype buttons |
| **Framed** (`:1720`) | pin has trips | per trip: title · subtype · `when_text` · **needs framing** badge · **Frame/Edit frame** · **Route** · **Unframe** (confirm) · **✎ jots** · plus "Another trip here:" subtype chips |

All of it is *about the selected pin*. By the rule above, all of it belongs on
the card.

## 3. The design

**A `Trips` chip on the pin's count-chip row**, opening as single-open
disclosure — the pattern `PinConnections` already establishes for
recollections / context / related pins.

**`components/globe/PinTrips.tsx`, mounted by BOTH `PinDetailCard` and
`PinEditPanel`** — Approach A from the reconciliation doc, chosen for the same
reason: two surfaces rendering one thing must use one component. That doc's
drift (the edit panel silently showing *less* than the detail card) is what
happens otherwise, and it has now bitten in this codebase repeatedly.

Empty state carries the *invitation* (variant 2), so a marker pin with no trip
still offers framing — inside the disclosure, not as chrome.

### Note for build — the chip row is already variant-aware

`PinConnections` builds its chips from a single array
(`PinConnections.tsx:134–145`), currently **recollections · context · hopper**,
and `variant="panel"` renders a subset. A Trips chip joins that array rather
than being bolted on beside it. Note also that the related-pins chip **no
longer exists** — the 2026-07-26 stop-places unit promoted it out of the row
into an elevated block; do not reintroduce a count chip for something that
earned its way out of one.

### Non-negotiable at build time

**Namespace the sibling key `trips-${relationshipId}`.** `PinTrips` becomes a
sibling of `PinFactsEditor` (`facts-…`) and `PinConnections`
(`connections-…`) in the same children list. Keying it off the bare
relationship id is precisely the collision that rendered the Facts block
**nineteen times** on 2026-07-26. Guard: `scripts/verify-jsx-sibling-keys.mjs`
already inspects this file set, including elements inside `{cond && <El/>}`
slots.

### What stays in chrome — deliberately

- **The armed "Trip from X — now pin where it went" banner** (`:1640`,
  `z-40`). This is a *mode*: the whole globe is waiting for the next click,
  and it correctly mirrors origin capture. Moving it onto a card would be the
  same mistake inverted — app-scoped state rendered inside one object.
- **Route editing** (`setRouteEdit`) is inherently spatial — it draws on the
  map. The chip opens it; the editor stays globe-level. Build should confirm
  whether the card closes or dims while routing.

### Behavioral notes

- **Arming already calls `deselect()`**, so the card closes as part of arming.
  From the card that reads correctly: you have left the pin to go find where
  the trip went. No change needed.
- **F1 disappears with no z-index work.** Nothing renders in the `top-20`
  band afterwards, so the search dropdown is unobstructed by construction
  rather than by a stacking rule someone must maintain.
- **Card density is the real risk.** The framed variant is the heaviest
  content in the strip, and the detail card is already dense — the
  reconciliation doc exists because of it. Trips is one more chip in a row
  that discloses one at a time, so the collapsed cost is a chip; the expanded
  cost needs Andy's eye on a pin with several trips.

## 4. The armed placement modal must state its mode

*(F4/F5 — Andy's second finding, same workflow, different surface.)*

Arming a trip and then picking a destination opens the **generic** pin
placement modal. It is preset — Trip type, armed pin as anchor — but it never
says **this pin is the trip's destination**. Its primary action reads
**"Add this place"** (`PinModal.tsx:338`). The intent is inferable from
studying the fields, which is exactly the work a dialog should be doing for
the user.

**The root cause is that the context is suppressed at the moment it is
needed.** The armed banner renders `{tripFromHere && !modalOpen && …}`
(`GlobeView.tsx:1639`), so the one cue explaining the placement is hidden as
soon as the modal opens.

### Class of bug (new — rule 11)

> **A generic surface reused in a specific mode must state the mode in its own
> title and primary action.** When the only cue lives in chrome outside the
> surface — worse, chrome suppressed while the surface is open — the user must
> reverse-engineer intent from secondary fields. **The tell:** a reused dialog
> whose call to action is the generic verb while the app sits in an armed
> state.

**This is the third finding today from one root theme**, which is worth more
than the three fixes: *state that an action depends on must travel with the
action's surface, not sit beside it in chrome.* Chrome-borne context gets
**occluded** (F1), **suppressed** (F4), and **looked for in the wrong place**
(F2). Moving the strip onto the card (§3) and the mode into the modal (here)
are the same correction applied twice.

### The change

When the modal opens with an armed origin **and** a trip type selected:

- **Heading:** *"Where did the trip from **My Mt. Snow Chalet** go?"*
- **Sub-line:** reuse the banner's existing language — *"Pin the place that
  marked the turn toward home."*
- **Primary action:** **"Set the destination"** (saving: *"Setting…"*), not
  "Add this place".
- **If the user changes the type away from a trip type**, the modal reverts to
  its generic heading and "Add this place" — the mode is expressed only while
  it is true. The checklist's §1 guarantee that the type stays changeable is
  preserved.

### F5 — disambiguate anchor from origin

While armed, the anchor select reads *"Which home were you living in then?"*
and is preset to the armed pin, so it presents as the trip's origin. It is
not: `suggestTripOrigin` prefers `armedOriginId` over `anchorId`, so editing
it here would silently not change the origin.

Two candidate resolutions, Andy's call:

1. **Label it in the armed case** — the anchor keeps its own prompt, plus a
   line stating the origin is already set to the armed pin and is changed in
   the framing step. Smallest, honest, adds a line of copy.
2. **Make the modal's origin authoritative when armed** — show the origin
   explicitly and let it be edited here, feeding the framing panel. Better
   model, more wiring, and it moves trip-level state into a pin-level dialog.

Recommendation: **(1)**. The framing panel is where trip-level fields belong;
this modal is placing a pin. The bug is that it *reads* as if it owned the
origin, and a label fixes the reading without moving ownership.

## 5. Related capability gap — retargeting a trip's destination

*(F6 — found in the same walk. Not UI polish: the capability is absent at
every layer.)*

`frame_trip` has no destination parameter and no sibling function supplies
one, so **a trip's destination is immutable from creation**. Trips are
captured destination-first, which means the single unchangeable field is the
one chosen when the user knows least about the journey.

### The shape of the fix

A new RPC — **additive, therefore ungated** under `CLAUDE.md`'s migration
policy (new RPCs are explicitly in the ungated list):

```
retarget_trip(p_user_id, p_trip_id,
              p_new_destination_relationship_id,
              p_demote_old_to_stop BOOLEAN DEFAULT true)
```

Behavior:

1. `validate_trip_pin` the new destination — including the one-way relaxation
   from the Loose-Ends design §7, without which a relocation still cannot
   terminate at a home. **That gated migration is a hard dependency of this
   feature**, which now has two callers rather than one.
2. Repoint `destination_relationship_id`.
3. If `p_demote_old_to_stop`, insert the previous destination as an itinerary
   stop. **Order matters** — `add_trip_stop` raises *"the destination is the
   turnaround, not an itinerary stop"* (`:204`), so the repoint must land
   first. Leg: `outbound` for one-way trips; for round trips the design must
   decide whether a demoted destination lands outbound or return (proposal:
   outbound, since it preceded the new turnaround).
4. **Never rename a user-titled trip.** `create_trip` derives the backing
   entity's name from the destination; a retarget must leave an explicit title
   alone. Only a trip still carrying its derived name should follow the new
   destination.

### Where it surfaces

On the framing panel, beside the destination — which that panel currently
states as fact ("The destination is saved") without offering any way to change
it. This is rule 11's cousin: **a panel that names a field it cannot edit
should say so, or offer the edit.** Andy went looking for exactly that
affordance and found a sentence instead.

### Scope note

This is a data-model capability, not part of the strip/modal work in §§3–4.
It is documented here because it emerged from the same walk and shares the
gated guard as a dependency; it can ship independently and probably should.

## 6. Open for Andy

1. **Does the whole strip move, or only the trigger?** This design moves all
   three variants, which is what the rule implies. Moving only "Start a trip
   from here" is smaller and fixes the discoverability finding, but leaves the
   summary content in chrome — and leaves F1 alive.
2. **Detail card only, or both surfaces?** Both is the reconciliation doc's
   answer and prevents the drift that doc was written to fix. Detail-card-only
   is less work now and recreates that exact problem later.
3. **Sequencing.** This is Phase-1 remediation, independent of the Loose-Ends
   unit. It could ship before it, after it, or alongside L1.
4. **Does `retarget_trip` (§5) ride this work or ship on its own?** It is a
   data-model capability rather than UI, it shares the gated guard as a
   dependency, and it is currently blocking a real remodel of your 1978 trip.

## 7. Cross-references

- Findings: [`../qa/2026-07-19-trip-from-here-qa-checklist.md`](../qa/2026-07-19-trip-from-here-qa-checklist.md) §Findings (F1–F3)
- Shared-component precedent: [`2026-07-20-pin-card-reconciliation-design.md`](2026-07-20-pin-card-reconciliation-design.md)
- Sibling-key rule + guard: `memory/project_lc_build_progress.md` (2026-07-26 block), `scripts/verify-jsx-sibling-keys.mjs`
- Matcher finding F3: `lib/globe/pin-search.ts`, `docs/qa/2026-07-18-globe-pin-search-qa-checklist.md`
- Roadmap position: Phase-1 remediation, [`2026-07-17-spine-and-share-roadmap.md`](2026-07-17-spine-and-share-roadmap.md) §2
