import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, errorResponse } from '@/lib/api-helpers'
import { buildPersonaSystemPrompt } from '@/lib/prompts/persona'
import { resolvePersonaVoice } from '@/lib/voices'
import { defaultPersonaState } from '@/types'
import type { Simulation } from '@/types'

export async function POST(request: NextRequest) {
  const auth = await requireRole(['rep', 'trainer', 'admin'])
  if (!auth.ok) return auth.response

  let simulationId: string
  try {
    const body = await request.json()
    simulationId = body.simulation_id
  } catch {
    return errorResponse('Invalid JSON body', 'VALIDATION_ERROR', 400)
  }

  if (!simulationId || typeof simulationId !== 'string') {
    return errorResponse('simulation_id is required', 'VALIDATION_ERROR', 400)
  }

  const admin = createAdminClient()

  // Load and validate the simulation
  const { data: simulation, error: simError } = await admin
    .from('simulations')
    .select('*')
    .eq('id', simulationId)
    .single<Simulation>()

  if (simError || !simulation) {
    return errorResponse('Simulation not found', 'NOT_FOUND', 404)
  }

  if (!simulation.is_active) {
    return errorResponse('Simulation is not active', 'SIMULATION_INACTIVE', 400)
  }

  // Create session row in pending state
  const { data: session, error: sessionError } = await admin
    .from('sessions')
    .insert({
      simulation_id: simulation.id,
      simulation_version: simulation.version,
      rep_id: auth.userId,
      status: 'pending',
      persona_state: defaultPersonaState,
    })
    .select('id')
    .single()

  if (sessionError || !session) {
    console.error('[POST /api/sessions/start] session insert failed', sessionError)
    return errorResponse('Failed to create session', 'INTERNAL_ERROR', 500)
  }

  // Request ephemeral token from OpenAI Realtime sessions endpoint
  // Note: use fetch directly — this endpoint is not in the openai SDK's standard namespaces
  let ephemeralToken: string
  let openaiSessionId: string
  const personaVoice = resolvePersonaVoice(simulation.persona_name, simulation.persona_voice)

  try {
    const oaiRes = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-realtime',
      }),
    })

    if (!oaiRes.ok) {
      const errText = await oaiRes.text()
      console.error('[POST /api/sessions/start] OpenAI error', oaiRes.status, errText)
      // Clean up the orphaned pending session
      await admin.from('sessions').update({ status: 'ended' }).eq('id', session.id)
      return errorResponse('Failed to create OpenAI session', 'OPENAI_ERROR', 502)
    }

    const oaiData = await oaiRes.json()
    ephemeralToken = oaiData.client_secret?.value
    openaiSessionId = oaiData.id

    if (!ephemeralToken) {
      await admin.from('sessions').update({ status: 'ended' }).eq('id', session.id)
      return errorResponse('OpenAI did not return an ephemeral token', 'OPENAI_ERROR', 502)
    }
  } catch (err) {
    console.error('[POST /api/sessions/start] fetch threw', err)
    await admin.from('sessions').update({ status: 'ended' }).eq('id', session.id)
    return errorResponse('Failed to reach OpenAI', 'OPENAI_ERROR', 502)
  }

  // Activate the session
  const now = new Date().toISOString()
  await admin
    .from('sessions')
    .update({
      status: 'active',
      openai_session_id: openaiSessionId,
      started_at: now,
    })
    .eq('id', session.id)

  const initialSystemPrompt = buildPersonaSystemPrompt(simulation, defaultPersonaState)

  return NextResponse.json({
    session_id: session.id,
    ephemeral_token: ephemeralToken,
    initial_system_prompt: initialSystemPrompt,
    opening_line: simulation.opening_line,
    persona_voice: personaVoice,
    persona_state: defaultPersonaState,
  })
}
