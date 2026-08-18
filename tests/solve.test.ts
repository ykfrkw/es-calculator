import { describe, it, expect } from 'vitest'
import { requiredInputs, solve } from '@/lib/es/solve'
import { QUANTITY_ORDER } from '@/lib/es/quantities'
import type { Quantity, Values } from '@/lib/es/types'

describe('OR → SMD', () => {
  const solution = solve({ or: 2 }, 'smd')

  it('always offers all three methods', () => {
    expect(solution.routes.map((route) => route.id)).toEqual([
      'cox',
      'hh',
      'probit',
    ])
  })

  it('resolves the two logistic routes', () => {
    for (const id of ['cox', 'hh']) {
      const route = solution.routes.find((candidate) => candidate.id === id)!
      expect(Number.isFinite(route.value)).toBe(true)
    }
  })

  it('shows the probit as blocked rather than hiding it', () => {
    const probit = solution.routes.find((route) => route.id === 'probit')!
    expect(Number.isNaN(probit.value)).toBe(true)
    expect(probit.missing).toEqual(['cer'])
    expect(probit.alternatives).toEqual(['eer', 'rr'])
    expect(probit.blockedReason).toBe(
      'Needs CER, EER or RR as well — the probit index depends on the absolute event rates, not just the odds ratio.',
    )
  })

  it('lights the probit up once a rate is supplied', () => {
    const withRate = solve({ or: 2, cer: 0.2 }, 'smd')
    const probit = withRate.routes.find((route) => route.id === 'probit')!
    expect(Number.isFinite(probit.value)).toBe(true)
    expect(probit.missing).toEqual([])
  })
})

describe('rates → SMD', () => {
  const solution = solve({ cer: 0.2, eer: 0.35 }, 'smd')

  it('resolves all three methods', () => {
    expect(solution.routes).toHaveLength(3)
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

  it('offers three approximate routes', () => {
    expect(solution.routes).toHaveLength(3)
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

  it('takes the logistic routes through OR and the probit straight to EER', () => {
    const cox = solution.routes.find((route) => route.id === 'cox')!
    expect(cox.steps.map((step) => step.produces)).toEqual(['or', 'eer'])

    const probit = solution.routes.find((route) => route.id === 'probit')!
    expect(probit.steps.map((step) => step.produces)).toEqual(['eer'])
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
      'RR alone does not determine OR. Add CER, EER or SMD.',
    )
  })

  it('handles the empty input', () => {
    const solution = solve({}, 'smd')
    expect(solution.resolved).toBe(false)
    expect(solution.routes).toHaveLength(3)
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
  it('asks only for what was picked when nothing is blocked', () => {
    expect(requiredInputs(['cer', 'eer'], 'smd')).toEqual({
      required: ['cer', 'eer'],
      optional: [],
    })
  })

  it('offers the rates that would add the probit method', () => {
    expect(requiredInputs(['or'], 'smd')).toEqual({
      required: ['or'],
      optional: ['cer', 'eer', 'rr'],
    })
  })

  // Only CER: a lone EER or RR still leaves the probit without a second
  // rate, because two of the four exact quantities are needed to close.
  it('offers CER when inverting an SMD', () => {
    expect(requiredInputs(['smd'], 'or')).toEqual({
      required: ['smd'],
      optional: ['cer'],
    })
  })

  it('adds nothing for a purely exact conversion', () => {
    expect(requiredInputs(['cer', 'or'], 'eer')).toEqual({
      required: ['cer', 'or'],
      optional: [],
    })
  })

  it('drops the target from the required list', () => {
    const picked: Quantity[] = ['cer', 'eer']
    expect(requiredInputs(picked, 'eer').required).toEqual(['cer'])
  })
})
