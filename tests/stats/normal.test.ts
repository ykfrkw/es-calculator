import { describe, it, expect } from 'vitest'
import { expit, logit } from '@/lib/es/stats/normal'

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
