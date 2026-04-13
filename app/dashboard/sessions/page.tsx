import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import DifficultyBadge from '@/components/DifficultyBadge'
import type { Profile, SessionStatus, Difficulty } from '@/types'

export const dynamic = 'force-dynamic'

interface SessionRow {
  id: string
  status: SessionStatus
  started_at: string | null
  ended_at: string | null
  created_at: string
  simulations: {
    title: string
    difficulty: Difficulty
  } | null
  evaluations: {
    overall_score: number
    passed: boolean
  } | null
}

function formatDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt || !endedAt) return '—'
  const s = Math.floor(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
  )
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${sec}s`
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const styles: Record<SessionStatus, string> = {
    pending: 'bg-slate-100 text-slate-500',
    active: 'bg-blue-50 text-blue-700',
    ended: 'bg-slate-100 text-slate-600',
    evaluated: 'bg-emerald-50 text-emerald-700',
  }
  const labels: Record<SessionStatus, string> = {
    pending: 'Pending',
    active: 'In Progress',
    ended: 'Ended',
    evaluated: 'Evaluated',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  )
}

export default async function SessionsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<Pick<Profile, 'role'>>()

  const selectQuery =
    'id, status, started_at, ended_at, created_at, simulations(title, difficulty), evaluations(overall_score, passed)'

  let filteredSessions: SessionRow[] = []

  if (profile?.role === 'rep') {
    const { data } = await admin
      .from('sessions')
      .select(selectQuery)
      .eq('rep_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
    filteredSessions = (data ?? []) as unknown as SessionRow[]
  } else {
    const { data } = await admin
      .from('sessions')
      .select(selectQuery)
      .order('created_at', { ascending: false })
      .limit(100)
    filteredSessions = (data ?? []) as unknown as SessionRow[]
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">Sessions</h1>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-500 text-sm mb-4">No sessions yet.</p>
          {profile?.role === 'rep' && (
            <Link href="/dashboard" className="btn-primary">
              Find a Simulation
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Simulation
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Date
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Duration
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Score
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSessions.map((session) => {
                const ev = Array.isArray(session.evaluations)
                  ? (session.evaluations as { overall_score: number; passed: boolean }[])[0] ?? null
                  : session.evaluations

                return (
                  <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {session.simulations?.title ?? 'Unknown Simulation'}
                        </span>
                        {session.simulations?.difficulty && (
                          <DifficultyBadge difficulty={session.simulations.difficulty} />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(session.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {session.status === 'active'
                        ? 'In progress'
                        : formatDuration(session.started_at, session.ended_at)}
                    </td>
                    <td className="px-4 py-3">
                      {ev ? (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 tabular-nums">
                            {ev.overall_score}
                          </span>
                          <span
                            className={`text-xs font-medium rounded-full px-1.5 py-0.5 ${
                              ev.passed
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-600'
                            }`}
                          >
                            {ev.passed ? 'Pass' : 'Fail'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(session.status === 'ended' || session.status === 'evaluated') && (
                        <Link
                          href={`/dashboard/sessions/${session.id}/results`}
                          className="text-xs text-blue-600 hover:underline font-medium"
                        >
                          View Results →
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
