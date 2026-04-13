'use client'

import { useState } from 'react'
import SimulationForm from '@/components/SimulationForm'
import type { SimulationTemplate, SimulationFormData } from '@/types'

const CATEGORY_COLORS: Record<string, string> = {
  Discovery: 'bg-blue-50 text-blue-700 border-blue-200',
  'Objection Handling': 'bg-amber-50 text-amber-700 border-amber-200',
  Closing: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

function categoryStyle(category: string): string {
  return CATEGORY_COLORS[category] ?? 'bg-slate-100 text-slate-600 border-slate-200'
}

export default function NewSimulationClient({
  templates,
}: {
  templates: SimulationTemplate[]
}) {
  const [templateKey, setTemplateKey] = useState<string | null>(null)
  const [templateData, setTemplateData] = useState<SimulationFormData | null>(null)
  const [showTemplates, setShowTemplates] = useState(templates.length > 0)

  function applyTemplate(template: SimulationTemplate) {
    setTemplateData(template.snapshot)
    setTemplateKey(template.id)
    setShowTemplates(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      {/* Template picker */}
      {showTemplates && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Start from a template</h2>
            <button
              type="button"
              onClick={() => setShowTemplates(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Skip →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template)}
                className="text-left rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 p-4 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-800">
                    {template.title}
                  </span>
                  <span
                    className={`text-xs font-medium rounded-full px-2 py-0.5 border shrink-0 ${categoryStyle(template.category)}`}
                  >
                    {template.category}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{template.description}</p>
                <p className="text-xs text-blue-500 mt-2 group-hover:underline">Use template →</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Divider when templates are hidden */}
      {!showTemplates && templates.length > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowTemplates(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            ← Choose a different template
          </button>
          {templateData && (
            <span className="text-xs text-slate-400">
              or{' '}
              <button
                type="button"
                onClick={() => { setTemplateData(null); setTemplateKey(null) }}
                className="text-slate-500 hover:underline"
              >
                start blank
              </button>
            </span>
          )}
        </div>
      )}

      {/* Form — key forces re-mount when template changes */}
      <SimulationForm
        key={templateKey ?? 'blank'}
        mode="create"
        templateData={templateData ?? undefined}
      />
    </div>
  )
}
