import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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
      <div className="mb-6">
        <a href="/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Back to dashboard
        </a>
        <h1 className="text-xl font-bold text-slate-900 mt-2">New Simulation</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Start from a template or define the scenario from scratch.
        </p>
      </div>

      <NewSimulationClient templates={(templates ?? []) as SimulationTemplate[]} />
    </div>
  )
}
