# Pasted research loses markdown → convert the clipboard's HTML flavor

**Date:** 2026-07-16 · **Found by:** Andy (the Biggs AFB context note)

## Symptom

Research copied from a rendered-AI/web source and pasted into a context
note (or recollection) arrives stripped: bold gone, citation links gone,
bullets inlined, and paragraph boundaries run together
("…missions.The Jet Transition Era…"). The Slice 6.6 markdown rendering
is fine — there was no markdown left to render.

## Root cause (verified in DB, note `c9aa1e56`)

The clipboard from such sources carries **two flavors**: rich
`text/html` and a degraded `text/plain` (the source app generates the
plain flavor, often badly — block elements concatenated without
whitespace). A bare `<textarea>` always pastes **text/plain**, so the
degradation happens at write time, before storage. Pasting the same
clipboard into Google Docs keeps formatting because Docs consumes the
HTML flavor — that asymmetry is the diagnostic tell.

## Fix (the pattern — use it on any new markdown-bearing textarea)

`lib/richPaste.ts` exports `handleRichPaste(e, setValue)`:

- reads `clipboardData.getData('text/html')`;
- converts to markdown via turndown (atx headings, `-` bullets,
  inline links; `<div>` treated as a block so nothing runs together);
- **only intercepts when the HTML flavor genuinely adds formatting**
  (`shouldUseHtmlFlavor` compares whitespace-squashed conversions), so
  hand-typed text, plain pastes, and span-wrapped code-editor pastes
  keep native behavior and hand-authored markdown is never re-escaped.

Wired on: EntityView context form + recollection composer,
CaptureAssistant main input, PinModal body, PinEditPanel body.
Deliberately NOT on PinHopper (jots are one-line plain text — it has
its own multi-line-split paste handler).

## Proof

`node scripts/verify-rich-paste.mjs` — bold/bullets/links/headings
survive, adjacent `<p>` blocks never run together, trivial HTML falls
through to native paste.

## Recognize this class

Any complaint shaped like "formatting lost when pasting X into Y" →
check the stored row first. If markdown is absent **at rest**, it's the
input surface (clipboard flavor), not the renderer. If markdown is
present at rest but not on screen, it's the renderer.
