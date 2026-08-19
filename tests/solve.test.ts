import { describe, it, expect } from 'vitest'
import { requiredInputs, solve } from '@/lib/es/solve'
import { QUANTITY_ORDER } from '@/lib/es/quantities'
import type { Values } from '@/lib/es/types'

describe('OR → SMD', () => {
  const solution = solve({ or: 2 }, 'smd')

  it('always offers both methods', () => {
    expect(solution.routes.map((route) => route.id)).toEqual(['cox', 'hh'])
  })

  it('resolves both logistic routes', () => {
    for (const route of solution.routes) {
      expect(Number.isFinite(route.value)).toBe(true)
    }
  })
})

describe('rates → SMD', () => {
  const solution = solve({ cer: 0.2, eer: 0.35 }, 'smd')

  it('resolves both methods', () => {
    expect(solution.routes).toHaveLength(2)
    expect(
      solution.routes.every((route) => Number.isFinite(route.value)),
    ).toBe(true)
  })

  it('derives the ratios along the way', () => {
    expect(solution.derived.rr).toBeCloseTo(1.75, 12)
    expect(solution.derived.or).toBeCloseTo(2.153846153846154, 12)
  })

  it('reports the spread between the methods', () => {
    expect(solution.spread).toBeCloseTo(0.46500312285676804 - 0.4238978744274404, 12)
    expect(solution.warnings.some((w) => w.includes('disagree'))).toBe(true)
  })

  it('shows the exact leg before the approximate one for Cox', () => {
    const cox = solution.routes.find((route) => route.id === 'cox')!
    expect(cox.steps.map((step) => step.kind)).toEqual(['exact', 'approximate'])
    expect(cox.steps[0].source).toBe('or_from_rates')
  })
})

describe('SMD → EER with a known CER', () => {
  const solution = solve({ smd: 0.5, cer: 0.2 }, 'eer')

  it('offers two approximate routes', () => {
    expect(solution.routes).toHaveLength(2)
    for (const route of solution.routes) {
      expect(route.kind).toBe('approximate')
      expect(Number.isFinite(route.value)).toBe(true)
    }
  })

  it('starts every route with the approximate leg', () => {
    for (const route of solution.routes) {
      expect(route.steps[0].kind).toBe('approximate')
      expect(route.steps.slice(1).every((step) => step.kind === 'exact')).toBe(
        true,
      )
    }
  })

  it('takes both logistic routes through OR', () => {
    for (const route of solution.routes) {
      expect(route.steps.map((step) => step.produces)).toEqual(['or', 'eer'])
    }
  })

  it('agrees with the direct method calls', () => {
    const hh = solution.routes.find((route) => route.id === 'hh')!
    // OR = exp(1.81 × 0.5), then EER = expit(logit(0.2) + ln OR).
    expect(hh.value).toBeCloseTo(0.38194652731910705, 12)
  })
})

describe('exact conversions', () => {
  it('CER + OR → EER is a single exact route with no assumption', () => {
    const solution = solve({ cer: 0.2, or: 2 }, 'eer')
    expect(solution.routes).toHaveLength(1)
    const route = solution.routes[0]
    expect(route.kind).toBe('exact')
    expect(route.assumption).toBeUndefined()
    expect(route.citations).toEqual([])
    expect(route.value).toBeCloseTo(0.3333333333333333, 12)
  })

  it('prefers exact algebra even when an SMD is also on hand', () => {
    const solution = solve({ cer: 0.2, eer: 0.35, smd: 0.4 }, 'or')
    expect(solution.routes).toHaveLength(1)
    expect(solution.routes[0].kind).toBe('exact')
  })
})

describe('unreachable targets', () => {
  it('says what is missing instead of returning nothing', () => {
    const solution = solve({ rr: 1.5 }, 'or')
    expect(solution.routes).toEqual([])
    expect(solution.resolved).toBe(false)
    expect(solution.message).toBe(
      'RR alone does not determine OR. Add CER or SMD.',
    )
  })

  // EER may name the target that could not be reached; what it must never do
  // is appear in the list of inputs the reader is told to go and find.
  it('never suggests adding EER', () => {
    for (const target of QUANTITY_ORDER) {
      const message = solve({ rr: 1.5 }, target).message ?? ''
      expect(message.split('Add ')[1] ?? '').not.toContain('EER')
    }
  })

  it('handles the empty input', () => {
    const solution = solve({}, 'smd')
    expect(solution.resolved).toBe(false)
    expect(solution.routes).toHaveLength(2)
    expect(solution.routes.every((route) => route.missing.length > 0)).toBe(true)
  })
})

describe('invariants', () => {
  const inputs: Values[] = [
    {},
    { cer: 0.2 },
    { or: 2 },
    { smd: 0.5 },
    { cer: 0.2, eer: 0.35 },
    { cer: 0.2, or: 2 },
    { or: 2, rr: 3 },
    { or: 1, rr: 1 },
    { cer: 0.6, rr: 2 },
    { cer: NaN, eer: Infinity, rr: -1, or: 0, smd: NaN },
    { cer: 0, eer: 1 },
    { smd: 500, cer: 0.2 },
    { smd: 1e300 },
  ]

  it.each(inputs)('solve never throws for %o', (known) => {
    for (const target of QUANTITY_ORDER) {
      expect(() => solve(known, target)).not.toThrow()
    }
  })

  it('never marks a route exact and gives it an assumption', () => {
    for (const known of inputs) {
      for (const target of QUANTITY_ORDER) {
        for (const route of solve(known, target).routes) {
          if (route.kind === 'exact') expect(route.assumption).toBeUndefined()
          if (route.assumption !== undefined) {
            expect(route.kind).toBe('approximate')
          }
        }
      }
    }
  })

  it('never returns a non-NaN, non-finite value', () => {
    for (const known of inputs) {
      for (const target of QUANTITY_ORDER) {
        for (const route of solve(known, target).routes) {
          expect(route.value === route.value ? Number.isFinite(route.value) : true).toBe(
            true,
          )
        }
      }
    }
  })
})

describe('requiredInputs', () => {
  // The exhaustive (from, to) sweep lives in tests/requirements.test.ts;
  // these pin the shapes the input panel branches on.
  it('demands the single missing piece for an exact conversion', () => {
    expect(requiredInputs(['rr'], ['or'])).toEqual({
      from: ['rr'],
      to: ['or'],
      requiredAnyOf: ['cer'],
      unreachable: false,
    })
  })

  it('demands nothing when the pair of rates already closes the algebra', () => {
    expect(requiredInputs(['cer', 'eer'], ['or'])).toEqual({
      from: ['cer', 'eer'],
      to: ['or'],
      requiredAnyOf: [],
      unreachable: false,
    })
  })

  it('demands the ratio that lets a seeded SMD reach both rates', () => {
    expect(requiredInputs(['smd'], ['cer', 'eer'])).toEqual({
      from: ['smd'],
      to: ['cer', 'eer'],
      requiredAnyOf: ['rr'],
      unreachable: false,
    })
  })

  it('never asks for the target or the source', () => {
    const requirement = requiredInputs(['or'], ['rr'])
    expect(requirement.requiredAnyOf).not.toContain('or')
    expect(requirement.requiredAnyOf).not.toContain('rr')
  })
})
