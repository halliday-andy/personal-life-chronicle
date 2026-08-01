/**
 * Ambient types for `turndown-plugin-gfm` (R9 / finding F11, 2026-07-30).
 *
 * The package ships no types and `@types/turndown-plugin-gfm` does not
 * exist on npm, so this declares the surface we actually use. Turndown's
 * own `use()` takes a plugin function of this shape.
 *
 * `gfm` is the bundle (tables + strikethrough + task lists); the individual
 * rule sets are declared too so a future narrowing (e.g. tables only) needs
 * no change here.
 */

declare module 'turndown-plugin-gfm' {
  import type TurndownService from 'turndown'

  type TurndownPlugin = (service: TurndownService) => void

  export const gfm: TurndownPlugin
  export const tables: TurndownPlugin
  export const strikethrough: TurndownPlugin
  export const taskListItems: TurndownPlugin
  export const highlightedCodeBlock: TurndownPlugin
}
