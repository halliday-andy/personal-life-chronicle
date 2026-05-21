'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
    >
      Sign out
    </button>
  )
}
