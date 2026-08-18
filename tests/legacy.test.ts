import { describe, it, expect } from 'vitest'
import { HH_FACTOR, methodById } from '@/lib/es/approx'
import { solve } from '@/lib/es/solve'

/**
 * The gate on retiring the WordPress "Calculated Fields Form" widgets.
 *
 * Each block reproduces one retired form. If any of these fail, the plugin
 * still has a job and must not be uninstalled.
 */

const hh = methodById('hh')!

/** The value a route resolved to, or NaN if none did. */
function resultOf(known: Parameters<typeof solve>[0], target: Parameters<typeof solve>[1]) {
  const solution = solve(known, target)
  const live = solution.routes.find((route) => Number.isFinite(route.value))
  return live ? live.value : NaN
}

describe('form 21 — CER & OR → EER', () => {
  it('recovers the experimental event rate', () => {
    expect(resultOf({ cer: 0.2, or: 2.153846153846154 }, 'eer')).toBeCloseTo(
      0.35,
      10,
    )
  })

  it('is a single exact route', () => {
    const solution = solve({ cer: 0.2, or: 2.153846153846154 }, 'eer')
    expect(solution.routes).toHaveLength(1)
    expect(solution.routes[0].kind).toBe('exact')
  })
})

describe('form 22 — OR & CER → RR', () => {
  it('recovers the risk ratio', () => {
    expect(resultOf({ or: 2.153846153846154, cer: 0.2 }, 'rr')).toBeCloseTo(
      1.75,
      10,
    )
  })
})

describe('form 23 — RR & CER → OR', () => {
  it('recovers the odds ratio', () => {
    expect(resultOf({ rr: 1.75, cer: 0.2 }, 'or')).toBeCloseTo(
      2.153846153846154,
      12,
    )
  })
})

describe('form 13 — OR → SMD', () => {
  it('reproduces the widget output for OR = 2', () => {
    expect(hh.toSmd({ or: 2 }).value).toBeCloseTo(0.3829542, 7)
  })

  it('uses 1.81 exactly', () => {
    expect(HH_FACTOR).toBe(1.81)
  })

  /**
   * 1.81 is the published constant, not a rounding of π/√3 that anyone may
   * "fix" later. The two divisors disagree in the fourth decimal of every
   * converted effect size.
   */
  it('is not the same as dividing by π/√3', () => {
    const withChinn = Math.log(2) / 1.81
    const withExactLogisticSd = Math.log(2) / (Math.PI / Math.sqrt(3))
    expect(withChinn).toBeCloseTo(0.3829542, 7)
    expect(withExactLogisticSd).toBeCloseTo(0.3821521, 7)
    expect(Math.abs(withChinn - withExactLogisticSd)).toBeGreaterThan(7e-4)
  })
})

describe('form 20 — SMD → OR', () => {
  it('reproduces the widget output for d = 0.5', () => {
    expect(hh.fromSmd(0.5).seed.or).toBeCloseTo(2.4719319, 7)
  })

  it('is reachable through solve as well', () => {
    const solution = solve({ smd: 0.5 }, 'or')
    const route = solution.routes.find((candidate) => candidate.id === 'hh')!
    expect(route.value).toBeCloseTo(2.4719319, 7)
    expect(route.kind).toBe('approximate')
  })
})

describe('all five retired forms are covered by the catalogue-facing API', () => {
  const pairs: [Parameters<typeof solve>[0], Parameters<typeof solve>[1]][] = [
    [{ cer: 0.2, or: 2.153846153846154 }, 'eer'],
    [{ cer: 0.2, or: 2.153846153846154 }, 'rr'],
    [{ cer: 0.2, rr: 1.75 }, 'or'],
    [{ or: 2 }, 'smd'],
    [{ smd: 0.5 }, 'or'],
  ]

  it.each(pairs)('%o → %s resolves', (known, target) => {
    expect(solve(known, target).resolved).toBe(true)
  })
})
