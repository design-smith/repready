import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile, Difficulty } from '@/types'

export const dynamic = 'force-dynamic'

interface SessionRow {
  id: string
  created_at: string
  simulation_id: string
  rep_id: string
  profiles: { full_name: string | null; email: string } | null
  simulations: { title: string; difficulty: Difficulty } | null
  evaluations: { overall_score: number; passed: boolean } | null
}

const RANGE_LABELS: Record<string, string> = {
  all: 'All time',
  '30': 'Last 30 days',
  '7': 'Last 7 days',
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { range?: string; simulation_id?: string }
}) {
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

  const range = searchParams.range ?? 'all'
  const filterSimId = searchParams.simulation_id ?? ''

  // Load simulations for filter dropdown
  const { data: simulations } = await admin
    .from('simulations')
    .select('id, title')
    .eq('is_active', true)
    .order('title', { ascending: true })

  let query = admin
    .from('sessions')
    .select(
      'id, created_at, simulation_id, rep_id, profiles(full_name, email), simulations(title, difficulty), evaluations(overall_score, passed)'
    )
    .eq('status', 'evaluated')

  if (filterSimId) {
    query = query.eq('simulation_id', filterSimId)
  }

  if (range !== 'all') {
    const days = parseInt(range)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('created_at', since)
  }

  const { data: rawSessions } = await query.order('created_at', { ascending: false })
  const sessions = (rawSessions ?? []) as unknown as SessionRow[]

  function getEval(s: SessionRow) {
    return Array.isArray(s.evaluations)
      ? (s.evaluations as SessionRow['evaluations'][])[0] ?? null
      : s.evaluations
  }

  // Aggregate per rep
  const repMap: Record<
    string,
    {
      name: string
      sessions: number
      scores: number[]
      passes: number
      bestScore: number
      lastDate: string
    }
  > = {}

  for (const s of sessions) {
    const prof = s.profiles as { full_name?: string | null; email: string } | null
    const name = prof?.full_name || prof?.email || s.rep_id
    if (!repMap[s.rep_id]) {
      repMap[s.rep_id] = { name, sessions: 0, scores: [], passes: 0, bestScore: 0, lastDate: s.created_at }
    }
    repMap[s.rep_id].sessions++
    if (s.created_at > repMap[s.rep_id].lastDate) repMap[s.rep_id].lastDate = s.created_at
    const ev = getEval(s)
    if (ev) {
      repMap[s.rep_id].scores.push(ev.overall_score)
      if (ev.passed) repMap[s.rep_id].passes++
      if (ev.overall_score > repMap[s.rep_id].bestScore) repMap[s.rep_id].bestScore = ev.overall_score
    }
  }

  const rows = Object.entries(repMap)
    .map(([repId, r]) => ({
      repId,
      ...r,
      avgScore: r.scores.length > 0 ? r.scores.reduce((a, b) => a + b, 0) / r.scores.length : null,
      passRate: r.scores.length > 0 ? (r.passes / r.scores.length) * 100 : null,
    }))
    .sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1))

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold text-slate-900 mb-6">Leaderboard</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Time range */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          {Object.entries(RANGE_LABELS).map(([val, label]) => (
            <Link
              key={val}
              href={`/dashboard/leaderboard?range=${val}${filterSimId ? `&simulation_id=${filterSimId}` : ''}`}
              className={`px-3 py-1.5 ${range === val ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Simulation filter */}
        <form method="GET" action="/dashboard/leaderboard" className="flex items-center gap-2">
          <input type="hidden" name="range" value={range} />
          <select
            name="simulation_id"
            defaultValue={filterSimId}
            className="input text-sm py-1.5"
          >
            <option value="">All simulations</option>
            {(simulations ?? []).map((sim) => (
              <option key={sim.id} value={sim.id}>{sim.title}</option>
            ))}
          </select>
          <button type="submit" className="btn-secondary text-sm">Filter</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-500 text-sm">No evaluated sessions in this period.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide w-12">Rank</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Rep</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Sessions</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Avg Score</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Pass Rate</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Best</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => {
                const isCurrentUser = row.repId === user.id
                return (
                  <tr
                    key={row.repId}
                    className={`${isCurrentUser ? 'bg-blue-50 font-medium' : 'hover:bg-slate-50'} transition-colors`}
                  >
                    <td className="px-4 py-3 text-slate-500 text-base">
                      {medals[i] ?? <span className="text-sm">{i + 1}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={isCurrentUser ? 'text-blue-700' : 'text-slate-900'}>
                        {row.name}
                        {isCurrentUser && <span className="ml-1 text-xs text-blue-500">(you)</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.sessions}</td>
                    <td className="px-4 py-3 text-slate-900 tabular-nums font-semibold">
                      {row.avgScore != null ? Math.round(row.avgScore) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {row.passRate != null ? `${Math.round(row.passRate)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 tabular-nums">{row.bestScore || '—'}</td>
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
