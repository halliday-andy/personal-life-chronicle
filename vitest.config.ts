/**
 * Component test harness (2026-08-04).
 *
 * WHAT THIS IS FOR, and what it is not.
 *
 * The repo's testing convention is `scripts/verify-*.mjs`: a pure function
 * called directly, or a DB proof inside a rolled-back transaction. That
 * convention suits the codebase's logic core very well and is not being
 * replaced. But three bugs shipped in one day that it structurally cannot
 * express, because none of them was a wrong VALUE:
 *
 *   - `d9171d7` — `openChip` seeded by a `useState` initialiser from data
 *     that had not arrived. Extracting the predicate would have proven it
 *     correct both before and after the fix; the broken code computed the
 *     right answer at the wrong moment.
 *   - `4bd75d2` — a pending draft's trip read back from live state that had
 *     since been cleared.
 *   - `dff4fa8` — a banner that never took the `!modalOpen` guard the
 *     dialog's own mode statement depended on.
 *
 * So this harness covers **timing, mount order, and conditional
 * rendering**. It does NOT cover layout: jsdom computes no geometry, so the
 * z-order half of `4bd75d2` and `dff4fa8` remains invisible here and stays
 * with Andy's eye and the QA checklists. That boundary is the point of this
 * comment — a harness that is believed to cover more than it does is worse
 * than none.
 *
 * `npm test` runs these. `npm run verify` runs the pure/DB proofs. Both
 * gates matter; neither subsumes the other.
 */

// Excluded from tsconfig: @vitejs/plugin-react and vitest ship slightly
// different copies of vite's Plugin type, so `tsc --noEmit` reports a false
// mismatch on `plugins: [react()]`. Vitest validates this file at run time,
// and `npm test` fails loudly if it is wrong — so the exclusion costs
// nothing real and keeps the app's type gate clean.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors tsconfig's "@/*" path alias so component imports resolve the
    // same way they do under Next.
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.tsx', 'test/**/*.test.ts'],
  },
})
