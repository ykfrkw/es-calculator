import { describe, it, expect } from 'vitest'
import { erf, erfc, expit, logit, phi } from '@/lib/es/stats/normal'
import { normQuantile } from '@/lib/es/stats/normQuantile'

// Reference values from R qnorm(p)
describe('normQuantile', () => {
  const cases: [number, number][] = [
    [0.025, -1.9599639845401],
    [0.05, -1.6448536269514],
    [0.5, 0],
    [0.95, 1.6448536269514],
    [0.975, 1.9599639845401],
    [0.99, 2.3263478740408],
    [0.999, 3.0902323061678],
  ]
  it.each(cases)('qnorm(%f) ≈ %f', (p, expected) => {
    expect(normQuantile(p)).toBeCloseTo(expected, 6)
  })

  it('handles boundaries', () => {
    expect(normQuantile(0)).toBe(-Infinity)
    expect(normQuantile(1)).toBe(Infinity)
    expect(Number.isNaN(normQuantile(-0.1))).toBe(true)
    expect(Number.isNaN(normQuantile(1.1))).toBe(true)
    expect(Number.isNaN(normQuantile(NaN))).toBe(true)
  })

  // The Beasley–Springer–Moro core alone is only ~1e-9; these hold the
  // Halley refinement in place.
  it.each([
    [0.01, -2.3263478740408408],
    [0.2, -0.8416212335729142],
    [0.35, -0.3853204664075676],
    [0.9, 1.2815515655446004],
  ])('qnorm(%f) is accurate to 1e-12', (p, expected) => {
    expect(Math.abs(normQuantile(p) - expected)).toBeLessThan(1e-12)
  })
})

describe('phi (standard normal CDF)', () => {
  // Reference values from R pnorm(z), tightened from the 5-dp checks the
  // responder tool used: the probit route composes Φ with Φ⁻¹.
  it.each([
    [0, 0.5],
    [-0.5, 0.30853753872598694],
    [0.4, 0.6554217416103242],
    [1.96, 0.9750021048517796],
    [-3, 0.0013498980316300946],
    [4.5, 0.9999966023268753],
  ])('phi(%f) ≈ %f', (z, expected) => {
    expect(phi(z)).toBeCloseTo(expected, 10)
  })

  it('symmetry: phi(z) + phi(−z) = 1', () => {
    for (const z of [0.1, 0.5, 1, 1.96, 3, 4.2]) {
      expect(phi(z) + phi(-z)).toBeCloseTo(1, 15)
    }
  })

  it('is monotone increasing', () => {
    let previous = -Infinity
    for (let z = -5; z <= 5; z += 0.25) {
      const p = phi(z)
      expect(p).toBeGreaterThan(previous)
      previous = p
    }
  })

  it('stays positive far into the lower tail', () => {
    expect(phi(-8)).toBeGreaterThan(0)
    expect(phi(-8)).toBeCloseTo(6.220960574271782e-16, 20)
    expect(phi(NaN)).toBeNaN()
  })
})

describe('erfc', () => {
  // Reference values from Python math.erfc.
  it.each([
    [0, 1],
    [0.1, 0.8875370839817152],
    [1, 0.15729920705028513],
    [-1, 1.8427007929497148],
    [3, 2.209049699858544e-5],
  ])('erfc(%f) ≈ %f', (x, expected) => {
    expect(erfc(x)).toBeCloseTo(expected, 12)
  })

  it('erf is odd', () => {
    for (const x of [0.3, 1, 2.5]) {
      expect(erf(-x)).toBeCloseTo(-erf(x), 15)
    }
  })

  it('erfc(x) + erfc(−x) = 2', () => {
    for (const x of [0.25, 1, 2, 3.5]) {
      expect(erfc(x) + erfc(-x)).toBeCloseTo(2, 15)
    }
  })

  it('returns NaN for NaN', () => {
    expect(erfc(NaN)).toBeNaN()
  })
})

describe('probit round trip', () => {
  const probabilities = [1e-6, 0.001, 0.01, 0.1, 0.35, 0.5, 0.9, 0.999]

  it.each(probabilities)('phi(normQuantile(%f)) recovers p to 1e-12', (p) => {
    expect(Math.abs(phi(normQuantile(p)) - p)).toBeLessThan(1e-12)
  })
})

describe('logit / expit', () => {
  it.each([
    [0.5, 0],
    [0.2, -1.3862943611198906],
    [0.75, 1.0986122886681098],
  ])('logit(%f) ≈ %f', (p, expected) => {
    expect(logit(p)).toBeCloseTo(expected, 13)
  })

  it('handles the boundaries and the outside', () => {
    expect(logit(0)).toBe(-Infinity)
    expect(logit(1)).toBe(Infinity)
    expect(logit(-0.1)).toBeNaN()
    expect(logit(1.1)).toBeNaN()
    expect(logit(NaN)).toBeNaN()
  })

  it('expit does not overflow or lose the tail', () => {
    expect(expit(800)).toBe(1)
    expect(expit(-800)).toBe(0)
    expect(expit(-40)).toBeGreaterThan(0)
    expect(expit(NaN)).toBeNaN()
  })

  it.each([1e-12, 1e-6, 0.01, 0.2, 0.5, 0.8, 0.999999, 1 - 1e-12])(
    'expit(logit(%f)) recovers p to 1e-14',
    (p) => {
      expect(Math.abs(expit(logit(p)) - p)).toBeLessThan(1e-14)
    },
  )
})
