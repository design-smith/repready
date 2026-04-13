import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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
      <div className="mb-6">
        <Link
          href={`/dashboard/simulations/${simulation.id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to simulation
        </Link>
        <h1 className="text-xl font-bold text-slate-900 mt-2">Edit Simulation</h1>
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4 mt-0.5 shrink-0"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          Saving will create a new version. Active sessions using the previous version are
          unaffected.
        </div>
      </div>

      <SimulationForm mode="edit" initialData={simulation} />
    </div>
  )
}
