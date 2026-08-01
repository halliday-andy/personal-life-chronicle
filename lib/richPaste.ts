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
import { gfm } from 'turndown-plugin-gfm'

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

// GFM: tables, strikethrough, task lists. Turndown's core has NO <table>
// rule, so a pasted table used to collapse into a vertical run of orphaned
// cell values (finding F11, 2026-07-30 — Andy's Ivy-League coeducation
// table). The renderer has spoken GFM all along via remark-gfm; only the
// converter was deaf to it.
turndown.use(gfm)

// ── Presentational emphasis ───────────────────────────────────────────
// Turndown only understands SEMANTIC emphasis (<strong>, <em>, <b>, <i>).
// Rendered sources frequently mark emphasis with style instead — Gemini
// marks every bold run with a styled <span>, so Andy's Dartmouth note
// arrived without a single ** in it while headings and bullets survived.
//
// Scoped to <span> deliberately: a filter matching any styled element
// would wrap whole blocks (a <p> with a font-weight) in emphasis markers.
const BOLD_WEIGHT = /^(bold|bolder|[6-9]00)$/i
const ITALIC_STYLE = /^(italic|oblique)/i

/** Read one declaration out of an inline style attribute. */
function styleProp(node: Node, prop: string): string {
  const style = (node as Element).getAttribute?.('style') ?? ''
  const hit = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(style)
  return hit ? hit[1].trim() : ''
}

const isPresentationallyBold = (n: Node) => BOLD_WEIGHT.test(styleProp(n, 'font-weight'))
const isPresentationallyItalic = (n: Node) => ITALIC_STYLE.test(styleProp(n, 'font-style'))

turndown.addRule('presentationalEmphasis', {
  filter: (node) =>
    node.nodeName === 'SPAN' && (isPresentationallyBold(node) || isPresentationallyItalic(node)),
  replacement: (content, node) => {
    const core = content.trim()
    if (!core) return content
    // Emphasis markers must hug the text — "** bold **" does not render —
    // so surrounding whitespace is preserved outside the markers.
    const lead = /^\s*/.exec(content)?.[0] ?? ''
    const tail = /\s*$/.exec(content)?.[0] ?? ''
    let out = core
    if (isPresentationallyBold(node)) out = `**${out}**`
    if (isPresentationallyItalic(node)) out = `*${out}*`
    return lead + out + tail
  },
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
