// ------------------------------------------------------------
// AI sales agent — shared types.
//
// The agent is the third inbound engine (flows → AI → automations)
// and follows the same input/consumed contract as
// src/lib/flows/types.ts so the webhook treats all engines
// uniformly.
// ------------------------------------------------------------

/** Inbound payload handed to the agent by the webhook. v1 handles
 *  text only; interactive replies belong to the flows engine and
 *  media understanding (voice notes) is a later roadmap item. */
export interface AIAgentInboundMessage {
  text: string
  /** Meta's message id — the idempotency key for the turn. */
  meta_message_id: string
}

export interface DispatchToAIAgentInput {
  accountId: string
  /** Owner of the whatsapp_config row — audit identity for sends,
   *  never used for tenancy (same convention as flows). */
  userId: string
  contactId: string
  conversationId: string
  message: AIAgentInboundMessage
}

export type AIAgentSkipReason =
  | 'disabled' // accounts.ai_enabled is false
  | 'no_api_key' // ANTHROPIC_API_KEY not configured on the deployment
  | 'empty_message' // nothing to respond to (media-only, etc.)
  | 'duplicate' // webhook redelivery — another turn already claimed this id
  | 'error' // model call / send failed (logged with error_message)

export interface DispatchToAIAgentResult {
  /** True when the agent replied — the webhook then suppresses the
   *  content-level automation triggers, exactly like a consumed flow. */
  consumed: boolean
  reason?: AIAgentSkipReason
}

/** One prior turn handed to the model as conversation memory. */
export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}
