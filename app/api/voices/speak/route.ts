import { NextRequest, NextResponse } from 'next/server'
import { requireRole, errorResponse } from '@/lib/api-helpers'
import { synthesizePersonaSpeech } from '@/lib/elevenlabs'
import type { PersonaVoice } from '@/types'

interface SpeakBody {
  text?: string
  persona_name?: string
  persona_voice?: PersonaVoice
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(['rep', 'trainer', 'admin'])
  if (!auth.ok) return auth.response

  let body: SpeakBody
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 'VALIDATION_ERROR', 400)
  }

  const text = body.text?.trim()
  if (!text) {
    return errorResponse('text is required', 'VALIDATION_ERROR', 400)
  }

  try {
    const audio = await synthesizePersonaSpeech({
      text,
      personaName: body.persona_name,
      personaVoice: body.persona_voice,
    })

    return new NextResponse(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[POST /api/voices/speak] request failed', error)
    return errorResponse('Failed to generate speech', 'ELEVENLABS_ERROR', 502)
  }
}
