'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DynamicList from '@/components/DynamicList'
import RubricEditor from '@/components/RubricEditor'
import type { Simulation, SimulationFormData, RubricCategory, Difficulty } from '@/types'

const DEFAULT_RUBRIC: RubricCategory[] = [
  { name: 'Discovery', weight: 5, description: '' },
  { name: 'Objection Handling', weight: 5, description: '' },
  { name: 'Rapport', weight: 5, description: '' },
  { name: 'Clarity', weight: 5, description: '' },
  { name: 'Closing', weight: 5, description: '' },
]

function blankForm(): SimulationFormData {
  return {
    title: '',
    difficulty: 'medium',
    call_goal: '',
    persona_name: '',
    persona_role: '',
    persona_style: '',
    company_context: '',
    opening_line: '',
    hidden_objections: [],
    allowed_disclosures: [],
    forbidden_disclosures: [],
    success_criteria: '',
    scoring_rubric: DEFAULT_RUBRIC,
    is_active: true,
  }
}

interface SimulationFormProps {
  mode: 'create' | 'edit'
  initialData?: Simulation
  templateData?: SimulationFormData
}

export default function SimulationForm({ mode, initialData, templateData }: SimulationFormProps) {
  const router = useRouter()

  const [form, setForm] = useState<SimulationFormData>(() => {
    if (initialData) {
      return {
        title: initialData.title,
        difficulty: initialData.difficulty,
        call_goal: initialData.call_goal,
        persona_name: initialData.persona_name,
        persona_role: initialData.persona_role,
        persona_style: initialData.persona_style,
        company_context: initialData.company_context,
        opening_line: initialData.opening_line,
        hidden_objections: initialData.hidden_objections,
        allowed_disclosures: initialData.allowed_disclosures,
        forbidden_disclosures: initialData.forbidden_disclosures,
        success_criteria: initialData.success_criteria,
        scoring_rubric: initialData.scoring_rubric,
        is_active: initialData.is_active,
      }
    }
    if (templateData) {
      return templateData
    }
    return blankForm()
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof SimulationFormData>(key: K, value: SimulationFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const url =
      mode === 'create' ? '/api/simulations' : `/api/simulations/${initialData!.id}`
    const method = mode === 'create' ? 'POST' : 'PUT'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'An unexpected error occurred.')
        return
      }

      router.push(`/dashboard/simulations/${json.data.id}`)
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      {/* ---- Section 1: Basic Info ---- */}
      <div className="card">
        <h2 className="section-title">Basic Info</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="label">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              required
              className="input"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Cold call — SMB SaaS discovery"
            />
          </div>

          <div>
            <span className="label">
              Difficulty <span className="text-red-500">*</span>
            </span>
            <div className="flex gap-2 mt-1">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set('difficulty', d)}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    form.difficulty === d
                      ? d === 'easy'
                        ? 'bg-green-100 border-green-400 text-green-800'
                        : d === 'medium'
                        ? 'bg-yellow-100 border-yellow-400 text-yellow-800'
                        : 'bg-red-100 border-red-400 text-red-800'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="call_goal" className="label">
              Call Goal <span className="text-red-500">*</span>
            </label>
            <textarea
              id="call_goal"
              required
              rows={3}
              className="input resize-none"
              value={form.call_goal}
              onChange={(e) => set('call_goal', e.target.value)}
              placeholder="What should the rep achieve by the end of this call?"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="is_active"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => set('is_active', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm text-slate-700">
              Active (reps can access this simulation)
            </label>
          </div>
        </div>
      </div>

      {/* ---- Section 2: Persona ---- */}
      <div className="card">
        <h2 className="section-title">Persona</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="persona_name" className="label">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="persona_name"
                type="text"
                required
                className="input"
                value={form.persona_name}
                onChange={(e) => set('persona_name', e.target.value)}
                placeholder="e.g. Sarah Chen"
              />
            </div>
            <div>
              <label htmlFor="persona_role" className="label">
                Role / Title <span className="text-red-500">*</span>
              </label>
              <input
                id="persona_role"
                type="text"
                required
                className="input"
                value={form.persona_role}
                onChange={(e) => set('persona_role', e.target.value)}
                placeholder="e.g. VP of Sales"
              />
            </div>
          </div>

          <div>
            <label htmlFor="persona_style" className="label">
              Communication Style <span className="text-red-500">*</span>
            </label>
            <input
              id="persona_style"
              type="text"
              required
              className="input"
              value={form.persona_style}
              onChange={(e) => set('persona_style', e.target.value)}
              placeholder="skeptical, impatient, knowledgeable"
            />
          </div>

          <div>
            <label htmlFor="company_context" className="label">
              Company Context <span className="text-red-500">*</span>
            </label>
            <textarea
              id="company_context"
              required
              rows={3}
              className="input resize-none"
              value={form.company_context}
              onChange={(e) => set('company_context', e.target.value)}
              placeholder="Describe the prospect's company, industry, size, current pain points…"
            />
          </div>

          <div>
            <label htmlFor="opening_line" className="label">
              Opening Line <span className="text-red-500">*</span>
            </label>
            <textarea
              id="opening_line"
              required
              rows={2}
              className="input resize-none"
              value={form.opening_line}
              onChange={(e) => set('opening_line', e.target.value)}
              placeholder="The first thing the persona says when the call starts"
            />
          </div>
        </div>
      </div>

      {/* ---- Section 3: Knowledge Boundaries ---- */}
      <div className="card">
        <h2 className="section-title">Knowledge Boundaries</h2>
        <div className="space-y-6">
          <DynamicList
            label="Hidden Objections"
            items={form.hidden_objections}
            onChange={(v) => set('hidden_objections', v)}
            placeholder="e.g. We're already in talks with a competitor"
          />
          <DynamicList
            label="Allowed Disclosures"
            items={form.allowed_disclosures}
            onChange={(v) => set('allowed_disclosures', v)}
            placeholder="e.g. Annual budget is ~$50k"
          />
          <DynamicList
            label="Forbidden Disclosures"
            items={form.forbidden_disclosures}
            onChange={(v) => set('forbidden_disclosures', v)}
            placeholder="e.g. Do not reveal the board is pushing for layoffs"
          />
        </div>
      </div>

      {/* ---- Section 4: Scoring ---- */}
      <div className="card">
        <h2 className="section-title">Scoring</h2>
        <div className="space-y-6">
          <div>
            <label htmlFor="success_criteria" className="label">
              Success Criteria <span className="text-red-500">*</span>
            </label>
            <textarea
              id="success_criteria"
              required
              rows={3}
              className="input resize-none"
              value={form.success_criteria}
              onChange={(e) => set('success_criteria', e.target.value)}
              placeholder="Describe what a successful call outcome looks like…"
            />
          </div>

          <div>
            <span className="label mb-3 block">
              Scoring Rubric <span className="text-red-500">*</span>
            </span>
            <RubricEditor
              categories={form.scoring_rubric}
              onChange={(v) => set('scoring_rubric', v)}
            />
          </div>
        </div>
      </div>

      {/* ---- Error + Submit ---- */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting
            ? mode === 'create'
              ? 'Creating…'
              : 'Saving…'
            : mode === 'create'
            ? 'Create Simulation'
            : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
