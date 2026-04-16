import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import DashboardPageHero from '@/components/DashboardPageHero'

export const dynamic = 'force-dynamic'
import NewSimulationClient from '@/components/NewSimulationClient'
import type { Profile, SimulationTemplate } from '@/types'

export default async function NewSimulationPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: profile }, { data: templates }] = await Promise.all([
    admin.from('profiles').select('role').eq('id', user.id).single<Pick<Profile, 'role'>>(),
    admin.from('simulation_templates').select('*').order('created_at', { ascending: true }),
  ])

  if (!profile || !['trainer', 'admin'].includes(profile.role)) {
    redirect('/dashboard')
  }

  return (
    <div>
      <DashboardPageHero
        kicker="Authoring"
        title="New simulation"
        description="Templates jump-start you; the editor is where persona voice, objections, and rubric come alive. Reps feel the difference."
      />
      <NewSimulationClient templates={(templates ?? []) as SimulationTemplate[]} />
    </div>
  )
}
