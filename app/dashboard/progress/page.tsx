import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import DashboardPageHero from '@/components/DashboardPageHero'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

interface EvaluationCategory {
  name: string
  score: number
  weight: number
}

interface SessionData {
  id: string
  created_at: string
  simulation_id: string
  rep_id: string
  evaluations: { overall_score: number; passed: boolean; category_scores: EvaluationCategory[] } | null
  session_metrics: { talk_ratio: number; filler_word_count: number; question_count: number } | null
}

interface RepOption {
  id: string
  email: string
  full_name: string | null
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: { rep_id?: string }
}) {
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

  // Determine whose data to show
  const isManager = profile?.role === 'trainer' || profile?.role === 'admin'
  const targetRepId = isManager && searchParams.rep_id ? searchParams.rep_id : user.id

  // Managers can pick a rep
  let repOptions: RepOption[] = []
  if (isManager) {
    const { data: reps } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'rep')
      .order('full_name', { ascending: true })
    repOptions = (reps ?? []) as RepOption[]
  }

  const { data: rawSessions } = await admin
    .from('sessions')
    .select(
      'id, created_at, simulation_id, rep_id, evaluations(overall_score, passed, category_scores), session_metrics(talk_ratio, filler_word_count, question_count)'
    )
    .eq('rep_id', targetRepId)
    .eq('status', 'evaluated')
    .order('created_at', { ascending: true })

  const sessions = (rawSessions ?? []) as unknown as SessionData[]

  const evaluated = sessions.filter((s) => {
    const ev = Array.isArray(s.evaluations) ? (s.evaluations as SessionData['evaluations'][])[0] : s.evaluations
    return ev != null
  })

  function getEval(s: SessionData) {
    return Array.isArray(s.evaluations)
      ? (s.evaluations as SessionData['evaluations'][])[0] ?? null
      : s.evaluations
  }
  function getMetrics(s: SessionData) {
    return Array.isArray(s.session_metrics)
      ? (s.session_metrics as SessionData['session_metrics'][])[0] ?? null
      : s.session_metrics
  }

  const scores = evaluated.map((s) => getEval(s)?.overall_score ?? 0)
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  const passCount = evaluated.filter((s) => getEval(s)?.passed).length
  const passRate = evaluated.length > 0 ? (passCount / evaluated.length) * 100 : null

  // Category averages — compare first half vs second half
  const categoryMap: Record<string, number[]> = {}
  for (const s of evaluated) {
    const ev = getEval(s)
    if (!ev) continue
    for (const cat of ev.category_scores) {
      if (!categoryMap[cat.name]) categoryMap[cat.name] = []
      categoryMap[cat.name].push(cat.score)
    }
  }
  const categoryStats = Object.entries(categoryMap).map(([name, scores]) => {
    const half = Math.floor(scores.length / 2)
    const first = half > 0 ? scores.slice(0, half).reduce((a, b) => a + b, 0) / half : null
    const second = half > 0 ? scores.slice(half).reduce((a, b) => a + b, 0) / (scores.length - half) : null
    const delta = first != null && second != null ? second - first : null
    return { name, avg: scores.reduce((a, b) => a + b, 0) / scores.length, delta }
  })

  // Metrics trend: first 3 vs last 3
  const withMetrics = evaluated.filter((s) => getMetrics(s) != null)
  const firstThree = withMetrics.slice(0, 3)
  const lastThree = withMetrics.slice(-3)

  function avgMetric(sessions: SessionData[], key: keyof NonNullable<SessionData['session_metrics']>) {
    const vals = sessions.map((s) => getMetrics(s)?.[key] as number).filter((v) => v != null)
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  // SVG line chart
  const chartW = 480
  const chartH = 120
  const padding = { top: 10, right: 10, bottom: 20, left: 30 }
  const innerW = chartW - padding.left - padding.right
  const innerH = chartH - padding.top - padding.bottom

  const scorePoints = evaluated.map((s, i) => ({
    x: evaluated.length > 1 ? (i / (evaluated.length - 1)) * innerW : innerW / 2,
    y: innerH - ((getEval(s)?.overall_score ?? 0) / 100) * innerH,
    score: getEval(s)?.overall_score ?? 0,
    date: new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }))

  // Linear regression for trend line
  let trendLine: { x1: number; y1: number; x2: number; y2: number } | null = null
  let trendLabel = ''
  if (scorePoints.length >= 2) {
    const n = scorePoints.length
    const sumX = scorePoints.reduce((a, p) => a + p.x, 0)
    const sumY = scorePoints.reduce((a, p) => a + p.y, 0)
    const sumXY = scorePoints.reduce((a, p) => a + p.x * p.y, 0)
    const sumX2 = scorePoints.reduce((a, p) => a + p.x * p.x, 0)
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    const x1 = 0
    const x2 = innerW
    trendLine = { x1, y1: slope * x1 + intercept, x2, y2: slope * x2 + intercept }
    trendLabel = slope < -0.3 ? 'Improving' : slope > 0.3 ? 'Needs consistency' : 'Steady'
  }

  const targetRep = isManager
    ? repOptions.find((r) => r.id === targetRepId)
    : null

  return (
    <div className="w-full">
      <DashboardPageHero
        kicker="Your trajectory"
        title="Progress"
        description="Scores over time, rubric categories, and talk-track habits — so you can see momentum, not just individual calls."
      />
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Overview</h1>
          {targetRep && (
            <p className="text-sm text-slate-500 mt-0.5">
              Viewing: {targetRep.full_name || targetRep.email}
            </p>
          )}
        </div>
        {isManager && repOptions.length > 0 && (
          <form method="GET" className="flex items-center gap-2">
            <select
              name="rep_id"
              defaultValue={targetRepId}
              className="input text-sm"
            >
              <option value={user.id}>My progress</option>
              {repOptions.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.full_name || rep.email}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary text-sm">View</button>
          </form>
        )}
      </div>

      {evaluated.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-500 text-sm">No evaluated sessions yet.</p>
          <Link href="/dashboard" className="btn-primary mt-4 inline-block">
            Start Practicing
          </Link>
        </div>
      ) : (
        <>
          {/* Overview */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="card text-center">
              <p className="text-xs text-slate-500 mb-1">Sessions</p>
              <p className="text-3xl font-bold text-slate-900">{evaluated.length}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-slate-500 mb-1">Avg Score</p>
              <p className="text-3xl font-bold text-slate-900">
                {avgScore != null ? Math.round(avgScore) : '—'}
              </p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-slate-500 mb-1">Pass Rate</p>
              <p className="text-3xl font-bold text-slate-900">
                {passRate != null ? `${Math.round(passRate)}%` : '—'}
              </p>
            </div>
          </div>

          {/* Score over time chart */}
          {scorePoints.length >= 2 && (
            <div className="card mb-8">
              <div className="flex items-center justify-between mb-2">
                <h2 className="section-title mb-0">Score Over Time</h2>
                {trendLabel && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trendLabel === 'Improving' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {trendLabel}
                  </span>
                )}
              </div>
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full">
                <g transform={`translate(${padding.left},${padding.top})`}>
                  {/* Y axis labels */}
                  {[0, 25, 50, 75, 100].map((v) => (
                    <g key={v}>
                      <line x1={0} y1={innerH - (v / 100) * innerH} x2={innerW} y2={innerH - (v / 100) * innerH} stroke="#e2e8f0" strokeWidth="1" />
                      <text x={-4} y={innerH - (v / 100) * innerH + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
                    </g>
                  ))}
                  {/* Trend line */}
                  {trendLine && (
                    <line
                      x1={trendLine.x1} y1={trendLine.y1}
                      x2={trendLine.x2} y2={trendLine.y2}
                      stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4,3"
                    />
                  )}
                  {/* Score polyline */}
                  <polyline
                    points={scorePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round"
                  />
                  {/* Points */}
                  {scorePoints.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="3.5" fill="#3b82f6" />
                      {i === 0 || i === scorePoints.length - 1 ? (
                        <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="9" fill="#475569">{p.score}</text>
                      ) : null}
                    </g>
                  ))}
                </g>
              </svg>
            </div>
          )}

          {/* Category breakdown */}
          {categoryStats.length > 0 && (
            <div className="card mb-8">
              <h2 className="section-title">Category Progress</h2>
              <div className="space-y-3">
                {categoryStats.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-slate-700 w-40 shrink-0">{cat.name}</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cat.avg >= 7 ? 'bg-emerald-500' : cat.avg >= 5 ? 'bg-amber-400' : 'bg-red-500'}`}
                        style={{ width: `${(cat.avg / 10) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-slate-600 tabular-nums w-10 text-right">
                      {cat.avg.toFixed(1)}
                    </span>
                    {cat.delta != null && (
                      <span className={`text-xs font-medium w-16 text-right ${cat.delta > 0.5 ? 'text-emerald-600' : cat.delta < -0.5 ? 'text-red-500' : 'text-slate-400'}`}>
                        {cat.delta > 0 ? `↑ +${cat.delta.toFixed(1)}` : cat.delta < 0 ? `↓ ${cat.delta.toFixed(1)}` : '→ flat'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metrics trend */}
          {firstThree.length > 0 && lastThree.length > 0 && firstThree !== lastThree && (
            <div className="card mb-8">
              <h2 className="section-title">Metrics Trend (First 3 vs Last 3)</h2>
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: 'Talk Ratio',
                    first: avgMetric(firstThree, 'talk_ratio'),
                    last: avgMetric(lastThree, 'talk_ratio'),
                    format: (v: number) => `${Math.round(v * 100)}%`,
                    betterWhen: 'lower',
                  },
                  {
                    label: 'Filler Words',
                    first: avgMetric(firstThree, 'filler_word_count'),
                    last: avgMetric(lastThree, 'filler_word_count'),
                    format: (v: number) => String(Math.round(v)),
                    betterWhen: 'lower',
                  },
                  {
                    label: 'Questions Asked',
                    first: avgMetric(firstThree, 'question_count'),
                    last: avgMetric(lastThree, 'question_count'),
                    format: (v: number) => String(Math.round(v)),
                    betterWhen: 'higher',
                  },
                ].map((m) => {
                  if (m.first == null || m.last == null) return null
                  const improved = m.betterWhen === 'lower' ? m.last < m.first : m.last > m.first
                  return (
                    <div key={m.label} className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                      <p className="text-xs text-slate-500 mb-2">{m.label}</p>
                      <div className="flex items-end gap-3">
                        <div>
                          <p className="text-xs text-slate-400">Before</p>
                          <p className="text-lg font-semibold text-slate-600">{m.format(m.first)}</p>
                        </div>
                        <span className="text-slate-300 mb-1">→</span>
                        <div>
                          <p className="text-xs text-slate-400">Now</p>
                          <p className={`text-lg font-semibold ${improved ? 'text-emerald-600' : 'text-red-500'}`}>
                            {m.format(m.last)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
