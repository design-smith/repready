import { notFound, redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import ResultsClient from '@/components/ResultsClient'
import type { Profile, TranscriptTurn, PersonaState, Evaluation, SessionMetrics, SessionAnnotation, CoachingHint } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ResultsPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: profile }, { data: session, error: sessionError }] = await Promise.all([
    admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single<Pick<Profile, 'role'>>(),
    admin
      .from('sessions')
      .select('*, transcript_turns(*)')
      .eq('id', params.id)
      .order('turn_number', { referencedTable: 'transcript_turns', ascending: true })
      .single(),
  ])

  if (sessionError || !session) notFound()

  if (profile?.role === 'rep' && session.rep_id !== user.id) notFound()

  const [
    { data: simulation },
    { data: evaluation },
    { data: metrics },
    { data: annotationsRaw },
    { data: hintsRaw },
  ] = await Promise.all([
    admin.from('simulations').select('id, title').eq('id', session.simulation_id).single(),
    admin.from('evaluations').select('*').eq('session_id', params.id).maybeSingle(),
    admin.from('session_metrics').select('*').eq('session_id', params.id).maybeSingle(),
    admin
      .from('session_annotations')
      .select('*, profiles(full_name, email)')
      .eq('session_id', params.id)
      .order('created_at', { ascending: true }),
    admin
      .from('coaching_hints')
      .select('*')
      .eq('session_id', params.id)
      .order('turn_number', { ascending: true }),
  ])

  const turns = (session.transcript_turns ?? []) as TranscriptTurn[]
  const finalState = session.persona_state as PersonaState

  const durationSeconds =
    session.started_at && session.ended_at
      ? Math.floor(
          (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000
        )
      : null

  function formatDuration(s: number | null): string {
    if (s === null) return '—'
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}m ${sec}s`
  }

  const canReEvaluate = profile?.role === 'trainer' || profile?.role === 'admin'
  const canAnnotate = profile?.role === 'trainer' || profile?.role === 'admin'

  const annotations: SessionAnnotation[] = (annotationsRaw ?? []).map((row) => {
    const p = row.profiles as { full_name?: string | null; email: string } | null
    return {
      id: row.id,
      session_id: row.session_id,
      annotator_id: row.annotator_id,
      annotator_name: p?.full_name || p?.email || 'Unknown',
      turn_number: row.turn_number ?? undefined,
      content: row.content,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  })

  return (
    <ResultsClient
      sessionId={params.id}
      simulationId={session.simulation_id as string}
      simulationTitle={(simulation as { title?: string } | null)?.title ?? 'Simulation'}
      durationFormatted={formatDuration(durationSeconds)}
      endedAt={session.ended_at ?? null}
      turns={turns}
      finalState={finalState}
      initialEvaluation={(evaluation as Evaluation | null) ?? null}
      metrics={(metrics as SessionMetrics | null) ?? null}
      annotations={annotations}
      hints={(hintsRaw as CoachingHint[] | null) ?? []}
      canReEvaluate={canReEvaluate}
      canAnnotate={canAnnotate}
    />
  )
}
