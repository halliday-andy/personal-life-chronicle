---
name: Project: LC build progress — May 2026 implementation phase
description: What's been built so far in the Claude Code implementation of Life Chronicle. Step-by-step state from Step 1 (scaffold) through Step 5 (interview API). Captures decisions made during build that aren't in the PRD.
type: project
---

## Session handoff — 2026-08-04 (R22 BUILT + three agreed add-ons)

**R22 SHIPPED.** `retarget_trip` finally has a caller: the framing panel
offers **"Where did it end?"**, and the PATCH route calls `retarget_trip`
before `frame_trip` with step-specific errors (two RPCs share no
transaction, so "Failed to update trip" would have been a lie by omission
once the destination had already moved). Commits `7001a12` (payload builder
+ proof, 10/10), `be38cc8` (API), `3f01cd4` (panel + PinSelect), `b55bbf0`
(Relocation), `903a29c` (route-mode stop capture), `27c537e` (the trip-kind
proof, which missed its own commit).

**Andy approved three add-ons** beyond the spec, all built:
1. **Trip-kind selector** — `frame_trip` has always taken `p_subtype` and
   no caller ever sent one. The same gap R22 exists to close, one field over.
2. **"Relocation"** — R6 part 1 removed the guard refusing a home as a
   destination, but nothing ever said the word, so a one-way arrival at a
   home read "Road trip" and looked like a data error. Derived once in
   `lib/globe/trip-kind.ts`, used by the pin card, the Travel Journal and
   the panel. **Shipped WRONG and corrected the same day (`79ac2bd`) — see
   rule 27 below.** `destination_type_code` is attached after `get_trips` by ONE
   shared helper (`lib/trips/destination-types.ts`) called from both of its
   callers — adding it to the RPC means DROP+CREATE, a gated migration.
   **Fold it into `get_trips` when a gated migration next goes to Andy.**
3. **Pin a stop from inside route mode** — an empty-globe click during
   route-building now pins the place AND adds it to the leg. It used to do
   nothing, costing a mode exit per waypoint.

**Andy's premise was wrong and the data said so in one query.** He asked
to reframe "the vacation trip to Wendy's Calgary apartment"; the trip is
`road_trip` and was ALREADY `return_to_origin: false`. The word "vacation"
belonged to the **pin** (`vacationed_at`, the code road-trip capture mints).
One `db-query.mjs` call before building saved a wrong build — the 08-03
handoff's own lesson, applied.

**QA: `docs/qa/2026-08-04-r22-trip-destination-qa-checklist.md`** — §1 is
the acceptance (the Fiat 128 remodel, still deliberately uncorrected), §6
retypes Wendy's leftover pin, §7 is the RESTRICT/CASCADE asymmetry.

**CLASS-OF-BUG (rule 21): reusing a control for a second field must be
parameterised by what NULL MEANS there, not just by its label.** The spec
said the destination selector should be "the same shape and the same pin
list" as the origin's. Same shape, yes — but a null origin is a real state
(a draft trip is exactly one without an origin) while
`destination_relationship_id` is NOT NULL. Copied markup would have offered
the user a state the database refuses. *The tell: "make another one like
that one" where the two fields differ in nullability, domain, or the
existence of the mode an escape-hatch option hands off to.*

**REFINEMENT of rule 20 (rule 22): reading a mutable classification to
DESCRIBE is fine; reading it to FORBID is not.** Rule 20 nearly stopped the
Relocation label — the label reads the destination pin's type, exactly what
the rule warns about. The difference is that a constraint freezes a past
judgement the data can outgrow, while a label re-derives the instant the
classification changes: retype the pin and the trip renames itself, nothing
trapped. *Recorded because rule 20 is otherwise easy to over-apply into
"never read a type", which would be wrong.*

**PIN OCCLUSION FIXED (`a6f2d88`), same session.** Andy's screenshots:
searching for the **Dartmouth** primary residence and selecting it still
left it under the label banner of a work-travel marker 508 m away. **Not
density — the stacking order was inverted by construction.** Mapbox GL
3.24 sets no marker z-index, so paint order is DOM insertion order = the
`pins` array = `get_residence_pins`' `ORDER BY sort_order ASC NULLS LAST`.
Sequenced primaries sort first → created first → painted at the BOTTOM;
markers have NULL sort_order, sort last, paint on top.
`lib/globe/pin-stack.ts` states the ladder (selected > hovered > spine >
home types > markers, latitude tiebreak). `isolate` on the map container
is load-bearing — `.mapboxgl-map` opens no stacking context.
Second half: `clusterFrame` was ALREADY computing the right zoom (13.82)
and handing it to `fitBounds` as a cap the 35 km cluster span never let
bind (settled 10.81). **The 2026-07-10 "containment beats separation" rule
is now conditional on who asked** — when the user names ONE pin, that
pin's legibility outranks the tour of its neighbourhood. The J4 Queenstown
case is held by the proof. Proofs: `verify-pin-stack.mjs` 15/15 new,
`verify-cluster-frame.mjs` 8 → 15.

**LATENT BUG FOUND BY ANDY'S WALK, FIXED (`49450c5`): every line on the
globe could vanish until a page reload.** Crossing the reading-zoom
threshold swaps the basemap via `setStyle`, which **wipes every source and
layer the app added**. The rebuild hung on ONE event — `style.load` — which
does not fire on every path `setStyle` takes; when it doesn't, the sources
are gone (absent from the incoming style) and nothing restores them.
**Latent since the 2026-07-18 style-regime feature**, not a regression from
R22 or the occlusion work (git-verified: neither touched any arc/route/
line/source/setData path).

**What made it hard to see: the pins looked fine.** DOM markers are not
part of the style and do not die with it, so the globe read as "the trip
won't draw" rather than "the style was rebuilt without us" — and I spent
several passes hunting the trip-visibility gate (`tripsPanelOpen`, the R18
chip gate) before Andy's own phrasing, *"not displaying any lines at all"*,
ruled it out. **The spine arcs have no gate; if they are missing too, no
visibility logic can be the cause.** One reload settled it.

**CLASS-OF-BUG (rule 25): rebuilding on ONE event when the thing you depend
on can be destroyed by several.** State owned by a lifecycle you do not
control must be re-asserted at every settle point, guarded by *"is it
actually missing?"* — never by *"did the event I trust fire?"*.

**Rule 25 needed an immediate correction, at Andy's cost (`1ed7577`).** The
first fix listened on `style.load`, **`styledata`** and `idle`. `styledata`
fires *inside* the render/placement cycle, so adding sources and SYMBOL
layers (the arc chevrons) from it mutated the style out from under mapbox's
placement engine: `TypeError: Cannot read properties of undefined (reading
'get')` at `Placement.continuePlacement` ← `_updatePlacement` ←
`Map._render`. **The completed rule: re-assert broadly, but only at points
that are SAFE to mutate from — necessary and safe are different questions,
and a settle point that fires mid-render answers only the first.** Now
`style.load` + `idle`; recovery is deferred one settle, never dropped.

*Also a lesson about the proof:* the original 10/10 asserted that
`styledata` recovery WORKED, so it would have passed the code that crashed.
A proof written from the fix's intent, not from the constraint it must
respect, is a proof that endorses the next bug. It now pins the exclusion —
`styledata` must trigger no install and must stay out of the event list —
12/12.

**FIXED (`3ea57e9`) — a STOP now auto-opens its trips too.** R19/F23/F24
gave *destinations* auto-open; R18/F21 made that chip the thing that paints
routes. R22 made destinations movable, so Wendy's became a stop and
silently lost both — the route it drew on arrival ten minutes earlier
stopped appearing. Andy's call: a stop is a place the journey passed
THROUGH, so the journey is still the point of the pin. **Origins stay
excluded (F21)** — a home with many departures buries the map — but origin-
ness is not a veto: a pin that is both origin and stop opens. Extracted to
`lib/globe/trip-auto-open.ts` with a proof (9/9) precisely because "any
trip touching this pin" is the tidier-looking version and IS the F21 bug.
*Second time in this session that a feature's reach was found by asking
what ELSE changes when a field becomes editable — see rule 26.*

**CLASS-OF-BUG (rule 28): removing a step can remove the side effect that
was holding a surface visible (`4bd75d2`).** Route mode's empty-globe click
skipped the usual deselect — deliberately, so the first click would pin
something as the banner promised. But that deselect had been closing the
pin card, and the card (`bottom-6 z-30`, up to 55vh) sits on top of the
draft's confirm bar (`bottom-8 z-20`). So the draft appeared with no way to
confirm it. **The removed step was doing two jobs and only one was named.**
*The tell: "this path skips X because…", where X also had a second,
undocumented effect.* Fixed both ways — the click now closes the card AND
drafts, and the bar moved to `z-40` so a transient confirm outranks a
persistent card however it was opened. **Second sighting of F1's shape**
(two surfaces in one band, loser invisible rather than broken); F1 was
retired by EMPTYING the `top-20` band, and nobody emptied the bottom one.

**Third pass on the same flow (`dff4fa8`), two more surface collisions.**
(a) The draft confirm bar still said **"Add this place"** while placing a
stop, so the only two visible actions were that and the banner's **Done** —
which, as Andy put it, makes no sense before the thing even has a name.
Rule 11 again: the bar had been left generic when drafts became able to be
stops. It now names the trip and leg, and reads "Add this stop".
(b) **F4 IN REVERSE.** F4's contract is "the banner is hidden while the
dialog is open, so the dialog must state the mode itself" — and the dialog
does. But the ROUTE banner never took the `!modalOpen` guard the
origin-capture banner has always carried, and both are `z-40` with the
banner later in the DOM, **so it covered the very line F4 exists to
guarantee.** *The tell: a rule stated as "X is hidden, therefore Y must
speak" — check that X is actually hidden on every path, not just the one it
was written for.* Banner now also drops while a draft is pending: one mode
surface at a time. PinModal capped at 90vh + scroll, since its mode
statement is at the top and any content growth pushes it out of reach.

**Same report, second finding:** clicking Done with a draft pending turned
the pending stop into an ordinary pin — the save read trip+leg back from
live route state that Done had just cleared. **Intent is now captured when
the draft is PLACED.** *Sibling of rule 26: state read back later from a
source that can change in between.*

