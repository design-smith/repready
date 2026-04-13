import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile, Difficulty } from '@/types'

export const dynamic = 'force-dynamic'

interface EvaluationCategory {
  name: string
  score: number
  weight: number
}

interface SessionWithData {
  id: string
  status: string
  started_at: string | null
  ended_at: string | null
  created_at: string
  simulation_id: string
  rep_id: string
  profiles: { full_name: string | null; email: string } | null
  simulations: { title: string; difficulty: Difficulty } | null
  evaluations: {
    overall_score: number
    passed: boolean
    category_scores: EvaluationCategory[]
  } | null
}

function formatPct(n: number): string {
  return `${Math.round(n)}%`
}

export default async function AnalyticsPage() {
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

  if (profile?.role === 'rep') redirect('/dashboard')

  const { data: rawSessions } = await admin
    .from('sessions')
    .select(
      'id, status, started_at, ended_at, created_at, simulation_id, rep_id, profiles(full_name, email), simulations(title, difficulty), evaluations(overall_score, passed, category_scores)'
    )
    .in('status', ['ended', 'evaluated'])
    .order('created_at', { ascending: false })

  const sessions = (rawSessions ?? []) as unknown as SessionWithData[]

  const evaluatedSessions = sessions.filter((s) => {
    const ev = Array.isArray(s.evaluations)
      ? (s.evaluations as SessionWithData['evaluations'][])[0]
      : s.evaluations
    return ev != null
  })

  function getEval(s: SessionWithData) {
    return Array.isArray(s.evaluations)
      ? (s.evaluations as SessionWithData['evaluations'][])[0] ?? null
      : s.evaluations
  }

  // ---------------------------------------------------------------
  // Team overview stats
  // ---------------------------------------------------------------
  const totalCompleted = sessions.length
  const totalEvaluated = evaluatedSessions.length

  const avgScore =
    totalEvaluated > 0
      ? evaluatedSessions.reduce((sum, s) => sum + (getEval(s)?.overall_score ?? 0), 0) /
        totalEvaluated
      : null

  const passRate =
    totalEvaluated > 0
      ? (evaluatedSessions.filter((s) => getEval(s)?.passed).length / totalEvaluated) * 100
      : null

  // Most-attempted simulation
  const simCounts: Record<string, { title: string; count: number }> = {}
  for (const s of sessions) {
    const title = s.simulations?.title ?? s.simulation_id
    if (!simCounts[s.simulation_id]) simCounts[s.simulation_id] = { title, count: 0 }
    simCounts[s.simulation_id].count++
  }
  const mostAttempted = Object.values(simCounts).sort((a, b) => b.count - a.count)[0] ?? null

  // ---------------------------------------------------------------
  // Rep performance table
  // ---------------------------------------------------------------
  const repMap: Record<
    string,
    { name: string; sessions: number; scores: number[]; passes: number; lastActive: string }
  > = {}
  for (const s of sessions) {
    const name =
      (s.profiles as { full_name?: string | null; email: string } | null)?.full_name ||
      (s.profiles as { full_name?: string | null; email: string } | null)?.email ||
      s.rep_id
    if (!repMap[s.rep_id]) {
      repMap[s.rep_id] = { name, sessions: 0, scores: [], passes: 0, lastActive: s.created_at }
    }
    repMap[s.rep_id].sessions++
    if (s.created_at > repMap[s.rep_id].lastActive) repMap[s.rep_id].lastActive = s.created_at
    const ev = getEval(s)
    if (ev) {
      repMap[s.rep_id].scores.push(ev.overall_score)
      if (ev.passed) repMap[s.rep_id].passes++
    }
  }
  const repRows = Object.entries(repMap)
    .map(([, r]) => ({
      ...r,
      avgScore: r.scores.length > 0 ? r.scores.reduce((a, b) => a + b, 0) / r.scores.length : null,
      passRate: r.scores.length > 0 ? (r.passes / r.scores.length) * 100 : null,
    }))
    .sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1))

  // ---------------------------------------------------------------
  // Weak areas: aggregate category scores across all evaluations
  // ---------------------------------------------------------------
  const categoryTotals: Record<string, { total: number; count: number }> = {}
  for (const s of evaluatedSessions) {
    const ev = getEval(s)
    if (!ev) continue
    for (const cat of ev.category_scores) {
      if (!categoryTotals[cat.name]) categoryTotals[cat.name] = { total: 0, count: 0 }
      categoryTotals[cat.name].total += cat.score
      categoryTotals[cat.name].count++
    }
  }
  const weakAreas = Object.entries(categoryTotals)
    .filter(([, v]) => v.count >= 5)
    .map(([name, v]) => ({ name, avg: v.total / v.count }))
    .sort((a, b) => a.avg - b.avg)

  // ---------------------------------------------------------------
  // Simulation difficulty breakdown
  // ---------------------------------------------------------------
  const simBreakdown: Record<
    string,
    { title: string; difficulty: Difficulty; attempts: number; scores: number[]; passes: number }
  > = {}
  for (const s of sessions) {
    const key = s.simulation_id
    if (!simBreakdown[key]) {
      simBreakdown[key] = {
        title: s.simulations?.title ?? key,
        difficulty: s.simulations?.difficulty ?? 'medium',
        attempts: 0,
        scores: [],
        passes: 0,
      }
    }
    simBreakdown[key].attempts++
    const ev = getEval(s)
    if (ev) {
      simBreakdown[key].scores.push(ev.overall_score)
      if (ev.passed) simBreakdown[key].passes++
    }
  }
  const simRows = Object.values(simBreakdown).sort((a, b) => b.attempts - a.attempts)

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold text-slate-900 mb-6">Team Analytics</h1>

      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Sessions Completed" value={String(totalCompleted)} />
        <StatCard
          label="Avg Score"
          value={avgScore !== null ? `${Math.round(avgScore)}` : '—'}
          sub={avgScore !== null ? '/100' : undefined}
        />
        <StatCard label="Pass Rate" value={passRate !== null ? formatPct(passRate) : '—'} />
        <StatCard
          label="Top Simulation"
          value={mostAttempted?.title ?? '—'}
          small
        />
      </div>

      {/* Rep performance table */}
      <div className="card overflow-hidden p-0 mb-8">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">Rep Performance</h2>
        </div>
        {repRows.length === 0 ? (
          <p className="text-sm text-slate-400 italic px-4 py-6">No rep data yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Rep
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Sessions
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Avg Score
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Pass Rate
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Last Active
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {repRows.map((rep, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{rep.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{rep.sessions}</td>
                  <td className="px-4 py-2.5 text-slate-900 tabular-nums">
                    {rep.avgScore !== null ? Math.round(rep.avgScore) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {rep.passRate !== null ? formatPct(rep.passRate) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {new Date(rep.lastActive).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Weak areas */}
      {weakAreas.length > 0 && (
        <div className="card mb-8">
          <h2 className="section-title">Weak Areas (≥5 sessions)</h2>
          <p className="text-xs text-slate-500 mb-4">
            Categories averaging below 6/10 across the team.
          </p>
          <div className="space-y-3">
            {weakAreas.map((area) => {
              const pct = (area.avg / 10) * 100
              const color =
                area.avg >= 8
                  ? 'bg-emerald-500'
                  : area.avg >= 6
                  ? 'bg-amber-400'
                  : 'bg-red-500'
              const labelColor =
                area.avg >= 8
                  ? 'text-emerald-700'
                  : area.avg >= 6
                  ? 'text-amber-700'
                  : 'text-red-700'
              return (
                <div key={area.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700">{area.name}</span>
                    <span className={`text-xs font-semibold tabular-nums ${labelColor}`}>
                      {area.avg.toFixed(1)} / 10
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Simulation breakdown */}
      {simRows.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">Simulation Breakdown</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Simulation
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Attempts
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Avg Score
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Pass Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {simRows.map((sim, i) => {
                const scored = sim.scores.length
                const avg = scored > 0 ? sim.scores.reduce((a, b) => a + b, 0) / scored : null
                const pass = scored > 0 ? (sim.passes / scored) * 100 : null
                return (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-900">{sim.title}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{sim.attempts}</td>
                    <td className="px-4 py-2.5 text-slate-900 tabular-nums">
                      {avg !== null ? Math.round(avg) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {pass !== null ? formatPct(pass) : '—'}
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

function StatCard({
  label,
  value,
  sub,
  small,
}: {
  label: string
  value: string
  sub?: string
  small?: boolean
}) {
  return (
    <div className="card">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <div className="flex items-end gap-0.5">
        <p
          className={`font-semibold text-slate-900 ${
            small ? 'text-sm leading-tight' : 'text-2xl'
          }`}
        >
          {value}
        </p>
        {sub && <p className="text-sm text-slate-400 mb-0.5">{sub}</p>}
      </div>
    </div>
  )
}
