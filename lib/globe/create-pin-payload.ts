/**
 * Pin-create payload assembly (2026-07-18).
 *
 * Origin: GlobeView.handleSave used to re-type the PinDraftData field
 * list inline when building the POST /api/globe/residence body — and the
 * U9 `unsequenced` field was never added, so every "Decide later — not
 * yet placed" primary landed SEQUENCED at the spine's end (Andy's live
 * repro, 2026-07-18). Class-of-bug: manual re-enumeration of a payload's
 * fields at a boundary silently drops newly added fields.
 *
 * The guard: `routed` must satisfy Record<keyof PinDraftData, unknown> —
 * add a field to PinDraftData and this file fails to COMPILE until the
 * field is consciously routed: sent, transformed, or documented as
 * client-only (like `trip`).
 */

import type { PinDraftData } from '@/components/globe/PinModal'

export interface DraftPoint {
  lng: number
  lat: number
  label: string
}

export function buildCreatePinPayload(draft: DraftPoint, data: PinDraftData) {
  const routed = {
    name: data.name,
    whenText: data.whenText,
    description: data.description,
    body: data.body,
    position: data.position,
    typeCode: data.typeCode,
    anchorId: data.anchorId,
    entityId: data.entityId,
    unsequenced: data.unsequenced,
    trip: data.trip, // client-only: U3 trip framing runs AFTER the pin saves — never posted
  } satisfies Record<keyof PinDraftData, unknown>

  return {
    lng: draft.lng,
    lat: draft.lat,
    label: routed.name.trim() || draft.label,
    whenText: routed.whenText,
    body: routed.body,
    position: routed.position,
    typeCode: routed.typeCode,
    anchorId: routed.anchorId,
    description: routed.description,
    entityId: routed.entityId,
    unsequenced: routed.unsequenced,
  }
}
