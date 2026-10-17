-- ============================================================
-- 023_security_hardening
--
-- Lock down internal helper functions: revoke EXECUTE from PUBLIC,
-- anon and authenticated, grant only what service_role needs, and
-- pin search_path on two functions flagged by the Supabase advisor.
--
-- Applied to the production Supabase project as migration
-- 20260610170104_security_hardening; copied here verbatim so a
-- fresh database set up from this repo matches production.
-- ============================================================

REVOKE ALL ON FUNCTION public._bcast_bump(UUID, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._bcast_cols_for_status(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_broadcast_counts(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_recipient_aggregate_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.merge_duplicate_contacts() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.recompute_broadcast_counts(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_duplicate_contacts() TO service_role;

ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public._bcast_cols_for_status(TEXT) SET search_path = public;
