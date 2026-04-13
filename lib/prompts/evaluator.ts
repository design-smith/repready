import type { Simulation, TranscriptTurn, PersonaState } from '@/types'

export const EVALUATOR_SYSTEM_MESSAGE = `You are a rigorous sales training evaluator. You receive a call transcript and a scoring rubric.
Score the rep ONLY on evidence present in the transcript. Do not infer intent or give benefit of the doubt.
If a behavior did not happen, it gets a low score — do not reward effort or assume it occurred off-transcript.
Return ONLY valid JSON. No explanation, no markdown, no preamble.`

export function buildEvaluatorPrompt(
  simulation: Simulation,
  transcript: TranscriptTurn[],
  finalPersonaState: PersonaState
): string {
  const transcriptText = transcript
    .map((t) => `[${t.speaker.toUpperCase()}]: ${t.content}`)
    .join('\n')

  const rubricJson = JSON.stringify(simulation.scoring_rubric, null, 2)

  const weightedFormulaExample = simulation.scoring_rubric
    .map((c) => `(score_for_"${c.name}" / 10) × ${c.weight}`)
    .join(' + ')

  const totalWeight = simulation.scoring_rubric.reduce((sum, c) => sum + c.weight, 0)

  return `SIMULATION CONTEXT
Title: ${simulation.title}
Persona: ${simulation.persona_name}, ${simulation.persona_role}
Company context: ${simulation.company_context}
Call goal for rep: ${simulation.call_goal}
Success criteria: ${simulation.success_criteria}
Difficulty: ${simulation.difficulty}

SCORING RUBRIC
${rubricJson}

HIDDEN OBJECTIONS (for evaluator context only — rep was not told these):
${simulation.hidden_objections.join('\n')}

CALL TRANSCRIPT
${transcriptText}

FINAL PERSONA STATE
${JSON.stringify(finalPersonaState, null, 2)}

SCORING INSTRUCTIONS
Score each rubric category from 0–10.

The overall_score is computed using this exact formula (result scaled to 0–100):
  overall_score = round( (${weightedFormulaExample}) / ${totalWeight} × 100 )

For passed: true if overall_score >= 70 AND the success criteria were meaningfully met based on the transcript.

For each category provide:
  - score: integer 0–10
  - evidence: quote or paraphrase the specific transcript moment that drove this score. If no evidence exists, say "No relevant behavior observed."
  - coaching: one concrete, actionable recommendation the rep can apply next time.

For strengths: 2–4 specific behaviors the rep demonstrated well.
For mistakes: 2–4 specific things the rep did that hurt their performance.
For missed_opportunities: 1–3 things the rep could have done but didn't.
For summary: 2–3 sentences summarizing overall performance.

Return this exact JSON shape (no markdown, no explanation — raw JSON only):
{
  "overall_score": number,
  "passed": boolean,
  "category_scores": [
    {
      "name": string,
      "score": number,
      "max": 10,
      "weight": number,
      "evidence": string,
      "coaching": string
    }
  ],
  "strengths": string[],
  "mistakes": string[],
  "missed_opportunities": string[],
  "summary": string
}`
}
