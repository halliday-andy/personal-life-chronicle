import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppNav from '@/components/AppNav'
import CaptureAssistant from '@/components/CaptureAssistant'
import { UiChromeProvider } from '@/components/UiChromeContext'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  return (
    <UiChromeProvider>
      <AppNav email={user.email} />
      {children}
      {/*
        Capture assistant mounts at the layout level so it persists across
        navigation between /dashboard, /interview, /memories, and future
        protected pages. Step 6e MVP — proposal-card UX lands in 6f.
        Wrapped in UiChromeProvider so a focused surface (e.g. the globe pin
        editor) can suppress the FAB while its panel is open.
      */}
      <CaptureAssistant />
    </UiChromeProvider>
  )
}
