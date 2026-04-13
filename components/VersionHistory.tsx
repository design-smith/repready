'use client'

import { useState } from 'react'
import type { SimulationVersion } from '@/types'

export default function VersionHistory({
  versions,
}: {
  versions: SimulationVersion[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <h2 className="text-base font-semibold text-slate-900">
          Version History{' '}
          <span className="ml-1 text-sm font-normal text-slate-500">
            ({versions.length} snapshot{versions.length !== 1 ? 's' : ''})
          </span>
        </h2>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {versions.map((v) => (
            <div
              key={v.id}
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900">
                  Version {v.version}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(v.created_at).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 line-clamp-1">
                {(v.snapshot as { title?: string }).title ?? '—'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
