import { describe, it, expect } from 'vitest'
import { EXACT_RULES, completeExact, symbolicClosure } from '@/lib/es/exact'
import type { Quantity, Values } from '@/lib/es/types'

/** The four exactly-related quantities; SMD is never exactly derivable. */
const EXACT_QUANTITIES: Quantity[] = ['cer', 'eer', 'rr', 'or']

const TWO_SUBSETS: Quantity[][] = [
  ['cer', 'eer'],
  ['cer', 'rr'],
  ['cer', 'or'],
  ['eer', 'rr'],
  ['eer', 'or'],
  ['or', 'rr'],
]

function rateGrid(): number[] {
  const rates: number[] = []
  for (let step = 1; step <= 18; step += 1) rates.push(step / 20)
  return rates
}

function truthFor(controlRate: number, experimentalRate: number): Values {
  return {
    cer: controlRate,
    eer: experimentalRate,
    rr: experimentalRate / controlRate,
    or:
      (experimentalRate * (1 - controlRate)) /
      (controlRate * (1 - experimentalRate)),
  }
}

describe('completeExact closure invariant', () => {
  describe.each(TWO_SUBSETS)('from %s', (...subset: Quantity[]) => {
    it('reproduces the other three quantities to 1e-10', () => {
      let checked = 0
      for (const controlRate of rateGrid()) {
        for (const experimentalRate of rateGrid()) {
          // OR = RR = 1 is genuinely indeterminate; it has its own test below.
          if (
            controlRate === experimentalRate &&
            subset.includes('or') &&
            subset.includes('rr')
          ) {
            continue
          }

          const truth = truthFor(controlRate, experimentalRate)
          const known: Values = {}
          for (const id of subset) known[id] = truth[id]

          const result = completeExact(known)
          expect(result.errors).toEqual([])

          for (const id of EXACT_QUANTITIES) {
            expect(result.values[id]).toBeDefined()
            expect(Math.abs(result.values[id]! - truth[id]!)).toBeLessThan(1e-10)
          }
          checked += 1
        }
      }
      expect(checked).toBeGreaterThan(300)
    })
  })
})

describe('RR × CER boundary', () => {
  it('rejects an EER that would reach or exceed 1', () => {
    const result = completeExact({ cer: 0.6, rr: 2 })
    expect(result.values.eer).toBeUndefined()
    expect(result.errors[0].message).toMatch(/cannot reach 1/)
  })

  it('accepts an EER just under 1', () => {
    const result = completeExact({ cer: 0.6, rr: 1.6 })
    expect(result.values.eer).toBeCloseTo(0.96, 12)
    expect(result.errors).toEqual([])
  })

  it('rejects an EER of exactly 1', () => {
    const result = completeExact({ cer: 0.5, rr: 2 })
    expect(result.values.eer).toBeUndefined()
    expect(result.errors[0].message).toMatch(/cannot reach 1/)
  })

  it('rejects a CER that would reach 1 going the other way', () => {
    const result = completeExact({ eer: 0.9, rr: 0.9 })
    expect(result.values.cer).toBeUndefined()
    expect(result.errors[0].message).toMatch(/cannot reach 1/)
  })
})

describe('domain rejections', () => {
  const rejected: [string, Values][] = [
    ['rate of 0', { cer: 0, eer: 0.3 }],
    ['rate of 1', { cer: 1, eer: 0.3 }],
    ['negative rate', { cer: -0.2, eer: 0.3 }],
    ['rate above 1', { cer: 1.5, eer: 0.3 }],
    ['percent-looking rate', { cer: 20, eer: 0.3 }],
    ['zero ratio', { cer: 0.2, or: 0 }],
    ['negative ratio', { cer: 0.2, rr: -1 }],
    ['NaN', { cer: NaN, eer: 0.3 }],
    ['Infinity', { cer: Infinity, eer: 0.3 }],
    ['-Infinity ratio', { cer: 0.2, or: -Infinity }],
  ]

  it.each(rejected)('rejects %s without throwing', (_label, known) => {
    const result = completeExact(known)
    expect(result.errors.length).toBeGreaterThan(0)
    for (const value of Object.values(result.values)) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('names the percentage mistake instead of coercing it', () => {
    const result = completeExact({ cer: 20, eer: 0.3 })
    expect(result.errors[0].message).toMatch(/looks like a percentage/)
    expect(result.values.cer).toBeUndefined()
  })

  it('never throws on an empty input', () => {
    expect(() => completeExact({})).not.toThrow()
    expect(completeExact({}).values).toEqual({})
  })
})

describe('cer_from_or_rr', () => {
  function cerFrom(odds: number, risk: number) {
    return completeExact({ or: odds, rr: risk })
  }

  it('recovers the golden control event rate', () => {
    const result = cerFrom(2.153846153846154, 1.75)
    expect(result.values.cer).toBeCloseTo(0.2, 12)
    expect(result.values.eer).toBeCloseTo(0.35, 12)
  })

  it('works below 1 as well', () => {
    const result = cerFrom(0.5, 0.8)
    expect(result.values.cer).toBeCloseTo(0.75, 12)
    expect(result.values.eer).toBeCloseTo(0.6, 12)
  })

  it('calls OR = RR = 1 indeterminate rather than 0/0', () => {
    const result = cerFrom(1, 1)
    expect(result.values.cer).toBeUndefined()
    expect(result.errors[0].message).toMatch(/Every control event rate/)
  })

  it('calls OR = 1 with RR ≠ 1 inconsistent', () => {
    const result = cerFrom(1, 1.5)
    expect(result.values.cer).toBeUndefined()
    expect(result.errors[0].message).toMatch(/identical odds/)
  })

  it('calls RR = 1 with OR ≠ 1 inconsistent and never returns CER = 1', () => {
    const result = cerFrom(2, 1)
    expect(result.values.cer).toBeUndefined()
    expect(result.errors[0].message).toMatch(/identical risks/)
    expect(result.values.cer).not.toBe(1)
  })

  it.each([
    [2, 3],
    [0.5, 0.3],
    [1.2, 1.5],
  ])('rejects OR = %f with RR = %f as incompatible', (odds, risk) => {
    const result = cerFrom(odds, risk)
    expect(result.values.cer).toBeUndefined()
    expect(result.errors[0].message).toMatch(
      /always further from 1 than the corresponding risk ratio/,
    )
  })

  it('refuses float garbage just above OR = 1', () => {
    const result = cerFrom(1 + 1e-14, 1.2)
    expect(result.values.cer).toBeUndefined()
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe('rule and closure bookkeeping', () => {
  it('has unique rule ids', () => {
    const ids = EXACT_RULES.map((rule) => rule.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('records the working in derivation order', () => {
    const result = completeExact({ cer: 0.2, eer: 0.35 })
    expect(result.steps.map((step) => step.produces)).toEqual(['rr', 'or'])
    expect(result.steps[0].substituted).toBe('RR = 0.35 / 0.2 = 1.75')
    expect(result.steps.every((step) => step.kind === 'exact')).toBe(true)
  })

  it('closes over the ratio quantities from any two of the four', () => {
    for (const subset of TWO_SUBSETS) {
      const closure = symbolicClosure(subset)
      for (const id of EXACT_QUANTITIES) expect(closure.has(id)).toBe(true)
    }
  })

  it('never reaches SMD by exact algebra', () => {
    expect(symbolicClosure(['cer', 'eer']).has('smd')).toBe(false)
  })

  it('cannot close from a single quantity', () => {
    for (const id of EXACT_QUANTITIES) {
      expect(symbolicClosure([id]).size).toBe(1)
    }
  })
})
