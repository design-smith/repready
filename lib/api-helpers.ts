import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile } from '@/types'

export function errorResponse(message: string, code: string, status: number) {
  return NextResponse.json({ error: message, code }, { status })
}

/**
 * Validates the incoming request has an authenticated session and that
 * the user's role is in the allowed list. Returns the user + profile on
 * success, or a ready-to-return error NextResponse.
 */
export async function requireRole(
  allowedRoles: Profile['role'][]
): Promise<
  | { ok: true; userId: string; profile: Profile }
  | { ok: false; response: NextResponse }
> {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false,
      response: errorResponse('Authentication required', 'AUTH_REQUIRED', 401),
    }
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (profileError || !profile) {
    return {
      ok: false,
      response: errorResponse('User profile not found', 'PROFILE_NOT_FOUND', 403),
    }
  }

  if (!allowedRoles.includes(profile.role)) {
    return {
      ok: false,
      response: errorResponse(
        'You do not have permission to perform this action',
        'FORBIDDEN',
        403
      ),
    }
  }

  return { ok: true, userId: user.id, profile }
}
