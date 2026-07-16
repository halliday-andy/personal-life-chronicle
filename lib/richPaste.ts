/**
 * Rich-clipboard paste → markdown (2026-07-16, the Biggs AFB finding).
 *
 * Research copied from rendered-HTML sources (Gemini, ChatGPT, docs,
 * web pages) carries TWO clipboard flavors: rich text/html and a
 * degraded text/plain — bold, bullets, and citation links stripped,
 * and block boundaries often run together ("missions.The Jet"). A bare
 * <textarea> always pastes the plain flavor, so the degradation was
 * reaching entity_context_notes and recollections AT WRITE TIME; the
 * Slice 6.6 markdown rendering never got markdown to render.
 *
 * The fix: on paste, when the HTML flavor exists AND actually carries
 * formatting the plain flavor lost, convert it to markdown (turndown)
 * and insert that instead. Plain pastes — and trivially-wrapped plain
 * text like a <span> from a code editor — keep native paste behavior,
 * so nothing changes for hand-typed or already-markdown content.
 *
 * Wire with: onPaste={(e) => handleRichPaste(e, setValue)} on any
 * long-form textarea whose content is stored and rendered as markdown.
 * (Deliberately NOT on PinHopper — jots are one-line plain text.)
 */

import type { ClipboardEvent } from 'react'
import TurndownService from 'turndown'

const turndown = new TurndownService({
  headingStyle: 'atx',        // ## Heading — matches the note-title idiom
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
})
// Rendered research often wraps blocks in <div>s; without this they can
// concatenate. Treat a <div> as a paragraph-level break.
turndown.addRule('divBlock', {
  filter: 'div',
  replacement: (content) => (content.trim() ? `\n\n${content}\n\n` : ''),
})

/** Convert an HTML clipboard flavor to markdown, tidied for note bodies. */
export function htmlToMarkdown(html: string): string {
  return turndown
    .turndown(html)
    .replace(/^(\s*)-\s{2,}/gm, '$1- ')  // turndown pads bullets to "-   "
    .replace(/\n{3,}/g, '\n\n')          // collapse runaway blank lines
    .trim()
}

/**
 * Only intercept the paste when the HTML flavor genuinely adds
 * something: markdown out of the conversion that differs from the
 * plain flavor beyond whitespace. A <span>-wrapped plain string (VS
 * Code, terminals) converts to its own plain text — leave those to the
 * browser so we never mangle hand-authored markdown.
 */
export function shouldUseHtmlFlavor(html: string, plain: string): boolean {
  if (!html || !html.includes('<')) return false
  let md: string
  try {
    md = htmlToMarkdown(html)
  } catch {
    return false
  }
  if (!md) return false
  const squash = (s: string) => s.replace(/\s+/g, ' ').trim()
  return squash(md) !== squash(plain)
}

/**
 * Paste handler for markdown-bearing textareas. Reads both clipboard
 * flavors; when the HTML flavor carries formatting, inserts its
 * markdown at the caret (replacing any selection) and restores the
 * caret after React re-renders. Otherwise does nothing — native paste
 * proceeds untouched.
 */
export function handleRichPaste(
  e: ClipboardEvent<HTMLTextAreaElement>,
  setValue: (updater: (prev: string) => string) => void,
): void {
  const html = e.clipboardData.getData('text/html')
  const plain = e.clipboardData.getData('text/plain')
  if (!shouldUseHtmlFlavor(html, plain)) return

  e.preventDefault()
  const target = e.currentTarget
  const md = htmlToMarkdown(html)
  const start = target.selectionStart ?? target.value.length
  const end = target.selectionEnd ?? target.value.length
  setValue((prev) => prev.slice(0, start) + md + prev.slice(end))
  // Caret lands after the inserted markdown once the re-render settles.
  const caret = start + md.length
  setTimeout(() => { target.setSelectionRange(caret, caret) }, 0)
}
