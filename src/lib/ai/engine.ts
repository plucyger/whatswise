// ------------------------------------------------------------
// AI sales agent — inbound engine (v1 scaffold).
//
// Third engine in the webhook's dispatch chain:
//
//   dispatchInboundToFlows()        — authored bot journeys win first
//   └─ dispatchInboundToAIAgent()   — THIS: free-form AI selling
//      └─ runAutomationsForTrigger() — content triggers only if
//                                      neither engine consumed
//
// Same { consumed } contract as flows so the webhook stays uniform.
// This function NEVER throws — a broken AI layer must not break
// message ingestion. Every failure path returns consumed:false so
// automations still get their shot.
//
// v1 scope (ClickUp 869dmvpgp): text in → routed Claude call with
// prompt caching → text reply → full audit row. Tools, RAG, and
// escalation rules arrive in 869dmvpjh / 869dmvphg / 869dmvptf and
// plug into the marked extension points below.
// ------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk'
import { engineSendText } from '@/lib/flows/meta-send'
import { supabaseAdmin } from './admin-client'
import { chooseModel } from './router'
import { buildSystemPrompt, STATIC_SYSTEM_PROMPT } from './prompt'
import type {
  ConversationTurn,
  DispatchToAIAgentInput,
  DispatchToAIAgentResult,
} from './types'

/** Turns of history handed to the model. Enough to follow a sale,
 *  small enough to keep the per-turn token bill predictable. The
 *  rolling-summary upgrade (longer memory, same cost) is part of
 *  the RAG ticket. */
const HISTORY_TURNS = 10

/** Hard ceiling on reply length — WhatsApp selling is short-form,
 *  and this caps the output-token spend per turn. */
const MAX_REPLY_TOKENS = 300

// Lazy singleton, same pattern as the admin client: constructing it
// at module load would crash builds on machines without the key.
let _anthropic: Anthropic | null = null
function anthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  }
  return _anthropic
}

/**
 * Handle one inbound customer message with the AI agent.
 *
 * Order of the guard clauses matters: the cheap, no-side-effect
 * checks (key, flag, empty text) run before the idempotency INSERT
 * so disabled accounts never accumulate log rows.
 */
export async function dispatchInboundToAIAgent(
  input: DispatchToAIAgentInput,
): Promise<DispatchToAIAgentResult> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return { consumed: false, reason: 'no_api_key' }
    }

    const text = input.message.text.trim()
    if (!text) return { consumed: false, reason: 'empty_message' }

    const db = supabaseAdmin()

    const { data: account } = await db
      .from('accounts')
      .select('id, name, ai_enabled')
      .eq('id', input.accountId)
      .maybeSingle()
    if (!account?.ai_enabled) {
      return { consumed: false, reason: 'disabled' }
    }

    // -- Idempotency claim ------------------------------------
    // Meta redelivers webhooks; the UNIQUE(meta_message_id) makes the
    // second delivery's INSERT fail with 23505 and we bail without a
    // second model call or duplicate reply (same pattern as the flows
    // engine's one-active-run index).
    const { data: logRow, error: claimErr } = await db
      .from('ai_agent_logs')
      .insert({
        account_id: input.accountId,
        contact_id: input.contactId,
        conversation_id: input.conversationId,
        meta_message_id: input.message.meta_message_id,
        inbound_text: text,
        status: 'processing',
      })
      .select('id')
      .single()
    if (claimErr || !logRow) {
      return { consumed: false, reason: 'duplicate' }
    }

    // -- Conversation memory ----------------------------------
    // Newest-first fetch then reverse: cheapest way to get "the last
    // N turns in chronological order". The inbound message itself is
    // already persisted by the webhook, so it is excluded here and
    // appended as the final user turn instead.
    const { data: recent } = await db
      .from('messages')
      .select('sender_type, content_text, message_id')
      .eq('conversation_id', input.conversationId)
      .not('content_text', 'is', null)
      .neq('message_id', input.message.meta_message_id)
      .order('created_at', { ascending: false })
      .limit(HISTORY_TURNS)

    const history: ConversationTurn[] = (recent ?? [])
      .reverse()
      .map((m) => ({
        role: m.sender_type === 'customer' ? ('user' as const) : ('assistant' as const),
        content: m.content_text as string,
      }))

    // -- Model call -------------------------------------------
    const model = chooseModel(text, history)
    const started = Date.now()

    // System prompt is split for caching: the static block (identical
    // across all tenants) carries cache_control so Anthropic reuses it;
    // only the small per-account suffix is uncached.
    const accountSuffix = buildSystemPrompt({ businessName: account.name }).slice(
      STATIC_SYSTEM_PROMPT.length,
    )

    const response = await anthropic().messages.create({
      model,
      max_tokens: MAX_REPLY_TOKENS,
      system: [
        { type: 'text', text: STATIC_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: accountSuffix },
      ],
      // EXTENSION POINT (869dmvpjh): tools — lookup_product,
      // create_order, tag_lead, schedule_followup — slot in here,
      // turning this single call into a tool-use loop.
      messages: [...history, { role: 'user' as const, content: text }],
    })

    const latencyMs = Date.now() - started
    const reply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim()

    if (!reply) {
      await db
        .from('ai_agent_logs')
        .update({ status: 'skipped', model, latency_ms: latencyMs })
        .eq('id', logRow.id)
      return { consumed: false, reason: 'error' }
    }

    // -- Send + audit -----------------------------------------
    // engineSendText handles phone-variant retry, the messages-table
    // insert (sender_type='bot'), and the conversation preview update —
    // identical surface to a flows send, so the inbox renders AI
    // replies with the existing bot affordance.
    await engineSendText({
      accountId: input.accountId,
      userId: input.userId,
      conversationId: input.conversationId,
      contactId: input.contactId,
      text: reply,
    })

    await db
      .from('ai_agent_logs')
      .update({
        status: 'replied',
        model,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        latency_ms: latencyMs,
        reply_text: reply,
      })
      .eq('id', logRow.id)

    // EXTENSION POINT (869dmvptf): escalation rules evaluate the turn
    // here — attempt counts, keywords, sentiment — and may pause the
    // agent + fire the owner ping even though we replied.

    return { consumed: true }
  } catch (err) {
    // Never let the AI layer break ingestion. Best-effort failure
    // audit; if even that fails we still return cleanly.
    console.error('[ai-agent] dispatch failed:', err)
    try {
      await supabaseAdmin()
        .from('ai_agent_logs')
        .update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq('meta_message_id', input.message.meta_message_id)
        .eq('status', 'processing')
    } catch {
      /* swallow — audit is best-effort on the failure path */
    }
    return { consumed: false, reason: 'error' }
  }
}
