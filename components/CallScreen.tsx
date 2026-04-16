'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCallSession } from '@/hooks/useCallSession'
import type { HintType } from '@/types'

interface SimulationMeta {
  id: string
  title: string
  persona_name: string
}

export default function CallScreen({ simulation }: { simulation: SimulationMeta }) {
  const router = useRouter()
  const [showSuggestion, setShowSuggestion] = useState(false)
  const { status, transcript, personaState, isSpeaking, currentHint, startCall, endCall } =
    useCallSession()

  const transcriptEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    startCall(simulation.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulation.id])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  async function handleEndCall() {
    try {
      const result = await endCall()
      router.push(`/dashboard/sessions/${result.session_id}/results`)
    } catch {
      router.push('/dashboard')
    }
  }

  return (
    <div className="h-screen bg-white text-slate-900 overflow-hidden">
      <div className="border-b border-slate-800 px-4 py-4 bg-slate-950">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-300">Live call</p>
            <h1 className="text-lg font-semibold tracking-tight text-white">{simulation.persona_name}</h1>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-300">Scenario</p>
            <p className="text-sm text-white font-semibold max-w-[320px] leading-snug">{simulation.title}</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 h-[calc(100vh-81px)] grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_420px] gap-4 overflow-hidden">
        <section className="rounded-3xl border border-slate-800 bg-slate-950 shadow-sm px-6 py-6 flex flex-col justify-between text-white min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center gap-5">
            {status === 'connecting' ? (
              <>
                <div className="w-28 h-28 rounded-full bg-slate-900 flex items-center justify-center border border-slate-700">
                  <svg
                    className="animate-spin w-10 h-10 text-slate-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                </div>
                <p className="text-slate-300 text-sm">Connecting...</p>
              </>
            ) : isSpeaking === 'persona' ? (
              <>
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-cyan-500/85 animate-pulse shadow-[0_0_90px_rgba(34,211,238,0.35)]" />
                  <div className="absolute inset-0 rounded-full border border-cyan-200/20 animate-ping" />
                </div>
                <p className="text-cyan-100 text-sm font-medium">{simulation.persona_name} is speaking...</p>
              </>
            ) : isSpeaking === 'rep' ? (
              <>
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-emerald-500/85 animate-pulse shadow-[0_0_90px_rgba(16,185,129,0.35)]" />
                  <div className="absolute inset-0 rounded-full border border-emerald-200/20 animate-ping" />
                </div>
                <p className="text-emerald-100 text-sm font-medium">Listening...</p>
              </>
            ) : (
              <>
                <div className="w-32 h-32 rounded-full bg-slate-900 border border-slate-700" />
                <p className="text-slate-300 text-sm">
                  {status === 'active' ? 'Ready when you are' : status === 'ended' ? 'Call ended' : 'Connecting...'}
                </p>
              </>
            )}

            {status === 'active' && (
              <div className="flex gap-4 mt-2">
                <StateBar label="Trust" value={personaState.trust} color="bg-cyan-400" />
                <StateBar label="Patience" value={personaState.patience} color="bg-amber-400" />
              </div>
            )}
          </div>

          <div className="pt-6 flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={handleEndCall}
              disabled={status !== 'active'}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-lg"
              aria-label="End call"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-7 h-7 text-white rotate-[135deg]"
              >
                <path
                  fillRule="evenodd"
                  d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <p className="text-slate-300 text-xs">End call</p>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-950 shadow-sm overflow-hidden flex flex-col min-h-0 text-white">
          <div className="border-b border-slate-800 px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-300">Conversation</p>
              <h2 className="text-sm font-semibold text-white">Transcript</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowSuggestion((open) => !open)}
              className="inline-flex items-center rounded-full border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
            >
              What should I say?
            </button>
          </div>

          {showSuggestion && (
            <div className="border-b border-slate-800 px-5 py-4 bg-slate-950">
              <div
                className={`rounded-2xl px-4 py-3 text-sm flex items-start gap-3 ${
                  currentHint
                    ? currentHint.hint_type === 'warning'
                      ? 'bg-amber-950/50 border border-amber-800/60 text-amber-100'
                      : currentHint.hint_type === 'encouragement'
                      ? 'bg-emerald-950/50 border border-emerald-800/60 text-emerald-100'
                      : 'bg-cyan-950/50 border border-cyan-800/60 text-cyan-100'
                    : 'bg-slate-900 border border-slate-700 text-slate-200'
                }`}
              >
                <HintIcon type={currentHint?.hint_type ?? 'tip'} />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] mb-1 opacity-90">Coach</p>
                  <p>
                    {currentHint?.hint ??
                      'No suggestion yet. Once the conversation develops, ask again and the latest coaching tip will show here.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
            {transcript.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-sm text-slate-300 px-6">
                The transcript will appear here as the call unfolds.
              </div>
            ) : (
              transcript.map((turn) => (
                <div
                  key={`${turn.turn_number}-${turn.speaker}`}
                  className={`flex ${turn.speaker === 'rep' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      turn.speaker === 'rep'
                        ? 'bg-cyan-700 text-white rounded-br-sm'
                        : 'bg-slate-800 text-white rounded-bl-sm border border-slate-700'
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-[0.2em] opacity-90 mb-1">
                      {turn.speaker === 'rep' ? 'You' : simulation.persona_name}
                    </p>
                    {turn.content}
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </aside>
      </div>
    </div>
  )
}

function HintIcon({ type }: { type: HintType }) {
  if (type === 'warning') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
    )
  }
  if (type === 'encouragement') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
      <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.044a1 1 0 001 1h2a1 1 0 001-1v-.044c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1zM9.5 4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 019.5 4zM10 17a1 1 0 100 2 1 1 0 000-2z" />
    </svg>
  )
}

function StateBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
    </div>
  )
}
