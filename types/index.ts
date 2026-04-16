export type Role = 'admin' | 'trainer' | 'rep'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type PersonaVoice =
  | 'alloy'
  | 'ash'
  | 'ballad'
  | 'cedar'
  | 'coral'
  | 'echo'
  | 'marin'
  | 'sage'
  | 'shimmer'
  | 'verse'

export interface Profile {
  id: string
  email: string
  role: Role
  full_name: string | null
  created_at: string
  updated_at: string
}

export interface RubricCategory {
  name: string
  weight: number
  description: string
}

export interface Simulation {
  id: string
  title: string
  difficulty: Difficulty
  call_goal: string
  persona_name: string
  persona_role: string
  persona_voice: PersonaVoice
  persona_style: string
  company_context: string
  opening_line: string
  hidden_objections: string[]
  allowed_disclosures: string[]
  forbidden_disclosures: string[]
  success_criteria: string
  scoring_rubric: RubricCategory[]
  is_active: boolean
  version: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SimulationVersion {
  id: string
  simulation_id: string
  version: number
  snapshot: Simulation
  created_by: string | null
  created_at: string
}

export interface SimulationWithVersions extends Simulation {
  simulation_versions: SimulationVersion[]
}

export interface ApiError {
  error: string
  code: string
}

export type SimulationFormData = Omit<
  Simulation,
  'id' | 'version' | 'created_by' | 'created_at' | 'updated_at'
>

// ---------------------------------------------------------------
// Phase 2 — Session & voice call types
// ---------------------------------------------------------------

export type SessionStatus = 'pending' | 'active' | 'ended' | 'evaluated'
export type Speaker = 'rep' | 'persona'

export interface PersonaState {
  trust: number                  // 0–1: how much the persona trusts the rep
  patience: number               // 0–1: 0 means ready to end the call
  pain_discovered: boolean       // true once rep has uncovered a real pain point
  objections_raised: string[]    // objections the persona has already surfaced
  meeting_requested: boolean     // true once rep has asked for a next step/meeting
  conversation_stage: 'opening' | 'discovery' | 'objection' | 'closing' | 'ended'
}

export const defaultPersonaState: PersonaState = {
  trust: 0.3,
  patience: 0.7,
  pain_discovered: false,
  objections_raised: [],
  meeting_requested: false,
  conversation_stage: 'opening',
}

export interface TranscriptTurn {
  id: string
  session_id: string
  turn_number: number
  speaker: Speaker
  content: string
  persona_state_after?: PersonaState
  created_at: string
}

export interface Session {
  id: string
  simulation_id: string
  simulation_version: number
  rep_id: string
  status: SessionStatus
  openai_session_id?: string
  persona_state: PersonaState
  started_at?: string
  ended_at?: string
  created_at: string
  updated_at: string
}

export interface SessionWithTranscript extends Session {
  transcript_turns: TranscriptTurn[]
}

// ---------------------------------------------------------------
// Phase 3 — Evaluation types
// ---------------------------------------------------------------

export interface EvaluationCategory {
  name: string      // matches RubricCategory.name from the simulation
  score: number     // 0–10
  max: number       // always 10
  weight: number    // from rubric — used for weighted overall score
  evidence: string  // specific transcript evidence for this score
  coaching: string  // one concrete coaching recommendation
}

export interface Evaluation {
  id: string
  session_id: string
  overall_score: number           // 0–100, weighted average across categories
  passed: boolean
  category_scores: EvaluationCategory[]
  strengths: string[]             // 2–4 items
  mistakes: string[]              // 2–4 items
  missed_opportunities: string[]  // 1–3 items
  summary: string                 // 2–3 sentence paragraph
  evaluated_at: string
  evaluator_model: string
}

// ---------------------------------------------------------------
// Phase 4 — Coaching hints, annotations, metrics, templates
// ---------------------------------------------------------------

export type HintType = 'tip' | 'warning' | 'encouragement'

export interface CoachingHint {
  id: string
  session_id: string
  turn_number: number
  hint: string
  hint_type: HintType
  created_at: string
}

export interface SessionAnnotation {
  id: string
  session_id: string
  annotator_id: string
  annotator_name?: string
  turn_number?: number
  content: string
  created_at: string
  updated_at: string
}

export interface SessionMetrics {
  id: string
  session_id: string
  talk_ratio: number
  avg_response_time_ms: number | null
  rep_turn_count: number
  persona_turn_count: number
  avg_rep_turn_length: number
  filler_word_count: number
  filler_words_found: Record<string, number>
  longest_monologue_words: number
  question_count: number
  created_at: string
}

export interface SimulationTemplate {
  id: string
  title: string
  description: string
  category: string
  snapshot: SimulationFormData
  created_at: string
}
