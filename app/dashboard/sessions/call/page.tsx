import { notFound, redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import CallScreen from '@/components/CallScreen'
import type { Difficulty } from '@/types'

export const dynamic = 'force-dynamic'

export default async function CallPage({
  searchParams,
}: {
  searchParams: { simulation_id?: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const simulationId = searchParams.simulation_id
  if (!simulationId) redirect('/dashboard')

  const admin = createAdminClient()

  const { data: simulation, error } = await admin
    .from('simulations')
    .select('id, title, persona_name, persona_role, difficulty, is_active')
    .eq('id', simulationId)
    .single()

  if (error || !simulation) notFound()

  if (!simulation.is_active) {
    redirect('/dashboard')
  }

  return (
    <CallScreen
      simulation={{
        id: simulation.id as string,
        title: simulation.title as string,
        persona_name: simulation.persona_name as string,
        persona_role: simulation.persona_role as string,
        difficulty: simulation.difficulty as Difficulty,
      }}
    />
  )
}
