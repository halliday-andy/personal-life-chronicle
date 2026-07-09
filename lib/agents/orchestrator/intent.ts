/**
 * Capture intents — structured, machine-readable purpose attached to a
 * submission by the UI (2026-07-09, from Andy's Hopper 5a QA).
 *
 * The problem this solves: the jot list and the capture assistant were
 * disconnected surfaces. Clicking "write up" on a jot must NOT depend on
 * the model re-interpreting prose to figure out which stub the user means
 * — the UI knows the exact stub_id, so it travels with the submission as
 * authoritative context.
 *
 * Two pieces, both pure so they're provable:
 *   renderIntentPreamble — the Layer C block the model sees.
 *   findBackstopConsume  — the deterministic guard: if a write-up run
 *     produced a recollection but the model forgot consume_memory_stub,
 *     core.ts consumes it mechanically. The check-off must never depend
 *     on model diligence (house pattern: prompt rule + mechanical guard).
 */

import type { ToolResultPayload } from './tools'

export interface ConsumeStubIntent {
  kind: 'consume_stub'
  stub_id: string
  /** The jot's text, for the model and the panel chip. */
  stub_body: string
  entity_id: string
  entity_name: string
}

export type CaptureIntent = ConsumeStubIntent

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Validate an untrusted intent payload from the client. */
export function parseCaptureIntent(raw: unknown): CaptureIntent | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.kind !== 'consume_stub') return null
  if (typeof o.stub_id !== 'string' || !UUID_RE.test(o.stub_id)) return null
  if (typeof o.entity_id !== 'string' || !UUID_RE.test(o.entity_id)) return null
  if (typeof o.stub_body !== 'string' || !o.stub_body.trim()) return null
  if (typeof o.entity_name !== 'string' || !o.entity_name.trim()) return null
  return {
    kind: 'consume_stub',
    stub_id: o.stub_id,
    stub_body: o.stub_body.trim(),
    entity_id: o.entity_id,
    entity_name: o.entity_name.trim(),
  }
}

/**
 * The Layer C preamble for an intent-carrying submission. Rides EVERY turn
 * of the write-up conversation (the client keeps sending it until the stub
 * is consumed), so it reads as standing state, not a one-shot command.
 */
export function renderIntentPreamble(intent: CaptureIntent): string {
  return [
    '[WRITE-UP INTENT — attached by the hopper UI; authoritative, not user prose]',
    `The user clicked "write up" on this jot from ${intent.entity_name}'s hopper:`,
    `  jot: "${intent.stub_body}"`,
    `  stub_id: ${intent.stub_id}`,
    `  host entity: ${intent.entity_name} (${intent.entity_id})`,
    'You are mid-write-up for THIS jot until it is consumed: interview the user to',
    'flesh it into a recollection (their words). When their account is told, run the',
    'capture trio (create_memory alone, then classify/extract with the memory_id),',
    'and in that same later turn call consume_memory_stub with THIS stub_id and the',
    'new memory_id. Do not re-list stubs to find it — the id above is the one.',
  ].join('\n')
}

/**
 * The deterministic backstop decision. Given the run's intent and its
 * proposals, returns the {stub_id, memory_id} that still needs consuming,
 * or null when nothing is owed:
 *   - no intent → null
 *   - a persisted consume_memory_stub for this stub already ran → null
 *   - no persisted create_memory (mid-interview turn) → null — nothing
 *     exists to consume against; the intent rides to the next turn
 *   - otherwise → consume the FIRST persisted memory against the stub
 */
export function findBackstopConsume(
  intent: CaptureIntent | null | undefined,
  proposals: ToolResultPayload[],
): { stub_id: string; memory_id: string } | null {
  if (!intent || intent.kind !== 'consume_stub') return null
  const consumed = proposals.some(
    (p) =>
      p.tool === 'consume_memory_stub' &&
      p.persisted &&
      (p.data as { stub_id?: string }).stub_id === intent.stub_id,
  )
  if (consumed) return null
  const created = proposals.find((p) => p.tool === 'create_memory' && p.persisted)
  const memory_id = created ? String((created.data as { memory_id?: string }).memory_id ?? '') : ''
  if (!memory_id) return null
  return { stub_id: intent.stub_id, memory_id }
}
