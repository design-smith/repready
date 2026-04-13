import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, errorResponse } from '@/lib/api-helpers'
import { computeSessionMetrics } from '@/lib/metrics/computeMetrics'
import type { TranscriptTurn } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(['rep', 'trainer', 'admin'])
  if (!auth.ok) return auth.response

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

  if (session.status === 'ended' || session.status === 'evaluated') {
    return errorResponse('Session has already ended', 'SESSION_ALREADY_ENDED', 400)
  }

  const endedAt = new Date().toISOString()

  await admin
    .from('sessions')
    .update({ status: 'ended', ended_at: endedAt })
    .eq('id', params.id)

  const { data: turns, error: turnsError } = await admin
    .from('transcript_turns')
    .select('*')
    .eq('session_id', params.id)
    .order('turn_number', { ascending: true })

  if (turnsError) {
    console.error('[POST /api/sessions/[id]/end] turns fetch failed', turnsError)
    return errorResponse('Failed to fetch transcript', 'INTERNAL_ERROR', 500)
  }

  let durationSeconds: number | null = null
  if (session.started_at) {
    durationSeconds = Math.floor(
      (new Date(endedAt).getTime() - new Date(session.started_at).getTime()) / 1000
    )
  }

  const transcript = (turns ?? []) as TranscriptTurn[]

  // Compute and store session metrics
  try {
    const metrics = computeSessionMetrics(transcript, durationSeconds ?? 0)
    await admin.from('session_metrics').upsert(
      { session_id: params.id, ...metrics },
      { onConflict: 'session_id' }
    )
  } catch (err) {
    console.error('[end] metrics computation failed:', err)
  }

  // Fire evaluation — await so results page doesn't race.
  // If evaluation fails we still return the end result — don't block the rep.
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    await fetch(`${appUrl}/api/sessions/${params.id}/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': process.env.INTERNAL_API_KEY ?? '',
      },
    })
  } catch (err) {
    console.error('[end] Evaluation trigger failed:', err)
  }

  return NextResponse.json({
    session_id: params.id,
    transcript,
    final_persona_state: session.persona_state,
    duration_seconds: durationSeconds,
  })
}
