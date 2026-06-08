'use client'

/**
 * UI chrome coordination.
 *
 * Lets a focused surface (e.g. the globe pin editor) temporarily suppress
 * persistent global chrome — currently the CaptureAssistant FAB, which is
 * fixed at z-50 and would otherwise overlap such panels and hide their
 * controls.
 *
 * Provided at the protected layout (wrapping both the page and the
 * CaptureAssistant). A descendant opens/closes its panel and calls
 * setAssistantSuppressed; the CaptureAssistant reads assistantSuppressed.
 */

import { createContext, useContext, useState, type ReactNode } from 'react'

interface UiChrome {
  assistantSuppressed: boolean
  setAssistantSuppressed: (v: boolean) => void
}

const UiChromeCtx = createContext<UiChrome>({
  assistantSuppressed: false,
  setAssistantSuppressed: () => {},
})

export function UiChromeProvider({ children }: { children: ReactNode }) {
  const [assistantSuppressed, setAssistantSuppressed] = useState(false)
  return (
    <UiChromeCtx.Provider value={{ assistantSuppressed, setAssistantSuppressed }}>
      {children}
    </UiChromeCtx.Provider>
  )
}

export const useUiChrome = () => useContext(UiChromeCtx)
