import type { PersonaState, Speaker } from '@/types'

/**
 * Builds the user-turn content for the GPT-4o-mini JSON-mode call that
 * updates persona state AND generates a coaching hint after each rep utterance.
 *
 * Pure function — no side effects.
 */
export function buildStateUpdatePrompt(
  currentState: PersonaState,
  repUtterance: string,
  recentHistory: { speaker: Speaker; content: string }[]
): string {
  const historyText =
    recentHistory.length > 0
      ? recentHistory
          .map((t) => `${t.speaker.toUpperCase()}: ${t.content}`)
          .join('\n')
      : '(no prior conversation)'

  return `
You are tracking the internal state of a simulated sales prospect during a training call.

CURRENT STATE:
${JSON.stringify(currentState, null, 2)}

RECENT CONVERSATION (oldest first):
${historyText}

REP JUST SAID:
"${repUtterance}"

Update the state based on what the rep just said. Apply these rules:
- Good open-ended discovery question (e.g. "What does your current process look like?") → increase trust by 0.05–0.10
- Feature pitch or product mention before pain is discovered → decrease trust by 0.08, decrease patience by 0.05
- Rep talks excessively without asking a question → decrease patience by 0.05
- Rep interrupted or dismissed the persona → decrease patience by 0.10
- Rep acknowledged an objection with empathy before responding → increase trust by 0.05
- Rep asked for a meeting, next step, or calendar → set meeting_requested to true
- Rep uncovered or the persona revealed a genuine pain point → set pain_discovered to true
- Rep asked a yes/no closed question → no trust change
- Patience naturally decreases by 0.02 per turn regardless of rep quality
- Update conversation_stage if appropriate (opening → discovery → objection → closing → ended)
- Clamp trust and patience to [0, 1]

COACHING HINT (for rep only, not visible to persona):
After evaluating the rep's utterance, optionally generate a short coaching hint (max 12 words).
Return null for both fields if the rep performed well and needs no adjustment.
Return "warning" if the rep pitched too early, used excessive filler words, or missed an obvious discovery opportunity.
Return "tip" if there is a clear next move the rep should consider.
Return "encouragement" if the rep just did something noticeably well.
Examples:
  warning: "You pitched before discovering their pain."
  tip: "Ask about their current vendor experience."
  encouragement: "Good — you uncovered a real frustration."

Return ONLY a valid JSON object matching this exact shape. No explanation, no markdown fences:
{
  "trust": <number 0–1>,
  "patience": <number 0–1>,
  "pain_discovered": <boolean>,
  "objections_raised": <string[]>,
  "meeting_requested": <boolean>,
  "conversation_stage": "opening" | "discovery" | "objection" | "closing" | "ended",
  "coaching_hint": {
    "hint": <string | null>,
    "hint_type": "tip" | "warning" | "encouragement" | null
  }
}
`.trim()
}

/**
 * System message used alongside buildStateUpdatePrompt in the GPT-4o-mini call.
 */
export const STATE_UPDATE_SYSTEM_MESSAGE =
  'You are a precise JSON state-tracker and sales coach. Given a sales prospect\'s current internal state ' +
  'and the rep\'s latest utterance, return an updated PersonaState JSON object with an optional coaching hint. ' +
  'Follow the rules exactly. Return only the JSON — no explanation, no markdown.'
