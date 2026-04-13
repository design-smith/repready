'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCallSession } from '@/hooks/useCallSession'
import DifficultyBadge from '@/components/DifficultyBadge'
import type { Difficulty, HintType } from '@/types'

interface SimulationMeta {
  id: string
  title: string
  persona_name: string
  persona_role: string
  difficulty: Difficulty
}

export default function CallScreen({ simulation }: { simulation: SimulationMeta }) {
  const router = useRouter()
  const { status, transcript, personaState, isSpeaking, currentHint, startCall, endCall, error } =
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
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Persona header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">{simulation.persona_name}</span>
              <DifficultyBadge difficulty={simulation.difficulty} />
            </div>
            <p className="text-slate-400 text-xs mt-0.5">{simulation.persona_role}</p>
          </div>
          <div className="text-xs text-slate-400">{simulation.title}</div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-between max-w-2xl mx-auto w-full px-4 py-8">

        {/* Speaking indicator orb */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          {status === 'connecting' ? (
            <>
              <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center">
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
              <p className="text-slate-400 text-sm">Connecting…</p>
            </>
          ) : isSpeaking === 'persona' ? (
            <>
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-blue-600 animate-pulse" />
                <div className="absolute inset-0 w-24 h-24 rounded-full bg-blue-400 opacity-30 animate-ping" />
              </div>
              <p className="text-blue-300 text-sm font-medium">{simulation.persona_name} is speaking…</p>
            </>
          ) : isSpeaking === 'rep' ? (
            <>
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-emerald-600 animate-pulse" />
                <div className="absolute inset-0 w-24 h-24 rounded-full bg-emerald-400 opacity-30 animate-ping" />
              </div>
              <p className="text-emerald-300 text-sm font-medium">Listening…</p>
            </>
          ) : (
            <>
              <div className="w-24 h-24 rounded-full bg-slate-700" />
              <p className="text-slate-500 text-sm">
                {status === 'active' ? 'Ready' : status === 'ended' ? 'Call ended' : 'Connecting…'}
              </p>
            </>
          )}

          {/* Persona state bars */}
          {status === 'active' && (
            <div className="flex gap-4 mt-2">
              <StateBar label="Trust" value={personaState.trust} color="bg-blue-500" />
              <StateBar label="Patience" value={personaState.patience} color="bg-amber-500" />
            </div>
          )}
        </div>

        {/* Transcript feed */}
        {transcript.length > 0 && (
          <div className="w-full max-h-64 overflow-y-auto space-y-2 mb-4 px-1">
            {transcript.map((turn) => (
              <div
                key={`${turn.turn_number}-${turn.speaker}`}
                className={`flex ${turn.speaker === 'rep' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-sm rounded-2xl px-4 py-2 text-sm ${
                    turn.speaker === 'rep'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-slate-700 text-slate-100 rounded-bl-sm'
                  }`}
                >
                  {turn.content}
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        )}

        {/* Coaching hint toast — appears above End Call, never blocks it */}
        {currentHint && (
          <div
            className={`w-full mb-4 rounded-xl px-4 py-3 flex items-start gap-3 text-sm ${
              currentHint.hint_type === 'warning'
                ? 'bg-amber-900/60 border border-amber-700 text-amber-200'
                : currentHint.hint_type === 'encouragement'
                ? 'bg-emerald-900/60 border border-emerald-700 text-emerald-200'
                : 'bg-blue-900/60 border border-blue-700 text-blue-200'
            }`}
          >
            <HintIcon type={currentHint.hint_type} />
            <span>{currentHint.hint}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm text-center mb-4 bg-red-900/30 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {/* End Call button */}
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
        <p className="text-slate-500 text-xs mt-2">End Call</p>
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
      <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
    </div>
  )
}
