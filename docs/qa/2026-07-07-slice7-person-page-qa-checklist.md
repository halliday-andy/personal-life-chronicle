# QA Walkthrough — Slice 7: Person page + Life's Cast + Hopper 5b (2026-07-07)

App: **http://localhost:3001/entities** (sign in first). Pick a real person
with a few mentions — Leola Lapides is the richest test subject.

> Four phases, all proofed by script (mention-links 4/4, Life's Cast 9/9,
> person-recollection 9/9, hopper tools 8/8 + a real orchestrator run 6/6).
> This is the human proof. Chronology note for §3: recollections list in
> CAPTURE order; true event-time ordering is the Temporal Agent's future
> job (when-phrases are never parsed).

## 1. Mention out-links (7.1)
- [x] Open a person page. Every "Recollections that mention…" row is an
      out-link. A mention that lives on a globe pin says **read in
      journey →** and lands on the OWNING STOP in /journey, opened and
      scrolled into view.
- [x] A mention with no pin says **open in Recollections →** and lands on
      the EXACT card in /memories — scrolled to center with a brief amber
      ring. (Not just the filtered list — the card itself.)
- [x] Cold deep link: copy such a /memories?entity=…#… URL into a fresh
      tab — same landing.
- [x] Place pages get the same treatment: a pin's own recollection row
      goes to the journey; hand-linked mentions go to /memories.

## 2. Life's Cast + content filter (7.2)
- [x] On a person page: **☆ Add to Life's Cast** next to the name. Click →
      ★ In Life's Cast (amber). Reload — it sticks. Click again → demoted.
- [x] Nothing you didn't promote is in the Cast (it never auto-populates).
- [x] /entities People tab: promoted people lead the list with a
      **★ Life's Cast** badge.
- [x] "with content only" checkbox hides blank rows (no mentions, no
      context, no jots, no description) and shows "(N hidden)".
      **[taste]** default is OFF because blank rows are also your cleanup
      targets — say if you want it remembered per-visit or default ON.
- [x] Non-person pages show NO Cast button (it's people-only; the API
      rejects the rest).

## 3. Person-anchored recollections (7.3)
- [ ] Person page → **Add recollection** (header of the mentions section).
      Write a short memory + a when-phrase in your own words ("summer of
      1982-ish"). Save.
- [ ] It appears in the mentions list right away (capture order), the
      when-phrase shown VERBATIM — never re-formatted into a date.
- [ ] Its row out-links to the exact /memories card; the card shows
      **Final** (owner-authored) with the person chip attached.
- [ ] Editing that card later (Edit on /memories) preserves the original
      as a revision — the standard owner-edit path.

## 4. The person hopper (7.1 host + 5a machinery)
- [ ] Person page → **Memories to write** section (light theme, matches
      the page — not the globe's dark styling). Jot a memory; count in the
      heading updates.
- [ ] Check one off manually; it moves to "N written" with strikethrough;
      reopen works; delete works. (Same behavior as the pin edit panel.)

## 5. Hopper 5b — the assistant loop (7.4)
- [ ] With open jots on a person, ask the capture assistant (⌘K):
      "What's in my hopper for <person>?" — it lists YOUR jots in your
      words (via tool, not invention).
- [ ] Pick one and tell the story (or let it interview you). When done:
      a draft proposal card appears (normal Accept flow), AND the jot
      shows as written on the person page — check-off happened by tool,
      not by prose. If the reply CLAIMS a check-off but the jot is still
      open, that's the words-are-not-actions class — report it.
- [ ] Mid-conversation, mention a different memory in passing ("oh, and
      there was also the time…"). The assistant should OFFER to jot it
      ("want me to add that to the hopper?") — never add silently. Agree,
      and the jot appears on the entity's hopper.
- [ ] Decline such an offer — nothing is added.

## 6. Regression spot-checks
- [ ] Globe pin edit panel hopper still looks right (nocturne — the theme
      split touched shared code).
- [ ] A pin's own overview text is still its own (mention-links never use
      role='location'; the 26-link repair must stay clean).
- [ ] /entities rename/merge/delete still work (the list gained columns).
