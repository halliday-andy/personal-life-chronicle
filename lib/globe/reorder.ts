/**
 * Pure re-sequencing for the residential spine (Step 7 Slice 4b follow-up).
 *
 * The edit-panel "Where does this fall in your life?" selector lets a user
 * jump an existing pin to any slot in one action. The reorder_residence_pins
 * RPC wants the FULL ordered id list, so we compute it here: take the pin out
 * of its current slot and drop it back in at the chosen final index.
 *
 * Kept pure (no React, no fetch) so it is unit-testable without a DOM or DB —
 * see scripts/verify-globe-reorder.ts.
 */

/**
 * Return a new array with the element at `from` moved so it lands at final
 * index `to`. `to` is clamped into range; an out-of-range `from` yields an
 * unchanged copy. The input is never mutated.
 */
export function moveToIndex<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice()
  if (from < 0 || from >= next.length) return next
  const clampedTo = Math.max(0, Math.min(to, next.length - 1))
  const [item] = next.splice(from, 1)
  next.splice(clampedTo, 0, item)
  return next
}

export interface SpineSlotOption {
  value: number   // final index in the spine the option places the pin at
  label: string
}

/**
 * Build the "Where does this fall in your life?" options for an EXISTING pin.
 * `names` is the ordered spine (including the pin), `selfIndex` is the pin's
 * current slot. The pin is excluded from the reference labels (you don't place
 * yourself relative to yourself), and `value` is the final index, so selecting
 * `value === selfIndex` is a no-op via moveToIndex. Caller guarantees
 * names.length > 1, so there is always at least one "other" to reference.
 */
export function spineSlotOptions(names: string[], selfIndex: number): SpineSlotOption[] {
  const others = names.filter((_, i) => i !== selfIndex)
  const options: SpineSlotOption[] = [{ value: 0, label: `Before ${others[0]} (earliest)` }]
  others.forEach((name, i) => {
    const newest = i === others.length - 1 ? ' (most recent)' : ''
    options.push({ value: i + 1, label: `After ${name}${newest}` })
  })
  return options
}
