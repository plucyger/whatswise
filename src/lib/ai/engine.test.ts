import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ------------------------------------------------------------
// Guard-path tests for dispatchInboundToAIAgent. The happy path
// (model call → send → audit) is exercised end-to-end against a
// test account; these tests pin the cheap early-exit behaviour
// that protects message ingestion when the AI layer is off,
// misconfigured, or redelivered.
//
// Mock style follows src/lib/automations/engine.test.ts:
// vi.hoisted state + fluent supabase builder.
// ------------------------------------------------------------

const state = vi.hoisted(() => ({
  account: null as null | { id: string; name: string; ai_enabled: boolean },
  claimError: null as null | { code: string },
}))

vi.mock('./admin-client', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'accounts') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: state.account, error: null }),
            }),
          }),
        }
      }
      if (table === 'ai_agent_logs') {
        return {
          insert: () => ({
            select: () => ({
              single: async () =>
                state.claimError
                  ? { data: null, error: state.claimError }
                  : { data: { id: 'log-1' }, error: null },
            }),
          }),
          update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        }
      }
      throw new Error(`unexpected table in guard tests: ${table}`)
    },
  }),
}))

// The guard paths must exit before any model call or send happens —
// throwing mocks prove it.
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: async () => {
        throw new Error('model should not be called on guard paths')
      },
    }
  },
}))
vi.mock('@/lib/flows/meta-send', () => ({
  engineSendText: async () => {
    throw new Error('send should not be called on guard paths')
  },
}))

import { dispatchInboundToAIAgent } from './engine'

const baseInput = {
  accountId: 'acc-1',
  userId: 'user-1',
  contactId: 'contact-1',
  conversationId: 'conv-1',
  message: { text: 'habari', meta_message_id: 'wamid.1' },
}

describe('dispatchInboundToAIAgent guard paths', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    state.account = { id: 'acc-1', name: 'Test Duka', ai_enabled: true }
    state.claimError = null
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('skips when ANTHROPIC_API_KEY is not configured', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const result = await dispatchInboundToAIAgent(baseInput)
    expect(result).toEqual({ consumed: false, reason: 'no_api_key' })
  })

  it('skips when the account has not enabled the agent', async () => {
    state.account = { id: 'acc-1', name: 'Test Duka', ai_enabled: false }
    const result = await dispatchInboundToAIAgent(baseInput)
    expect(result).toEqual({ consumed: false, reason: 'disabled' })
  })

  it('skips when the account row is missing (defensive)', async () => {
    state.account = null
    const result = await dispatchInboundToAIAgent(baseInput)
    expect(result).toEqual({ consumed: false, reason: 'disabled' })
  })

  it('skips empty / whitespace-only messages', async () => {
    const result = await dispatchInboundToAIAgent({
      ...baseInput,
      message: { text: '   ', meta_message_id: 'wamid.2' },
    })
    expect(result).toEqual({ consumed: false, reason: 'empty_message' })
  })

  it('treats a unique-violation on the log claim as a webhook redelivery', async () => {
    state.claimError = { code: '23505' }
    const result = await dispatchInboundToAIAgent(baseInput)
    expect(result).toEqual({ consumed: false, reason: 'duplicate' })
  })
})
