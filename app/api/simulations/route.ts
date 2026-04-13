import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, errorResponse } from '@/lib/api-helpers'
import type { SimulationFormData } from '@/types'

// ---------------------------------------------------------------
// GET /api/simulations
// Query params: difficulty (easy|medium|hard), search (string)
// Accessible by all authenticated users; reps only see active ones.
// ---------------------------------------------------------------
export async function GET(request: NextRequest) {
  const supabase_auth = await import('@/lib/supabase/server').then((m) => m.createClient())
  const {
    data: { user },
  } = await supabase_auth.auth.getUser()

  if (!user) {
    return errorResponse('Authentication required', 'AUTH_REQUIRED', 401)
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return errorResponse('User profile not found', 'PROFILE_NOT_FOUND', 403)
  }

  const { searchParams } = new URL(request.url)
  const difficulty = searchParams.get('difficulty')
  const search = searchParams.get('search')

  let query = admin
    .from('simulations')
    .select('id, title, difficulty, call_goal, persona_name, is_active, version, created_at, updated_at')
    .order('created_at', { ascending: false })

  // Reps may only see active simulations
  if (profile.role === 'rep') {
    query = query.eq('is_active', true)
  }

  if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) {
    query = query.eq('difficulty', difficulty)
  }

  if (search && search.trim()) {
    query = query.ilike('title', `%${search.trim()}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('[GET /api/simulations]', error)
    return errorResponse('Failed to fetch simulations', 'INTERNAL_ERROR', 500)
  }

  return NextResponse.json({ data })
}

// ---------------------------------------------------------------
// POST /api/simulations
// Body: SimulationFormData
// Requires trainer or admin role.
// ---------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await requireRole(['trainer', 'admin'])
  if (!auth.ok) return auth.response

  let body: SimulationFormData
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 'VALIDATION_ERROR', 400)
  }

  const validationError = validateSimulationBody(body)
  if (validationError) {
    return errorResponse(validationError, 'VALIDATION_ERROR', 400)
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('simulations')
    .insert({
      title: body.title.trim(),
      difficulty: body.difficulty,
      call_goal: body.call_goal.trim(),
      persona_name: body.persona_name.trim(),
      persona_role: body.persona_role.trim(),
      persona_style: body.persona_style.trim(),
      company_context: body.company_context.trim(),
      opening_line: body.opening_line.trim(),
      hidden_objections: body.hidden_objections,
      allowed_disclosures: body.allowed_disclosures,
      forbidden_disclosures: body.forbidden_disclosures,
      success_criteria: body.success_criteria.trim(),
      scoring_rubric: body.scoring_rubric,
      is_active: body.is_active,
      version: 1,
      created_by: auth.userId,
    })
    .select()
    .single()

  if (error) {
    console.error('[POST /api/simulations]', error)
    return errorResponse('Failed to create simulation', 'INTERNAL_ERROR', 500)
  }

  return NextResponse.json({ data }, { status: 201 })
}

// ---------------------------------------------------------------
// Shared validation
// ---------------------------------------------------------------
function validateSimulationBody(body: Partial<SimulationFormData>): string | null {
  const required: (keyof SimulationFormData)[] = [
    'title',
    'difficulty',
    'call_goal',
    'persona_name',
    'persona_role',
    'persona_style',
    'company_context',
    'opening_line',
    'success_criteria',
  ]

  for (const field of required) {
    const value = body[field]
    if (typeof value !== 'string' || !value.trim()) {
      return `Field "${field}" is required`
    }
  }

  if (!['easy', 'medium', 'hard'].includes(body.difficulty as string)) {
    return 'difficulty must be easy, medium, or hard'
  }

  if (!Array.isArray(body.scoring_rubric) || body.scoring_rubric.length === 0) {
    return 'scoring_rubric must be a non-empty array'
  }

  for (const category of body.scoring_rubric) {
    if (typeof category.name !== 'string' || !category.name.trim()) {
      return 'Each rubric category must have a name'
    }
    if (typeof category.weight !== 'number' || category.weight < 1 || category.weight > 10) {
      return 'Rubric category weight must be between 1 and 10'
    }
  }

  return null
}
