-- ============================================================
-- 023_security_hardening.sql — lock down internal functions
--
-- Supabase's security advisor (run 2026-06-10 against a fresh
-- deployment) flagged every SECURITY DEFINER function in `public`
-- as callable by `anon` / `authenticated` via PostgREST
-- (/rest/v1/rpc/<fn>). Postgres grants EXECUTE to PUBLIC by
-- default on new functions, so anything we don't explicitly
-- revoke is one HTTP call away.
--
-- Triage of the flagged functions:
--
--   INTERNAL — must never be client-callable. Revoked here:
--     _bcast_bump                         (broadcast counter delta;
--                                          would let any signed-in
--                                          user corrupt any
--                                          broadcast's counts)
--     _bcast_cols_for_status              (helper, harmless but
--                                          no reason to expose)
--     recompute_broadcast_counts          (ops safety net; service
--                                          role / SQL editor only)
--     broadcast_recipient_aggregate_trigger (trigger fn)
--     update_updated_at_column            (trigger fn)
--     handle_new_user                     (auth trigger fn)
--     merge_duplicate_contacts            (one-time data surgery;
--                                          SECURITY DEFINER bypasses
--                                          RLS — service role only)
--
--   INTENTIONALLY EXPOSED — self-authorizing via auth.uid()
--   checks in their bodies; grants stay as shipped:
--     is_account_member       (RLS policies need authenticated)
--     peek_invitation         (anon — the /join/<token> page)
--     redeem_invitation       (authenticated)
--     set_member_role / remove_account_member /
--     transfer_account_ownership (authenticated; RPC self-checks)
--
-- Also fixes the two "role mutable search_path" warnings by
-- pinning search_path on the functions that lacked it.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Revoke client EXECUTE on internal functions.
--    REVOKE on a grant that doesn't exist is a no-op, so this
--    block re-runs cleanly.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public._bcast_bump(UUID, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._bcast_cols_for_status(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_broadcast_counts(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_recipient_aggregate_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.merge_duplicate_contacts() FROM PUBLIC, anon, authenticated;

-- Service role keeps EXECUTE on the two functions it actually
-- calls outside trigger context (triggers run as the table owner,
-- so the trigger functions need no explicit grants at all).
GRANT EXECUTE ON FUNCTION public.recompute_broadcast_counts(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_duplicate_contacts() TO service_role;

-- ------------------------------------------------------------
-- 2. Pin search_path where it was mutable (advisor 0011).
--    ALTER FUNCTION ... SET is idempotent.
-- ------------------------------------------------------------
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public._bcast_cols_for_status(TEXT) SET search_path = public;
