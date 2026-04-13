'use client'

import { useState } from 'react'
import type { TranscriptTurn, SessionAnnotation } from '@/types'

interface AnnotationPanelProps {
  sessionId: string
  transcript: TranscriptTurn[]
  existingAnnotations: SessionAnnotation[]
  canAnnotate: boolean
}

export default function AnnotationPanel({
  sessionId,
  transcript,
  existingAnnotations,
  canAnnotate,
}: AnnotationPanelProps) {
  const [annotations, setAnnotations] = useState<SessionAnnotation[]>(existingAnnotations)
  const [expandedTurn, setExpandedTurn] = useState<number | null>(null)
  const [generalComment, setGeneralComment] = useState('')
  const [turnComment, setTurnComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const annotationsByTurn = new Map<number, SessionAnnotation[]>()
  const generalAnnotations: SessionAnnotation[] = []

  for (const ann of annotations) {
    if (ann.turn_number != null) {
      const existing = annotationsByTurn.get(ann.turn_number) ?? []
      existing.push(ann)
      annotationsByTurn.set(ann.turn_number, existing)
    } else {
      generalAnnotations.push(ann)
    }
  }

  async function submitAnnotation(content: string, turnNumber?: number) {
    if (!content.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), turn_number: turnNumber }),
      })
      if (res.ok) {
        const { annotation } = await res.json()
        setAnnotations((prev) => [...prev, annotation as SessionAnnotation])
        if (turnNumber != null) setTurnComment('')
        else setGeneralComment('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteAnnotation(id: string) {
    const res = await fetch(`/api/annotations/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAnnotations((prev) => prev.filter((a) => a.id !== id))
    }
  }

  return (
    <div>
      {/* Transcript with inline annotation threads */}
      <div className="space-y-3 mb-6">
        {transcript.map((turn) => {
          const turnAnns = annotationsByTurn.get(turn.turn_number) ?? []
          const isExpanded = expandedTurn === turn.turn_number

          return (
            <div key={turn.id}>
              <div
                className={`flex gap-3 ${turn.speaker === 'rep' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                    turn.speaker === 'rep'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {turn.speaker === 'rep' ? 'R' : 'P'}
                </div>
                <div className="flex-1">
                  <div
                    className={`rounded-xl px-4 py-2.5 text-sm ${
                      turn.speaker === 'rep'
                        ? 'bg-blue-50 text-slate-900'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    {turn.content}
                  </div>
                  {/* Annotation indicator / toggle */}
                  <div className="mt-1 flex items-center gap-2">
                    {turnAnns.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedTurn(isExpanded ? null : turn.turn_number)}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                          <path fillRule="evenodd" d="M1 8.74c0 .983.713 1.825 1.69 1.943L3 10.7v1.55a.75.75 0 001.28.53l1.82-1.82H10a2 2 0 002-2V5a2 2 0 00-2-2H3a2 2 0 00-2 2v3.74z" clipRule="evenodd" />
                        </svg>
                        {turnAnns.length} note{turnAnns.length !== 1 ? 's' : ''}
                      </button>
                    )}
                    {canAnnotate && (
                      <button
                        type="button"
                        onClick={() => setExpandedTurn(isExpanded ? null : turn.turn_number)}
                        className="text-xs text-slate-400 hover:text-blue-600"
                      >
                        + Add note
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded annotation thread for this turn */}
              {isExpanded && (
                <div className="ml-10 mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  {turnAnns.map((ann) => (
                    <div key={ann.id} className="text-xs text-slate-700">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-medium text-amber-800">{ann.annotator_name}</span>
                          <span className="text-slate-400 ml-1">
                            {new Date(ann.created_at).toLocaleDateString(undefined, {
                              month: 'short', day: 'numeric',
                            })}
                          </span>
                          <p className="mt-0.5">{ann.content}</p>
                        </div>
                        {canAnnotate && (
                          <button
                            type="button"
                            onClick={() => deleteAnnotation(ann.id)}
                            className="text-slate-300 hover:text-red-500 shrink-0"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                              <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {canAnnotate && (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={turnComment}
                        onChange={(e) => setTurnComment(e.target.value)}
                        placeholder="Add a note on this turn…"
                        className="flex-1 text-xs border border-amber-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            submitAnnotation(turnComment, turn.turn_number)
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => submitAnnotation(turnComment, turn.turn_number)}
                        disabled={submitting || !turnComment.trim()}
                        className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded disabled:opacity-50"
                      >
                        Post
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* General session comment */}
      {(canAnnotate || generalAnnotations.length > 0) && (
        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            General Feedback
          </h3>
          {generalAnnotations.map((ann) => (
            <div key={ann.id} className="mb-3 bg-slate-50 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-medium text-slate-700">{ann.annotator_name}</span>
                  <span className="text-slate-400 text-xs ml-1">
                    {new Date(ann.created_at).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric',
                    })}
                  </span>
                  <p className="text-slate-700 mt-0.5 text-sm">{ann.content}</p>
                </div>
                {canAnnotate && (
                  <button
                    type="button"
                    onClick={() => deleteAnnotation(ann.id)}
                    className="text-slate-300 hover:text-red-500 shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
          {canAnnotate && (
            <div className="flex gap-2">
              <textarea
                value={generalComment}
                onChange={(e) => setGeneralComment(e.target.value)}
                placeholder="Leave overall feedback on this session…"
                rows={2}
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
              />
              <button
                type="button"
                onClick={() => submitAnnotation(generalComment)}
                disabled={submitting || !generalComment.trim()}
                className="btn-secondary text-sm self-end disabled:opacity-50"
              >
                Post
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
