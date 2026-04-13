import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, errorResponse } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(['rep', 'trainer', 'admin'])
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  const { data: session, error } = await admin
    .from('sessions')
    .select(`
      *,
      transcript_turns (*)
    `)
    .eq('id', params.id)
    .order('turn_number', { referencedTable: 'transcript_turns', ascending: true })
    .single()

  if (error || !session) {
    return errorResponse('Session not found', 'NOT_FOUND', 404)
  }

  // Reps can only see their own sessions
  if (auth.profile.role === 'rep' && session.rep_id !== auth.userId) {
    return errorResponse('Session not found', 'NOT_FOUND', 404)
  }

  return NextResponse.json({ data: session })
}
