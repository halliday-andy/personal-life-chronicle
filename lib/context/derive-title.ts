/**
 * deriveContextTitle — a short, scannable label for a context note (Slice 6.5b).
 *
 * Context notes have no title field; the convention nudged in the Add-context
 * form is to start the body with a markdown heading (`## B-47s in the Cold
 * War`). This pure helper derives a title so the pin card and the entity page
 * agree on what to show:
 *
 *   1. The text of the first ATX heading (`#`…`######`), if any.
 *   2. Otherwise the first ~8 words of the first non-empty line (with an
 *      ellipsis when truncated) — so a note is never label-less.
 *   3. Otherwise 'Untitled note' (empty / whitespace-only body).
 *
 * Shared by the server (residence detail) and any client surface; keep it
 * pure (no I/O, no React) so it can be unit-tested in isolation.
 */

const MAX_FALLBACK_WORDS = 8
const MAX_WORD_LEN = 40 // any residual monster token (key, hash…) gets clamped

/**
 * Reduce inline markdown to its human text for use as a PLAIN-TEXT label.
 * Context bodies are typically pasted research (often agent-composed, with
 * `[label](very-long-search-url)` links); a derived title must carry the
 * label, never the URL (live overflow in the Journey context list,
 * 2026-07-09). Exported for the proof.
 */
export function stripInlineMarkdown(line: string): string {
  let s = line
  // Images first (their syntax contains the link syntax): ![alt](url) → alt
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  // Links: [label](url) → label
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  // Bare URLs → hostname ("google.com") — scannable, never a wall of query string
  s = s.replace(/https?:\/\/([^\s/]+)[^\s]*/g, (_m, host: string) => host.replace(/^www\./, ''))
  // Emphasis + inline code markers (keep the text between them)
  s = s.replace(/(\*\*|__|\*|_|`)/g, '')
  // Clamp any residual unbreakable token so a title can never overflow
  s = s
    .split(/\s+/)
    .map((w) => (w.length > MAX_WORD_LEN ? w.slice(0, MAX_WORD_LEN) + '…' : w))
    .join(' ')
  return s.trim()
}

export function deriveContextTitle(body: string): string {
  const text = (body ?? '').trim()
  if (!text) return 'Untitled note'

  const lines = text.split(/\r?\n/)

  // 1. First ATX heading anywhere in the note. A trailing closing sequence
  //    (`## Title ##`) must be space-separated to count as a closer, so a `#`
  //    inside the title (e.g. "C# notes") is preserved.
  for (const line of lines) {
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/)
    if (heading) {
      const clean = stripInlineMarkdown(heading[1])
      if (clean) return clean
    }
  }

  // 2. First ~8 words of the first non-empty line, markdown reduced to text.
  //    A leading ATX-hash run is stripped first so a "loose" heading with no
  //    space (`##Foo`) — which step 1 won't accept and the renderer shows
  //    literally — never leaks its # marks into a plain-text title. A line
  //    that is only hashes reduces to empty and is skipped.
  const firstLine = lines
    .map((l) => stripInlineMarkdown(l.replace(/^\s{0,3}#{1,6}\s*/, '')))
    .find((l) => l.length > 0)
  if (!firstLine) return 'Untitled note'
  const words = firstLine.split(/\s+/)
  const head = words.slice(0, MAX_FALLBACK_WORDS).join(' ')
  return words.length > MAX_FALLBACK_WORDS ? `${head}…` : head
}
