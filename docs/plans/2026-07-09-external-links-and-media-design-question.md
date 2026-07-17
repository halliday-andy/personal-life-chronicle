# Design question — active links & external media in context and recollections

*Status: OPEN QUESTION — parked for a design discussion with Andy. Not scheduled.
Raised 2026-07-09 during Journey QA. No build should start from this note without
that discussion happening first.*

*Update 2026-07-17: this question now has a scheduled home — it folds into the
**Shareable Collections** design (`2026-07-17-spine-and-share-roadmap.md` §4),
where its hardest parts (viewer-side third-party embeds, link rot in shared
views) become concrete.*

## Trigger

A context note on Zaragoza AB, pasted from agent research (Gemini/Google), carried
`[Operation Reflex](https://www.google.com/search?q=…&kgmid=…#sv=CBwSjAQ…)` — a
markdown link whose URL is a wall of query-string state. The immediate rendering
bugs were fixed same-day (`d8b24f8`: derived titles reduce markdown to human text;
the shared Markdown renderer wraps monster tokens). But the *source material* still
carries the raw link, and that surfaced the real question this note parks:

**How should Life Chronicle collect and present active links inside context and
recollections — especially for cut-and-paste context entries, which will typically
come from web research done by another agent?**

## Questions to work through

1. **Capture-time link hygiene (context).** Context is verbatim by design (6.5b's
   `use_full_submission` guard exists precisely to protect paste fidelity). Should
   pasted links be normalized at capture — tracking/query params stripped, search-URLs
   collapsed to their target, long URLs converted to `[title](url)` form? Where is the
   line between *cleaning* and *altering the source*? Options range from never-touch,
   through propose-and-confirm cleanup on the 6.5b card, to silent normalization of
   known-noise params only.

2. **Recollections are harder-bounded.** `content_raw` is Raw Vault — immutable,
   verbatim (invariant #1). Any link optimization there must be PRESENTATION-layer
   only (render-time), never stored transformation. Confirm this boundary explicitly
   in whatever design emerges.

3. **Presentation of links.** Today: markdown links render as anchors (label text),
   bare URLs autolink, long ones wrap. Should we go further — favicons, fetched page
   titles for bare URLs, hover previews, a distinct "sources" strip on a note? Note
   `entity_context_notes` already has `source_label`/`source_url` for the canonical
   citation — inline links vs. the source field may deserve different treatment.

4. **External media assets (YouTube etc.).** Andy explicitly wants links to YouTube
   videos and other media that live OUTSIDE the application and are NOT stored in our
   database. Questions: plain link vs. inline embed (thumbnail? player?); where they
   can appear (context notes, recollections, pin galleries alongside stored photos?);
   **privacy** — embeds make third-party requests from the viewer's browser (the
   project rejected Cloudinary for the memory vault on exactly this ground; a YouTube
   iframe phones home similarly); link rot / dead-video handling for a chronicle meant
   to outlive the links; and how shared views (Access Cards, Single Post Share) treat
   external media a viewer loads from a third party.

5. **Collection flow.** When the capture assistant receives research containing media
   links, should it extract them into structured fields (source_url, a future
   `external_media` list on the note) rather than leaving them inline? Propose-and-
   confirm, as always.

## Related invariants & prior art

- Raw Vault immutability (CLAUDE.md invariant #1) — bounds question 2.
- 6.5b verbatim-fidelity guard (`use_full_submission`) — bounds question 1.
- Privacy stance: no third-party CDNs for vault content (HEIC server-convert decision,
  2026-06-14) — bounds question 4.
- Same-day rendering fixes: `lib/context/derive-title.ts` (stripInlineMarkdown),
  `components/Markdown.tsx` (break-words/break-all) — the floor this discussion
  builds on, not the ceiling.
