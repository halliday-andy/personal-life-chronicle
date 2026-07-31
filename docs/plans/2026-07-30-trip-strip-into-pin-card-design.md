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

## 4. Open for Andy

1. **Does the whole strip move, or only the trigger?** This design moves all
   three variants, which is what the rule implies. Moving only "Start a trip
   from here" is smaller and fixes the discoverability finding, but leaves the
   summary content in chrome — and leaves F1 alive.
2. **Detail card only, or both surfaces?** Both is the reconciliation doc's
   answer and prevents the drift that doc was written to fix. Detail-card-only
   is less work now and recreates that exact problem later.
3. **Sequencing.** This is Phase-1 remediation, independent of the Loose-Ends
   unit. It could ship before it, after it, or alongside L1.

## 5. Cross-references

- Findings: [`../qa/2026-07-19-trip-from-here-qa-checklist.md`](../qa/2026-07-19-trip-from-here-qa-checklist.md) §Findings (F1–F3)
- Shared-component precedent: [`2026-07-20-pin-card-reconciliation-design.md`](2026-07-20-pin-card-reconciliation-design.md)
- Sibling-key rule + guard: `memory/project_lc_build_progress.md` (2026-07-26 block), `scripts/verify-jsx-sibling-keys.mjs`
- Matcher finding F3: `lib/globe/pin-search.ts`, `docs/qa/2026-07-18-globe-pin-search-qa-checklist.md`
- Roadmap position: Phase-1 remediation, [`2026-07-17-spine-and-share-roadmap.md`](2026-07-17-spine-and-share-roadmap.md) §2
