'use client'

/**
 * UI chrome coordination.
 *
 * Lets a focused surface (e.g. the globe pin editor) temporarily suppress
 * persistent global chrome — currently the CaptureAssistant FAB, which is
 * fixed at z-50 and would otherwise overlap such panels and hide their
 * controls.
 *
 * 2026-07-09 (write-up bridge): also carries structured hand-offs INTO the
 * assistant —
 *   assistantSeed   a jot the user clicked "write up" on; CaptureAssistant
 *                   opens itself, shows the chip, and attaches the intent
 *                   to every submission until the stub is consumed.
 *   viewingEntity   the entity the current surface is about (selected pin,
 *                   open person page) — ambient context so "jot this" or
 *                   "this place" needs no name.
 *
 * Provided at the protected layout (wrapping both the page and the
 * CaptureAssistant). Descendants write; the CaptureAssistant reads.
 */

import { createContext, useContext, useState, type ReactNode } from 'react'
import type { ConsumeStubIntent } from '@/lib/agents/orchestrator/intent'

export interface ViewingEntity {
  entity_id: string
  entity_name: string
  entity_type?: string
}

interface UiChrome {
  assistantSuppressed: boolean
  setAssistantSuppressed: (v: boolean) => void
  /** A write-up hand-off waiting for (or being worked by) the assistant. */
  assistantSeed: ConsumeStubIntent | null
  /** Hand a jot to the assistant — it opens itself and carries the intent. */
  openAssistantWithSeed: (seed: ConsumeStubIntent) => void
  clearAssistantSeed: () => void
  viewingEntity: ViewingEntity | null
  setViewingEntity: (v: ViewingEntity | null) => void
}

const UiChromeCtx = createContext<UiChrome>({
  assistantSuppressed: false,
  setAssistantSuppressed: () => {},
  assistantSeed: null,
  openAssistantWithSeed: () => {},
  clearAssistantSeed: () => {},
  viewingEntity: null,
  setViewingEntity: () => {},
})

export function UiChromeProvider({ children }: { children: ReactNode }) {
  const [assistantSuppressed, setAssistantSuppressed] = useState(false)
  const [assistantSeed, setAssistantSeed] = useState<ConsumeStubIntent | null>(null)
  const [viewingEntity, setViewingEntity] = useState<ViewingEntity | null>(null)
  return (
    <UiChromeCtx.Provider
      value={{
        assistantSuppressed,
        setAssistantSuppressed,
        assistantSeed,
        openAssistantWithSeed: setAssistantSeed,
        clearAssistantSeed: () => setAssistantSeed(null),
        viewingEntity,
        setViewingEntity,
      }}
    >
      {children}
    </UiChromeCtx.Provider>
  )
}

export const useUiChrome = () => useContext(UiChromeCtx)