**CLASS-OF-BUG (rule 27): a DERIVED label must never replace an
OWNER-ASSERTED one (`79ac2bd`).** The Relocation reading was returned
*instead of* the trip's subtype, so a relocation could not say what kind of
journey it was. Andy set the Fiat 128 to Professional travel to test the
new kind selector and neither surface showed it — the write had worked, the
label had eaten it. **His example for why it matters: a chronology of the
major road trips of his life. That drive belongs in it and had stopped
saying so.** This is **rule 15 one step further**: owner-asserted and
machine-read must never render as peers — and here the machine-read had not
become a peer, it had *evicted* the claim. They were also **orthogonal
axes**: "road trip" is the journey's character, "relocation" is what it
accomplished; a relocation can be driven or flown, and a road trip stays
one whether or not you came home. *The tell: a derived value and a stored
one competing for a single slot — whichever wins, the other is destroyed.*
Now `tripKind()` returns both, rendered as claim + reading ("reads as a
relocation", italic/dim/unboxed, one shared constant). Deleting
`tripKindLabel` made the compiler find every call site. Proof 16 → 19,
asserting EVERY subtype survives being a relocation.

**Also settled (Andy asked directly): "Relocation" must NOT join the
subtype dropdown.** It would force a false choice between two true things,
duplicate a fact derivable from `return_to_origin` + destination type (rule
24), and freeze a reading that should re-derive when either input changes
(rule 22).

**CLASS-OF-BUG (rule 26): making a field editable breaks whatever was
keyed on its old value.** R22 turned `destination_relationship_id` into
something the owner can move, and two behaviours keyed on "is this pin the
destination" — auto-open, and the route painting gated behind it — silently
stopped applying to a pin that had just been demoted to a stop. Nothing
errored; a behaviour simply went missing. *The tell: shipping an edit path
for a field, then grepping that field's name and finding read sites that
assume it never moves.* Sibling to rule 16 (when a rule gates writing,
check it also gates reading) — the same failure one step later.

**The rule's own grep was then run.** Every other read site of
`destination_relationship_id` re-derives correctly from the current value:
the rose trip-destination halo + "trip to frame" flag (R11/R6) move to the
new destination as they should, the `?trip=` deep link lands on the current
one, and both the route gate and the `mine` filter already consider stops
and origins. **autoOpen was the only site that assumed immutability.**
*Was an observation; now BUILT (`c14a704`).* A STOP had no pin styling, so
a place a journey passed through looked like any unrelated pin. Andy asked
whether **"stop on a trip" should be a pin TYPE**. **Answered no, and the
reasoning is a standing one:** a pin can be a stop on one trip and a
destination on another (one `type_code` cannot hold that, a role SET can);
`trip_stops` already stores the fact, so a type duplicates a relation one
join away (rule 24); and *place = entity + dimension + relationship* puts
trip membership on the **relationship** shelf, not the type vocabulary.
**The gap was never taxonomic — nothing DREW the relation.** `logged_at`
remains the right answer to "what kind of place is this", which is why
route mode still defaults to it. Roles derived in
`lib/globe/trip-pin-roles.ts` (proof 13/13) so a retarget re-styles both
ends instantly with no second source of truth. Stop mark is deliberately
quieter than the destination halo — **CSS order is load-bearing**, stop
before destination, so a pin holding both roles keeps the louder mark.
Both marks added to the legend.

**BUG, same walk (`d9171d7`): the trips chip never opened on a deep-link
arrival.** Clicking Wendy's from the Journey stop list drew no arc, though
HOVERING it did — the tell that the data was fine and only the disclosure
was wrong (hover paints routes independently of the chip; selection goes
through it, R18/F21). `PinConnections` seeded `openChip` with a `useState`
INITIALISER, which runs once at mount, from `autoOpen`, which derives from
trips — and the `?pin=` deep-link branch, unlike the `?trip=` branch beside
it, does not wait for `tripsLoaded`. So the card mounted while `trips` was
empty and the chip never opened. **Rule 19's family: state seeded from
something not ready yet.** Not a retarget artifact and not stop-specific —
any pin whose trips arrived after its card mounted.

**PROOF GAP — now TWO commits (`d9171d7`, `4bd75d2`), which is the argument
for the harness rather than a coincidence.** `4bd75d2` is worse for the
harness case, not better: half of it is **z-order**, which jsdom cannot
observe at all, so a component harness would have caught the state half
(intent captured at draft time) and NOT the occlusion half. **Any harness
decision should be made knowing it covers timing and state, never layout.**
Layout stays with Andy's eye and the QA checklist.

**PROOF GAP, stated plainly: `d9171d7` shipped with NO test.** It is React
mount-order timing and this repo has no component test runner — the whole
suite is `scripts/verify-*.mjs`, pure functions and DB proofs. Extracting a
predicate would not have caught it, because the bug was WHEN the value was
read, not what it computed. **A component harness (Vitest + Testing
Library) is the real fix and is an open decision, not an oversight** — see
the same-day discussion with Andy. Until then this class is guarded only by
rule 19 and a QA step, which is weaker than everything around it.

**OPEN — long place-pickers are already unwieldy at 48 pins (Andy,
2026-08-04).** Writing a stop for the Fiat 128 he hit "Associated with
which place?" showing **every pin he owns, unsorted**, and had to hunt a
list that ran off the screen. **Quick fix taken (`4c138a3`): a stop now
defaults to the trip's DESTINATION** — his call, and the reasoning is
durable ("a trip is about getting to that destination and leaving the
origin behind"). The default had been `primaries[0]`, first on the spine
and never right for any particular reason.

**Deferred by Andy: how the app handles long dropdowns generally.** This is
an *early-stage* spine — 48 places — and the residential-completion track
(Spine & Share, Track A) is explicitly about making it much longer. Every
`<select>` of places has this problem, not just this one; `PinSelect` (R22)
is the other obvious one.

**One CONTAINED piece worth doing first, not yet done:** `anchorCandidates`
returns `logged_at`'s options as the raw `pins` array — **unsorted** —
while every other type gets `homeRank → sort_order → name`. So the Log case
is uniquely unordered, and Log is exactly what route mode mints for a stop.
Sorting that branch is one line and independent of any list-UX redesign.

**OPEN DESIGN QUESTION — the anchor family vs. the geographic
neighbourhood (Andy, 2026-08-04, from his Queenstown screenshot).** Arrival
framing gathers "the cluster" as **every pin within 30 km**, which is a
geometric proxy for a relation the schema already stores exactly. Selecting
**Year 2 Coronet Peak, Queenstown NZ** showed Ramada (164 m) and Trans
Hotel (575 m) — both anchored to the **Ski School**, i.e. *grandchildren* —
while the one pin actually anchored to the selected residence, **Coronet
Peak Ski School (12.96 km)**, was off screen. Motorcycle Trip to Sheep
Station (25.5 km) counted as a neighbour despite belonging to a *different*
residence. **So the framing showed the grandchildren, dropped the child,
and counted a stranger.**

Measured alternatives (his real coords, 2000×1450 viewport):
- geometric cluster → `zoomToFit` z10.98 vs separation z15.42 → **focus**,
  family off screen;
- anchor-family frame (residence + its Ski School) → **z12.12**: Ski School
  at 1041 px, but Ramada collapses to 13 px and Trans Hotel to 46 px — one
  occlusion traded for another.

Neither is free, which is why it was NOT built. The coherent answer is
family framing **plus** collapsing colliding neighbours' chips to bare dots
(the "focus dims its neighbours" option deferred earlier the same day) —
its own unit, needing a real design pass on *what arriving at a pin should
show you*. **Andy's instinct that the workplace belongs in frame is the
open question; nothing here settles it.**

**CLASS-OF-BUG (rule 24): a convenient proxy standing in for a relation the
schema already stores.** "Within 30 km" was chosen because it needs no
join; "anchored to" is the thing actually meant, and it is one column away.
The proxy agrees with the relation often enough to look right and diverges
exactly where the data is interesting. *The tell: a radius, a time window,
or a name-prefix match doing the work of a foreign key that exists.*
Sibling to rules 21 and 23 — all three are one decision quietly standing in
for another that was never stated.

**CLASS-OF-BUG (rule 23): DOM insertion order IS a z-order.** A list
rendered in a query's order inherits that order as a painting policy, and
an `ORDER BY` written to read "most important first" paints the most
important thing at the BOTTOM. The two orderings want opposite things and
nothing in either place says so. *The tell: a render loop over an array
that came straight from a query, where things overlap on screen and no
z-index is set anywhere.* Sibling to rule 21 — both are cases of one
decision silently doubling as a second, unstated one.

**Dive ceiling split out (`8024267`), after Andy's Queenstown screenshot.**
ONE clamp (`maxZoom: 14`) was capping both the fitBounds ceiling and the
separation target, so the focus branch computed z15.42 and settled for 14 —
his 164 m pair rendered 49 px apart, readable only because the new ladder
put the primary on top. **The ladder was covering for a discarded number.**
The two ceilings are now separate (`DIVE_CEILING = 16.5`), because "how far
may fitBounds over-zoom a tiny cluster" is not "how far may the camera dive
to make the named pin legible". Below ~70 m it stops: that is the deferred
displacement problem, not a camera problem. 49 px → 130 px.

**Still unverified by me: the visual result.** tsc, lint, 15+21 proofs and
two live-data checks all pass, but no browser walk was done — the globe
needs Andy's session. §9 of the R22 checklist covers it.

**A checklist can be written from the model being replaced.** §9's
Queenstown bullet told Andy to expect the old containment behaviour, so it
would have "failed" against correct code and passed against the bug. He
caught it by reading the screen instead of the checklist. *Write the
expectation from the code as changed, not from the habit.*

**Still open, unchanged:** destination == origin is forbidden by nothing
(the other half of deferred F22 — flagged to Andy, no guard added); the
four globe surfaces still lacking Escape; the curated-vs-raw label wording
call.

**NEXT: Loose-Ends L1–L3.** The design
(`docs/plans/2026-07-30-loose-ends-surface-design.md`) still owes Andy a
review — written before the pin card and trips changed underneath it — and
the implementation plan has never been written.

---

## Session handoff — 2026-07-30 (design day + live QA findings; NO code shipped)

Andy WALKED the trip-from-here checklist to completion — nine findings
(F1–F9). Design docs written, then **R1–R3 BUILT and pushed** (the first
code of the day; F7 closed as a pass on Andy's eye).

**BUILT 2026-07-30:** `52cf87e` R3 pin search (token-wise matching +
abbreviations + an explicit "none of your pins match"; proof extended 8 → 15
and proven red/green), `0be03e7` R1 modal dismissal (new
`lib/ui/use-escape-key.ts`; both globe modals were keyboard traps; dismissal
now PRESERVES the armed origin, only a real frame consumes it), `fb8ac78` R2
the framing panel's exit set (Discard/Keep/Save for drafts, Cancel/Save when
framed). QA: `docs/qa/2026-07-30-remediation-r1-r3-qa-checklist.md`.
**R4 BUILT `2de4ea4` — three findings, one change.** `PinTrips.tsx` carries
all three former globe strips onto the pin card (home summary / unframed
invitation / framed trip rows), owning the state the strips owned. **Mounted
BY `PinConnections` as `PinHopper` is — a deliberate deviation from the design
(which said "third sibling in each card") and a better one:** the chip row
lives inside `PinConnections`, so this is the faithful reading of "a Trips
chip on the count-chip row", AND it makes the sibling-key hazard moot rather
than handled. `PinConnections` stays ignorant of trips via one opaque
`tripCtx`. Globe keeps its own modes as callbacks (arm origin, draw route,
open framing). **The `top-20` band is now EMPTY, so F1 cannot recur by someone
re-tuning a z-index.** 162 lines of JSX removed plus the orphaned state. QA:
`docs/qa/2026-08-01-trip-strip-on-card-qa-checklist.md`.

**R4–R5 UNBLOCKED 2026-08-01** — Andy completed the pin-card reconciliation
walk, whose only finding was that the "N related pins" chip item is superseded
(the 07-26 stop-places unit removed the chip the 07-20 rename had renamed).
**Phase-1 checklists: four of five walked** — trip-from-here (F1–F9),
context-card (F10–F13), pin-facts editor (F14–F17), pin-card reconciliation.
Only **stop-places order** remains, plus the data chores.

**Context-card walk added F10–F12.** `4c657d3` **R10 BUILT**: a `##Title` on
line 1 lost to a proper heading inside pasted research, because
`deriveContextTitle` required a space after the hashes and the loose-form
fallback only ran when the note had NO heading anywhere — invisible until
pasted material started bringing its own headings (proof 15 → 17, red/green;
derived at read time so old notes self-correct). **F11 (R9, not built):** rich
paste loses tables AND all bold — turndown has no table rule and no rule for
PRESENTATIONAL emphasis (Gemini uses styled spans, not `<b>`), while
`remark-gfm` is active on render. **F10 (R8):** Andy could not reproduce the
context-chip symptom, but the detail card genuinely has no max-height and no
internal scroll inside an `overflow-hidden` viewport — latent, kept on merit.

**R11 BUILT (F13):** editing a long context note jumped the page — the
textarea was `rows={4}` regardless of content, so opening the editor collapsed
a tall rendered block into a short box and the preserved scroll offset landed
Andy in the recollections list with the editor above the viewport. Fixed with
autoFocus + `scrollIntoView` and content-sized rows (4–24, computed once).

**R9 BUILT (F11):** rich paste lost tables AND all bold. Two gaps —
`turndown` has no `<table>` rule (fixed with `turndown-plugin-gfm`; note
`remark-gfm` was ALREADY active on render, so the app could display markdown
it could not produce), and turndown understands only SEMANTIC emphasis while
Gemini marks bold with styled spans (fixed with a `presentationalEmphasis`
rule reading inline `font-weight`/`font-style`, scoped to `<span>`). Proof
10 → 15, red/green. **Known limit:** the rule reads INLINE styles; a source
using a CSS class will still flatten, and the next step there is capturing
raw clipboard HTML rather than guessing.

**R8 BUILT + VERIFIED LIVE on Zaragoza AB (F10, reproduced 2026-08-01):** opening a chip activated it and
nothing else happened — the panel opened below the fold in `PinEditPanel`,
which ALREADY scrolls; the disclosures render after the chip row inside that
container and nothing brought them into view. Fixed in shared
`PinConnections` (`scrollIntoView({ block: 'nearest' })` on open) plus a
bounded height + internal scroll on `PinDetailCard`. **My first diagnosis
named the wrong component and I closed it as un-reproducible — "cannot
reproduce" is not "not a bug".**

**R12 BUILT (F14):** the "● yours" sticky-fact marker explained itself only
through a native `title`, whose ~1s reveal delay is the BROWSER's and is not
controllable; it also never fires on touch and is announced inconsistently.
Promoted to a visible legend under the Facts heading, shown only while a
marker exists. **CLASS-OF-BUG (rule 14): meaning carried only by a native
`title` tooltip is effectively hidden.** *The tell: an explanation that exists
only in a `title` attribute.* SECOND sighting — the Journey stop ordinal was
hidden the same way on 2026-07-26 and promoted to visible text then, so the
precedent already existed and this is the pattern repeating rather than a new
judgement call.

**R13 BUILT (F15/F16, Andy's Loring AFB walk):** `residence_detail` was
missing from the fact chips on BOTH reading surfaces *and* from the client
types — the omission fossilised, though the API returned it all along, so an
owner could correct "The place itself" and never see it. And
`rough_temporal_range` rendered as a peer of editable facts while being
editable NOWHERE, restating Loring's `when` phrase in the machine's words.
**Andy's call: keep it, separate it** — it now sits under its own label,
*"The chronicle's reading · not yours to edit"*.

**R14 BUILT (F17):** residence facts rendered on NON-HOME pins — "father and
sister" on a castle visit. The facts EDITOR always gated on `isHomeType`
(`PinEditPanel:475`); the two READING surfaces never gated at all. **The write
side was scoped and the read side was not** — an asymmetry, not a regression;
R13 merely made it conspicuous. Both reading surfaces now use the same shared
predicate. `verify-anchor-options` gained the coverage of `isHomeType` it
never had, pinning HOME_TYPES membership so widening it can't silently put
residence facts back on vacation pins.

**R15 BUILT (F18):** a place title in Journey dragged as a LINK. Only direct
children get the draggable `<li>`; grandchildren have no drag handlers — what
dragged was the `<a href>`, natively draggable in every browser. **The bigger
half: the same native drag hijacked DIRECT children**, so grabbing a
draggable row by its title started the anchor's drag instead of the row's and
reorder-by-title silently failed — it only worked if the row was grabbed
outside the link. `draggable={false}` on both `ChildRow` links fixes both.

**R16 BUILT (F19):** hovering a pin peeked its tethers but never its TRIPS.
Two line systems disagreed about hover — the tether effect always honoured
`hoverPreview`, the route effect honoured only `selectedId` / the global
toggle / route-building. Hovering the trip's far end showed THAT pin's tether
to its anchor, a different system, which made the behaviour read as a
one-sided link rather than a missing one. **CLASS-OF-BUG (rule 18): two
systems drawing the same kind of thing must agree about what reveals them.**
*The tell: a reveal gesture that works from one end of a relationship and not
the other.*

**BUT THE REPORTED CASE WAS NOT THIS BUG.** No trip touches Coronet Peak Ski
School (verified: 0 rows) — the Dirt Bikes trip belongs to the similarly-named
RESIDENCE "Coronet Peak, Queenstown NZ" a few hundred metres away, and at that
zoom its arc reads as pointing at the workplace. The app was correct; the
asymmetry I fixed was real but was not what Andy hit.

**PERSONAL PATTERN worth naming (2nd occurrence today, after F10's wrong
component): VERIFY THE PREMISE BEFORE FIXING.** One query — "does any trip
touch this pin?" — would have settled it before a line was written. Reading
code and finding *a* plausible cause is not the same as confirming *the*
cause. Andy's data is queryable; use it first.

**CLASS-OF-BUG (rule 17): a natively-draggable element inside a drag-to-
reorder row steals the gesture.** Links and images drag by default; an `<a>`
inside a `draggable` `<li>` wins over its parent. *The tell: reorder that
works only when you grab the row's whitespace.*

**R17 BUILT (F20):** the chronicle's three line tiers were coloured for
NOCTURNE and hardcoded at layer creation, so on the daylight basemap a Log's
dashed tether all but vanished on greens and beiges. The 2026-07-18 regime
swaps the canvas and re-installs the layers, but nothing re-tuned what was
drawn on it. `chronicleLinePaint(regime)` now lives beside the regime logic.
**Blur was the worst offender — a soft edge reads as GLOW on dark and SMUDGE
on light**, so daylight drops it, raises opacity, and darkens hues. Identity
preserved across regimes; only values change. Proof gained four assertions
aimed at the actual failure mode: every tier defined in both regimes, daylight
never fainter, daylight never blurrier, tiers mutually distinct. **Another
instance of rule 16's shape.**

**R18 BUILT (F21):** a selected pin painted its trip routes even with routes
toggled OFF, with no escape — `tripsVisible || touches(t)` made the legend
additive only, and R10's "always show the selected pin's trips" assumed one or
two. **R16 (hover) widened the same override earlier the same evening.** Now
the card's ✈ chip gates it: opening shows, closing hides, hover stays a
transient peek. Control sits on the pin's own surface (rule 10) and reuses R4.

**F22 DEFERRED to the visual-language pass:** when a trip destination is
anchored to that trip's ORIGIN, tether and route draw the SAME segment
(confirmed — Sheep Station's anchor is Coronet Peak, Queenstown NZ, the trip's
origin). Correct suppression is conditional on that pair's route being drawn,
which needs the two line effects to coordinate; unconditional suppression
would lose the only "belongs to that home" cue when routes are hidden.

**R19 BUILT (F23/F24):** the detail card could reach ~85% of the viewport in
the middle of the map, so opening the trips chip cost you the globe — capped
at **55vh** (it has scrolled internally since R8) with a new ember-tinted
`.globe-scroll` bar, applied to the edit panel's column too so the two globe
surfaces share one vocabulary. And a trip's **DESTINATION** now auto-opens its
trips panel (painting the route via R18's gate) — **destinations only**, since
an origin may have many departures, which is what R18 just stopped from
burying the map.

**GOTCHA worth keeping: child effects run BEFORE parent effects.** Reporting
the trips panel's closed state on UNMOUNT had to live in `PinTrips`; a reset
in `GlobeView` keyed on `selectedId` fired AFTER the child reported itself
open and silently clobbered the auto-opened panel. *The tell: a parent
"reset on change" effect racing a child's mount effect.*

**R20 BUILT (F25):** the globe's DRAFT CONFIRM BAR had no Escape. R1 fixed
`PinModal` and `TripFramePanel` and **missed a third surface of the same
kind** — a transient state with a Cancel. Gated on `draft !== null &&
!modalOpen`, exactly the bar's render condition, so two handlers can never
fire for one keypress. The R1 checklist ALSO mis-described the bar as "the pin
placement modal", which is what sent Andy to the wrong surface — reworded to
walk both in order. **Lesson: when fixing a class of surface, ENUMERATE the
class.** Two were obvious; the third only surfaced because a QA step described
it wrongly. Remaining candidates of the same kind, NOT yet given Escape:
route-building, origin capture, the armed trip banner, refine-location.

**R21 BUILT (F26):** re-framing a trip showed an EMPTY title and year —
`TripFramePanel` initialised both to `''` unconditionally, so the panel only
ever behaved as if framing a FRESH draft and an edit never loaded saved
values. Compounded by the placeholder `e.g. "The {destinationName}
conference"` where `destinationName = t.title || t.destination_name`, so a
titled trip had its own title quoted back inside the example — it looked like
ghost text of his title in an empty field. **No data loss:** `frame_trip`
COALESCEs both, so empty meant "unchanged". *Known limitation, unchanged: a
title or when_text therefore cannot be CLEARED through the panel, only
replaced.*

**CLASS-OF-BUG (rule 19): a form reused for CREATE and EDIT must load current
values on the edit path.** *The tell: state initialised to a literal `''`
rather than from the record.* Cousin of rule 11 (a generic surface reused in a
specific mode must state the mode) — same root, one component serving two
jobs and only remembering one of them. Third such finding in this panel after
F9b's exit labels and F5's anchor/origin conflation.

**R5 BUILT (F4/F5):** the armed placement modal now states its mode —
heading *"Where did the trip go?"*, sub-line naming the origin, action **"Set
the destination"** — and reverts to the generic dialog if the type is changed
away from a trip, so the mode is stated only while TRUE. F5's clarifying line
says the anchor is the era, not the origin. **The remediation pass is now
complete except R6**, which carries the gated migration.

**R6 PART 1 APPLIED 2026-08-03** (gated, Andy approved, applied by filename):
`20260803120000_trip_destination_guard_removed.sql` **REMOVES** the "a primary
residence cannot be a trip destination" rule — not the relaxation originally
designed. **Andy's scenario killed the premise:** a ROUND trip to view a house
under construction, which becomes home six months later; the journey never
changed, the world did, yet the trip became unsaveable — and recording it
after the move was refused outright, since `create_trip` ran the same test.
**PIN TYPES DESCRIBE THE PRESENT; TRIPS DESCRIBE THE PAST**, so any rule keyed
on a destination's current type misjudges a life where places change role.
`return_to_origin` already carries the distinction, asserted by the owner.
`p_allow_spine` existed only for this rule (1 of 4 call sites passed false) so
it was removed, not made conditional — DROP + CREATE with an orphan-overload
proof. Retained: ownership, globe-pin check, and `add_trip_stop`'s turnaround
refusal (about a trip's own shape, not a pin's type). Proof
`scripts/verify-trip-destination-guard.mjs` 9/9, read-only. **R6 PART 2 APPLIED 2026-08-03:** `20260803130000_retarget_trip.sql` —
`retarget_trip(user, trip, new_destination, demote_old_to_stop = true)`.
Additive. **Order is load-bearing:** `add_trip_stop` refuses the CURRENT
destination, so the old one can only be demoted AFTER the repoint lands; the
demotion routes through `add_trip_stop` rather than a bare INSERT so
validation and positioning stay in one place. Promoting an existing STOP
deletes its stop row first (a pin must never be both). An UNTITLED trip's
derived entity name follows the move; a TITLED trip keeps the owner's
sentence untouched. Proof `verify-retarget-trip.mjs` 8/8, run inside a
ROLLED-BACK transaction against real pins as fixtures. **The Fiat 128 remodel is DELIBERATELY NOT DONE** — Andy's call 2026-08-03:
correcting it with SQL would spend the only end-to-end QA fixture for R22.
**Do not "helpfully" fix it.**

**NEXT UNIT — R22**, fully specced at
`docs/plans/2026-08-03-r22-trip-destination-ui-design.md`: `retarget_trip`
exists and is proven but NOTHING CALLS IT, so a trip's destination is
changeable only by an agent running SQL. R22 adds the API path and a
destination selector on the framing panel (~an afternoon), and its acceptance
is Andy performing the 1978 remodel himself in the UI.

**SESSION HANDOFF: `docs/plans/2026-08-03-handoff-prompt.md`** — written at
the context limit with nothing mid-flight.

**CLASS-OF-BUG (rule 20): a constraint keyed on a MUTABLE classification
misjudges history.** Validating a past fact against a present type produces
false refusals as the world changes. *The tell: a rule that reads an entity's
current type to decide whether a past event was legitimate.* Earned when
Andy's counter-example broke a guard I was about to extend rather than remove.

**PRINCIPLE (rule 16): when a rule gates writing, check it also gates
reading.** Three sightings now of the same shape — the pin-card
reconciliation drift (edit panel showed LESS than the card), F15
(`residence_detail` editable but rendered nowhere), and F17 (facts scoped on
write, unscoped on read). *The tell: a predicate imported by a reading surface
but used only for something incidental.*

**PRINCIPLE (rule 15): show whose claim it is.** The "● yours" marker (R12)
and "the chronicle's reading" (R13) are counterparts — owner-asserted and
machine-read must never render as peers. *In an app that stores biography,
whose sentence it is is not decoration.* Sibling of the 07-26 rule that
placeholder text must be unmistakably illustrative.

**CLASS-OF-BUG (new, rule 13): a mode switch that changes an element's height
must keep that element in view.** Suspected at F10, confirmed at F13 — two
sightings. Replacing rendered content with an editor collapses the document,
and a preserved scroll offset then points somewhere meaningless.

**CLASS-OF-BUG (new, rule 12): test a converter against captured REAL input,
not idealised markup.** A synthetic `<b>` fixture proved bold survived rich
paste; Andy's actual source marks bold presentationally, and all of it was
lost. *The tell: a fixture nobody copied from a real producer.* Sibling of the
07-26 rule that a guard which has never failed on its own bug is unproven.

- **START HERE next session: `docs/plans/2026-07-30-phase1-remediation-plan.md`**
  — the finding register + build order R1–R7. **Sequencing agreed with Andy:
  remediation ships as ONE pass BEFORE Loose-Ends L1.** Findings from the
  four remaining Phase-1 checklists **append to its §1**, never to a new doc:
  a finding that lives only in a walked checklist dies when that checklist is
  archived. Evidence stays in the checklist; the DECISION lives in the plan.
  **All four open design questions were resolved 2026-07-30 — R1–R5 are fully
  specified and unblocked; R6's migration is approved as written and applies
  at R6; R7 needs only Andy's A/B glance.** Build may start from the plan
  without further design work.

- **Loose-Ends surface designed** — see [[project_lc_loose_ends_design]] and
  `docs/plans/2026-07-30-loose-ends-surface-design.md`. Drafted, awaiting
  Andy's review.
- **Trip strip → pin card designed** —
  `docs/plans/2026-07-30-trip-strip-into-pin-card-design.md`, from Andy's live
  QA. Design only; three §4 questions open for him.
- **CLASS-OF-BUG (new, rule 10): a control scoped to a selected object
  belongs on that object's surface.** Rendered into global chrome — above all
  next to a global control — proximity assigns it to the neighbour's
  intention, and users hunt for it where the app's conventions say it lives.
  *The tell: an action that reads `selectedId` but renders outside the
  selected thing's card.* Earned from "Start a trip from here" living under
  the search box: Andy searched the detail card and edit panel for it and
  failed, while every other pin-scoped control (`PinFactsEditor`,
  `PinConnections`, `PinHopper`) already sat on the pin's surfaces. **No
  static guard proposed** — the check is "does this render inside the selected
  object's subtree", a judgement about intent, not a shape a linter sees.
- **The same misplacement was also a functional bug.** The strip (`z-30`,
  `top-20`) paints over the search dropdown (`z-20`, `top-6`, expanding down),
  hiding pin-search's "Your pins" group, which renders at the top of the
  merged results. **Corollary worth keeping: a UX misplacement and a stacking
  bug can be one root cause** — the control in the wrong lane was covering
  that lane's output.
- **Third silent-failure path in globe search.** `searchPins` matches the
  WHOLE query as a substring (`name.includes(q)`), so `Mount Snow Chalet`
  misses the pin actually named **"My Mt. Snow Chalet"** (`mount` ≠ `mt.`).
  Indistinguishable from the occlusion above and from the known append trap —
  all three render as nothing. **"No pins matched" must be said out loud.**
- **CORRECTED 2026-08-01 (Andy):** an earlier note here claimed "Wendy's
  shared apartment" was a residence workaround that belonged on the spine.
  **It was never a residence.** It is a legitimate non-spine pin, and in the
  1978 Fiat 128 relocation it should be an itinerary **STOP** — the trip runs
  My Mt. Snow Chalet → *stop* Wendy's apartment → **SSV Day Lodge Room** as
  destination. Nothing to retype; the only remodel is the retarget. Also confirmed: 14 sequenced stops, **4 residences with
  `sort_order` NULL** (26th Street Santa Monica, Brookbend Drive Des Peres,
  Peabody Terrace HBS, Canmore House).
- **CLASS-OF-BUG (new, rule 11): a generic surface reused in a specific mode
  must state the mode in its OWN title and primary action.** When the only cue
  lives in chrome outside the surface — worse, chrome *suppressed* while the
  surface is open — the user reverse-engineers intent from secondary fields.
  *The tell: a reused dialog whose CTA is the generic verb while the app sits
  in an armed state.* Earned from "Start a trip from here": the placement
  modal opens preset (Trip type, armed pin as anchor) but says only **"Add
  this place"**, and the armed banner carrying the context renders
  `{tripFromHere && !modalOpen && …}` — **suppressed exactly when needed.**
- **The through-line of all four findings, worth more than the fixes:** *state
  an action depends on must travel with the action's surface, not sit beside
  it in chrome.* Chrome-borne context gets **occluded** (F1), **suppressed**
  (F4), and **hunted for in the wrong place** (F2). One correction applied
  twice: strip → card, mode → modal.
- **F5 (latent, not user-reported):** for trip pin types the anchor prompt is
  "Which home were you living in then?" and is preset to the armed pin, so it
  READS as the trip origin. It isn't — `suggestTripOrigin` prefers
  `armedOriginId` over `anchorId`, so editing it there silently would not
  change the origin. Recommended fix is a clarifying label, not moving
  trip-level state into a pin-level dialog.
- **F6 (Andy; CAPABILITY GAP, blocking real work): a trip's destination is
  IMMUTABLE.** `frame_trip` takes origin/title/when/year/subtype/
  return_to_origin/clear_origin — **no destination** — and no sibling function
  supplies one. Severe because capture is destination-FIRST: the one
  unchangeable field is the one chosen when the user knows least about the
  journey. Andy hit it remodelling his 1978 trip (`594fa9aa`) as chalet →
  *stop* Wendy's apartment (which IS in Calgary — one pin, two names; not a
  separate waypoint) → **SSV Day Lodge Room** (Sunshine Village, Banff) as
  destination; blocked twice (no retarget function, and SSV
  Day Lodge Room is `lived_at` so the still-gated guard refuses it). That trip
  is ALREADY one-way with the right origin and zero stops — the destination is
  its only wrong field and its only unchangeable one. **Andy is in no rush to
  repair the data** — the capability gap stands on its own. Note the chalet is spine `sort_order` 12 and SSV Day Lodge Room is 13
  — CONSECUTIVE, so this relocation lives in the interstice between them: a
  live instance of the Loose-Ends seam design's §3.5. **Do NOT delete-and-recreate** — `delete_trip` loses
  the title, framing and trip-entity jots, and `create_trip` runs the same
  guard so it would fail anyway. Fix sketched as a new additive RPC
  `retarget_trip(..., p_demote_old_to_stop)`; retarget must land BEFORE
  demoting the old destination to a stop (`add_trip_stop` refuses the current
  destination), and it must never rename a user-titled trip.
- **The gated trip-terminus relaxation now has TWO dependents** — the seam's
  one-way trips and `retarget_trip`. Raises its priority.
- Andy's call: **do not patch the occlusion blocker** — he can navigate around
  it, and the redesign matters more than an intermediate fix.

## Session handoff — 2026-07-26 (pin-facts editor UI — the 07-10 design closed)

Andy resumed QA at the 2026-07-19 "start a trip from here" checklist this
evening; the build side finished the pin-facts editor.

- **QA checklists caught up** (`81ade7b`): Andy's live check-offs since
  07-18 recorded against the original checklists — globe pin search
  COMPLETE (all §1–§8), unsequenced residences §5–§6, UI-checklist §4
  spine remnants **and all of §5 photos/gallery** (done ahead of its
  Phase-5 slot). Master Phase 1 now has three checklists left:
  trip-from-here (in progress), context-card, pin-card reconciliation —
  plus the data chores (Phillips Exeter merge, Leola alias, ~5 stubs).
- **Pin-facts editor UI BUILT** (`59a6be2`; closes
  `docs/plans/2026-07-10-pin-facts-editor-enhancement.md`, whose data
  layer shipped 07-20): `components/globe/PinFactsEditor.tsx` on the edit
  panel — two selects + two text fields, **immediate per-field saves**,
  each edited field marked "● yours" and sticky against re-extraction,
  plus **↻ Refresh from recollection** (POSTs, emitting the same
  `globe/pin.saved` a text save emits, so stub resolution rides along).
  Homes only via a newly exported `isHomeType` (anchor-options), so the
  anchor picker and the facts editor share ONE definition of home-ness.
  New route `app/api/globe/residence/[id]/facts` — deliberately NOT
  folded into the pin PATCH, which takes the full field set every save
  (folding in would make an untouched fact indistinguishable from a
  cleared one and mark all four owner-edited on every save, freezing out
  extraction entirely). Proof `verify-sticky-facts.mjs` **26/26** (was
  16/16). **VISUAL PENDING Andy's eyeball** — QA
  `docs/qa/2026-07-26-pin-facts-editor-qa-checklist.md` (§3 is the one
  that matters: the sticky invariant proven live).
- **Two GET defects fixed en route**, both live the moment editing ships:
  `facts` was gated on `globe_extraction` existing (so an owner's edit on
  a never-extracted pin would save and render as nothing), and
  `residence_detail` was never returned at all — the route read facts
  inline and had already drifted from the proven `readCurrentFacts`.
  **Class-of-bug: a route that re-reads a persisted shape by hand drifts
  from the proven reader — read through the reader.**
- **`mergeFactsIntoMetadata` is now the ONE writer** of the persisted
  fact shape (top-level `residence_type`/`move_reason` + the
  `globe_extraction` mirror + `facts_owner_edited`); `runGlobeExtraction`
  calls it too, and it's MERGE-only in both directions so an owner edit
  preserves the extraction audit trail (mentioned_people, confidence,
  extracted_at). **Class-of-bug: two writers of one persisted shape
  drift — extract the writer, don't re-derive the shape** (the storage
  sibling of 07-20's PinConnections rule for two renderers).
- **`lib/globe/fact-vocabulary.ts` is the ONE vocabulary** — the model's
  tool enum and the editor's selects both read it. **Class-of-bug: a
  controlled vocabulary duplicated between the model's schema and the
  owner's picker drifts into values one side can emit and the other
  can't.**
- **KB updated in the same change** (standing rule): "The facts read from
  a home's recollection" section in `kb-recollections-and-jots.md` +
  README index row.
- **Deferred, flagged to Andy:** no "un-stick" control (a fact, once
  owner-edited, can't be handed back to extraction); the detail-card and
  Journey chips still de-underscore raw codes ("family care") while the
  editor shows curated labels ("Caring for family") — one line to unify,
  Andy's call which wording wins; refresh waits a fixed ~3.5s for the
  async re-read rather than tracking progress.
- **BUG from Andy's live QA, fixed same session (`ee67828`): the Facts
  block rendered NINETEEN times.** `PinFactsEditor` and `PinConnections`
  are siblings in the same children list and BOTH used
  `key={pin.relationship_id}` — React reconciles siblings by key, so the
  collision made it duplicate them. React warns, but only at runtime in
  dev. Fixed by namespacing both keys by role (`facts-${id}` /
  `connections-${id}`). **Class-of-bug: when several sibling components
  each reset on the same entity, keying them all off that entity's bare
  id collides — namespace sibling keys by ROLE.** Guard:
  `scripts/verify-jsx-sibling-keys.mjs` (TypeScript AST, 41 files),
  proven red/green. **Second lesson worth keeping: the FIRST version of
  that guard passed while the bug was present** — it only inspected
  direct element children, and these two sit inside `{cond && <El/>}`
  slots. Caught only by reintroducing the bug to test the test. *A guard
  that has never failed on the bug it was written for is unproven.*
- **Journey stop ordinals (`670ab15`)**, from Andy's question about
  cross-surface navigation: the globe card reads "STOP 8 OF 14" but
  Journey showed nothing — except it DID compute the same ordinal and
  hid it in a hover `title` (invisible to touch, screen readers, and
  scanning). Promoted to visible text in its own gutter left of the rail
  (Andy's placement call), plus an `sr-only` "Stop N." in the heading
  since the rail is aria-hidden. **Design calls: the ordinal is
  ORIENTATION, not identity** — it renumbers on any earlier insertion,
  so name + when-phrase stays the durable handle and the deterministic
  links keep navigating by pin identity; **no denominator in Journey**
  (whole arc visible) but **kept on the globe** (can't see the whole
  spine; a rising total reads as accumulation, serving the undaunting
  brief); unplaced/unanchored stay unnumbered. KB `kb-navigating.md`
  updated same commit.
- **Claude can now drive the running app** — the Chrome extension
  connects once the **Claude side panel is open** in Chrome (installed +
  site-permitted is NOT enough; a clean Chrome restart alone did not do
  it). `list_connected_browsers` → `select_browser` → `tabs_context_mcp`.
  The Journey page verifies cleanly; the **globe often fails to finish
  its Mapbox init on repeated hard navigations** in the automated tab
  (the API is healthy — ~950ms, all 37 pins), so globe visuals may still
  need Andy's eye. Beware: typing into the search box APPENDS to any
  existing query and a stray Places pick drops a draft pin (cancel it).
- **Journey reading fixes, from Andy's QA of his own Dartmouth stop:**
  cited recollections were cut off at 240 chars and read as unnavigable
  — they WERE links, but with only a hover colour as affordance. Now
  **"… more" expands the full text INLINE** (`6d6cda5`), because Journey
  is the reading surface and sending the reader to /memories costs them
  their place. **Class-of-bug (2nd sighting): a truncated excerpt whose
  continuation lives elsewhere needs an explicit continuation affordance,
  never a hover state.** Also **spine-derived ordering** (`51972bb`): the
  list was `created_at DESC` (capture order), now sorts by stop, then
  position within the stop, then oldest-first — chronological in effect,
  nothing parsed (`lib/journey/recollection-order.ts`, proof 14/14).
  Known limit, pinned in the proof: a recollection filed on one pin but
  ABOUT an earlier time sorts at its host pin.
- **Context zero-state fix** (`bd0e9ce`): the context chip was gated on
  `context.length > 0` and the add link lives inside it, so **ten of
  fourteen homes had no route to adding context at all**. **Class-of-bug:
  never hide the control that CREATES the first item behind the existence
  of an item.** (Sibling of the 07-20 finding that "add" was too
  prominent — demoting it into a disclosure that could be absent went one
  step too far.) The checklist itself was also stale, still naming a
  label the pin-card reconciliation had renamed hours later.
- **STOP PLACES: elevated + owner-ordered, three pieces** (`70fdb4d` data
  layer + 19-case proof, `adbdfd0` API + tree ordering, `4a4d853` Journey
  drag, `2e69c03` globe card). From Andy's Mt. Snow Chalet finding: a
  four-month short-term stay inside a twelve-month home was invisible
  behind a faint "2 related pins" chip at the bottom of a long card. Now
  its own block ABOVE the chips on both globe surfaces, each row with its
  kind label and era phrase, in the owner's **drag order** — Andy's call:
  "instead of forcing the user to follow a convention in the assertion of
  time ranges, I'd prefer this be drag-and-drop orderable." Nesting kept;
  grandchildren follow their parent and don't drag (his call). Two
  migrations applied and verified, incl. a **gated `DROP FUNCTION`** on
  `get_residence_pins` to add a return column (Andy approved).
- **"chapter" → "stop" rename** (`aff4bd7`) + new memory
  [[project_lc_thematic_chapters]]. "Chapter" is reserved for a future
  user-defined PUBLICATION object spanning many stops and overlapping
  others — Andy: "nearly the same thing as a shareable collection", so
  roadmap §4 must decide if they are ONE object. The rename was bigger
  than a refactor: **"chapter" was already user-facing in four KB
  articles, three seeded 07-19**, teaching users the wrong word. All four
  revised. `user_periods` stays dormant; the 2026-04-30 decision stands.
- **Accessibility policy** ([[feedback_lc_accessibility_deferral]],
  `cf9f9e5`): dedicated keyboard work defers toward MVP; free-with-the-
  build semantics always ship; take the accessible path when a feature
  makes it cheap; never skip silently. Debt list in roadmap §5.
- **Claude can now drive the running app** — the Chrome extension
  connects only while the **Claude side panel is OPEN** (any tab, any
  window; the MCP uses its own tab group). `/journey` and `/memories`
  verify cleanly; **the globe often fails its Mapbox init in the
  automated tab**, so globe visuals stay Andy's. Trap: the globe search
  box APPENDS to an existing query and a stray Places pick drops a draft
  pin.
- **NEXT:** the **Loose-Ends surface design doc** (roadmap §3) —
  design-first, Journey-doc pattern, Andy's agreement before any code.
  Full handoff at `docs/plans/2026-07-27-handoff-prompt.md`.
  **Five checklists await Andy's live pass** (trip-from-here = his resume
  point, context-card, pin-card reconciliation, pin-facts, stop-places);
  pin-facts §2/§3 write to his real chronicle so they need his go-ahead.
  Deferred + named: grandchild reorder (endpoint ready, UI unwired),
  keyboard reorder, the fact un-stick control, unifying fact-chip wording.

## Session handoff — 2026-07-20 (context-card fix + pin-card reconciliation + sticky facts data layer)

Andy QA'd live while this session built; he checked off **unsequenced
residences** and **Slice 3 close-out** in the master sequence (Phase 1).
Three units shipped, all pushed, proofs where there's pure logic:

- **Context-card finding fixed** (Lockbourne card, `74ea542`+`6bca349`):
  the "N context" chip led with "＋ add context" over the actual note
  rendered as dim, dead-looking text (inverted hierarchy), and derived
  titles leaked raw `##`. Root causes: the context block was written
  add-first with weak-affordance rows; `deriveContextTitle` only accepted a
  heading WITH a space after the hashes (`## Foo`), so `##Foo` fell through
  to the raw first line. Fixes: notes-first + strong affordance (Andy's
  call: navigate-with-strong-affordance), and strip a leading ATX-hash run
  in the title fallback (`verify-derive-context-title.mjs` 15/15).
  **Class-of-bug: a derived plain-text label must never carry through block
  markdown (leading hashes), spacing regardless.**
- **Pin-card reconciliation** (design `docs/plans/2026-07-20-pin-card-reconciliation-design.md`;
  `af19c86`/`77fc099`/`324fb20`, Approach A): the detail card and edit panel
  each rendered the pin's connected collections independently and had
  DRIFTED — the bigger edit panel showed LESS (no context, no related pins).
  Extracted `components/globe/PinConnections.tsx`, mounted by BOTH cards; the
  edit panel is now the pin's workbench. Folded in Andy's two directives:
  "N anchored" chip → **"N related pin(s)"**; **"＋ Add New Context ↗"**
  deep-links to `/entities/[id]?addContext=1`, which auto-opens the composer
  (EntityView reads the param client-side). Hopper is per-variant (card = 4th
  single-open chip; panel keeps its own full always-open hopper). **Class-of-
  bug: two surfaces rendering the same data drift — extract a shared
  component, don't copy the markup.** tsc+lint green; **VISUAL PENDING Andy's
  eyeball** (Claude is auth-blocked from the running app) — QA
  `docs/qa/2026-07-20-pin-card-reconciliation-qa-checklist.md`.
- **Sticky pin-facts DATA LAYER** (`3679df6`; the pin-facts editor's
  foundation, plan `docs/plans/2026-07-10-pin-facts-editor-enhancement.md`):
  `runGlobeExtraction` overwrote every fact on each re-run, clobbering owner
  corrections. New pure `lib/globe/sticky-facts.ts` (`verify-sticky-facts.mjs`
  16/16): owner-edited fields (provenance in
  `relationships.metadata.facts_owner_edited`) survive re-extraction;
  extraction stays frontline for untouched fields. Integrated into
  runGlobeExtraction (raw model output still logged for audit; metadata stays
  MERGE-only). **Class-of-bug: an owner-editable field an agent also writes
  needs per-field provenance so the agent can't clobber the owner** (kin to
  merge-substance-preservation). `applyOwnerFactEdit` write helper is built +
  proven for the UI step.
- **Pin photo ordering / carousel foundation** (`b325ec7`/`6a4c2ad`/`7609ecb`;
  design `docs/plans/2026-07-20-pin-photo-ordering-design.md`): from Andy's
  UI-checklist §5 finding — photos landed at the front and sequential adds came
  out reversed because the gallery sorted by `created_at` DESC with no stored
  order. Added `entity_media.sort_order` (additive migration, no gate, applied
  + column-verified); pure `lib/globe/pin-image-order.ts`
  (`verify-pin-image-order.mjs` 8/8); backend appends at end + `reorderPinImages`
  (PATCH `{order}`) + promote drops the former primary to the carousel END
  (primary = cover, **decoupled** from sequence — Andy's model); drag-to-reorder
  UI in the edit-panel gallery (native HTML5 DnD, primary not draggable). **No
  backfill** (Andy reinstalls the few old multi-photo pins). **Deferred:
  keyboard-accessible reorder** (drag is pointer-only) + the carousel/slideshow
  presentation itself. Andy can QA this one **live** (not auth-blocked). QA
  `docs/qa/2026-07-20-photo-ordering-qa-checklist.md`.
- **Legend swatch fix** (`93be8de`): the Legend's Second residence & Vacation
  icons rendered as tiny black rectangles — the swatch applied the per-type
  MODIFIER class without the base `globe-pin` (unlike the on-globe markers), and
  those two modifiers inherit size + background from the base. Now
  `globe-pin ${modifier}`; a doc comment on `pinTypeClass` tells consumers to
  always prepend the base. **Class-of-bug: a modifier-only CSS class applied
  without its base collapses to its box-shadow.** From Andy finalizing the
  2026-07-18 pin-search QA.
- **Andy confirmed pin-facts defaults:** all four facts editable
  (residence_type / residence_detail / household_composition / move_reason);
  a user-triggered "refresh facts from the recollection" button + the queued
  offer-after-text-edit.
- **NEXT (2026-07-20 session closed here):** Andy resumes QA **tomorrow at the
  2026-07-19 "start a trip from here" checklist**
  (`docs/qa/2026-07-19-trip-from-here-qa-checklist.md`, Phase 1). Pending his
  live eyeball (Claude is auth-blocked from the running app): the pin-card
  reconciliation + the photo reorder. Build units still queued: the pin-facts
  editor **UI** (four fields + refresh button on the workbench, using
  `applyOwnerFactEdit`), then the **Loose-Ends surface design doc** (roadmap §3).

## Session handoff — 2026-07-18 (Spine & Share direction set; two Phase-1 riders BUILT)

- **2026-07-17: the Spine & Share roadmap is the active forward plan**
  (`docs/plans/2026-07-17-spine-and-share-roadmap.md`; direction memory
  [[project_lc_direction_2026-07-17]]): Track A = complete birth-to-now
  spine in weeks via a Loose-Ends surface (design doc next); Track B =
  shareable spine + Shareable Collections. All open QA consolidated into
  `docs/qa/2026-07-17-master-qa-sequence.md` (five phases, objective
  order, not build order). Plans folder archived/re-homed the same day;
  June Gemini commentary folded in 2026-07-18 (four inputs to the
  Collections design, one to Loose-Ends).
- **Globe pin search BUILT 2026-07-18** (`01cd5ee`/`aa04524`/`2e8d957`),
  from Andy's first Phase-1 QA finding: FindLocationBox rebuilt headless
  on SearchBoxCore — merged dropdown, "Your pins" (ALL types; matcher
  `lib/globe/pin-search.ts`, proof 8/8, tiered + diacritic-tolerant +
  spine-first) above Mapbox places; pin pick = `framePinOnMap` (extracted
  from the ?pin= deep-link effect — cluster-aware, compact-card arrival);
  route-building treats a search pick as "add this stop". Preserved:
  lat,lng paste (reverse-geocoded) + suggest-failure swallowing.
- **Basemap regime BUILT 2026-07-18** (Andy's Sunshine Village
  comparison; his call: outdoors style, build now): nocturne = canvas at
  world/regional zoom; ≥13.2 crosses to `outdoors-v12` detail, ≤12.6
  back (hysteresis `lib/globe/style-regime.ts`, proof 8/8; dissolve via
  `.globe-basemap-fading`, reduced-motion safe). **Class-of-change note:
  `setStyle` wipes all sources/layers/images** — chronicle layers now
  install idempotently on EVERY `style.load`, seeded from `lineDataRef`
  (latest arcs/tethers/commutes/routes FCs) + `activeArcRef` (selected
  leg emphasis), so swaps come back fully drawn with no effect re-runs.
  Fog is nocturne-only. `.globe-daylight` lands on the container as a
  daylight CSS tuning hook (pills carry their own dark backgrounds — no
  flip needed up front).
- **BUG + fix (2026-07-18, Andy's Phase-1 repro): decide-later primaries
  landed SEQUENCED at the spine's end.** PinModal produced
  `unsequenced: true` and the API/RPC honored it — but GlobeView's
  handleSave re-typed the PinDraftData field list into the POST body and
  never added U9's `unsequenced`; position:null then meant "append".
  (Edit path uses the sequence endpoint — that's why correcting worked.)
  Fix: payload assembly extracted to
  `lib/globe/create-pin-payload.ts` with a `satisfies
  Record<keyof PinDraftData, unknown>` exhaustiveness guard — adding a
  PinDraftData field now fails COMPILE until it is consciously routed
  (sent, transformed, or documented client-only like `trip`). Proof
  `verify-create-pin-payload.mjs` 6/6. **Class-of-bug: manual
  re-enumeration of payload fields at a boundary silently drops newly
  added fields — assemble boundary payloads in one guarded builder.**
  The RPC proof passed throughout; the bug lived in the one unproven
  hop (client assembly). Andy's repro pins already healed via edit.
- **Find + fix #2 (2026-07-18, same Phase-1 sitting): the anchor picker
  ("which home did you commute from?") offered SEQUENCED primaries only** —
  a workplace couldn't anchor to a just-created decide-later home. Fix:
  `lib/globe/anchor-options.ts` (proof `verify-anchor-options.mjs` 6/6),
  used by BOTH PinModal and PinEditPanel: Log keeps anchoring to any pin;
  every other marker anchors to a HOME = primaries (sequenced first in
  spine order, then unsequenced "· not yet placed") + second residences +
  short-term stays (Andy delegated the scoping call; vacations/travel/
  workplaces stay out — that's what Log is for; DB stays permissive per
  validate_pin_anchor). **Principle: home-ness is the TYPE, not the spine
  slot — U9's NULL-sort_order exclusion applies to ORDER-derived logic
  only.** `primaries` prop still feeds the sequence-position picker
  (sequenced-only, correct). TripFramePanel already passed all pins — no
  gap there.
- **"Start a trip from here" BUILT 2026-07-19** (Andy's ask, from the
  Mt.-Snow-Chalet "how do I trip from an existing pin?" question): the
  home-pin trip strip (now ALWAYS shown for primaries, not only when
  departures exist) arms `tripFromHere`; a banner mirrors origin-capture;
  the next PinModal opens pre-set to Trip; framing suggestion runs
  through `suggestTripOrigin` (`lib/globe/trip-origin.ts`, proof 5/5:
  existing origin > armed > anchor > Home Base > null) at all three
  setFraming sites; armed state consumed when a framing closes,
  cancellable from the banner. Trips stay destination-first — this is an
  origin-first ENTRY, not a new flow. Daylight ring contrast fix same
  day (`.globe-daylight` hook's first use — burnt amber/deep rose
  unfinished rings). QA: `2026-07-19-trip-from-here-qa-checklist.md`.
- **Andy's QA state:** working the master sequence, Phase 1 (unsequenced
  residences in progress). New checklists queued into Phase 1:
  `2026-07-18-globe-pin-search-`, `2026-07-18-basemap-regime-`, and
  `2026-07-19-trip-from-here-`.
- **NEXT:** Phase-1 QA continues → remediation (+ pin-facts rider);
  then the Loose-Ends surface design doc (roadmap §3).

## Session handoff — 2026-07-15 (Trips & Travel Journal T1–T9 BUILT)

The full Trips & Travel track (plan
`docs/plans/2026-07-15-001-feat-trips-travel-journal-plan.md`, run as a
/goal) shipped in one autonomous pass, U1–U9, commits `3fbdf08`…`cf19287`:

- **U1 data layer** — `trips` + `trip_stops` over existing pins; backing
  `trip` entity (new enum value) carries recollections/jots/context via
  existing machinery; origin nullable (NULL = draft), destination
  RESTRICT (unframe before pin delete — Andy's call); leg-aware stops.
  Proof `verify-trips-travel.mjs` **33/33**, self-cleaning.
- **U2 API** — `/api/trips` (+`[tripId]`, `/stops`, `/home-base`);
  subtype constants in `lib/globe/trip-types.ts`.
- **U3 capture** — PinModal "Trip" path (subtype → pin per KTD4) +
  `TripFramePanel` (origin suggestion: anchor ?? Home Base; year_hint
  typed only, never parsed).
- **U4 globe** — `trip-routes` tier (rose; dashed return), hidden behind
  legend toggle; selection shows full route; destination halo + draft
  dashed ring; route-builder banner (click pins = stops).
- **U5 Travel Journal** — `/journey` mode toggle (JourneySurface), trip
  cards by year_hint ("Sometime" last), `?trip=` handoff both ways.
- **U6 retro framing** — "frame it as a trip" on markers (AE2 = Wallace
  Monument walkthrough), Unframe (pin untouched), PinHopper on trip
  entities, friendly destination-delete error.
- **U7 frequent traveler** — Home Base (`set_home_base`), "Another trip
  here", subtype/decade filters, residence "N trips originated here".
- **U8 Future Places** — `wants_to_visit` pin (hollow mint), whitelists
  amended from live RPC defs; promotion re-types then frames.
- **U9 unsequenced residences** — "Decide later" in the sequence picker
  (create + edit/demote), `place_residence_in_spine`/`unsequence_residence`,
  spine = sequenced primaries everywhere (arcs, origin star, reorder,
  nearest_residence), Journey "Not yet placed" group, trip-origin
  capture for homes that predate the spine (AE5).

**Andy's live QA outstanding** (checklists in `docs/qa/2026-07-15-*`):
trips-capture, trips-globe, travel-journal, trips-retro-framing (AE2 on
the real Wallace pin), trips-frequent-traveler, future-places,
unsequenced-residences. Person-page QA from Slice 7 also still queued.

## Session handoff — 2026-07-05 (reconciliation; Slice 6.5b in progress)

Supersedes the 2026-06-17 block below, which had gone nine days stale. The
06-22→06-26 interval is fully recorded in
`docs/plans/2026-06-22-globe-and-entity-ux-revised-roadmap.md`,
`docs/qa/2026-06-24-globe-slice3-closeout-qa-checklist.md`,
`docs/qa/2026-06-24-slice6-entity-view-context-qa-checklist.md`, and
[[project_lc_globe_entity_ux_brief]]; this block makes this file current again.

- **Slice 3 close-out BUILT 2026-06-23** (`12a3392`…`a9183ce`, 7 atomic commits):
  placard (reuses `entities.description`), at-rest when-chips + hover card,
  origin-pin treatment, "Refine location" detail-card action, re-type
  anchor stash/restore (`metadata.prior_anchor_residence_id`), chevron/tether
  contrast. Migrations `20260623120000` + `20260623130000` (additive).
- **Slice 3.5 BUILT 06-23 (`87ffe44`), REWORKED 06-24 (`cfa7202`)** after Andy's
  QA: the active-lines tray + per-pin toggle were REMOVED (OR-logic conflict);
  line visibility is now global-only — class filters + a zoom-gated
  "Side lines in view" toggle + transient hover preview.
- **Slice 3.6 "Log" pin BUILT 06-23** (`3219462`/`3650151`/`f19b39d`):
  `logged_at` type, `validate_pin_anchor` generalizes anchoring to any own
  globe pin, recollection roll-up ("Anchored here"). Andy proofed it live
  (globe QA §§9–11 ✓).
- **QA rounds 1–3 (06-24)** drove fixes: origin star rework (`f91f9b4`),
  one-chevron-per-leg (`1f4c8e9`), refine-drag guard (`c15b118`), editable
  pin name (`ac7c72a`), re-type inserts after the anchor home (`89c7266`),
  edit-panel markdown (`44fa2a9`).
- **Slice 6 (Entity View + context substrate) BUILT through Phase 6.6**
  (06-24→06-26): 6.1 `entity_context_notes` + merge repoint (`8dbbcd0`);
  6.2/6.3 Entity View `/entities/[id]` + add/remove context (`6ab7481`);
  6.4 entity chips + globe→Entity-View link (`474915e`, `04d8acd`;
  /memories full-text search deferred); 6.5a attach-research-as-context
  from /review (`9e56a58`); 6.6 note markdown, derived titles, in-place
  edit, pin-card count-chips (`90aed81`, `e356815`, `6f27c90`, `b452302`).
- **2026-07-04 session:** `verify-globe-slice4b.mjs` made live-DB-safe
  (`9ce8116`) after it had shifted the real spine; origin-backup hook made
  observable (`ab30e12`). See [[feedback_lc_silent_backup_and_sandbox]].
- **Andy's QA state:** globe checklist mostly ✓; re-tests outstanding
  (§4 chevron-on-line, §5 refine, §12 retype round-trip, §13 orphan,
  §14 naming/markdown). **Slice 6 walkthrough deliberately deferred by Andy
  until Slice 6 completes.** The 06-15 UI checklist pass is committed
  (`b2cd6fb`).
- **Slice 6.5b BUILT 2026-07-05** (`09cf680` backend, `8f8d8c6` card UI,
  `4ffbf86` behavioral proof): proposal-only `propose_context_note` tool
  (entity resolution by name, source-URL auto-detect,
  `use_full_submission` reads the verbatim paste from
  capture_submissions), "Context vs recollection" prompt section
  (SYSTEM_PROMPT_VERSION 2026-07-05.0), `ContextProposalCard`
  (Accept→6.5a context POST / Adjust→typeahead+visibility / Decline).
  Proofs: `verify-context-proposal-tool.mjs` 9/9 +
  `verify-orchestrator-context-proposal.mjs` (real run — research paste
  routed to the tool ONLY; Raw Vault + backlog untouched; nothing
  persisted pre-Accept). **Slice 6 build COMPLETE** (only /memories
  full-text search deferred). Detail: [[project_lc_globe_entity_ux_brief]].
- **Journey view designed 2026-07-05** — "Resume View" renamed + redesigned
  after Claude Code's review; canonical spec
  `docs/plans/2026-07-05-journey-view-design.md` (standalone `/journey`,
  `?pin=` handoff, summary rows + lazy detail, ember-spine emotional layer
  in MVP, mobile-first; phases J1–J5). Same session the **Hopper split**:
  5a (pin notepad) pulled forward, 5b (assistant consume loop + person
  host) stays with Slice 7.
- **Hopper 5a BUILT 2026-07-05** (`ac11a61` data layer, `95e7627` UI):
  `memory_stubs` table (roadmap M2, applied) + merge_entities repoint
  (proof `verify-memory-stubs.mjs` 7/7); `/api/entity/[id]/stubs`;
  `PinHopper` — always-present "✎ jot" chip on the detail card (live
  count) + full "Memories to write" section on the edit panel (check off,
  reopen, delete). QA: `docs/qa/2026-07-05-hopper-5a-qa-checklist.md`.
- **Known gap (2026-07-06, two live occurrences): pin creation does NO
  entity resolution.** `create_residence_pin` mints a fresh place entity
  unconditionally — even an exact-name match against an existing entity
  isn't checked (the #38 matcher + #39 vigilance live only on the
  capture/extraction path). Live duplicates: "Phillips Exeter Academy"
  (extraction-born 05-20 as organization, later re-typed place, no geom
  vs pin-born 06-19 "Summer 1970") and the cross-name Hanover/Dartmouth
  pair (3 recollections invisible from the pin). Data heal = /entities
  merge INTO the pin entity (pin survives, owns globe identity; aliases
  fold so future mentions resolve). Fix spawned as background task:
  PinModal "this looks like your existing X — pin it?" + optional
  `p_entity_id` on create_residence_pin. General answers given to Andy:
  linking is by name/alias identity, never by date-range overlap
  (invariant #5; temporal overlap ≠ identity — at most a future
  Temporal-Agent *suggestion*).
- **Owner-edit micro-slice BUILT 2026-07-06** (`e4c9cb5`), from Andy's
  Leola finding (a recollection ABOUT Leola Lapides carried no link to
  her — pronoun-only references are invisible to per-memory extraction;
  the conversational context that resolved "she" was discarded).
  /memories cards now have: (1) **Edit on FINAL memories** —
  revision-preserving (prior content_raw → memory_revisions, then
  overwrite; the globe's Slice-4a owner-edit pattern; temporal metadata
  edits freely); (2) **entity-link editing** — × unlink + "+ link"
  typeahead (person→participant, place→location, idempotent): graph
  repair without prose rewrite. Logic in `lib/memory/owner-edit.ts`,
  proof `verify-memory-owner-edit.mjs` 9/9. QA:
  `docs/qa/2026-07-06-memories-owner-edit-qa-checklist.md` (§1 = the
  Leola repair walkthrough). **Queued enhancements from the same
  discussion:** offer re-extraction after a finalized text edit;
  capture-time prevention = orchestrator passes pronoun referents
  ("she" = Leola) to extract_entities (bundle with the orchestrator/5b
  work).
- **Both queued background tasks BUILT 2026-07-07** (before session
  close, Andy's request): (1) **Alias editing** — the Entity View
  "also:" line is chips with × + a "+ alias" input (PATCH already
  supported wholesale alias replace; this was the missing UI). Removing
  the junk "Leo" on Leola Lapides is left to Andy's QA. (2) **Pin
  adoption** (the duplicate-twin fix, migration `20260707120000`):
  `create_residence_pin` gains optional `p_entity_id` — the pin ADOPTS
  the user's existing unpinned place/organization entity (gains geom,
  org→place per physical-location-wins, keeps description/links, folds
  a differing modal name as alias; guards: ownership / already-pinned /
  non-place-org). `GET /api/globe/entity-match?name=` (exact ci match,
  unpinned only) feeds a PinModal offer strip ("pin it instead of
  creating a duplicate?" / Create new, per-candidate dismissal). Proof
  `verify-globe-pin-adopt-entity.mjs` 12/12. QA:
  `docs/qa/2026-07-07-pin-adoption-and-aliases-qa-checklist.md`.
- **Globe stub resolution BUILT + SWEPT 2026-07-06** (`102f825` + sweep),
  from Andy's QA finding: 19 pin recollections had ZERO person links —
  30+ names stranded in `metadata.globe_extraction` (the Slice-2
  deferral come due). `lib/globe/stub-resolution.ts`: exact
  canonical/alias match → direct memory_entities link; else a
  review_queue `entity_stub_proposal` (new item_type, additive CHECK
  migration `20260706120000`) with fuzzy suggestion ≥0.8 — never silent
  entity creation (propose-and-confirm). /review "New mention" card:
  editable name ("my father" → real name, stub kept as alias) +
  Add / Link-to-existing / Same-link-them / Dismiss
  (`resolve-stub` route reuses linkEntityToMemory). Extraction agent
  chains resolution after every pin save; bookkeeping in
  `metadata.globe_stub_resolution` keeps re-runs idempotent. **Live
  sweep result: 17 pins → 11 linked directly, 57 proposals queued.**
  Proofs: `verify-globe-stub-resolution.mjs` 9/9;
  `scripts/sweep-globe-stub-resolution.mjs` re-runnable. QA:
  `docs/qa/2026-07-06-stub-resolution-qa-checklist.md`.
- **Incident + hardening (2026-07-06 late): reverse-direction merge
  stripped the Dartmouth pin.** Andy merged the Hanover PIN entity INTO
  the Dartmouth extraction entity; merge_entities repointed links +
  folded the alias but entity-level columns died with the source row —
  geom gone, pin vanished from the globe (relationship survived, sort 6,
  all 5 memory links intact). **Repaired:** geom restored at the
  Dartmouth green (43.7044, −72.2887, subtype city; Andy refines).
  **Hardened:** migration `20260706130000` — merge_entities now COALESCEs
  geom / place_subtype / description / location_entity_id / born/died/
  founded from source onto a NULL target before delete, so merge
  DIRECTION can no longer destroy substance. Proof
  `verify-merge-preserves-substance.mjs` 6/6 (reproduces the incident
  shape). **Class-of-bug: any owner-facing merge of twins where one side
  carries unique columns — the function must union substance, not just
  links.** Exeter twins still unmerged (safe in either direction now).
- **Journey J1 BUILT 2026-07-06** (owner-edit QA ✓ complete, Andy's go):
  `/journey` server-rendered from ONE `get_residence_pins` call —
  spine-ordered stop cards (name + verbatim when-chip + placard), origin
  ★/"The beginning" + "now" badge, anchored markers nested under their
  actual anchor (Log-on-vacation under the vacation; visual indent caps
  at 2), "Elsewhere · not yet anchored" section (nothing ever
  disappears — dead-anchor + cycle guards), mobile-first max-w-2xl.
  AppNav gains Journey. Tree core `lib/journey/tree.ts`, pure-function
  proof `verify-journey-tree.mjs` 6/6. QA:
  `docs/qa/2026-07-06-journey-j1-qa-checklist.md`. **J2 BUILT same
  session:** per-stop rail segments = continuous ember thread (clean at
  any card height, ends at "now"), glowing origin ★, ringed "now"
  marker, `transitionPhrase()` vocabulary over the extraction's
  move_reason (9/11 live stops carry one; absent → nothing rendered);
  migration `20260706140000` widens get_residence_pins with move_reason
  (proof `verify-journey-move-reason.mjs` 3/3). Static by design —
  reduced-motion safe. **J3 BUILT same night** (Andy's QA: "flat and
  non-interactive"): stop headers expand in place — lazy single-open
  detail (recollection markdown, photo, fact chips, linked-recollection
  excerpts → /memories, context titles → Entity View, per-child
  excerpts from the roll-up), cached per stop, zero detail requests
  until tap; rendering moved to `components/journey/JourneyList.tsx`
  (client), page stays a one-RPC server shell. **J4 BUILT same night:**
  `?pin=<relationshipId>` read/written by BOTH surfaces — Journey opens
  the owning stop + scrolls the linked row into view (markers resolve
  to their ancestor stop; reduced-motion → instant jump) and mirrors
  expand/collapse into the URL via router.replace; the globe consumes
  the param post-pins-load (selectPin + flyTo with map-ready retry) and
  mirrors selection via history.replaceState. Links: journey stop
  footer "Show on globe →", child NAMES link to their marker's pin,
  globe detail card "Read in journey →". Cold deep links work; globe
  stays out of AppNav. **J5 BUILT 2026-07-07 — the Journey arc (J1–J5)
  is COMPLETE.** A11y pass: place names are real h2s wrapping the
  disclosure buttons (rotor-walkable spine; detail sections h3),
  aria-controls + role=region panels, visible amber focus-visible
  rings, loading skeleton is a role=status region with sr-only text
  (shimmer bars aria-hidden), decorative rail/chevrons/arrows
  aria-hidden while transition PHRASES stay readable, page metadata
  title. Design doc marked BUILT. Journey is now the claimed
  screen-reader-accessible representation of the globe (design §4).
  **Next per roadmap: Slice 7** (Person page + Life's Cast + Hopper
  5b), riding on Slice 6 — plus Andy's accumulated QA queue.
- **Incident + repair (2026-07-07, Andy's QA): mention-links hijacked
  pin overview text.** The stub sweep AND the /memories "+ link" both
  defaulted place links to role='location' — but role='location' +
  capture_mode='globe_onboarding' (oldest-first) IS the discriminator
  for "the pin's own memory" (the 2026-06-11 scoping rule). One pin's
  globe recollection linked to another pin's entity therefore
  masqueraded as its overview: Coronet Peak Ski School showed the 1975
  primary's text (Andy's sighting); Trans Hotel showed the Ramada's;
  five more pins carried latent wrong-role links. **Class-of-bug:
  role='location' is load-bearing — mention-links must NEVER use it.**
  Fixes: `defaultRoleForType` place→'mentioned' (owner links, stub
  sweep, resolve-stub all inherit); data repaired by
  `scripts/repair-globe-location-roles.mjs` (26 links flipped; genuine
  pairs identified by the create-transaction exact-timestamp match;
  post-condition proven clean; re-runnable). Consumers unaffected:
  linked-recollections, Entity View, /memories queries don't filter by
  role; get_residence_pins has_memory stays location-only by design.
  Proofs updated (owner-edit + stub-resolution assert 'mentioned').
- **Incident + guards (2026-07-06 late): orchestrator narrated a save
  with ZERO tool calls.** Andy pasted Harry Leonard ski-show research
  mid-conversation; the reply claimed it was "added as context to
  McCormick Place" — audit log shows `tools: []`; nothing persisted
  anywhere. **Class-of-bug: words-are-not-actions hallucination — the
  reply-accuracy rule assumed there was a tool result to misreport.**
  Fixes: (1) "Words are not actions" prompt directive
  (SYSTEM_PROMPT_VERSION 2026-07-06.0); (2) deterministic UI backstop —
  substantial submission + zero tool calls ⇒ "no action was taken this
  turn" notice under the reply; (3) behavioral proof now runs the paste
  mid-conversation (the incident shape) — PASS. The lost material was
  recovered from capture_submissions into a review_queue
  attach-as-context card.
- **SLICE 7 BUILT 2026-07-07 (all four phases, Andy's go on the proposal):**
  7.1 (`77ada81`, `1da0374`) — /memories row-anchor deep link
  (`#<memory_id>` scroll+highlight, the Slice-6 deferral pulled forward
  with Andy's OK); Entity-View mention rows link OUT (pin-anchored →
  `/journey?pin=` via `lib/entity/mention-pins.ts`, resolution rides
  role='location' as designed; else the /memories anchor); PinHopper
  gains a `light` theme + `showTitle` and the person page hosts it.
  7.2 (`49f5d68`) — Life's Cast: `metadata.in_lifes_cast` (M3, no DDL)
  via pure `applyLifesCast` MERGE (is_self etc. provably survive);
  deliberate ☆/★ toggle on person pages (persons only, API-enforced);
  /entities ★ badge + Cast-first person tab + "with content only"
  filter (`entityHasContent`; default OFF — the list doubles as the
  orphan-cleanup surface). 7.3 (`dbc5701`) — person-anchored
  recollections: "Add recollection" on person pages →
  `createPersonAnchoredRecollection` (verbatim body + when-phrase,
  saves FINAL, role='participant' link, failed link deletes the orphan).
  Listed in CAPTURE order — event chronology stays the Temporal Agent's.
  7.4 (`6f8cd4d`) — Hopper 5b: orchestrator tools list_memory_stubs /
  add_memory_stub (only on explicit user yes; never mints entities) /
  consume_memory_stub (requires a REAL memory_id — words-are-not-actions
  backing); prompt section "The Hopper" (SYSTEM_PROMPT_VERSION
  2026-07-07.0); migration `20260707130000` adds
  `memory_stubs.consumed_by_memory_id` lineage (additive, applied).
  Proofs: mention-links 4/4, lifes-cast 9/9, person-recollection 9/9,
  hopper-tools 8/8, and a REAL orchestrator run 6/6 (list → create →
  classify/extract → consume in one run, reply matched tools). QA:
  `docs/qa/2026-07-07-slice7-person-page-qa-checklist.md`.
- **Andy's QA delta (checked live 2026-07-07):** stub proposals 52/57
  confirmed (5 pending); owner-edit checklist COMPLETE (17/17, in
  `783ca91`); Exeter twins still unmerged; Leola still carries the junk
  "Leo" alias (alias QA pending); Journey J1 / Slice 6 / Hopper 5a /
  stub-resolution walkthroughs still open.
- **Hopper QA session 2026-07-09 (Andy live-QA'd 5a; four builds came
  out of it, all pushed):**
  (1) **One jot per memory** (`53eb13a`) — tip text under the jot input,
  multi-line paste splits into N jots, prompt granularity rule ("split
  semantically, not on punctuation" — proof: a run-on with an internal
  comma produced exactly 3 atomic stubs, `verify-orchestrator-jot-split`
  6/6).
  (2) **The write-up bridge R1** (`06973e3`) — ✍ write on every open jot
  opens the CaptureAssistant seeded with a structured consume_stub
  intent (exact stub_id; amber chip; rides every turn); core backstop
  consumes mechanically if the model forgets (`findBackstopConsume`,
  pure + proven); viewingEntity ambient context (selected pin / open
  entity page → "this place" needs no name); a seed exits globe edit
  mode so the suppressed assistant can surface. `verify-capture-intent`
  9/9 + real seeded run 6/6 (model consumed the exact stub itself, no
  list call needed).
  (3) **R2 hopper nomination** (`8a4e875`) — Layer B digest gains "Open
  jots" per host (cache-stable ordering); prompt may nominate ONE jot at
  openings/lulls, never nagging. `verify-digest-hopper` 8/8.
  (4) **INCIDENT + fixes (`a6cfbb4`): the invisible write-up.** Andy's
  seeded write-up (Playa Coma Ruga, the surf-launch memory) consumed
  correctly but VANISHED from the pin: extraction minted near-duplicate
  place "Commaruga" (the user's own spelling) and linked the memory
  there. **Space-collapse disguise** — "Commaruga" vs "Playa Coma Ruga"
  slips ALL matcher rules (space defeats boundary-containment; one token
  defeats token-subset; "Playa" prefix defeats whole-string JW). Nothing
  was lost (Raw Vault + consume lineage intact — lineage made the trace
  trivial). Fixes: (a) **consume_memory_stub now GUARANTEES the host
  link** (idempotent linkEntityToMemory at the one gate all consume
  paths share; mentioned/participant, never 'location'; failure reported,
  never unwinds the consume) — extraction is now additive, not
  load-bearing, for write-up visibility; (b) **scoreNameMatch
  space-collapse rule** — single-token name windowed (JW) against the
  space-stripped long name, merge-proposal band capped 0.9; guards:
  single-token short side ONLY (a two-token "Air Force" fragment
  window-matched a base at 0.9 during the rule's own verification —
  caught pre-commit), ≥6 chars, multi-token long side.
  `verify-entity-matching` 17/17; `verify-hopper-consume-tools` 10/10.
  Data healed by Andy: /entities merge Commaruga INTO the pin entity
  (alias folded; both recollections verified on the pin; overview
  discriminator verified untouched). **Class-of-bug: any UI flow whose
  outcome must be visible on a host surface needs a deterministic link
  at the flow's own gate — never rely on extraction resolution alone.**
- **NEXT:** Andy's QA (Journey J1 walkthrough in progress 2026-07-09;
  then Slice 7 checklist + Slice 6 + stub-resolution + pin-adoption
  walkthroughs + Exeter merge + 5 remaining stub proposals); then per
  roadmap §5 the slice list is exhausted — remaining parked items:
  Vertical Moments, pin-visual redesign, /memories full-text search
  (deferred from Slice 6).


> **Earlier build history (Step 5 through Slice 2, May–mid-June 2026) has been
> archived to keep this file's "read first" section fast to scan.** It covers:
> the original Step 6a–6h build (orchestrator, capture assistant, tagger/entity
> agents), Step 7 Slices 1–4b (globe walking skeleton through edit/relocate/
> delete/sequencing), Slice 2 (photos + extraction) and Slice 3 (place types),
> the context-layer and interview-dialogue design sessions, durable tooling/
> schema lessons (Inngest v4 breaking changes, HEIC handling, dev-server
> operations rules, RLS activation gate), and the 2026-06-17 QA remediation
> pass (already self-marked superseded at the time it was written). See
> `memory/project_lc_build_progress_archive_2026H1.md` for the full text —
> nothing was deleted, only moved out of this file's fast-scan zone.

## How to apply

When starting work on Step 6 or Step 7, this is the file to read first. It captures the actual state of the codebase and the decisions that aren't documented elsewhere. Cross-reference `LC_Development_Sequence.md` for the canonical step definitions.

