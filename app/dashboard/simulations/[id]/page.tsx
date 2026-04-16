import { notFound, redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import SimulationDetailView from '@/components/SimulationDetailView'
import type { Profile, SimulationWithVersions } from '@/types'

export const dynamic = 'force-dynamic'

export default async function SimulationDetailPage({
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
      .select(
        `
        *,
        simulation_versions (
          id,
          version,
          snapshot,
          created_by,
          created_at
        )
      `
      )
      .eq('id', params.id)
      .order('version', { referencedTable: 'simulation_versions', ascending: false })
      .single<SimulationWithVersions>(),
  ])

  if (error || !simulation) notFound()

  if (profile?.role === 'rep' && !simulation.is_active) notFound()

  const canEdit = profile?.role === 'trainer' || profile?.role === 'admin'

  return (
    <SimulationDetailView
      simulation={simulation}
      profileRole={profile?.role}
      canEdit={canEdit}
    />
  )
}
