import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, errorResponse } from '@/lib/api-helpers'
import type { SessionAnnotation } from '@/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(['rep', 'trainer', 'admin'])
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  // Verify session access for reps
  if (auth.profile.role === 'rep') {
    const { data: session } = await admin
      .from('sessions')
      .select('rep_id')
      .eq('id', params.id)
      .single()
    if (!session || session.rep_id !== auth.userId) {
      return errorResponse('Access denied', 'FORBIDDEN', 403)
    }
  }

  const { data, error } = await admin
    .from('session_annotations')
    .select('*, profiles(full_name, email)')
    .eq('session_id', params.id)
    .order('created_at', { ascending: true })

  if (error) {
    return errorResponse('Failed to fetch annotations', 'INTERNAL_ERROR', 500)
  }

  const annotations = (data ?? []).map((row) => {
    const profile = row.profiles as { full_name?: string | null; email: string } | null
    return {
      id: row.id,
      session_id: row.session_id,
      annotator_id: row.annotator_id,
      annotator_name: profile?.full_name || profile?.email || 'Unknown',
      turn_number: row.turn_number ?? undefined,
      content: row.content,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } as SessionAnnotation
  })

  return NextResponse.json({ annotations })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(['trainer', 'admin'])
  if (!auth.ok) return auth.response

  let content: string
  let turnNumber: number | undefined
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

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('session_annotations')
    .insert({
      session_id: params.id,
      annotator_id: auth.userId,
      content: content.trim(),
      turn_number: turnNumber ?? null,
    })
    .select('*, profiles(full_name, email)')
    .single()

  if (error || !data) {
    return errorResponse('Failed to create annotation', 'INTERNAL_ERROR', 500)
  }

  const profile = data.profiles as { full_name?: string | null; email: string } | null
  const annotation: SessionAnnotation = {
    id: data.id,
    session_id: data.session_id,
    annotator_id: data.annotator_id,
    annotator_name: profile?.full_name || profile?.email || 'Unknown',
    turn_number: data.turn_number ?? undefined,
    content: data.content,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }

  return NextResponse.json({ annotation }, { status: 201 })
}
