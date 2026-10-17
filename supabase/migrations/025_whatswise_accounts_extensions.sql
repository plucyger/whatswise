-- ============================================================
-- 025_whatswise_accounts_extensions
--
-- Extend `accounts` with subscription billing, M-Pesa integration,
-- owner contact and AI agent settings, and make KES the default
-- account currency.
--
-- Applied to the production Supabase project as migration
-- 20260628105123_whatswise_accounts_extensions; copied here verbatim
-- so a fresh database set up from this repo matches production.
-- ============================================================


-- WhatsWise: extend accounts table with billing, M-Pesa, and operational fields

-- Fix currency default to KES
ALTER TABLE public.accounts
  ALTER COLUMN default_currency SET DEFAULT 'KES';

-- Subscription billing
ALTER TABLE public.accounts
  ADD COLUMN subscription_tier text NOT NULL DEFAULT 'mwanzo'
    CHECK (subscription_tier IN ('mwanzo', 'biashara', 'kampuni')),
  ADD COLUMN subscription_status text NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled')),
  ADD COLUMN trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  ADD COLUMN subscription_started_at timestamptz,
  ADD COLUMN next_billing_at timestamptz;

-- M-Pesa integration (aggregator path first: Kopo Kopo / IntaSend)
-- Secrets stored AES-256-GCM encrypted at app layer before insert
ALTER TABLE public.accounts
  ADD COLUMN mpesa_shortcode text,
  ADD COLUMN mpesa_consumer_key_enc text,
  ADD COLUMN mpesa_consumer_secret_enc text,
  ADD COLUMN mpesa_passkey_enc text,
  ADD COLUMN mpesa_aggregator text
    CHECK (mpesa_aggregator IN ('kopokopo', 'intasend', 'daraja') OR mpesa_aggregator IS NULL);

-- Owner contact for escalation pings and billing receipts
ALTER TABLE public.accounts
  ADD COLUMN owner_phone text,
  ADD COLUMN owner_whatsapp_opted_in boolean NOT NULL DEFAULT false;

-- AI agent settings (extends existing ai_enabled flag)
ALTER TABLE public.accounts
  ADD COLUMN ai_language text NOT NULL DEFAULT 'auto'
    CHECK (ai_language IN ('auto', 'en', 'sw', 'sheng')),
  ADD COLUMN ai_escalation_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN ai_max_attempts_before_escalate integer NOT NULL DEFAULT 2;

-- Useful index for billing jobs
CREATE INDEX IF NOT EXISTS accounts_next_billing_at_idx
  ON public.accounts (next_billing_at)
  WHERE subscription_status = 'active';

-- Comment for future devs
COMMENT ON COLUMN public.accounts.mpesa_consumer_key_enc IS 'AES-256-GCM encrypted at app layer. Never store plaintext.';
COMMENT ON COLUMN public.accounts.mpesa_consumer_secret_enc IS 'AES-256-GCM encrypted at app layer. Never store plaintext.';
COMMENT ON COLUMN public.accounts.mpesa_passkey_enc IS 'AES-256-GCM encrypted at app layer. Never store plaintext.';
