'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { CallClient, type EndCallResult, type CallStatus, type SpeakingState } from '@/lib/realtime/callClient'
import { defaultPersonaState } from '@/types'
import type { TranscriptTurn, PersonaState, HintType } from '@/types'

export interface UseCallSessionReturn {
  status: CallStatus | 'idle'
  transcript: TranscriptTurn[]
  personaState: PersonaState
  sessionId: string | null
  isSpeaking: SpeakingState
  currentHint: { hint: string; hint_type: HintType } | null
  startCall: (simulationId: string) => Promise<void>
  endCall: () => Promise<EndCallResult>
  error: string | null
}

export function useCallSession(): UseCallSessionReturn {
  const [status, setStatus] = useState<CallStatus | 'idle'>('idle')
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([])
  const [personaState, setPersonaState] = useState<PersonaState>(defaultPersonaState)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState<SpeakingState>('idle')
  const [currentHint, setCurrentHint] = useState<{ hint: string; hint_type: HintType } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clientRef = useRef<CallClient | null>(null)
  const startingRef = useRef(false)

  // Clean up on unmount — stop mic and end session if still active
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.endCall().catch(() => {})
        clientRef.current = null
      }
    }
  }, [])

  const startCall = useCallback(async (simulationId: string): Promise<void> => {
    if (startingRef.current || status !== 'idle') return
    startingRef.current = true
    setError(null)
    setStatus('connecting')

    try {
      const res = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulation_id: simulationId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to start session')
      }

      const {
        session_id,
        ephemeral_token,
        initial_system_prompt,
        opening_line,
        persona_voice,
        persona_state,
      } = data

      setSessionId(session_id)
      setPersonaState(persona_state)

      const client = new CallClient(
        session_id,
        ephemeral_token,
        initial_system_prompt,
        opening_line,
        persona_voice
      )

      client.onStatusChange = (s) => setStatus(s)
      client.onSpeakingChange = (s) => setIsSpeaking(s)
      client.onError = (msg) => setError(msg)

      client.onTranscriptUpdate = (turn) => {
        setTranscript((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}-${turn.turn_number}`,
            session_id,
            created_at: new Date().toISOString(),
            ...turn,
          } satisfies TranscriptTurn,
        ])
      }

      client.onPersonaStateUpdate = (state) => setPersonaState(state)

      client.onCoachingHint = (hint, hint_type) => {
        setCurrentHint({ hint, hint_type })
      }

      clientRef.current = client
      await client.connect()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(msg)
      setStatus('idle')
    } finally {
      startingRef.current = false
    }
  }, [status])

  const endCall = useCallback(async (): Promise<EndCallResult> => {
    if (!clientRef.current) throw new Error('No active call to end')
    const result = await clientRef.current.endCall()
    clientRef.current = null
    setStatus('ended')
    setIsSpeaking('idle')
    setCurrentHint(null)
    return result
  }, [])

  return {
    status,
    transcript,
    personaState,
    sessionId,
    isSpeaking,
    currentHint,
    startCall,
    endCall,
    error,
  }
}
