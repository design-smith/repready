import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, errorResponse } from '@/lib/api-helpers'
import { isMissingPersonaVoiceColumnError } from '@/lib/supabase/schemaCompat'
import { resolvePersonaVoice } from '@/lib/voices'
import type { SimulationFormData, Simulation } from '@/types'

// ---------------------------------------------------------------
// GET /api/simulations/[id]
// Returns the simulation plus its full version history.
// Accessible by all authenticated users (reps only if active).
// ---------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAuth = await import('@/lib/supabase/server').then((m) => m.createClient())
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

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

  const { data: simulation, error } = await admin
    .from('simulations')
    .select(`
      *,
      simulation_versions (
        id,
        version,
        snapshot,
        created_by,
        created_at
      )
    `)
    .eq('id', params.id)
    .order('version', { referencedTable: 'simulation_versions', ascending: false })
    .single()

  if (error || !simulation) {
    return errorResponse('Simulation not found', 'NOT_FOUND', 404)
  }

  // Reps can only view active simulations
  if (profile.role === 'rep' && !simulation.is_active) {
    return errorResponse('Simulation not found', 'NOT_FOUND', 404)
  }

  return NextResponse.json({ data: simulation })
}

// ---------------------------------------------------------------
// PUT /api/simulations/[id]
// Before updating, snapshots the current state into simulation_versions.
// Requires trainer or admin role.
// ---------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(['trainer', 'admin'])
  if (!auth.ok) return auth.response

  let body: Partial<SimulationFormData>
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 'VALIDATION_ERROR', 400)
  }

  const admin = createAdminClient()

  // Fetch current simulation to snapshot before overwriting
  const { data: current, error: fetchError } = await admin
    .from('simulations')
    .select('*')
    .eq('id', params.id)
    .single<Simulation>()

  if (fetchError || !current) {
    return errorResponse('Simulation not found', 'NOT_FOUND', 404)
  }

  const validationError = validateSimulationBody(body)
  if (validationError) {
    return errorResponse(validationError, 'VALIDATION_ERROR', 400)
  }

  // Snapshot the current state before applying changes
  const { error: versionError } = await admin
    .from('simulation_versions')
    .insert({
      simulation_id: current.id,
      version: current.version,
      snapshot: current,
      created_by: auth.userId,
    })

  if (versionError) {
    console.error('[PUT /api/simulations] version insert failed', versionError)
    return errorResponse('Failed to create version snapshot', 'INTERNAL_ERROR', 500)
  }

  // Apply the update and increment the version counter
  const updatePayload = {
    title: (body.title as string).trim(),
    difficulty: body.difficulty,
    call_goal: (body.call_goal as string).trim(),
    persona_name: (body.persona_name as string).trim(),
    persona_role: (body.persona_role as string).trim(),
    persona_voice: resolvePersonaVoice(body.persona_name, body.persona_voice),
    persona_style: (body.persona_style as string).trim(),
    company_context: (body.company_context as string).trim(),
    opening_line: (body.opening_line as string).trim(),
    hidden_objections: body.hidden_objections,
    allowed_disclosures: body.allowed_disclosures,
    forbidden_disclosures: body.forbidden_disclosures,
    success_criteria: (body.success_criteria as string).trim(),
    scoring_rubric: body.scoring_rubric,
    is_active: body.is_active,
    version: current.version + 1,
  }

  let { data: updated, error: updateError } = await admin
    .from('simulations')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (updateError && isMissingPersonaVoiceColumnError(updateError)) {
    const { persona_voice: _personaVoice, ...legacyPayload } = updatePayload
    const retry = await admin
      .from('simulations')
      .update(legacyPayload)
      .eq('id', params.id)
      .select()
      .single()
    updated = retry.data
    updateError = retry.error
  }

  if (updateError) {
    console.error('[PUT /api/simulations]', updateError)
    return errorResponse('Failed to update simulation', 'INTERNAL_ERROR', 500)
  }

  return NextResponse.json({ data: updated })
}

// ---------------------------------------------------------------
// Shared validation (mirrors route.ts)
// ---------------------------------------------------------------
function validateSimulationBody(body: Partial<SimulationFormData>): string | null {
  const required = [
    'title',
    'difficulty',
    'call_goal',
    'persona_name',
    'persona_role',
    'persona_style',
    'company_context',
    'opening_line',
    'success_criteria',
  ] as const

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
