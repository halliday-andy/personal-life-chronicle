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

export function deriveContextTitle(body: string): string {
  const text = (body ?? '').trim()
  if (!text) return 'Untitled note'

  const lines = text.split(/\r?\n/)

  // 1. First ATX heading anywhere in the note. A trailing closing sequence
  //    (`## Title ##`) must be space-separated to count as a closer, so a `#`
  //    inside the title (e.g. "C# notes") is preserved.
  for (const line of lines) {
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/)
    if (heading) return heading[1].trim()
  }

  // 2. First ~8 words of the first non-empty line.
  const firstLine = lines.map((l) => l.trim()).find((l) => l.length > 0)
  if (!firstLine) return 'Untitled note'
  const words = firstLine.split(/\s+/)
  const head = words.slice(0, MAX_FALLBACK_WORDS).join(' ')
  return words.length > MAX_FALLBACK_WORDS ? `${head}…` : head
}
