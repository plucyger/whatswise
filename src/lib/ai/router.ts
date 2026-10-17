// ------------------------------------------------------------
// Model routing — pick the cheapest model that can handle the turn.
//
// Cost target is <$0.02 per conversation (see docs/EXECUTION-PLAN.md),
// which means Haiku must carry ~90% of turns and Sonnet is reserved
// for the hard ones. v1 routing is a deliberately dumb, fully
// unit-testable heuristic; the eval harness (ClickUp 869dmvpke) is
// what will tell us where it misroutes, and this is the one place
// to fix it when it does.
// ------------------------------------------------------------

import type { ConversationTurn } from './types'

/** Workhorse — fast + cheap, handles greetings, price questions,
 *  availability checks, simple back-and-forth. */
export const CHEAP_MODEL = process.env.AI_AGENT_CHEAP_MODEL ?? 'claude-haiku-4-5-20251001'

/** Escalation model for turns that need real reasoning: objection
 *  handling, multi-item negotiations, ambiguous asks. */
export const SMART_MODEL = process.env.AI_AGENT_SMART_MODEL ?? 'claude-sonnet-4-6'

/** Signals that the customer is past small talk and into territory
 *  where a weak answer loses the sale. Mixed EN/Swahili on purpose —
 *  these are the phrases that show up in real Kenyan WhatsApp selling
 *  ("bei ya mwisho" = final price, "punguza" = lower it, "si uniambie"
 *  = come on, tell me…). Extend via evals, not gut feel.
 */
const ESCALATION_PATTERNS: RegExp[] = [
  /\b(discount|punguz\w*|bei ya mwisho|last price|final price|ofa)\b/i,
  /\b(refund|return|complaint|fraud|con\b|scam|mwizi)\b/i,
  /\b(deliver\w*|shipping|ufikish\w*|mtaani|location yenu)\b/i, // logistics negotiation
  /\b(compare|tofauti|difference|which (one|is) better)\b/i,
  /\?[\s\S]*\?/, // multiple questions in one message (dotAll-free for the es2017 target)
]

/** Long messages tend to carry context-heavy asks (stories, multi-part
 *  requirements) that the cheap model handles worse. */
const LONG_MESSAGE_CHARS = 280

/** A long thread means accumulated context the model must actually
 *  track — escalate rather than let the cheap model lose the plot. */
const LONG_HISTORY_TURNS = 12

/**
 * Choose the model for this turn. Pure function — no IO — so the
 * routing policy is trivially testable and diffable in review.
 */
export function chooseModel(inboundText: string, history: ConversationTurn[]): string {
  if (inboundText.length > LONG_MESSAGE_CHARS) return SMART_MODEL
  if (history.length > LONG_HISTORY_TURNS) return SMART_MODEL
  if (ESCALATION_PATTERNS.some((p) => p.test(inboundText))) return SMART_MODEL
  return CHEAP_MODEL
}
