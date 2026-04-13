'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import DifficultyBadge from '@/components/DifficultyBadge'
import type { Simulation, Difficulty, Role } from '@/types'

interface SimulationsListProps {
  simulations: Pick<
    Simulation,
    'id' | 'title' | 'difficulty' | 'call_goal' | 'persona_name' | 'is_active' | 'version' | 'created_at'
  >[]
  userRole: Role
}

export default function SimulationsList({ simulations, userRole }: SimulationsListProps) {
  const [search, setSearch] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'all'>('all')

  const canCreate = userRole === 'trainer' || userRole === 'admin'

  const filtered = useMemo(() => {
    return simulations.filter((s) => {
      const matchesSearch =
        !search.trim() ||
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.persona_name.toLowerCase().includes(search.toLowerCase())
      const matchesDifficulty =
        difficultyFilter === 'all' || s.difficulty === difficultyFilter
      return matchesSearch && matchesDifficulty
    })
  }, [simulations, search, difficultyFilter])

  return (
    <div>
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Simulations</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {simulations.length} simulation{simulations.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <Link href="/dashboard/simulations/new" className="btn-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            New Simulation
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or persona…"
          className="input flex-1"
        />
        <div className="flex gap-2 shrink-0">
          {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficultyFilter(d)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                difficultyFilter === d
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg font-medium">No simulations found</p>
          <p className="text-sm mt-1">
            {simulations.length === 0
              ? canCreate
                ? 'Create your first simulation to get started.'
                : 'No simulations are available yet.'
              : 'Try adjusting your search or filter.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/simulations/${s.id}`}
              className="card hover:shadow-md hover:border-slate-300 transition-all group block"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-semibold text-slate-900 text-sm leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
                  {s.title}
                </h3>
                <div className="flex items-center gap-1.5 shrink-0">
                  <DifficultyBadge difficulty={s.difficulty} />
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-1">
                <span className="font-medium text-slate-600">{s.persona_name}</span>
              </p>

              <p className="text-xs text-slate-500 line-clamp-2 mb-3">{s.call_goal}</p>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                    s.is_active
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}
                  />
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
                <span>v{s.version}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
