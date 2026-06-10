# WhatsWise Execution Plan

**Team Digits · June 2026 · maps the [Product Brief & Roadmap] onto this codebase and the ClickUp board**

ClickUp: folder **WhatsWise — WhatsApp AI CRM** in *🟣 PROJECTS & DELIVERY*. Every item below references its ClickUp task id. No work without a ticket; tickets reference PRs.

---

## 1. Where we start from

This repo is a fork of [ArnasDon/wacrm](https://github.com/ArnasDon/wacrm) (MIT). Key finding: **wacrm is already account-multi-tenant** (migration `017_account_sharing.sql`): an `accounts` table, `account_id` + RLS on every domain table, an `is_account_member(account_id, min_role)` policy helper, and an owner/admin/agent/viewer role hierarchy (`src/lib/auth/roles.ts`, `src/lib/auth/account.ts`). The brief's "multi-tenancy first" milestone is therefore mostly hardening, not building.

Already running:
- Supabase project `ijsqolpjbkxgmqkclbwl` (eu-central-1) with all 22 migrations applied
- Local dev server wired to it (`.env.local`; service-role key still to be pasted from the dashboard)

Confirmed absent (we build these): any AI layer, products/catalog, orders, payments, billing, escalation engine, embedded signup.

## 2. Architecture: where each pillar plugs in

Inbound pipeline (`src/app/api/whatsapp/webhook/route.ts`): Meta POST → HMAC verify → tenant resolved by `phone_number_id → whatsapp_config.account_id` → contact/conversation/message rows → engine dispatch:

```
dispatchInboundToFlows()        — consumed-flag pattern (src/lib/flows/engine.ts)
└─ (NEW) dispatchInboundToAIAgent() — the AI sales agent, same { consumed } contract
   └─ runAutomationsForTrigger()    — fire-and-forget (src/lib/automations/engine.ts)
```

The AI agent is a **third engine** in that chain, reusing existing infrastructure:

| Reuse | Where |
|---|---|
| Outbound send (text, buttons, lists, templates, media) | `src/lib/whatsapp/meta-api.ts` via the `meta-send.ts` engine-client pattern |
| Token decryption (AES-256-GCM) | `src/lib/whatsapp/encryption.ts` |
| Service-role client | `src/lib/automations/admin-client.ts` pattern |
| Rate limiting | `src/lib/rate-limit.ts` (swap in-memory Map → Upstash Redis at scale) |
| Audit | new `ai_agent_logs` table mirroring `automation_logs` |
| Handoff | flows' existing `handoff` node semantics + `flow_runs.paused_by_agent` status |

New services:

- **`src/lib/ai/`** — conversation engine. System prompt assembled from `business_profile` + policies (prompt-cached); RAG over catalog via pgvector; Claude tool-use with tools `lookup_product`, `create_order`, `send_stk_push`, `escalate_to_human`, `tag_lead`, `schedule_followup`; model routing (Haiku 4.5 for ~90% of turns, Sonnet escalation); memory = last N turns + rolling summary. Target <$0.02/conversation.
- **`src/lib/payments/`** — aggregator-first M-Pesa (Kopo Kopo or IntaSend; Daraja-direct later). STK Push, idempotent callback handler at `/api/payments/callback` (M-Pesa callbacks duplicate and arrive late — idempotency keys everywhere), reconciliation against orders. Tables: `mpesa_config` (per-account, encrypted creds), `orders`, `payments`.
- **`src/lib/escalations/`** — rules engine evaluated per AI turn (attempt count, keyword list, sentiment, deal value). Ping = utility-category WhatsApp template to the owner's number with AI summary; optional SMS fallback (Africa's Talking). Tables: `escalation_rules`, `escalations`.
- **New schema**: `products` (catalog + embeddings), `business_profile` (onboarding answers → system prompt), `subscriptions` (KES billing on the same payments service).

