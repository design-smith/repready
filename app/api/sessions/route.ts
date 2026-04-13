import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, errorResponse } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  const auth = await requireRole(['rep', 'trainer', 'admin'])
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  let query = admin
    .from('sessions')
    .select('*, simulations(title, difficulty)')
    .order('created_at', { ascending: false })

  // Reps only see their own sessions
  if (auth.profile.role === 'rep') {
    query = query.eq('rep_id', auth.userId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[GET /api/sessions]', error)
    return errorResponse('Failed to fetch sessions', 'INTERNAL_ERROR', 500)
  }

  return NextResponse.json({ data })
}
