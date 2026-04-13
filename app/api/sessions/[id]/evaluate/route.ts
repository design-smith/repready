import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, errorResponse } from '@/lib/api-helpers'
import { buildEvaluatorPrompt, EVALUATOR_SYSTEM_MESSAGE } from '@/lib/prompts/evaluator'
import type { Simulation, TranscriptTurn, PersonaState, Evaluation } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id
  const admin = createAdminClient()

  // Accept two auth patterns:
  //   1. A user session (trainer/admin calling manually via UI)
  //   2. An internal server-to-server call via x-internal-key header
  const internalKey = request.headers.get('x-internal-key')
  const isInternalCall =
    internalKey &&
    process.env.INTERNAL_API_KEY &&
    internalKey === process.env.INTERNAL_API_KEY

  let callerId: string | null = null
  let callerRole: string | null = null

  if (!isInternalCall) {
    const auth = await requireRole(['trainer', 'admin'])
    if (!auth.ok) return auth.response
    callerId = auth.userId
    callerRole = auth.profile.role
  }

  // Load the session
  const { data: session, error: sessionError } = await admin
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return errorResponse('Session not found', 'NOT_FOUND', 404)
  }

  if (session.status !== 'ended' && session.status !== 'evaluated') {
    return errorResponse(
      'Session must be ended before evaluation',
      'SESSION_NOT_ENDED',
      400
    )
  }

  // Idempotency: if evaluation already exists and caller is not a trainer/admin
  // requesting a re-evaluation, return the existing result
  const { data: existing } = await admin
    .from('evaluations')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()

  const isReEvalRequest =
    !isInternalCall && (callerRole === 'trainer' || callerRole === 'admin')

  if (existing && !isReEvalRequest) {
    return NextResponse.json({ evaluation: existing as Evaluation })
  }

  // Load transcript
  const { data: turns, error: turnsError } = await admin
    .from('transcript_turns')
    .select('*')
    .eq('session_id', sessionId)
    .order('turn_number', { ascending: true })

  if (turnsError) {
    return errorResponse('Failed to load transcript', 'INTERNAL_ERROR', 500)
  }

  // Load simulation — use versioned snapshot if available, fall back to live row
  // This is the critical detail: score against the rubric that was active during the call
  let simulation: Simulation | null = null

  if (session.simulation_version > 1) {
    const { data: versionRow } = await admin
      .from('simulation_versions')
      .select('snapshot')
      .eq('simulation_id', session.simulation_id)
      .eq('version', session.simulation_version)
      .maybeSingle()

    if (versionRow?.snapshot) {
      simulation = versionRow.snapshot as Simulation
    }
  }

  if (!simulation) {
    const { data: liveSimulation } = await admin
      .from('simulations')
      .select('*')
      .eq('id', session.simulation_id)
      .single()
    simulation = liveSimulation as Simulation
  }

  if (!simulation) {
    return errorResponse('Simulation not found', 'SIMULATION_NOT_FOUND', 404)
  }

  const finalPersonaState = session.persona_state as PersonaState
  const evaluatorPrompt = buildEvaluatorPrompt(
    simulation,
    (turns ?? []) as TranscriptTurn[],
    finalPersonaState
  )

  // Call Claude Sonnet
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let raw = ''
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: EVALUATOR_SYSTEM_MESSAGE,
      messages: [{ role: 'user', content: evaluatorPrompt }],
    })

    raw = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
  } catch (err) {
    console.error('[evaluate] Claude API call failed:', err)
    return errorResponse('Evaluator API call failed', 'EVALUATOR_API_FAILURE', 502)
  }

  let result: Omit<Evaluation, 'id' | 'session_id' | 'evaluated_at' | 'evaluator_model'>
  try {
    result = JSON.parse(raw)
  } catch {
    console.error('[evaluate] JSON parse failure. Raw response:', raw)
    return NextResponse.json(
      { error: 'EVALUATOR_PARSE_FAILURE', raw },
      { status: 502 }
    )
  }

  // Upsert evaluation — ON CONFLICT via the UNIQUE constraint on session_id
  const { data: upserted, error: upsertError } = await admin
    .from('evaluations')
    .upsert(
      {
        session_id: sessionId,
        overall_score: result.overall_score,
        passed: result.passed,
        category_scores: result.category_scores,
        strengths: result.strengths,
        mistakes: result.mistakes,
        missed_opportunities: result.missed_opportunities,
        summary: result.summary,
        evaluated_at: new Date().toISOString(),
        evaluator_model: 'claude-sonnet-4-5',
      },
      { onConflict: 'session_id' }
    )
    .select()
    .single()

  if (upsertError || !upserted) {
    console.error('[evaluate] upsert failed:', upsertError)
    return errorResponse('Failed to save evaluation', 'INTERNAL_ERROR', 500)
  }

  // Update session status to 'evaluated'
  await admin
    .from('sessions')
    .update({ status: 'evaluated' })
    .eq('id', sessionId)

  return NextResponse.json({ evaluation: upserted as Evaluation })
}
