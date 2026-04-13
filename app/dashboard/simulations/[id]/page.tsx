import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import DifficultyBadge from '@/components/DifficultyBadge'
import VersionHistory from '@/components/VersionHistory'
import StartCallButton from '@/components/StartCallButton'
import type { Profile, SimulationWithVersions } from '@/types'

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

  // Reps can only view active simulations
  if (profile?.role === 'rep' && !simulation.is_active) notFound()

  const canEdit = profile?.role === 'trainer' || profile?.role === 'admin'

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Back to dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-slate-900">{simulation.title}</h1>
            <DifficultyBadge difficulty={simulation.difficulty} />
          </div>
          <p className="text-sm text-slate-500">
            Version {simulation.version} &middot; Created{' '}
            {new Date(simulation.created_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              simulation.is_active
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${simulation.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}
            />
            {simulation.is_active ? 'Active' : 'Inactive'}
          </span>
          {profile?.role === 'rep' && simulation.is_active && (
            <StartCallButton simulationId={simulation.id} />
          )}
          {canEdit && (
            <Link
              href={`/dashboard/simulations/${simulation.id}/edit`}
              className="btn-primary"
            >
              Edit
            </Link>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {/* Basic Info */}
        <div className="card">
          <h2 className="section-title">Basic Info</h2>
          <dl className="space-y-3">
            <DetailRow label="Call Goal" value={simulation.call_goal} multiline />
          </dl>
        </div>

        {/* Persona */}
        <div className="card">
          <h2 className="section-title">Persona</h2>
          <dl className="space-y-3">
            <DetailRow label="Name" value={simulation.persona_name} />
            <DetailRow label="Role / Title" value={simulation.persona_role} />
            <DetailRow label="Communication Style" value={simulation.persona_style} />
            <DetailRow
              label="Company Context"
              value={simulation.company_context}
              multiline
            />
            <DetailRow
              label="Opening Line"
              value={simulation.opening_line}
              multiline
            />
          </dl>
        </div>

        {/* Knowledge Boundaries */}
        <div className="card">
          <h2 className="section-title">Knowledge Boundaries</h2>
          <div className="space-y-4">
            <ListDetail
              label="Hidden Objections"
              items={simulation.hidden_objections}
            />
            <ListDetail
              label="Allowed Disclosures"
              items={simulation.allowed_disclosures}
            />
            <ListDetail
              label="Forbidden Disclosures"
              items={simulation.forbidden_disclosures}
            />
          </div>
        </div>

        {/* Scoring */}
        <div className="card">
          <h2 className="section-title">Scoring</h2>
          <DetailRow
            label="Success Criteria"
            value={simulation.success_criteria}
            multiline
          />
          <div className="mt-4">
            <span className="label">Scoring Rubric</span>
            <div className="mt-2 space-y-2">
              {simulation.scoring_rubric.map((category, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3"
                >
                  <span className="font-medium text-sm text-slate-900 flex-1">
                    {category.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-24 bg-slate-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${(category.weight / 10) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-8">{category.weight}/10</span>
                  </div>
                  {category.description && (
                    <span className="text-xs text-slate-500 flex-1 text-right">
                      {category.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Version History */}
        {canEdit && simulation.simulation_versions.length > 0 && (
          <VersionHistory versions={simulation.simulation_versions} />
        )}
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  multiline,
}: {
  label: string
  value: string
  multiline?: boolean
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">
        {label}
      </dt>
      <dd
        className={`text-sm text-slate-900 ${multiline ? 'whitespace-pre-wrap' : ''}`}
      >
        {value}
      </dd>
    </div>
  )
}

function ListDetail({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}
      </span>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 mt-1 italic">None defined</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-700">
              <span className="text-slate-400 shrink-0">•</span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
