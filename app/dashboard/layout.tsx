import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import LogoutButton from '@/components/LogoutButton'
import type { Profile } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/dashboard" className="text-base font-bold text-slate-900">
            RepReady
          </a>
          <div className="flex items-center gap-4">
            {/* Nav links */}
            <nav className="hidden sm:flex items-center gap-4">
              <Link href="/dashboard/sessions" className="text-sm text-slate-600 hover:text-slate-900">
                Sessions
              </Link>
              <Link href="/dashboard/progress" className="text-sm text-slate-600 hover:text-slate-900">
                Progress
              </Link>
              <Link href="/dashboard/leaderboard" className="text-sm text-slate-600 hover:text-slate-900">
                Leaderboard
              </Link>
              {profile && (profile.role === 'trainer' || profile.role === 'admin') && (
                <Link href="/dashboard/analytics" className="text-sm text-slate-600 hover:text-slate-900">
                  Analytics
                </Link>
              )}
            </nav>

            {profile && (
              <span className="text-xs text-slate-500 hidden sm:block">
                {profile.email}
                <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 capitalize">
                  {profile.role}
                </span>
              </span>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  )
}
