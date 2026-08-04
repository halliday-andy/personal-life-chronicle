# Handoff — Life Chronicle, session of 2026-08-03

*Written at the close of a long build+QA session. `origin/main` is current;
working tree clean. Handed off because the context window was filling, not
because anything is half-done — **nothing is mid-flight.***

---

## 1. Read in this order

1. `CLAUDE.md` — auto-loaded. Protocols + invariants. Don't relitigate.
2. `memory/MEMORY.md` — the index; "Current state (read first)".
3. `memory/project_lc_build_progress.md` — the **2026-07-30 block** is
   current and now covers this session too. Rules 10–20 live there.
4. **`docs/plans/2026-07-30-phase1-remediation-plan.md`** — the finding
   register, F1–F26, and what each became. **This is the spine of the last
   two sessions.**
5. `docs/plans/2026-08-03-r22-trip-destination-ui-design.md` — **the next
   unit**, fully specced.
6. `docs/plans/2026-07-30-loose-ends-surface-design.md` — the unit after
   that; **designed but never reviewed by Andy**.

## 2. Where things stand

**Phase-1 QA is COMPLETE.** All five checklists walked, plus two written
this session. The data chores are done (verified: `review_queue` has zero
unresolved items; Phillips Exeter merged; Leola's alias clean).

**The Phase-1 remediation pass is COMPLETE — R1 through R21**, 26 findings
either fixed, closed as passes, or deliberately deferred. Two migrations
applied to the live database with Andy's approval, both proven.

## 3. The next unit — R22

`retarget_trip` exists and is proven, but **nothing calls it**, so a trip's
destination is changeable only by an agent running SQL. R22 gives that to
Andy: an API path plus a destination selector on the framing panel.
Roughly an afternoon. Spec is complete — no design work needed.

**Andy's 1978 Fiat 128 trip is deliberately left uncorrected** as R22's
end-to-end fixture. **Do not "helpfully" fix it with SQL** — his call, so the
feature gets proven on a real case rather than shipping unexercised.

## 4. Then — Loose-Ends L1–L3

Roadmap Unit 1, and the gate on it (QA Phase 1) is now lifted. Two decisions
already made: **two plans, seam first**, and the design doc exists. Two
things owed before code:

1. **Andy's review of the design** — it has never had one, and the pin card
   and trips have changed considerably underneath it since 2026-07-30.
2. **The implementation plan** for L1–L3 — never written.

## 5. Class-of-bug rules earned this session (10–20)

All in `memory/project_lc_build_progress.md`. They generalise — apply them,
don't rediscover them.

| # | Rule |
|---|---|
| 10 | A control scoped to a selected object belongs on that object's surface. *Tell: reads `selectedId`, renders outside the card.* |
| 11 | A generic surface reused in a specific mode must state the mode in its own title and primary action. *Fired three times in one evening.* |
| 12 | Test a converter against captured REAL input, not idealised markup. *A synthetic `<b>` fixture proved bold survived; the real source used styled spans and lost all of it.* |
| 13 | A mode switch that changes an element's height must keep that element in view. |
| 14 | Meaning carried only by a native `title` tooltip is effectively hidden — the delay is the browser's, and it never fires on touch. |
| 15 | Show whose claim it is. Owner-asserted and machine-read must never render as peers. |
| 16 | When a rule gates writing, check it also gates reading. *Four sightings.* |
| 17 | A natively-draggable element inside a drag-to-reorder row steals the gesture. *Tell: reorder that only works on whitespace.* |
| 18 | Two systems drawing the same kind of thing must agree about what reveals them. |
| 19 | A form reused for CREATE and EDIT must load current values on the edit path. *Tell: state initialised to a literal `''`.* |
| 20 | **A constraint keyed on a mutable classification misjudges history.** *Tell: a rule reading an entity's current type to decide whether a past event was legitimate.* |

**Rule 20 is the one to carry hardest.** It killed a guard I was about to
extend rather than remove, and it came from Andy's counter-example, not from
reading the code.

## 6. Two mistakes I made, so you don't repeat the shape

- **"Cannot reproduce" is not "not a bug."** I closed F10 as unreproducible
  because the geometry didn't match Andy's description. It didn't match
  because I was reasoning about the wrong component. He reproduced it later
  with screenshots.
- **Verify the premise before fixing.** Twice I found *a* plausible cause in
  the code and started fixing without confirming it was *the* cause. Andy's
  data is queryable via `node scripts/db-query.mjs "<sql>"` — one query
  usually settles it.

## 7. Recorded for later, so nothing is lost

- **`docs/plans/2026-08-01-temporal-arcs-brainstorm.md`** — exploratory,
  unscheduled. Arcs of engagement (cars, pets, philosophies) as a
  co-scrolling column beside the spine. **§8's fork is open and must not be
  treated as settled.** Its finding outlives the feature: someone who lived
  in one place their whole life has ONE stop, so **invariant #5's assumption
  that the residential spine IS the temporal scaffold has a class of user it
  doesn't serve.**
- **`docs/plans/2026-08-01-pin-separation-preliminary-design.md`** — pin
  occlusion on zoom-out, written after reading the **Codex build's**
  `lib/globe/marker-layout.ts` directly. Their approach beat mine:
  displacement constrained to ONE axis (`[dx, 0]`) keeps latitude truthful.
  Density deferred to post-MVP by Andy.
- **F22** — tether and route draw the same segment when a trip's destination
  is anchored to its origin. Deferred to the globe visual-language pass;
  correct suppression needs the two line effects to coordinate.
- **Four globe surfaces still lack Escape** — route-building, origin
  capture, the armed trip banner, refine-location. Needs Andy's call on
  whether Escape becomes a general "back out of the current mode" gesture,
  which requires a precedence order.
- **A wording call outstanding:** curated labels ("Caring for family") vs
  raw de-underscored codes ("family care") across surfaces.

## 8. Operational knowledge

- **Migrations apply DIRECTLY** — `node scripts/db-apply.mjs <filename>`,
  a direct Postgres connection via `SUPABASE_DB_URL`. **Always pass the
  filename**: a bare invocation applies EVERY pending migration. Ledger is
  `public._claude_migrations`; `--status` lists applied vs pending. The
  Supabase dashboard's SQL-editor history will NOT show these.
- **Never leave an unapproved migration in `supabase/migrations/`** — write
  it to the scratchpad first, move it in on approval. Otherwise a later bare
  apply runs it.
- **Read Andy's live data** with `node scripts/db-query.mjs "<sql>"`. It has
  settled several arguments faster than reading code.
- **DB-touching proofs run inside a rolled-back transaction** — see
  `verify-retarget-trip.mjs`. The chronicle must be untouched by a proof.
- Gates on every commit: `npx tsc --noEmit` + `npx next lint --dir app --dir
  components --dir lib`. Never `npm run build` while dev runs.
- Dual-write every memory change to the workspace `memory/` **and**
  auto-memory (`.../spaces/21262e82-*/memory`); verify with `diff -r`.
- Auto-push hook covers each commit; check `git status -sb` for `[ahead N]`.

## 9. Standing guards (unchanged)

`role='location'` is the pin-overview discriminator; words-are-not-actions;
`merge_entities` preserves substance both ways; `entities.metadata` is
MERGE-only; one definition per controlled vocabulary; **namespace sibling
React keys by ROLE** (`facts-…`, `connections-…`, `trips-…`); home-ness is
the TYPE, not the spine slot; a guard that has never failed on its own bug is
unproven.
