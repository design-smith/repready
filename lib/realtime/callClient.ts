// BROWSER ONLY — do not import in server components, API routes, or any file
// that does not have 'use client'. Uses WebSocket, AudioContext, getUserMedia.

import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { TranscriptTurn, PersonaState, HintType } from '@/types'

export type CallStatus = 'connecting' | 'active' | 'ended'
export type SpeakingState = 'rep' | 'persona' | 'idle'

export interface EndCallResult {
  session_id: string
  transcript: TranscriptTurn[]
  final_persona_state: PersonaState
  duration_seconds: number | null
}

export class CallClient {
  // Callbacks — assign before calling connect()
  onTranscriptUpdate?: (turn: Omit<TranscriptTurn, 'id' | 'session_id' | 'created_at'>) => void
  onPersonaStateUpdate?: (state: PersonaState) => void
  onStatusChange?: (status: CallStatus) => void
  onSpeakingChange?: (speaking: SpeakingState) => void
  onCoachingHint?: (hint: string, hintType: HintType) => void
  onError?: (message: string) => void

  private ws: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private scriptProcessor: ScriptProcessorNode | null = null
  private monitorNode: GainNode | null = null

  private isPlaying = false
  private currentSource: AudioBufferSourceNode | null = null

  // Persona audio recording via MediaStreamDestination
  private personaDestination: MediaStreamAudioDestinationNode | null = null

  // Recording
  private repRecorder: MediaRecorder | null = null
  private personaRecorder: MediaRecorder | null = null
  private repChunks: Blob[] = []
  private personaChunks: Blob[] = []

  // Turn tracking
  private turnCounter = 0
  private sessionOpened = false
  private shuttingDown = false
  private responseInFlight = false

  constructor(
    private readonly sessionId: string,
    private readonly ephemeralToken: string,
    private readonly initialSystemPrompt: string,
    private readonly openingLine: string,
    private readonly personaVoice: string
  ) {}

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------

  async connect(): Promise<void> {
    this.shuttingDown = false
    this.onStatusChange?.('connecting')
    await this.setupAudio()

    this.ws = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-realtime',
      ['realtime', `openai-insecure-api-key.${this.ephemeralToken}`, 'openai-beta.realtime-v1']
    )

