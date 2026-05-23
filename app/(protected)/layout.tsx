import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CaptureAssistant from '@/components/CaptureAssistant'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  return (
    <>
      {children}
      {/*
        Capture assistant mounts at the layout level so it persists across
        navigation between /dashboard, /interview, /memories, and future
        protected pages. Step 6e MVP — proposal-card UX lands in 6f.
      */}
      <CaptureAssistant />
    </>
  )
}
