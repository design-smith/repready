import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/DashboardShell'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

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

  const showAnalyticsLink =
    !!profile && (profile.role === 'trainer' || profile.role === 'admin')

  return (
    <DashboardShell profile={profile ?? null} showAnalyticsLink={showAnalyticsLink}>
      {children}
    </DashboardShell>
  )
}
