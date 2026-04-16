import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import SessionsView, { type SessionRowView } from '@/components/SessionsView'
import type { Profile, SessionStatus, Difficulty } from '@/types'

export const dynamic = 'force-dynamic'

interface SessionRow {
  id: string
  status: SessionStatus
  started_at: string | null
  ended_at: string | null
  created_at: string
  simulations: {
    title: string
    difficulty: Difficulty
  } | null
  evaluations: {
    overall_score: number
    passed: boolean
  } | null
}

export default async function SessionsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<Pick<Profile, 'role'>>()

  const selectQuery =
    'id, status, started_at, ended_at, created_at, simulations(title, difficulty), evaluations(overall_score, passed)'

  let filteredSessions: SessionRow[] = []

  if (profile?.role === 'rep') {
    const { data } = await admin
      .from('sessions')
      .select(selectQuery)
      .eq('rep_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
    filteredSessions = (data ?? []) as unknown as SessionRow[]
  } else {
    const { data } = await admin
      .from('sessions')
      .select(selectQuery)
      .order('created_at', { ascending: false })
      .limit(100)
    filteredSessions = (data ?? []) as unknown as SessionRow[]
  }

  return (
    <SessionsView
      sessions={filteredSessions as SessionRowView[]}
      profileRole={profile?.role}
    />
  )
}
