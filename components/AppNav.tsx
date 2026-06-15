'use client'

/**
 * AppNav — the single global navigation bar for the protected app,
 * rendered once from app/(protected)/layout.tsx. Replaces the per-page
 * hand-rolled headers (which kept producing one-off navigation dead
 * ends). Links to every surface with active-route highlighting, plus the
 * signed-in email and sign-out.
 *
 * The /globe surface is full-screen nocturne chrome with its own glass
 * "← Dashboard" affordance, so the bar opts OUT there (returns null) —
 * never covering the map.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from '@/app/(protected)/dashboard/sign-out-button'

const LINKS: { href: string; label: string }[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/globe', label: 'Globe' },
  { href: '/memories', label: 'Memories' },
  { href: '/entities', label: 'Entities' },
  { href: '/review', label: 'Review' },
  { href: '/interview', label: 'Interview' },
]

export default function AppNav({ email }: { email?: string }) {
  const pathname = usePathname() ?? ''

  // The globe owns the full viewport and its own chrome — no top bar there.
  if (pathname.startsWith('/globe')) return null

  return (
    <header className="bg-white border-b border-stone-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/dashboard" className="shrink-0 text-base font-semibold tracking-tight text-stone-900">
            Life Chronicle
          </Link>
          <nav className="flex items-center gap-3 overflow-x-auto text-sm">
            {LINKS.map((l) => {
              const active =
                l.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(l.href)
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`shrink-0 transition-colors ${
                    active ? 'font-medium text-stone-900' : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {l.label}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {email && <span className="hidden text-sm text-stone-500 sm:inline">{email}</span>}
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
