import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, errorResponse } from '@/lib/api-helpers'

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

  // Verify session exists and caller owns it
  const { data: session, error: sessionError } = await admin
    .from('sessions')
    .select('rep_id, status')
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

  const { error: insertError } = await admin.from('transcript_turns').insert({
    session_id: params.id,
    turn_number: turnNumber,
    speaker: 'persona',
    content: content.trim(),
  })

  if (insertError) {
    console.error('[POST /api/sessions/[id]/persona-turn] insert failed', insertError)
    return errorResponse('Failed to store turn', 'INTERNAL_ERROR', 500)
  }

  return NextResponse.json({ ok: true })
}
