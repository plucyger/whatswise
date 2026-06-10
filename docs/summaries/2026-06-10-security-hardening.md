# Summary: Phase 0 Security Hardening

**Date:** 10 June 2026 · **ClickUp:** [869dmvp6f](https://app.clickup.com/t/869dmvp6f) · **Branch:** `feat/phase0-security-hardening`

## What changed

New migration [023_security_hardening.sql](../../supabase/migrations/023_security_hardening.sql), already applied to the live Supabase project (`ijsqolpjbkxgmqkclbwl`).

Postgres grants EXECUTE to everyone by default on new functions, and Supabase exposes `public` functions over PostgREST at `/rest/v1/rpc/<name>`. The security advisor flagged 16 warnings: every internal SECURITY DEFINER function was one HTTP call away for any visitor or signed-in user. Worst case: `_bcast_bump` would have let any logged-in user corrupt any account's broadcast counters.

### Locked down (EXECUTE revoked from `anon` + `authenticated`)
| Function | Why it was dangerous |
|---|---|
| `_bcast_bump` | Arbitrary ±1 writes to broadcast counters across tenants |
| `recompute_broadcast_counts` | Cross-tenant counter rewrites (now service-role only) |
| `merge_duplicate_contacts` | RLS-bypassing data surgery (now service-role only) |
| `_bcast_cols_for_status`, trigger fns (`broadcast_recipient_aggregate_trigger`, `update_updated_at_column`, `handle_new_user`) | No client use case; minimized surface |

### Deliberately left exposed (no change)
`is_account_member` (RLS policies need it), `peek_invitation` (anon join page), `redeem_invitation`, `set_member_role`, `remove_account_member`, `transfer_account_ownership` — each self-authorizes via `auth.uid()` checks in its body. The advisor still lists these; that's expected and documented in the migration header.

### Also fixed
Pinned `search_path` on `update_updated_at_column` and `_bcast_cols_for_status` (advisor lint 0011, search-path hijack hardening).

## Verification
Re-ran the Supabase security advisor after applying: all 16 internal-function warnings cleared. Remaining items are by-design (self-authorizing RPCs, public media buckets) plus two follow-ups below.

## Follow-ups (not in this change)
- **Enable leaked-password protection** — dashboard toggle: Auth → Providers → Password (advisor warns it's off)
- Redis (Upstash) rate limiter to replace the in-memory one — needs an Upstash account/credentials (rest of ticket 869dmvp6f)
- Public bucket listing policies could be narrowed if we ever store sensitive media

## How to follow along
- Read the migration file — its header comments carry the full triage rationale
- Pattern to copy for future functions: **every new function gets explicit `REVOKE ... FROM PUBLIC, anon, authenticated` plus a deliberate `GRANT`** (see migrations 007/012 which did this correctly from day one)
