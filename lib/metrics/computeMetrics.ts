import type { TranscriptTurn, SessionMetrics } from '@/types'

const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'basically', 'literally', 'right', 'so']

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function computeSessionMetrics(
  transcript: TranscriptTurn[],
  durationSeconds: number
): Omit<SessionMetrics, 'id' | 'session_id' | 'created_at'> {
  const repTurns = transcript.filter((t) => t.speaker === 'rep')
  const personaTurns = transcript.filter((t) => t.speaker === 'persona')

  const repTurnCount = repTurns.length
  const personaTurnCount = personaTurns.length

  // Word counts
  const totalWords = transcript.reduce((sum, t) => sum + wordCount(t.content), 0)
  const repWords = repTurns.reduce((sum, t) => sum + wordCount(t.content), 0)

  const talkRatio = totalWords > 0 ? repWords / totalWords : 0
  const avgRepTurnLength = repTurnCount > 0 ? Math.round(repWords / repTurnCount) : 0

  const longestMonologueWords = repTurns.reduce(
    (max, t) => Math.max(max, wordCount(t.content)),
    0
  )

  // Filler words — case-insensitive scan
  const fillerWordsFound: Record<string, number> = {}
  let fillerWordCount = 0
  for (const turn of repTurns) {
    const lower = turn.content.toLowerCase()
    for (const filler of FILLER_WORDS) {
      // word-boundary-aware match
      const regex = new RegExp(`\\b${filler.replace(/\s+/g, '\\s+')}\\b`, 'gi')
      const matches = lower.match(regex)
      if (matches && matches.length > 0) {
        fillerWordsFound[filler] = (fillerWordsFound[filler] ?? 0) + matches.length
        fillerWordCount += matches.length
      }
    }
  }

  // Questions: rep turns ending in ?
  const questionCount = repTurns.filter((t) => t.content.trim().endsWith('?')).length

  // Avg response time: time between end of persona turn and start of next rep turn
  // Use created_at timestamps as proxy
  let avgResponseTimeMs: number | null = null
  const responseTimes: number[] = []

  for (let i = 0; i < transcript.length - 1; i++) {
    const cur = transcript[i]
    const next = transcript[i + 1]
    if (cur.speaker === 'persona' && next.speaker === 'rep') {
      const diff =
        new Date(next.created_at).getTime() - new Date(cur.created_at).getTime()
      if (diff > 0 && diff < 60000) {
        // Ignore gaps > 60s (likely pauses / page loads)
        responseTimes.push(diff)
      }
    }
  }

  if (responseTimes.length > 0) {
    avgResponseTimeMs = Math.round(
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    )
  }

  return {
    talk_ratio: Math.round(talkRatio * 1000) / 1000,
    avg_response_time_ms: avgResponseTimeMs,
    rep_turn_count: repTurnCount,
    persona_turn_count: personaTurnCount,
    avg_rep_turn_length: avgRepTurnLength,
    filler_word_count: fillerWordCount,
    filler_words_found: fillerWordsFound,
    longest_monologue_words: longestMonologueWords,
    question_count: questionCount,
  }
}
