import { describe, expect, it } from 'vitest'
import { CHEAP_MODEL, SMART_MODEL, chooseModel } from './router'
import type { ConversationTurn } from './types'

const noHistory: ConversationTurn[] = []

describe('chooseModel', () => {
  it('routes simple greetings and price questions to the cheap model', () => {
    expect(chooseModel('habari, mko na viatu size 42?', noHistory)).toBe(CHEAP_MODEL)
    expect(chooseModel('ni how much?', noHistory)).toBe(CHEAP_MODEL)
    expect(chooseModel('hi', noHistory)).toBe(CHEAP_MODEL)
  })

  it('escalates negotiation language (EN + Swahili)', () => {
    expect(chooseModel('bei ya mwisho ni ngapi?', noHistory)).toBe(SMART_MODEL)
    expect(chooseModel('any discount for 3 pieces?', noHistory)).toBe(SMART_MODEL)
    expect(chooseModel('punguza kidogo boss', noHistory)).toBe(SMART_MODEL)
  })

  it('escalates trust/dispute territory', () => {
    expect(chooseModel('nataka refund yangu', noHistory)).toBe(SMART_MODEL)
    expect(chooseModel('this looks like a scam', noHistory)).toBe(SMART_MODEL)
  })

  it('escalates multi-question and long messages', () => {
    expect(chooseModel('do you deliver? what colors do you have?', noHistory)).toBe(SMART_MODEL)
    expect(chooseModel('a'.repeat(300), noHistory)).toBe(SMART_MODEL)
  })

  it('escalates long conversations even when the turn is simple', () => {
    const longHistory: ConversationTurn[] = Array.from({ length: 13 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      content: `turn ${i}`,
    }))
    expect(chooseModel('sawa', longHistory)).toBe(SMART_MODEL)
  })
})
