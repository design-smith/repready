// BROWSER ONLY — do not import in server components, API routes, or any file
// that does not have 'use client'. Uses WebSocket, AudioContext, getUserMedia.

import { createBrowserClient } from '@supabase/ssr'
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

  // Playback queue
  private pendingChunks: Float32Array<ArrayBuffer>[] = []
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

  constructor(
    private readonly sessionId: string,
    private readonly ephemeralToken: string,
    private readonly initialSystemPrompt: string,
    private readonly openingLine: string
  ) {}

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------

  async connect(): Promise<void> {
    this.onStatusChange?.('connecting')
    await this.setupAudio()

    this.ws = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
      ['realtime', `openai-insecure-api-key.${this.ephemeralToken}`, 'openai-beta.realtime-v1']
    )

    this.ws.onopen = () => {
      this.sendEvent({
        type: 'session.update',
        session: {
          instructions: this.initialSystemPrompt,
          voice: 'shimmer',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: { type: 'server_vad', silence_duration_ms: 800 },
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
      this.onError?.('WebSocket connection error')
    }

    this.ws.onclose = () => {
      this.stopMic()
      if (this.audioContext?.state !== 'closed') {
        this.audioContext?.close()
      }
    }
  }

  async endCall(): Promise<EndCallResult> {
    // Stop recording and collect final chunks
    await this.stopRecorders()

    this.stopMic()
    this.drainAudio()
    this.ws?.close()

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
    this.scriptProcessor.connect(this.audioContext.destination)

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

    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

    const mimeType = this.repChunks[0]?.type || 'audio/webm'
    const repFile = new Blob(this.repChunks, { type: mimeType })
    const personaFile = new Blob(this.personaChunks, { type: mimeType })

    await Promise.allSettled([
      repFile.size > 0 &&
        supabase.storage
          .from(bucket)
          .upload(`sessions/${this.sessionId}/rep.webm`, repFile, { upsert: true }),
      personaFile.size > 0 &&
        supabase.storage
          .from(bucket)
          .upload(`sessions/${this.sessionId}/persona.webm`, personaFile, { upsert: true }),
    ])
  }

  // ---------------------------------------------------------------
  // Audio playback
  // ---------------------------------------------------------------

  private enqueueAudio(base64: string): void {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    const int16 = new Int16Array(bytes.buffer)
    const float32 = new Float32Array(int16.length) as Float32Array<ArrayBuffer>
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32767

    this.pendingChunks.push(float32)
    if (!this.isPlaying) this.playNextChunk()
  }

  private playNextChunk(): void {
    if (!this.audioContext || this.pendingChunks.length === 0) {
      this.isPlaying = false
      return
    }
    this.isPlaying = true

    const chunk = this.pendingChunks.shift()!
    const buffer = this.audioContext.createBuffer(1, chunk.length, 24000)
    buffer.copyToChannel(chunk, 0)

    const source = this.audioContext.createBufferSource()
    source.buffer = buffer
    // Connect to speaker output
    source.connect(this.audioContext.destination)
    // Also pipe into the persona recorder's destination node
    if (this.personaDestination) {
      source.connect(this.personaDestination)
    }
    source.onended = () => this.playNextChunk()
    source.start()

    this.currentSource = source
  }

  private drainAudio(): void {
    try { this.currentSource?.stop() } catch { /* already ended */ }
    this.pendingChunks = []
    this.isPlaying = false
    this.currentSource = null
  }

  private stopMic(): void {
    this.scriptProcessor?.disconnect()
    this.mediaStream?.getTracks().forEach((t) => t.stop())
  }

  // ---------------------------------------------------------------
  // WebSocket event handling
  // ---------------------------------------------------------------

  private sendEvent(event: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event))
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const type = msg.type as string

    switch (type) {
      case 'session.updated': {
        if (!this.sessionOpened) {
          this.sessionOpened = true
          this.onStatusChange?.('active')
          this.sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'assistant',
              content: [{ type: 'input_text', text: this.openingLine }],
            },
          })
          this.sendEvent({ type: 'response.create' })
        }
        break
      }

      case 'input_audio_buffer.speech_started': {
        this.drainAudio()
        this.onSpeakingChange?.('rep')
        break
      }

      case 'response.audio.delta': {
        const delta = (msg as { delta?: string }).delta
        if (delta) {
          if (!this.isPlaying) this.onSpeakingChange?.('persona')
          this.enqueueAudio(delta)
        }
        break
      }

      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = (msg as { transcript?: string }).transcript ?? ''
        if (transcript.trim()) {
          this.turnCounter++
          const turnNumber = this.turnCounter
          this.onTranscriptUpdate?.({ turn_number: turnNumber, speaker: 'rep', content: transcript })
          this.postRepTurn(transcript, turnNumber)
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
        }
        break
      }

      case 'response.done': {
        this.onSpeakingChange?.('idle')
        break
      }

      case 'error': {
        const errMsg = (msg as { error?: { message?: string } }).error?.message ?? 'Unknown OpenAI error'
        console.error('[CallClient] OpenAI error event:', errMsg)
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