Single-tenant residue to fix in Phase 0 (deployment-level only): webhook GET verification iterates all `whatsapp_config` rows (index by token when configs grow); shared `AUTOMATION_CRON_SECRET`; in-memory rate limiting; user-scoped storage paths; Supabase advisor warnings (revoke anon EXECUTE on internal SECURITY DEFINER functions).

## 3. Phases

### Phase 0 — Foundation (Weeks 1–2)
| Ticket | Work |
|---|---|
| `869dmvp4t` Fork + repo hygiene | Private repo under Team Digits, protected `main`, keep `upstream` remote for pulling wacrm fixes, rebrand |
| `869dmvp5n` Supabase + staging | Mostly done (project live, migrations applied). Remaining: Vercel staging, service-role key, real env vars |
| `869dmvp6f` Multi-tenancy | Re-scoped: harden existing accounts model — advisor fixes, per-account cron scoping, Redis rate limiting |
| `869dmvp7a` Per-org Meta creds + webhook routing | Routing exists; add token-indexed GET verification; test 2 orgs |
| `869dmvp82` E2E on Meta test number | Exit: two isolated orgs exchanging messages on one deployment |
| `869dmvpcw` Working agreement + docs | ADRs in `docs/decisions/`, PR review rule, CI gate |

### Phase 1 — MVP (Weeks 3–10) · Dev A = AI/product, Dev B = platform/payments
Critical path: AI scaffold → RAG → tools → in-chat payment. Eval harness starts week 3 (the Swahili/Sheng moat is built by iteration time, not at the end).

1. `869dmvpgp` AI engine scaffold (A, urgent) — `src/lib/ai/engine.ts`, webhook hook, `ai_agent_logs`, per-account enable flag
2. `869dmvphg` Knowledge base + RAG (A, urgent) — `products`/`business_profile`, pgvector migration, embedding pipeline
3. `869dmvpjh` Agent tools (A) — executors over existing contacts/deals/tags tables
4. `869dmvpke` Swahili/Sheng eval set + harness (A) — vitest eval runner over recorded conversations; runs on every prompt change
5. `869dmvpmz` M-Pesa integration (B, urgent) — aggregator client, payment tables, idempotent callbacks
6. `869dmvpnr` In-chat payment flow (A+B, urgent) — quote → confirm → STK Push → callback → receipt in conversation
7. `869dmvptf` Escalation rules engine (A)
8. `869dmvpu3` "Needs your attention" pings (B) — utility template + context; SMS fallback optional
9. `869dmvpur` Conversational onboarding + Meta embedded signup (A+B, urgent)
10. `869dmvpvv` KES subscription billing (B) — `subscriptions` + plan gating
11. `869dmvpwr` Guardrails + audit log (A) — catalog-only quoting, discount approval threshold
12. `869dmvpxk` Dashboard polish + daily WhatsApp summary (A)

**Exit:** a stranger signs up, onboards in 15 minutes, and takes a real payment through an AI conversation.

### Phase 2 — Pilot (Weeks 11–14)
`869dmvqak` recruit 10–20 Nairobi design partners · `869dmvq49` instrumentation (containment, escalation reasons, payment success, cost/conversation — derived from `ai_agent_logs`) · `869dmvq4z` weekly conversation review + prompt iteration · `869dmvq5m` ODPC compliance (consent in onboarding, retention cron, registration) · `869dmvq67` pricing validation.
**Exit:** ≥5 businesses collecting real revenue weekly; containment ≥70%.

### Phase 3 — Launch & v2 (Weeks 15+)
`869dmvqb4` public launch · `869dmvqbk` CTWA ads (free 72h window) · `869dmvqcd` WhatsApp Flows checkout · `869dmvqd2` eTIMS receipts. Ideas list stays parked until demand pulls it.

## 4. North star

**KES collected through WhatsWise per business per month.** Supporting: time-to-first-AI-sale, AI containment rate, response time, churn.
