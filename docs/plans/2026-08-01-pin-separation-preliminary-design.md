# Preliminary design — pin separation on zoom-out

**Date:** 2026-08-01
**Author:** Claude Code (Opus 5), from Andy's Queenstown occlusion finding and
his three Codex screenshots.
**Status:** **PRELIMINARY — recordable, not agreed, not built.** Belongs to the
globe visual-language pass
([`2026-07-17-spine-and-share-roadmap.md`](2026-07-17-spine-and-share-roadmap.md) §5),
which is post-remediation. Density behaviour is **explicitly deferred to a
post-MVP refinement phase** at Andy's call.

---

## 1. The problem

At zoom-out, two pins a few kilometres apart occupy the same screen pixels.
Today the winner is **arbitrary**: there is no `z-index` on pins anywhere, and
Mapbox's `Marker` does not sort, so stacking is DOM insertion order — whichever
row `get_residence_pins` returned later. Andy had to zoom far in to discover
that a workplace was hiding a primary residence in Queenstown.

Two consequences, both real:

- **A place in the chronicle can be invisible** with nothing to indicate it.
- **Its NAME is invisible too.** Zoom-gated labels already exist
  (`GlobeView.tsx:719`, names on from zoom ≥ 4), so the text-instead-of-click
  behaviour Andy wants is built — but two superimposed pins produce two
  superimposed labels. **Separation fixes legibility and labelling together.**

## 2. The reference — the Codex build already solves it

`lib/globe/marker-layout.ts` in the sibling implementation
(`memory/project_lc_dual_track_final_review.md`). Verified by reading the
source, not inferred from screenshots:

```
MINIMUM_MARKER_SEPARATION_PX = 42

1. project markers to screen space
2. greedily cluster anything within 42px, merging transitively
3. per cluster: sort by x, then y, then id
   // "Preserve geographic screen order when collision separation
   //  turns on or off across zoom levels."
4. lay out evenly spaced 42px apart, centred on the cluster centroid
5. offset = [dx, 0]        ← Y IS NEVER TOUCHED
```

**Step 5 is the insight and it is better than what this document first
proposed.** An earlier draft suggested pushing each pin outward along its true
**bearing** from the centroid — radial displacement, which distorts *both*
axes. Codex constrains displacement to **one axis**, so **latitude stays
truthful and vertical relationships survive exactly**; only longitude is
normalised. Constraining displacement to one axis keeps the other honest.

Andy's verdict on the result, across city → regional → country zoom: it
"doesn't obscure or dilute the comprehension of the important message, which
is that there are pins here to be zoomed in on and reviewed."

## 3. Limitations, read from the source

Recorded so they are chosen rather than inherited.

| # | Limitation | Severity |
|---|---|---|
| 1 | **A north–south pair spreads horizontally.** Two pins at the same longitude fall within 42px, cluster, and separate left/right — inventing a horizontal relationship that does not exist. True `y` survives, so they end up diagonal rather than wrong | mild, but it is a fabrication |
| 2 | **Even spacing discards relative distance.** Three pins, two near-identical and one further, become equidistant | mild at 2–3, misleading at scale |
| 3 | **No decay.** Offsets are full-strength the instant pins come within 42px, so they *pop* rather than ease across the threshold | visible; worth fixing |
| 4 | **Greedy clustering is input-order dependent.** The merge step mitigates it, but cluster membership can depend on array order | low; determinism matters for stability across renders |
| 5 | **Density is unsolved.** Twelve pins in one cluster produce a 42 × 11 = **462px** horizontal row — wider than a phone | **the deferred question** |

## 4. Proposed design

**Adopt the core**, which is proven in Andy's own product, and address (3) and
(4) — the two that are cheap and improve it.

**The layout function is PURE** — projected markers in, offsets out — which
means it gets a proof script under this project's established pattern, with
the properties asserted rather than eyeballed:

- order preservation (a pin west of another stays west, at every zoom)
- `dy === 0` always (latitude is never altered)
- a lone pin gets a zero offset
- determinism: the same input in any array order yields the same offsets
- the decay curve is monotonic and reaches zero at the threshold

**Changes from the reference:**

1. **Ease the offset in** rather than switching it on. Scale the applied offset
   by how far inside the threshold the pins are, so they slide apart as you
   zoom out instead of jumping. Fixes (3).
2. **Sort deterministically before clustering**, so cluster membership cannot
   depend on the API's row order. Fixes (4).
3. **Keep even spacing for v1** — (2) is real but a distance-preserving spread
   costs more than it buys at two or three pins, which is the case that
   actually occurs today.

**Integration:** the app uses DOM `mapboxgl.Marker`s, which are repositionable
divs, so offsets apply as a transform on the marker element. Recompute on
`zoom`/`move`, throttled to animation frames.

**Also in scope, and small:** give markers a deliberate `z-index` so that where
pins *do* still overlap, the winner is not arbitrary. **Latitude-based**
(southerly on top, the cartographic convention), with the selected/hovered pin
always above. **Not type-priority** — drawing a workplace that is genuinely in
front behind a home contradicts the whole objective.

## 5. Explicitly deferred — post-MVP refinement (Andy, 2026-08-01)

**What happens at higher densities.** The reference shows the two-pin case
working; it says nothing about twelve. A 462px row is not an answer, and the
alternatives all cost something: a genuine cluster bubble at some threshold
(erases identity, which is what the globe exists to show), a bounded spread
that accepts residual overlap, or a spiral/grid that abandons order
preservation.

Andy: *"we'll have to experiment in a refinement phase post-MVP on what happens
when larger concentrations and density cloud the globe view."* **Find that edge
deliberately rather than discovering it on a dense chronicle.**

**Related but separate:** the zoom-4 name gate exists because *"DOM markers get
no collision culling, so world-scale views with every name visible are label
soup"* (`GlobeView.tsx:714`). It is a blunt stand-in for collision handling the
app lacks. Separated pins do not produce soup, so **the threshold should be
revisited once separation lands** — but not before.

**Not adopted:** the Codex pins are numbered badges (stop ordinals, plus "F2"
for a future place). Andy, 2026-08-01: *"I don't think the globe view numerals
assist in any way. I much prefer representation in text once the zoom is close
enough."* That preference is already implemented here as the zoom-gated name
labels; the numerals are not wanted.

## 6. Cross-references

- Roadmap slot: [`2026-07-17-spine-and-share-roadmap.md`](2026-07-17-spine-and-share-roadmap.md) §5, globe visual-language pass
- Reference implementation: `../../CODEX Life Chronicle Project/lib/globe/marker-layout.ts`
- Dual-track commitment: `memory/project_lc_dual_track_final_review.md`
- Name gate: `components/globe/GlobeView.tsx:714–722`
