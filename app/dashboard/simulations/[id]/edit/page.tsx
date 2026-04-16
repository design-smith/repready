import { notFound, redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import DashboardPageHero from '@/components/DashboardPageHero'
import { BackLink } from '@/components/page-ui/BackLink'

export const dynamic = 'force-dynamic'
import SimulationForm from '@/components/SimulationForm'
import type { Profile, Simulation } from '@/types'

export default async function EditSimulationPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: profile }, { data: simulation, error }] = await Promise.all([
    admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single<Pick<Profile, 'role'>>(),
    admin
      .from('simulations')
      .select('*')
      .eq('id', params.id)
      .single<Simulation>(),
  ])

  if (!profile || !['trainer', 'admin'].includes(profile.role)) {
    redirect('/dashboard')
  }

  if (error || !simulation) notFound()

  return (
    <div>
      <BackLink href={`/dashboard/simulations/${simulation.id}`}>Back to simulation</BackLink>
      <DashboardPageHero
        kicker="Revision"
        title="Edit simulation"
        description="Fine-tune the buyer, boundaries, and rubric. Saving snapshots a new version — in-flight sessions stay on the version they started with."
      />

      <SimulationForm mode="edit" initialData={simulation} />
    </div>
  )
}
