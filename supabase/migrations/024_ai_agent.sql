-- ============================================================
-- 024_ai_agent.sql — AI sales agent: enable flag + audit log
--
-- First migration of the WhatsWise AI layer (ClickUp 869dmvpgp).
-- The agent is a third inbound engine alongside flows and
-- automations; this migration gives it:
--
--   1. `accounts.ai_enabled` — per-account opt-in. Default FALSE
--      so existing accounts are untouched; the conversational
--      onboarding (Phase 1) will flip it at the end of setup.
--      Lives on `accounts` (not profiles) because the agent is
--      an account-level capability, like the WhatsApp number.
--
--   2. `ai_agent_logs` — append-only audit of every agent turn.
--      One row per inbound message the agent handled (or skipped/
--      failed on). This table is load-bearing for three roadmap
--      items, so the columns are deliberately complete from day 1:
--        - Guardrails audit (869dmvpwr): what the model said & did
--        - Cost tracking (<$0.02/conversation target): model +
--          token counts per turn
--        - Pilot instrumentation (869dmvq49): containment &
--          escalation metrics derive from status/escalated
--
--      `meta_message_id` is UNIQUE — Meta redelivers webhooks, and
--      the engine claims a message by inserting the log row FIRST
--      (status='processing'); the second delivery hits 23505 and
--      exits. Same idempotency pattern as flow_runs' partial
--      unique index (migration 010).
--
-- RLS mirrors automation_logs: members read their account's rows;
-- writes happen exclusively through the service-role engine.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Per-account enable flag
-- ------------------------------------------------------------
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ------------------------------------------------------------
-- 2. ai_agent_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_agent_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- SET NULL (not CASCADE): the audit trail must survive contact /
  -- conversation deletion, same rationale as migration 004.
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  -- Meta's id for the inbound message this turn responded to.
  -- UNIQUE = webhook-redelivery idempotency key (see header).
  meta_message_id TEXT NOT NULL UNIQUE,
  -- Model actually used for the turn (router may escalate), e.g.
  -- 'claude-haiku-4-5-20251001'. NULL while status='processing'
  -- or when the turn was skipped before any model call.
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  -- Lifecycle:
  --   processing — row claimed, model call in flight
  --   replied    — reply sent to the customer
  --   skipped    — agent declined the turn (disabled, no text, …)
  --   failed     — model call or send threw; error_message set
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'replied', 'skipped', 'failed')),
  -- What the customer said and what the agent answered — the raw
  -- material for the eval set (869dmvpke) and the owner-facing
  -- "what the AI did" view (869dmvpwr).
  inbound_text TEXT,
  reply_text TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dashboard + cost queries: "this account's turns, newest first".
CREATE INDEX IF NOT EXISTS idx_ai_agent_logs_account_created
  ON ai_agent_logs(account_id, created_at DESC);

-- Conversation timeline view joins on this.
CREATE INDEX IF NOT EXISTS idx_ai_agent_logs_conversation
  ON ai_agent_logs(conversation_id)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE ai_agent_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_agent_logs_select ON ai_agent_logs;
CREATE POLICY ai_agent_logs_select ON ai_agent_logs FOR SELECT
  USING (is_account_member(account_id));
-- No INSERT/UPDATE/DELETE policies: the engine writes through the
-- service-role client (RLS bypass), clients never write — mirrors
-- automation_pending_executions.
