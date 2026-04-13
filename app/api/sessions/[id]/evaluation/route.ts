import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, errorResponse } from '@/lib/api-helpers'
import type { Evaluation } from '@/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(['rep', 'trainer', 'admin'])
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  // Verify session access
  const { data: session, error: sessionError } = await admin
    .from('sessions')
    .select('id, rep_id')
    .eq('id', params.id)
    .single()

  if (sessionError || !session) {
    return errorResponse('Session not found', 'NOT_FOUND', 404)
  }

  // Reps can only see their own sessions
  if (auth.profile.role === 'rep' && session.rep_id !== auth.userId) {
    return errorResponse('Access denied', 'FORBIDDEN', 403)
  }

  const { data: evaluation } = await admin
    .from('evaluations')
    .select('*')
    .eq('session_id', params.id)
    .maybeSingle()

  return NextResponse.json({ evaluation: (evaluation as Evaluation | null) ?? null })
}
