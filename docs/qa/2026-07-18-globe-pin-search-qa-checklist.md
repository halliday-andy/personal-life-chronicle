# QA — Globe pin search (find box "Your pins" group, 2026-07-18)

App: **http://localhost:3001/globe** (sign in first).

Built from this phase's first finding: navigating to a prior spine stop
required manual globe flying or a detour through Journey. The find box
now searches your own pins (ALL types) above external places, in one
dropdown. Part of master-sequence Phase 1.

## 1. Your pins — the new group

- [ ] Type the first few letters of a home you've pinned (2+ characters)
      → a **"Your pins"** section appears at the TOP of the dropdown,
      above "Places".
- [ ] Each pin row shows: a **type-colored dot**, the pin **name**, its
      **when phrase**, and the **type label** right-aligned. `[taste]`
      the row density.
- [ ] A single character shows nothing (no one-key noise).
- [ ] Marker pins match too — try a workplace, a vacation, a Log, a trip
      destination, a Future Place (Andy's call: all types searchable).

## 2. Picking a pin = navigation, not placement

- [ ] Click a pin result → the globe **flies to it and selects it**; the
      detail card arrives **compact** (same arrival as a Journey
      "Show on globe →" link). **No draft pin is created.**
- [ ] Search a Queenstown-cluster pin → the fly is **cluster-aware**
      (frames the local group, not one dot under the card).
- [ ] The original itch: from anywhere on the globe, reach a prior spine
      stop with one query + one click — no zoom-out/rotate/hunt, no
      Journey detour.

## 3. Ranking sanity

- [ ] A query matching several pins ranks name-start matches above
      mid-name matches, and **spine homes above markers** within a tier.

## 4. Places (the original flow) intact

- [ ] Searching somewhere new shows **"Places"** results beneath any pin
      matches; picking one flies there and drops the **draft pin**
      exactly as before.
- [ ] A query matching no pins shows Places only (no empty "Your pins"
      header).
- [ ] No matches at all → a friendly "No matches…" row, never a blank or
      an error.

## 5. Coordinate paste (preserved behavior)

- [ ] Paste a Google-order pair (e.g. `43.7044, -72.2887`) → a **"Go
      to…"** row appears; picking it reverse-geocodes a place label and
      lands the draft pin flow as before.
- [ ] A nonsense pair (`95, 200`) is treated as plain text — no crash
      (the 2026-06-17 crash class).

## 6. Keyboard + a11y

- [ ] Arrow keys traverse BOTH groups in one pass; Enter picks the
      highlighted row; Escape closes the dropdown.
- [ ] The ✕ button clears the query and keeps focus in the box.
- [ ] VoiceOver announces the box as a combobox and reads rows as
      options (spot-check).

## 7. Route-building mode

- [ ] With a trip's route-builder banner active, picking a pin from
      search **adds it as a stop** (same as clicking the pin) and flies
      to it — handy for far-away stops.

## 8. Regression spot-checks

- [ ] Normal pin clicking, hover cards, and the legend behave as before.
- [ ] A very long garbage query degrades to "no matches" (suggest
      failures are swallowed, never a page error).
