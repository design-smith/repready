import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Skip all /_next/* (dev + prod internals, not only static), images, favicon.
     * A narrow _next/static-only skip can still run middleware on other /_next routes
     * and contribute to flaky dev + missing chunk 404s.
     */
    '/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
