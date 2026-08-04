'use client'

/**
 * PinSelect — one pin-picking `<select>`, used for both ends of a trip
 * (R22, 2026-08-03).
 *
 * R22's spec said the destination selector should be "the same shape and
 * the same pin list" as the origin's. Same shape, yes — same list, no, and
 * the difference is the whole reason this is a component rather than a
 * copy-paste:
 *
 *  - The origin has a real **"Decide later"**: `trips.origin_relationship_id`
 *    is nullable, and a draft trip is precisely one without an origin.
 *    `trips.destination_relationship_id` is **NOT NULL** — a trip without a
 *    destination is not a trip. So `allowNone` is per-end.
 *  - "＋ Pin a new origin on the globe…" hands off to origin capture, a
 *    globe mode that only ever sets an ORIGIN. There is no destination
 *    equivalent, so `onAddNew` is optional rather than assumed.
 *  - "(home at the time)" describes why a pin is being SUGGESTED as an
 *    origin. It is meaningless on the other end, so the suffix travels
 *    with the caller.
 *
 * Two selectors that differ only in label must not drift into two
 * implementations — the pin-card reconciliation lesson. Two selectors that
 * differ in what a null MEANS must not be one hardcoded list.
 */

export interface SelectablePin {
  relationship_id: string
  name: string
  type_code: string | null
}

export default function PinSelect({
  value,
  onChange,
  pins,
  disabled,
  suggestedId,
  suggestionSuffix,
  allowNone,
  noneLabel,
  onAddNew,
  addNewLabel,
  label,
  id,
}: {
  value: string
  onChange: (relationshipId: string) => void
  pins: SelectablePin[]
  disabled?: boolean
  /** Floated to the top of the list — the pin the app thinks is likeliest. */
  suggestedId?: string | null
  /** Why it is suggested, e.g. "home at the time". Rendered in parentheses. */
  suggestionSuffix?: string
  /** Does an empty choice exist at all? False for a NOT NULL column. */
  allowNone: boolean
  noneLabel?: string
  /** Offer an escape to a globe capture mode. Omitted where none exists. */
  onAddNew?: () => void
  addNewLabel?: string
  label: string
  id: string
}) {
  const suggested = suggestedId ? pins.find((p) => p.relationship_id === suggestedId) : undefined
  const others = pins.filter((p) => p.relationship_id !== suggested?.relationship_id)

  return (
    <>
      <label htmlFor={id} className="block text-sm text-[var(--ink-dim)]">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          // The sentinel never becomes state — it is a command, not a value.
          if (e.target.value === '__new__') { onAddNew?.(); return }
          onChange(e.target.value)
        }}
        disabled={disabled}
        className="mt-1 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ember-soft)]"
      >
        {suggested && (
          <option value={suggested.relationship_id}>
            {suggested.name}{suggestionSuffix ? ` (${suggestionSuffix})` : ''}
          </option>
        )}
        {others.map((p) => (
          <option key={p.relationship_id} value={p.relationship_id}>{p.name}</option>
        ))}
        {onAddNew && <option value="__new__">{addNewLabel ?? '＋ Pin a new place on the globe…'}</option>}
        {allowNone && <option value="">{noneLabel ?? 'Decide later'}</option>}
      </select>
    </>
  )
}
