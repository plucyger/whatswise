-- ============================================================
-- 024_ai_agent
--
-- AI agent: per-account `ai_enabled` flag plus an `ai_agent_logs`
-- table (one row per inbound message handled), readable by account
-- members via RLS.
--
-- Applied to the production Supabase project as migration
-- 20260610170342_ai_agent; copied here verbatim so a fresh
-- database set up from this repo matches production.
-- ============================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS ai_agent_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  meta_message_id TEXT NOT NULL UNIQUE,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'replied', 'skipped', 'failed')),
  inbound_text TEXT,
  reply_text TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_logs_account_created
  ON ai_agent_logs(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_agent_logs_conversation
  ON ai_agent_logs(conversation_id)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE ai_agent_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_agent_logs_select ON ai_agent_logs;
CREATE POLICY ai_agent_logs_select ON ai_agent_logs FOR SELECT
  USING (is_account_member(account_id));
