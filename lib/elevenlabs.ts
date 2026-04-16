import { getPersonaVoiceOption, resolvePersonaVoice } from '@/lib/voices'
import type { PersonaVoice } from '@/types'

const ELEVENLABS_VOICE_MODEL = 'eleven_flash_v2_5'

interface ElevenLabsVoice {
  voice_id: string
  name: string
  labels?: Record<string, string>
}

let cachedVoices: { expiresAt: number; voices: ElevenLabsVoice[] } | null = null

async function listVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  const now = Date.now()
  if (cachedVoices && cachedVoices.expiresAt > now) {
    return cachedVoices.voices
  }

  const response = await fetch('https://api.elevenlabs.io/v2/voices', {
    headers: {
      'xi-api-key': apiKey,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to list ElevenLabs voices: ${response.status} ${text}`)
  }

  const data = (await response.json()) as { voices?: ElevenLabsVoice[] }
  const voices = data.voices ?? []
  cachedVoices = { voices, expiresAt: now + 5 * 60 * 1000 }
  return voices
}

async function resolveElevenVoiceId(apiKey: string, personaVoice: PersonaVoice): Promise<string> {
  const preferred = getPersonaVoiceOption(personaVoice)
  const preferredName = preferred.elevenVoiceName
  const voices = await listVoices(apiKey)

  const exactMatch = voices.find((voice) => voice.name.toLowerCase() === preferredName.toLowerCase())
  if (exactMatch) return exactMatch.voice_id

  const partialMatch = voices.find((voice) =>
    voice.name.toLowerCase().includes(preferredName.toLowerCase())
  )
  if (partialMatch) return partialMatch.voice_id

  const genderMatch = voices.find((voice) => {
    const gender = voice.labels?.gender?.toLowerCase()
    return gender === preferred.preferredGender
  })
  if (genderMatch) {
    console.warn(
      `[ElevenLabs] preferred voice "${preferredName}" not found, falling back to ${preferred.preferredGender} voice "${genderMatch.name}"`
    )
    return genderMatch.voice_id
  }

  if (voices[0]?.voice_id) {
    console.warn(
      `[ElevenLabs] preferred voice "${preferredName}" not found, falling back to first available voice "${voices[0].name}"`
    )
    return voices[0].voice_id
  }

  throw new Error(`No ElevenLabs voices available for preferred voice "${preferredName}"`)
}

export async function synthesizePersonaSpeech(params: {
  text: string
  personaName?: string | null
  personaVoice?: string | null
}): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not configured')
  }

  const resolvedVoice = resolvePersonaVoice(params.personaName, params.personaVoice)
  const voiceId = await resolveElevenVoiceId(apiKey, resolvedVoice)

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: params.text,
      model_id: ELEVENLABS_VOICE_MODEL,
      output_format: 'mp3_44100_128',
      voice_settings: {
        stability: 0.05,
        similarity_boost: 0.35,
        style: 1,
        speed: 1.04,
        use_speaker_boost: false,
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`ElevenLabs TTS failed: ${response.status} ${text}`)
  }

  return response.arrayBuffer()
}
