import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, errorResponse } from '@/lib/api-helpers'
import { buildPersonaSystemPrompt } from '@/lib/prompts/persona'
import { buildStateUpdatePrompt, STATE_UPDATE_SYSTEM_MESSAGE } from '@/lib/prompts/stateUpdate'
import type { PersonaState, Simulation, HintType } from '@/types'

interface StateUpdateResult extends PersonaState {
  coaching_hint?: {
    hint: string | null
    hint_type: HintType | null
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(['rep', 'trainer', 'admin'])
  if (!auth.ok) return auth.response

  let content: string
  let turnNumber: number
  try {
    const body = await request.json()
    content = body.content
    turnNumber = body.turn_number
  } catch {
    return errorResponse('Invalid JSON body', 'VALIDATION_ERROR', 400)
  }

  if (!content || typeof content !== 'string' || !content.trim()) {
    return errorResponse('content is required', 'VALIDATION_ERROR', 400)
  }
  if (typeof turnNumber !== 'number' || !Number.isInteger(turnNumber) || turnNumber < 1) {
    return errorResponse('turn_number must be a positive integer', 'VALIDATION_ERROR', 400)
  }

  const admin = createAdminClient()

  const { data: session, error: sessionError } = await admin
    .from('sessions')
    .select('*')
    .eq('id', params.id)
    .single()

  if (sessionError || !session) {
    return errorResponse('Session not found', 'NOT_FOUND', 404)
  }

  if (session.rep_id !== auth.userId) {
    return errorResponse('Access denied', 'FORBIDDEN', 403)
  }

  if (session.status !== 'active') {
    return errorResponse('Session is not active', 'SESSION_NOT_ACTIVE', 400)
  }

  const { data: recentRaw } = await admin
    .from('transcript_turns')
    .select('speaker, content')
    .eq('session_id', params.id)
    .order('turn_number', { ascending: false })
    .limit(10)

  const recentHistory = (recentRaw ?? [])
    .reverse()
    .map((t) => ({ speaker: t.speaker as 'rep' | 'persona', content: t.content as string }))

  const { data: insertedTurn, error: insertError } = await admin
    .from('transcript_turns')
    .insert({
      session_id: params.id,
      turn_number: turnNumber,
      speaker: 'rep',
      content: content.trim(),
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[POST /api/sessions/[id]/turn] insert failed', insertError)
    return errorResponse('Failed to store turn', 'INTERNAL_ERROR', 500)
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  let newState: PersonaState = session.persona_state as PersonaState
  let coachingHint: { hint: string | null; hint_type: HintType | null } = {
    hint: null,
    hint_type: null,
  }

  try {
    const statePrompt = buildStateUpdatePrompt(newState, content.trim(), recentHistory)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: STATE_UPDATE_SYSTEM_MESSAGE },
        { role: 'user', content: statePrompt },
      ],
      max_tokens: 350,
    })

    const raw = completion.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(raw) as StateUpdateResult

    newState = {
      trust: Math.max(0, Math.min(1, parsed.trust ?? newState.trust)),
      patience: Math.max(0, Math.min(1, parsed.patience ?? newState.patience)),
      pain_discovered: parsed.pain_discovered ?? newState.pain_discovered,
      objections_raised: parsed.objections_raised ?? newState.objections_raised,
      meeting_requested: parsed.meeting_requested ?? newState.meeting_requested,
      conversation_stage: parsed.conversation_stage ?? newState.conversation_stage,
    }

    if (parsed.coaching_hint?.hint) {
      coachingHint = {
        hint: parsed.coaching_hint.hint,
        hint_type: parsed.coaching_hint.hint_type ?? 'tip',
      }
    }
  } catch (err) {
    console.error('[POST /api/sessions/[id]/turn] state update failed', err)
  }

  await admin.from('sessions').update({ persona_state: newState }).eq('id', params.id)
  await admin
    .from('transcript_turns')
    .update({ persona_state_after: newState })
    .eq('id', insertedTurn.id)

  if (coachingHint.hint && coachingHint.hint_type) {
    await admin.from('coaching_hints').insert({
      session_id: params.id,
      turn_number: turnNumber,
      hint: coachingHint.hint,
      hint_type: coachingHint.hint_type,
    })
  }

  const { data: simulation } = await admin
    .from('simulations')
    .select('*')
    .eq('id', session.simulation_id)
    .single<Simulation>()

  const newSystemPrompt = simulation ? buildPersonaSystemPrompt(simulation, newState) : ''

  return NextResponse.json({
    updated_state: newState,
    new_system_prompt: newSystemPrompt,
    coaching_hint: coachingHint,
  })
}
