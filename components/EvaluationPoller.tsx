'use client'

import { useEffect, useRef, useState } from 'react'
import type { Evaluation } from '@/types'

interface EvaluationPollerProps {
  sessionId: string
  onEvaluationReady: (evaluation: Evaluation) => void
}

export default function EvaluationPoller({
  sessionId,
  onEvaluationReady,
}: EvaluationPollerProps) {
  const [timedOut, setTimedOut] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resolvedRef = useRef(false)

  useEffect(() => {
    const poll = async () => {
      if (resolvedRef.current) return
      try {
        const res = await fetch(`/api/sessions/${sessionId}/evaluation`)
        if (!res.ok) return
        const data = await res.json()
        if (data.evaluation) {
          resolvedRef.current = true
          clearInterval(intervalRef.current!)
          clearTimeout(timeoutRef.current!)
          onEvaluationReady(data.evaluation as Evaluation)
        }
      } catch {
        // Network hiccup — keep polling
      }
    }

    // Start polling every 3 seconds
    intervalRef.current = setInterval(poll, 3000)
    // Also fire once immediately
    poll()

    // Stop after 60 seconds
    timeoutRef.current = setTimeout(() => {
      if (!resolvedRef.current) {
        clearInterval(intervalRef.current!)
        setTimedOut(true)
      }
    }, 60000)

    return () => {
      clearInterval(intervalRef.current!)
      clearTimeout(timeoutRef.current!)
    }
  }, [sessionId, onEvaluationReady])

  if (timedOut) {
    return (
      <div className="card text-center py-10">
        <p className="text-slate-500 text-sm">
          Scoring is taking longer than expected.{' '}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-blue-600 hover:underline font-medium"
          >
            Refresh the page to check again.
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="card text-center py-10">
      <div className="flex items-center justify-center gap-3 text-slate-500">
        <svg
          className="animate-spin w-5 h-5 text-blue-500 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
        <p className="text-sm">Analyzing your call…</p>
      </div>
    </div>
  )
}
