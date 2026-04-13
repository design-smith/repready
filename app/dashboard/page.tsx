import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import SimulationsList from '@/components/SimulationsList'
import type { Profile, Simulation } from '@/types'

export default async function DashboardPage() {
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

  if (!profile) redirect('/login')

  let query = admin
    .from('simulations')
    .select(
      'id, title, difficulty, call_goal, persona_name, is_active, version, created_at'
    )
    .order('created_at', { ascending: false })

  // Reps only see active simulations
  if (profile.role === 'rep') {
    query = query.eq('is_active', true)
  }

  const { data: simulations } = await query

  return (
    <SimulationsList
      simulations={(simulations as Pick<
        Simulation,
        'id' | 'title' | 'difficulty' | 'call_goal' | 'persona_name' | 'is_active' | 'version' | 'created_at'
      >[]) ?? []}
      userRole={profile.role}
    />
  )
}
