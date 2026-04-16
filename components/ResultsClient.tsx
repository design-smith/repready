'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  Heading,
  HStack,
  Icon,
  Text,
} from '@chakra-ui/react'
import { Link } from '@chakra-ui/next-js'
import EvaluationPoller from '@/components/EvaluationPoller'
import AnnotationPanel from '@/components/AnnotationPanel'
import type {
  TranscriptTurn,
  PersonaState,
  Evaluation,
  EvaluationCategory,
  SessionMetrics,
  SessionAnnotation,
  CoachingHint,
} from '@/types'

const AudioPlayback = dynamic(() => import('@/components/AudioPlayback'), { ssr: false })

interface ResultsClientProps {
  sessionId: string
  simulationId: string
  simulationTitle: string
  durationFormatted: string
  endedAt: string | null
  turns: TranscriptTurn[]
  finalState: PersonaState
  initialEvaluation: Evaluation | null
  metrics: SessionMetrics | null
  annotations: SessionAnnotation[]
  hints: CoachingHint[]
  canReEvaluate: boolean
  canAnnotate: boolean
}

export default function ResultsClient({
  sessionId,
  simulationId,
  simulationTitle,
  durationFormatted,
  endedAt,
  turns,
  finalState,
  initialEvaluation,
  metrics,
  annotations,
  hints,
  canReEvaluate,
  canAnnotate,
}: ResultsClientProps) {
  const [evaluation, setEvaluation] = useState<Evaluation | null>(initialEvaluation)
  const [audioOpen, setAudioOpen] = useState(false)
  const [annotationsOpen, setAnnotationsOpen] = useState(false)
  const [hintsOpen, setHintsOpen] = useState(false)

  return (
    <Box w="full">
      <Button as={Link} href="/dashboard/sessions" variant="ghost" size="sm" color="gray.600" mb={6} pl={0}>
        ← All sessions
      </Button>

      <Box
        borderRadius="2xl"
        borderWidth="1px"
        borderColor="emerald.200"
        bgGradient="linear(to-br, emerald.50, white)"
        px={{ base: 5, md: 8 }}
        py={6}
        mb={8}
        boxShadow="sm"
      >
        <HStack align="flex-start" spacing={4}>
          <FlexCircleIcon />
          <Box>
            <Text fontSize="xs" fontWeight="bold" color="emerald.700" textTransform="uppercase" letterSpacing="wider">
              Call complete
            </Text>
            <Heading size="md" color="gray.900" mt={1}>
              {simulationTitle}
            </Heading>
            <Text fontSize="sm" color="gray.600" mt={2}>
              Duration <strong>{durationFormatted}</strong>
              {endedAt && (
                <>
                  {' '}
                  ·{' '}
                  {new Date(endedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </>
              )}
            </Text>
          </Box>
        </HStack>
      </Box>

      {/* Evaluation — poller or full results */}
      {evaluation ? (
        <EvaluationResults
          evaluation={evaluation}
          metrics={metrics}
          canReEvaluate={canReEvaluate}
          sessionId={sessionId}
          onReEvaluate={setEvaluation}
        />
      ) : (
        <EvaluationPoller sessionId={sessionId} onEvaluationReady={setEvaluation} />
      )}

      {/* Coaching hints log */}
      {hints.length > 0 && (
        <div className="card mb-6">
          <button
            type="button"
            onClick={() => setHintsOpen((o) => !o)}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="section-title mb-0">
              Coaching Hints During Call{' '}
              <span className="font-normal text-slate-500 text-sm">({hints.length})</span>
            </h2>
            <ChevronIcon open={hintsOpen} />
          </button>
          {hintsOpen && (
            <div className="mt-4 space-y-2">
              {hints.map((h) => (
                <div
                  key={h.id}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2 text-sm ${
                    h.hint_type === 'warning'
                      ? 'bg-amber-50 border border-amber-200 text-amber-800'
                      : h.hint_type === 'encouragement'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-blue-50 border border-blue-200 text-blue-800'
                  }`}
                >
                  <span className="text-xs font-medium capitalize shrink-0 mt-0.5">{h.hint_type}</span>
                  <span>{h.hint}</span>
                  <span className="text-xs text-slate-400 shrink-0 ml-auto">Turn {h.turn_number}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audio playback */}
      <div className="card mb-6">
        <button
          type="button"
          onClick={() => setAudioOpen((o) => !o)}
          className="w-full flex items-center justify-between text-left"
        >
          <h2 className="section-title mb-0">Audio Playback</h2>
          <ChevronIcon open={audioOpen} />
        </button>
        {audioOpen && (
          <div className="mt-4">
            <AudioPlayback sessionId={sessionId} />
          </div>
        )}
      </div>

      {/* Manager annotations */}
      <div className="card mb-6">
        <button
          type="button"
          onClick={() => setAnnotationsOpen((o) => !o)}
          className="w-full flex items-center justify-between text-left"
        >
          <h2 className="section-title mb-0">
            Annotations{' '}
            {annotations.length > 0 && (
              <span className="font-normal text-slate-500 text-sm">({annotations.length})</span>
            )}
          </h2>
          <ChevronIcon open={annotationsOpen} />
        </button>
        {annotationsOpen && (
          <div className="mt-4">
            <AnnotationPanel
              sessionId={sessionId}
              transcript={turns}
              existingAnnotations={annotations}
              canAnnotate={canAnnotate}
            />
          </div>
        )}
      </div>

      <ButtonGroup spacing={3} flexWrap="wrap" variant="outline">
        <Button as={Link} href={`/dashboard/sessions/call?simulation_id=${simulationId}`} colorScheme="cyan">
          Practice again
        </Button>
        <Button as={Link} href="/dashboard/sessions">
          All sessions
        </Button>
        <Button as={Link} href="/dashboard">
          Dashboard
        </Button>
      </ButtonGroup>
    </Box>
  )
}

function FlexCircleIcon() {
  return (
    <Flex
      w={12}
      h={12}
      borderRadius="full"
      bg="emerald.100"
      align="center"
      justify="center"
      shrink={0}
    >
      <Icon viewBox="0 0 20 20" boxSize={6} color="emerald.600">
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
          clipRule="evenodd"
        />
      </Icon>
    </Flex>
  )
}

// ---------------------------------------------------------------
// Evaluation results view
// ---------------------------------------------------------------

function EvaluationResults({
  evaluation,
  metrics,
  canReEvaluate,
  sessionId,
  onReEvaluate,
}: {
  evaluation: Evaluation
  metrics: SessionMetrics | null
  canReEvaluate: boolean
  sessionId: string
  onReEvaluate: (e: Evaluation) => void
}) {
  const [reEvaluating, setReEvaluating] = useState(false)

  async function handleReEvaluate() {
    setReEvaluating(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/evaluate`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        onReEvaluate(data.evaluation)
      }
    } finally {
      setReEvaluating(false)
    }
  }

  const heroline = evaluation.summary.split(/\.|\n/)[0]?.trim() ?? ''

  return (
    <>
      {/* Score hero */}
      <div className="card mb-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-end gap-1">
            <span className="text-6xl font-bold text-slate-900">{evaluation.overall_score}</span>
            <span className="text-2xl text-slate-400 mb-2">/100</span>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${evaluation.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {evaluation.passed ? 'PASSED' : 'NEEDS WORK'}
          </span>
          {heroline && <p className="text-sm text-slate-500 max-w-sm">{heroline}.</p>}
        </div>
      </div>

      {/* Category breakdown */}
      <div className="card mb-6">
        <h2 className="section-title">Category Scores</h2>
        <div className="space-y-5">
          {evaluation.category_scores.map((cat) => (
            <CategoryRow key={cat.name} category={cat} />
          ))}
        </div>
      </div>

      {/* Call metrics */}
      {metrics && <MetricsSection metrics={metrics} />}

      {/* Strengths / Mistakes / Missed opportunities */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <FeedbackColumn title="Strengths" items={evaluation.strengths} iconClass="text-emerald-500"
          iconPath="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" />
        <FeedbackColumn title="Mistakes" items={evaluation.mistakes} iconClass="text-red-500"
          iconPath="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        <FeedbackColumn title="Missed Opportunities" items={evaluation.missed_opportunities} iconClass="text-amber-500"
          iconPath="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" />
      </div>

      {/* Summary */}
      <div className="card mb-6">
        <h2 className="section-title">Summary</h2>
        <p className="text-sm text-slate-700 leading-relaxed">{evaluation.summary}</p>
      </div>

      {/* Re-evaluate */}
      {canReEvaluate && (
        <div className="mb-6">
          <button type="button" onClick={handleReEvaluate} disabled={reEvaluating}
            className="btn-secondary text-sm disabled:opacity-50">
            {reEvaluating ? 'Re-evaluating…' : 'Re-evaluate'}
          </button>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------
// Call metrics section
// ---------------------------------------------------------------

function MetricsSection({ metrics }: { metrics: SessionMetrics }) {
  const talkPct = Math.round(metrics.talk_ratio * 100)
  const talkColor = talkPct >= 40 && talkPct <= 60 ? 'text-emerald-700' : talkPct > 80 ? 'text-red-600' : 'text-amber-600'
  const talkNote = talkPct >= 40 && talkPct <= 60 ? 'Good balance' : talkPct > 80 ? 'Talking too much' : talkPct < 30 ? 'Too quiet' : 'Slightly high'

  const questionColor = metrics.question_count >= 3 ? 'text-emerald-700' : metrics.question_count >= 1 ? 'text-amber-600' : 'text-red-600'
  const fillerColor = metrics.filler_word_count < 5 ? 'text-emerald-700' : metrics.filler_word_count <= 10 ? 'text-amber-600' : 'text-red-600'
  const monologueColor = metrics.longest_monologue_words > 80 ? 'text-red-600' : metrics.avg_rep_turn_length > 50 ? 'text-amber-600' : 'text-emerald-700'

  const topFillers = Object.entries(metrics.filler_words_found)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word, count]) => `"${word}" (${count}×)`)
    .join(', ')

  return (
    <div className="card mb-6">
      <h2 className="section-title">Call Metrics</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
        <MetricCard
          label="Talk Ratio"
          value={`${talkPct}%`}
          note={talkNote}
          valueClass={talkColor}
        />
        <MetricCard
          label="Questions Asked"
          value={String(metrics.question_count)}
          note={metrics.question_count >= 3 ? 'Good' : metrics.question_count === 0 ? 'Ask more questions' : 'Ask more'}
          valueClass={questionColor}
        />
        <MetricCard
          label="Filler Words"
          value={String(metrics.filler_word_count)}
          note={metrics.filler_word_count < 5 ? 'Clean delivery' : metrics.filler_word_count <= 10 ? 'Watch fillers' : 'Too many fillers'}
          valueClass={fillerColor}
        />
        <MetricCard
          label="Avg Turn Length"
          value={`${metrics.avg_rep_turn_length}w`}
          note={metrics.avg_rep_turn_length > 50 ? 'Consider shorter responses' : 'Good'}
          valueClass={monologueColor}
        />
        <MetricCard
          label="Longest Speech"
          value={`${metrics.longest_monologue_words}w`}
          note={metrics.longest_monologue_words > 80 ? 'Break it up' : 'Fine'}
          valueClass={metrics.longest_monologue_words > 80 ? 'text-red-600' : 'text-emerald-700'}
        />
        {metrics.avg_response_time_ms != null && (
          <MetricCard
            label="Avg Response Time"
            value={`${(metrics.avg_response_time_ms / 1000).toFixed(1)}s`}
            note="After persona speaks"
            valueClass="text-slate-700"
          />
        )}
      </div>
      {topFillers && (
        <p className="text-xs text-slate-500">
          Most used fillers: {topFillers}
        </p>
      )}
    </div>
  )
}

function MetricCard({ label, value, note, valueClass }: {
  label: string; value: string; note: string; valueClass?: string
}) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${valueClass ?? 'text-slate-900'}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{note}</p>
    </div>
  )
}

// ---------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------

function CategoryRow({ category }: { category: EvaluationCategory }) {
  const pct = (category.score / category.max) * 100
  const barColor = category.score >= 8 ? 'bg-emerald-500' : category.score >= 5 ? 'bg-amber-400' : 'bg-red-500'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-slate-800">{category.name}</span>
        <span className="text-sm text-slate-500 tabular-nums">{category.score} / {category.max}</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {category.evidence && (
        <p className="text-xs text-slate-500 mb-0.5"><span className="font-medium">Evidence:</span> {category.evidence}</p>
      )}
      {category.coaching && (
        <p className="text-xs text-slate-400 italic"><span className="not-italic font-medium text-slate-500">Coaching:</span> {category.coaching}</p>
      )}
    </div>
  )
}

function FeedbackColumn({ title, items, iconClass, iconPath }: {
  title: string; items: string[]; iconClass: string; iconPath: string
}) {
  return (
    <div className="card">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 italic">None noted.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                className={`w-4 h-4 shrink-0 mt-0.5 ${iconClass}`}>
                <path fillRule="evenodd" d={iconPath} clipRule="evenodd" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
      className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
  )
}
