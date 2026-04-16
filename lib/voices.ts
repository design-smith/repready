import type { PersonaVoice } from '@/types'

export interface PersonaVoiceOption {
  id: PersonaVoice
  label: string
  description: string
  elevenVoiceName: string
  preferredGender: 'male' | 'female'
  aliases?: string[]
}

export const PERSONA_VOICE_OPTIONS: PersonaVoiceOption[] = [
  { id: 'marin', label: 'Rachel', description: 'Polished and articulate', elevenVoiceName: 'Rachel', preferredGender: 'female' },
  { id: 'cedar', label: 'Antoni', description: 'Grounded and direct', elevenVoiceName: 'Antoni', preferredGender: 'male' },
  { id: 'ash', label: 'Josh', description: 'Confident and restrained', elevenVoiceName: 'Josh', preferredGender: 'male' },
  { id: 'coral', label: 'Bella', description: 'Warm and approachable', elevenVoiceName: 'Bella', preferredGender: 'female' },
  { id: 'sage', label: 'Sam', description: 'Measured and professional', elevenVoiceName: 'Sam', preferredGender: 'male' },
  { id: 'verse', label: 'Matilda', description: 'Expressive and conversational', elevenVoiceName: 'Matilda', preferredGender: 'female' },
  { id: 'echo', label: 'Adam', description: 'Calm and even', elevenVoiceName: 'Adam', preferredGender: 'male' },
  { id: 'alloy', label: 'Arnold', description: 'Bold and assertive', elevenVoiceName: 'Arnold', preferredGender: 'male' },
  { id: 'ballad', label: 'Domi', description: 'Smooth and composed', elevenVoiceName: 'Domi', preferredGender: 'female' },
  { id: 'shimmer', label: 'Elli', description: 'Bright and energetic', elevenVoiceName: 'Elli', preferredGender: 'female' },
]

export const DEFAULT_PERSONA_VOICE: PersonaVoice = 'marin'

const STARTER_PERSONA_VOICE_MAP: Record<string, PersonaVoice> = {
  'Karen Osei': 'coral',
  'David Park': 'cedar',
  'Priya Menon': 'verse',
  'Marcus Webb': 'echo',
  'Rachel Torres': 'sage',
}

export function resolvePersonaVoice(
  personaName?: string | null,
  existingVoice?: string | null
): PersonaVoice {
  const matched = PERSONA_VOICE_OPTIONS.find((voice) => voice.id === existingVoice)
  if (matched) return matched.id

  if (personaName) {
    const seeded = STARTER_PERSONA_VOICE_MAP[personaName.trim()]
    if (seeded) return seeded
  }

  return DEFAULT_PERSONA_VOICE
}

export function getPersonaVoiceOption(voice: PersonaVoice): PersonaVoiceOption {
  return PERSONA_VOICE_OPTIONS.find((option) => option.id === voice) ?? PERSONA_VOICE_OPTIONS[0]
}
