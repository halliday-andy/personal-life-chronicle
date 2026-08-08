import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// jsdom implements no layout, so scroll APIs simply do not exist on its
// elements. Stubbed so components that scroll a newly revealed panel into
// view (rule 13) can be rendered at all.
//
// Worth noticing rather than papering over: the very first thing this
// harness hit was a LAYOUT api it cannot provide. That is the boundary
// documented in vitest.config.ts — this suite reasons about timing and
// conditional rendering, never about geometry. If a test ever wants to
// assert something scrolled or is on top of something else, it is asking
// the wrong runner.
Element.prototype.scrollIntoView = vi.fn()

// Components under test mount real children that fetch on mount (PinHopper
// loads a pin's jots). Unstubbed, every render prints a network stack trace
// and a genuine failure gets lost in it. A test that actually cares about a
// response overrides this locally — the default is "the network answers
// nothing", never "the network is a surprise".
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })),
  )
})
afterEach(() => vi.unstubAllGlobals())

// Each test gets a clean document. Mount ORDER is what most of these
// assert, so a leaked tree from a previous test would not merely be noise —
// it would quietly satisfy the thing under test.
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
