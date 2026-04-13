import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, errorResponse } from '@/lib/api-helpers'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(['trainer', 'admin'])
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  // Verify ownership — trainers/admins can only delete their own annotations
  const { data: annotation } = await admin
    .from('session_annotations')
    .select('annotator_id')
    .eq('id', params.id)
    .single()

  if (!annotation) {
    return errorResponse('Annotation not found', 'NOT_FOUND', 404)
  }

  if (annotation.annotator_id !== auth.userId) {
    return errorResponse('You can only delete your own annotations', 'FORBIDDEN', 403)
  }

  const { error } = await admin
    .from('session_annotations')
    .delete()
    .eq('id', params.id)

  if (error) {
    return errorResponse('Failed to delete annotation', 'INTERNAL_ERROR', 500)
  }

  return new NextResponse(null, { status: 204 })
}
