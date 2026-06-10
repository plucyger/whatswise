# Summary: AI Conversation Engine Scaffold (v1)

**Date:** 10 June 2026 · **ClickUp:** [869dmvpgp](https://app.clickup.com/t/869dmvpgp) · **Branch:** `feat/ai-engine-scaffold` · **Version:** 0.3.0

## What was built

The AI sales agent now exists as the **third inbound engine** in the webhook chain:

```
customer message → webhook (HMAC verified, tenant resolved by phone_number_id)
  1. dispatchInboundToFlows()      — authored bot journeys win first
  2. dispatchInboundToAIAgent()    — NEW: free-form AI selling (text turns only)
  3. runAutomationsForTrigger()    — content triggers only if neither consumed
```

### Files
| File | What it does |
|---|---|
| [src/lib/ai/engine.ts](../../src/lib/ai/engine.ts) | `dispatchInboundToAIAgent()` — guards, idempotency claim, memory fetch, Claude call, reply send, audit. Never throws; a broken AI layer cannot break message ingestion |
| [src/lib/ai/router.ts](../../src/lib/ai/router.ts) | Model routing: Haiku 4.5 by default, Sonnet for negotiation ("bei ya mwisho", "discount"), disputes, multi-question/long turns, long threads. Pure function, fully unit-tested |
| [src/lib/ai/prompt.ts](../../src/lib/ai/prompt.ts) | System prompt: a static, prompt-cached block (language mirroring EN/SW/Sheng, hard guardrails) + tiny per-account suffix |
| [src/lib/ai/types.ts](../../src/lib/ai/types.ts) | Shared types; same `{ consumed }` contract as flows |
| [supabase/migrations/024_ai_agent.sql](../../supabase/migrations/024_ai_agent.sql) | `accounts.ai_enabled` flag (default **off**) + `ai_agent_logs` audit table — applied to the live project |
| router.test.ts / engine.test.ts | 10 tests: routing policy + every guard path |

### Design decisions worth knowing
- **Per-account opt-in, fail-safe by default.** With `ai_enabled=false` or no `ANTHROPIC_API_KEY`, the engine exits in one indexed SELECT and everything behaves exactly as before. No existing account changes behaviour.
- **Idempotency = insert-first.** The engine claims a message by inserting its `ai_agent_logs` row (UNIQUE on Meta's message id) *before* calling the model — a redelivered webhook can never double-reply or double-spend tokens.
- **Cost discipline from day one.** Every turn logs model, input/output tokens, and latency; the static prompt is cached across all tenants; replies are capped at 300 output tokens. The <$0.02/conversation target is measurable immediately.
- **Sends reuse the flows sender** (`engineSendText`): phone-variant retry, `messages` insert as `sender_type='bot'`, conversation preview update — AI replies render in the inbox like any bot message.

### Extension points (marked in code)
- **Tools** (`869dmvpjh`): the single `messages.create` call becomes a tool-use loop — `lookup_product`, `create_order`, `tag_lead`, `schedule_followup`
- **RAG** (`869dmvphg`): `business_profile` + retrieved catalog chunks extend `prompt.ts`
- **Escalations** (`869dmvptf`): rules evaluate each turn after the reply in `engine.ts`

## How to try it
1. Set `ANTHROPIC_API_KEY` in `.env.local` (see `.env.local.example`)
2. Enable for an account: `UPDATE accounts SET ai_enabled = TRUE WHERE id = '<account>';`
3. Send a WhatsApp message to that account's number → AI reply lands in the same chat; the turn appears in `ai_agent_logs`

## Verification
- `npm run typecheck` clean · `npm test` 401/401 passing (10 new)
- Migration applied to Supabase project `ijsqolpjbkxgmqkclbwl`
- Live end-to-end test pends a Meta test number + API key (Phase 0 ticket `869dmvp82`)

## Follow-ups
- Add `ANTHROPIC_API_KEY` to staging env when it exists
- Rolling conversation summary (longer memory at flat cost) — bundled into the RAG ticket