    this.ws.onopen = () => {
      this.responseInFlight = false
      this.sendEvent({
        type: 'session.update',
        session: {
          instructions: this.initialSystemPrompt,
          input_audio_format: 'pcm16',
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: {
            type: 'server_vad',
            silence_duration_ms: 800,
            create_response: false,
          },
        },
      })
    }

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        this.handleMessage(JSON.parse(event.data as string))
      } catch (err) {
        console.error('[CallClient] failed to parse WS message', err)
      }
    }

    this.ws.onerror = () => {
      if (this.shuttingDown) return
      this.onError?.('WebSocket connection error')
    }

    this.ws.onclose = () => {
      void this.teardownAudio()
    }
  }

  async endCall(): Promise<EndCallResult> {
    this.shuttingDown = true

    // Stop recording and collect final chunks
    await this.stopRecorders()

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendEvent({ type: 'response.cancel' })
    }

    this.ws?.close()
    await this.teardownAudio()

    // Upload audio to Supabase Storage (best-effort — don't block on failure)
    this.uploadAudio().catch((err) =>
      console.error('[CallClient] audio upload failed:', err)
    )

    const res = await fetch(`/api/sessions/${this.sessionId}/end`, { method: 'POST' })
    const data = await res.json()

    this.onStatusChange?.('ended')
    return data as EndCallResult
  }

  // ---------------------------------------------------------------
  // Audio setup
  // ---------------------------------------------------------------

  private async setupAudio(): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.audioContext = new AudioContext({ sampleRate: 24000 })

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    // Persona audio destination for recording
    this.personaDestination = this.audioContext.createMediaStreamDestination()

    const source = this.audioContext.createMediaStreamSource(this.mediaStream)
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1)
    this.monitorNode = this.audioContext.createGain()
    this.monitorNode.gain.value = 0

    this.scriptProcessor.onaudioprocess = (event) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

      const float32 = event.inputBuffer.getChannelData(0)
      const int16 = new Int16Array(float32.length)
      for (let i = 0; i < float32.length; i++) {
        const clamped = Math.max(-1, Math.min(1, float32[i]))
        int16[i] = Math.round(clamped * 32767)
      }

      const uint8 = new Uint8Array(int16.buffer)
      let binary = ''
      for (let j = 0; j < uint8.length; j++) binary += String.fromCharCode(uint8[j])
      const base64 = btoa(binary)
      this.sendEvent({ type: 'input_audio_buffer.append', audio: base64 })
    }

    source.connect(this.scriptProcessor)
    this.scriptProcessor.connect(this.monitorNode)
    this.monitorNode.connect(this.audioContext.destination)

    // Start MediaRecorder instances
    this.startRecorders()
  }

  private startRecorders(): void {
    if (!this.mediaStream || !this.personaDestination) return

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    try {
      this.repRecorder = new MediaRecorder(this.mediaStream, { mimeType })
      this.repRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.repChunks.push(e.data)
      }
      this.repRecorder.start(5000) // collect chunks every 5s
    } catch (err) {
      console.warn('[CallClient] rep recorder failed to start:', err)
    }

    try {
      this.personaRecorder = new MediaRecorder(this.personaDestination.stream, { mimeType })
      this.personaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.personaChunks.push(e.data)
      }
      this.personaRecorder.start(5000)
    } catch (err) {
      console.warn('[CallClient] persona recorder failed to start:', err)
    }
  }

  private stopRecorders(): Promise<void> {
    const promises: Promise<void>[] = []

    if (this.repRecorder && this.repRecorder.state !== 'inactive') {
      promises.push(
        new Promise((resolve) => {
          this.repRecorder!.onstop = () => resolve()
          this.repRecorder!.stop()
        })
      )
    }

    if (this.personaRecorder && this.personaRecorder.state !== 'inactive') {
      promises.push(
        new Promise((resolve) => {
          this.personaRecorder!.onstop = () => resolve()
          this.personaRecorder!.stop()
        })
      )
    }

    return Promise.all(promises).then(() => undefined)
  }

  private async uploadAudio(): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET

    if (!supabaseUrl || !supabaseAnonKey || !bucket) {
      console.warn('[CallClient] storage env vars missing — skipping audio upload')
      return
    }

    const supabase = createSupabaseClient()

    const mimeType = this.repChunks[0]?.type || 'audio/webm'
    const repFile = new Blob(this.repChunks, { type: mimeType })
    const personaFile = new Blob(this.personaChunks, { type: mimeType })

    const uploads: Promise<unknown>[] = []

    if (repFile.size > 0) {
      uploads.push(
        supabase.storage
          .from(bucket)
          .upload(`sessions/${this.sessionId}/rep.webm`, repFile, {
            upsert: true,
            contentType: mimeType,
          })
          .then(({ error }) => {
            if (error) console.warn('[CallClient] rep audio upload failed:', error)
          })
      )
    }

    if (personaFile.size > 0) {
      uploads.push(
        supabase.storage
          .from(bucket)
          .upload(`sessions/${this.sessionId}/persona.webm`, personaFile, {
            upsert: true,
            contentType: mimeType,
          })
          .then(({ error }) => {
            if (error) console.warn('[CallClient] persona audio upload failed:', error)
          })
      )
    }

    await Promise.allSettled(uploads)
  }

  // ---------------------------------------------------------------
  // Audio playback
  // ---------------------------------------------------------------

  private async speakText(text: string): Promise<void> {
    if (this.shuttingDown || !this.audioContext) return

    try {
      const response = await fetch('/api/voices/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          persona_voice: this.personaVoice,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? 'Failed to generate persona speech')
      }

      const audio = await response.arrayBuffer()
      if (this.shuttingDown || !this.audioContext) return

      const decoded = await this.audioContext.decodeAudioData(audio.slice(0))
      if (this.shuttingDown) return

      this.drainAudio()
      this.isPlaying = true
      this.onSpeakingChange?.('persona')

      const source = this.audioContext.createBufferSource()
      source.buffer = decoded
      source.connect(this.audioContext.destination)
      if (this.personaDestination) {
        source.connect(this.personaDestination)
      }
      source.onended = () => {
        if (this.currentSource === source) {
          this.currentSource = null
        }
        this.isPlaying = false
        this.onSpeakingChange?.('idle')
      }
      source.start()
      this.currentSource = source
    } catch (error) {
      console.error('[CallClient] ElevenLabs playback failed', error)
      this.onError?.(error instanceof Error ? error.message : 'Persona speech playback failed')
    }
  }

  private drainAudio(): void {
    try { this.currentSource?.stop() } catch { /* already ended */ }
    this.isPlaying = false
    this.currentSource = null
    this.onSpeakingChange?.('idle')
  }

  private stopMic(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null
    }
    this.scriptProcessor?.disconnect()
    this.monitorNode?.disconnect()
    this.scriptProcessor = null
    this.mediaStream?.getTracks().forEach((t) => t.stop())
    this.mediaStream = null
  }

  private async teardownAudio(): Promise<void> {
    this.stopMic()
    this.drainAudio()

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close()
      } catch {
        // Ignore close races during teardown.
      }
    }

    this.audioContext = null
    this.personaDestination = null
    this.monitorNode = null
  }

  // ---------------------------------------------------------------
  // WebSocket event handling
  // ---------------------------------------------------------------

  private sendEvent(event: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event))
    }
  }

  private requestResponse(): void {
    if (this.shuttingDown || this.responseInFlight) return
    this.responseInFlight = true
    this.sendEvent({ type: 'response.create' })
  }

  private handleMessage(msg: Record<string, unknown>): void {
    if (this.shuttingDown) return

    const type = msg.type as string

    switch (type) {
      case 'session.updated': {
        if (!this.sessionOpened) {
          this.sessionOpened = true
          this.onStatusChange?.('active')
          this.requestResponse()
        }
        break
      }

      case 'input_audio_buffer.speech_started': {
        this.drainAudio()
        this.onSpeakingChange?.('rep')
        break
      }

      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = (msg as { transcript?: string }).transcript ?? ''
        if (transcript.trim()) {
          this.turnCounter++
          const turnNumber = this.turnCounter
          this.onTranscriptUpdate?.({ turn_number: turnNumber, speaker: 'rep', content: transcript })
          this.postRepTurn(transcript, turnNumber)
          this.requestResponse()
        }
        break
      }

      case 'response.output_text.done':
      case 'response.text.done': {
        const transcript =
          (msg as { text?: string }).text ??
          (msg as { delta?: string }).delta ??
          ''

        if (transcript.trim()) {
          this.turnCounter++
          const turnNumber = this.turnCounter
          this.onTranscriptUpdate?.({ turn_number: turnNumber, speaker: 'persona', content: transcript })
          this.postPersonaTurn(transcript, turnNumber)
          void this.speakText(transcript)
        }
        break
      }

      case 'response.audio_transcript.done': {
        const transcript = (msg as { transcript?: string }).transcript ?? ''
        if (transcript.trim()) {
          this.turnCounter++
          const turnNumber = this.turnCounter
          this.onTranscriptUpdate?.({ turn_number: turnNumber, speaker: 'persona', content: transcript })
          this.postPersonaTurn(transcript, turnNumber)
          void this.speakText(transcript)
        }
        break
      }

      case 'response.done': {
        this.responseInFlight = false
        if (!this.isPlaying) {
          this.onSpeakingChange?.('idle')
        }
        break
      }

      case 'error': {
        const errMsg = (msg as { error?: { message?: string } }).error?.message ?? 'Unknown OpenAI error'
        console.error('[CallClient] OpenAI error event:', errMsg)
        if (errMsg.toLowerCase().includes('active response in progress')) {
          this.responseInFlight = true
          break
        }
        this.responseInFlight = false
        this.onError?.(errMsg)
        break
      }
    }
  }

  // ---------------------------------------------------------------
  // API calls back to Next.js
  // ---------------------------------------------------------------

  private async postRepTurn(content: string, turnNumber: number): Promise<void> {
    try {
      const res = await fetch(`/api/sessions/${this.sessionId}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, turn_number: turnNumber }),
      })

      if (!res.ok) return

      const { updated_state, new_system_prompt, coaching_hint } = await res.json()

      if (updated_state) {
        this.onPersonaStateUpdate?.(updated_state as PersonaState)
      }

      if (new_system_prompt) {
        this.sendEvent({
          type: 'session.update',
          session: { instructions: new_system_prompt },
        })
      }

      if (coaching_hint?.hint && coaching_hint?.hint_type) {
        this.onCoachingHint?.(coaching_hint.hint as string, coaching_hint.hint_type as HintType)
      }
    } catch (err) {
      console.error('[CallClient] postRepTurn failed', err)
    }
  }

  private async postPersonaTurn(content: string, turnNumber: number): Promise<void> {
    try {
      await fetch(`/api/sessions/${this.sessionId}/persona-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, turn_number: turnNumber }),
      })
    } catch (err) {
      console.error('[CallClient] postPersonaTurn failed', err)
    }
  }
}
