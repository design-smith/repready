import { NextRequest, NextResponse } from 'next/server'
import { requireRole, errorResponse } from '@/lib/api-helpers'
import { synthesizePersonaSpeech } from '@/lib/elevenlabs'
import type { PersonaVoice } from '@/types'

interface VoicePreviewBody {
  persona_name?: string
  persona_role?: string
  persona_style?: string
  persona_voice?: PersonaVoice
  opening_line?: string
}

function buildPreviewText(body: VoicePreviewBody): string {
  const openingLine = body.opening_line?.trim()
  if (openingLine) return openingLine.slice(0, 300)

  const name = body.persona_name?.trim() || 'Jordan Blake'
  const role = body.persona_role?.trim() || 'Vice President of Operations'

  return `Hi, this is ${name}, ${role}. Thanks for calling. I have a couple of minutes, so tell me why you reached out.`
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(['trainer', 'admin'])
  if (!auth.ok) return auth.response

  let body: VoicePreviewBody
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 'VALIDATION_ERROR', 400)
  }

  const input = buildPreviewText(body)

  try {
    const audio = await synthesizePersonaSpeech({
      text: input,
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
    console.error('[POST /api/voices/preview] request failed', error)
    return errorResponse('Failed to generate preview audio', 'ELEVENLABS_ERROR', 502)
  }
}
