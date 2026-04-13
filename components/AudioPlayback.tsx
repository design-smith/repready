'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface AudioPlaybackProps {
  sessionId: string
}

export default function AudioPlayback({ sessionId }: AudioPlaybackProps) {
  const [repUrl, setRepUrl] = useState<string | null>(null)
  const [personaUrl, setPersonaUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [playingTogether, setPlayingTogether] = useState(false)

  const repRef = useRef<HTMLAudioElement>(null)
  const personaRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!bucket || !supabaseUrl || !supabaseAnonKey) {
      setLoading(false)
      return
    }

    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

    Promise.all([
      supabase.storage.from(bucket).createSignedUrl(`sessions/${sessionId}/rep.webm`, 3600),
      supabase.storage.from(bucket).createSignedUrl(`sessions/${sessionId}/persona.webm`, 3600),
    ]).then(([repResult, personaResult]) => {
      setRepUrl(repResult.data?.signedUrl ?? null)
      setPersonaUrl(personaResult.data?.signedUrl ?? null)
      setLoading(false)
    })
  }, [sessionId])

  function handlePlayTogether() {
    if (repRef.current && personaRef.current) {
      repRef.current.currentTime = 0
      personaRef.current.currentTime = 0
      repRef.current.play()
      personaRef.current.play()
      setPlayingTogether(true)

      const onEnd = () => setPlayingTogether(false)
      repRef.current.onended = onEnd
      personaRef.current.onended = onEnd
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400 italic">Loading audio…</p>
  }

  if (!repUrl && !personaUrl) {
    return (
      <p className="text-sm text-slate-400 italic">Recording not available for this session.</p>
    )
  }

  return (
    <div className="space-y-4">
      {repUrl && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Your audio</p>
          <audio ref={repRef} src={repUrl} controls className="w-full" />
        </div>
      )}
      {personaUrl && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Persona audio</p>
          <audio ref={personaRef} src={personaUrl} controls className="w-full" />
        </div>
      )}
      {repUrl && personaUrl && (
        <button
          type="button"
          onClick={handlePlayTogether}
          disabled={playingTogether}
          className="btn-secondary text-sm disabled:opacity-50"
        >
          {playingTogether ? 'Playing…' : 'Play both together'}
        </button>
      )}
    </div>
  )
}
