# QA — Rich paste keeps markdown (context notes & recollections)

**Date:** 2026-07-16
**Prereqs:** dev server on `localhost:3001`; the same research source
you used for the Biggs AFB note (or any rendered AI answer with bold,
bullets, and citation links).

## 1. The original repro, fixed

- [ ] Copy the Biggs research from the source again. On the El Paso
      place entity, **Add context** and paste into the body box → the
      textarea now shows **markdown text** (`**bold**`, `- ` bullets,
      `[1](url)` links, blank lines between paragraphs) instead of a
      flattened run.
- [ ] Save → the note renders with bold, working citation links, real
      bullets, and separated paragraphs.
- [ ] Copying the note's text back out of the UI keeps the paragraph
      structure.

## 2. Other surfaces

- [ ] Same paste into the capture assistant's input → markdown
      preserved in the input (and in what the orchestrator stores).
- [ ] Same paste into a pin's "Your memory of it" (modal) and the edit
      panel's recollection editor → markdown preserved, renders on the
      detail card.

## 3. Nothing else regressed

- [ ] Typing normally in all these boxes: unchanged.
- [ ] Pasting PLAIN text (e.g. from a .txt/terminal): unchanged,
      character-for-character — no added escapes.
- [ ] Pasting hand-written markdown from a plain editor: arrives
      verbatim (no `\*\*` escaping).
- [ ] Pin hopper jots: paste still splits lines into separate jots.

## 4. The old Biggs note

The note saved before the fix (last night, 23:33) is still flattened —
the degradation happened at write time and is in the stored text. If
you want it pretty: copy the research from the source once more and
paste it into that note's in-place editor (it will arrive as markdown
now), or tell me and I'll splice the formatted research into the
stored body for you.
