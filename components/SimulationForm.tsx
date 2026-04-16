'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, AlertIcon, AlertTitle, Box, Text } from '@chakra-ui/react'
import DynamicList from '@/components/DynamicList'
import RubricEditor from '@/components/RubricEditor'
import {
  DEFAULT_PERSONA_VOICE,
  PERSONA_VOICE_OPTIONS,
  resolvePersonaVoice,
} from '@/lib/voices'
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
    persona_voice: DEFAULT_PERSONA_VOICE,
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
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [form, setForm] = useState<SimulationFormData>(() => {
    if (initialData) {
      return {
        title: initialData.title,
        difficulty: initialData.difficulty,
        call_goal: initialData.call_goal,
        persona_name: initialData.persona_name,
        persona_role: initialData.persona_role,
        persona_voice: resolvePersonaVoice(initialData.persona_name, initialData.persona_voice),
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
      return {
        ...templateData,
        persona_voice: resolvePersonaVoice(templateData.persona_name, templateData.persona_voice),
      }
    }
    return blankForm()
  })

  const [submitting, setSubmitting] = useState(false)
  const [previewingVoice, setPreviewingVoice] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (!previewUrl || !audioRef.current) return

    audioRef.current.src = previewUrl
    audioRef.current.play().catch(() => {})
  }, [previewUrl])

  function set<K extends keyof SimulationFormData>(key: K, value: SimulationFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handlePreviewVoice() {
    setPreviewError(null)
    setPreviewingVoice(true)

    try {
      const res = await fetch('/api/voices/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona_name: form.persona_name,
          persona_role: form.persona_role,
          persona_style: form.persona_style,
          persona_voice: form.persona_voice,
          opening_line: form.opening_line,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? 'Failed to generate preview audio.')
      }

      const blob = await res.blob()
      const nextUrl = URL.createObjectURL(blob)

      if (previewUrl) URL.revokeObjectURL(previewUrl)
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setPreviewUrl(nextUrl)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to generate preview audio.')
    } finally {
      setPreviewingVoice(false)
    }
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
      {mode === 'edit' && (
        <Alert status="warning" variant="subtle" borderRadius="xl" borderWidth="1px" borderColor="orange.200">
          <AlertIcon />
          <Box>
            <AlertTitle fontSize="sm">Versioning</AlertTitle>
            <Text fontSize="sm" color="gray.700" mt={1}>
              Saving creates a new version. Sessions already started on the previous version are not changed.
            </Text>
          </Box>
        </Alert>
      )}
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
            <label htmlFor="persona_voice" className="label">
              Voice <span className="text-red-500">*</span>
            </label>
            <select
              id="persona_voice"
              className="input"
              value={form.persona_voice}
              onChange={(e) => set('persona_voice', e.target.value as SimulationFormData['persona_voice'])}
            >
              {PERSONA_VOICE_OPTIONS.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.label} — {voice.description}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Pick the ElevenLabs voice that fits the persona. This is what reps will hear on the live call.
            </p>
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handlePreviewVoice}
                disabled={previewingVoice}
                className="btn-secondary disabled:opacity-50"
              >
                {previewingVoice ? 'Generating preview…' : 'Preview voice'}
              </button>
              <span className="text-xs text-slate-500">
                Uses the opening line when present, otherwise a short fallback intro.
              </span>
            </div>
            {previewError && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {previewError}
              </p>
            )}
            {previewUrl && (
              <audio ref={audioRef} controls className="mt-3 w-full" src={previewUrl}>
                Your browser does not support audio playback.
              </audio>
            )}
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
