import { describe, it, expect } from 'vitest'
import {
  APPROX_METHODS,
  COX_FACTOR,
  HH_FACTOR,
  methodById,
} from '@/lib/es/approx'

const cox = methodById('cox')!
const hh = methodById('hh')!
const probit = methodById('probit')!

/** p_C = 0.20, p_E = 0.35 — the fixture every test in this repo shares. */
const GOLDEN = {
  cer: 0.2,
  eer: 0.35,
  rr: 1.75,
  or: 2.153846153846154,
  lnOr: 0.7672551527136672,
  cox: 0.46500312285676804,
  hh: 0.4238978744274404,
  probit: 0.45630076716534657,
}

describe('divisors are literals', () => {
  it('COX_FACTOR is exactly 1.65', () => {
    expect(COX_FACTOR).toBe(1.65)
  })

  it('HH_FACTOR is exactly 1.81, not π/√3', () => {
    expect(HH_FACTOR).toBe(1.81)
    expect(HH_FACTOR).not.toBe(Math.PI / Math.sqrt(3))
  })
})

describe('toSmd golden values', () => {
  it('Cox', () => {
    expect(cox.toSmd({ or: GOLDEN.or }).value).toBeCloseTo(GOLDEN.cox, 9)
  })

  it('Hasselblad–Hedges', () => {
    expect(hh.toSmd({ or: GOLDEN.or }).value).toBeCloseTo(GOLDEN.hh, 9)
  })

  it('Probit', () => {
    expect(
      probit.toSmd({ cer: GOLDEN.cer, eer: GOLDEN.eer }).value,
    ).toBeCloseTo(GOLDEN.probit, 9)
  })

  it('the logistic conversions really are ln(OR) divided by their constant', () => {
    expect(cox.toSmd({ or: GOLDEN.or }).value * COX_FACTOR).toBeCloseTo(
      GOLDEN.lnOr,
      12,
    )
    expect(hh.toSmd({ or: GOLDEN.or }).value * HH_FACTOR).toBeCloseTo(
      GOLDEN.lnOr,
      12,
    )
  })
})

describe('round trips', () => {
  const effects = [-1.2, -0.3, 0, 0.2, 0.4563, 0.8, 1.5]

  it.each(effects)('Cox recovers d = %f to 1e-12', (smd) => {
    const seeded = cox.fromSmd(smd)
    expect(Math.abs(cox.toSmd(seeded.seed).value - smd)).toBeLessThan(1e-12)
  })

  it.each(effects)('Hasselblad–Hedges recovers d = %f to 1e-12', (smd) => {
    const seeded = hh.fromSmd(smd)
    expect(Math.abs(hh.toSmd(seeded.seed).value - smd)).toBeLessThan(1e-12)
  })

  it.each(effects)('Probit recovers d = %f to 1e-10', (smd) => {
    const seeded = probit.fromSmd(smd, { cer: 0.2 })
    const back = probit.toSmd({ cer: 0.2, eer: seeded.seed.eer })
    expect(Math.abs(back.value - smd)).toBeLessThan(1e-10)
  })

  it('probit seeds EER rather than OR, so the exact rules can finish the job', () => {
    expect(probit.seeds).toBe('eer')
    expect(cox.seeds).toBe('or')
    expect(hh.seeds).toBe('or')
  })

  it('the probit seed reproduces the fixture', () => {
    const seeded = probit.fromSmd(GOLDEN.probit, { cer: GOLDEN.cer })
    expect(seeded.seed.eer).toBeCloseTo(GOLDEN.eer, 12)
  })
})

describe('ordering and the null', () => {
  it.each([1.2, 2, 5, 40])(
    'for OR = %f above 1, d_Cox exceeds d_HH',
    (odds) => {
      const dCox = cox.toSmd({ or: odds }).value
      const dHh = hh.toSmd({ or: odds }).value
      expect(dCox).toBeGreaterThan(dHh)
    },
  )

  it('all three methods return 0 at the null', () => {
    expect(cox.toSmd({ or: 1 }).value).toBe(0)
    expect(hh.toSmd({ or: 1 }).value).toBe(0)
    expect(probit.toSmd({ cer: 0.3, eer: 0.3 }).value).toBe(0)
  })

  it('inverts the null back to no effect', () => {
    expect(cox.fromSmd(0).seed.or).toBe(1)
    expect(hh.fromSmd(0).seed.or).toBe(1)
    expect(probit.fromSmd(0, { cer: 0.3 }).seed.eer).toBeCloseTo(0.3, 14)
  })
})

describe('refusals', () => {
  it('does not return Infinity for an absurd d', () => {
    const seeded = cox.fromSmd(500)
    expect(seeded.seed.or).toBeUndefined()
    expect(seeded.error).toMatch(/representable range/)
  })

  it('refuses a non-finite d', () => {
    expect(cox.fromSmd(NaN).error).toBeDefined()
    expect(hh.fromSmd(Infinity).error).toBeDefined()
    expect(probit.fromSmd(NaN, { cer: 0.2 }).error).toBeDefined()
  })

  it('refuses to invert the probit without a control event rate', () => {
    const seeded = probit.fromSmd(0.5)
    expect(seeded.seed).toEqual({})
    expect(seeded.error).toMatch(/CER/)
  })

  it('reports missing inputs instead of computing with undefined', () => {
    expect(cox.toSmd({}).error).toMatch(/OR/)
    expect(probit.toSmd({ cer: 0.2 }).error).toMatch(/EER/)
    expect(Number.isNaN(cox.toSmd({}).value)).toBe(true)
  })

  it('refuses a probit shift that leaves the unit interval', () => {
    const seeded = probit.fromSmd(12, { cer: 0.2 })
    expect(seeded.seed.eer).toBeUndefined()
    expect(seeded.error).toMatch(/not a rate/)
  })
})

describe('method metadata', () => {
  it('has exactly three methods, each with an assumption and citations', () => {
    expect(APPROX_METHODS).toHaveLength(3)
    for (const method of APPROX_METHODS) {
      expect(method.assumption.length).toBeGreaterThan(0)
      expect(method.citations.length).toBeGreaterThan(0)
      expect(method.blockedNote.length).toBeGreaterThan(0)
    }
  })

  it('prints the divisor it actually used', () => {
    expect(cox.toSmd({ or: 2 }).substituted).toContain('1.65')
    expect(hh.toSmd({ or: 2 }).substituted).toContain('1.81')
  })
})
