import { describe, it, expect } from 'vitest'
import { QUANTITY_ORDER } from '@/lib/es/quantities'
import { requiredInputs, solve } from '@/lib/es/solve'
import type { Quantity, Values } from '@/lib/es/types'

/** Mutually consistent probe values, so no pair can contradict another. */
const SENTINELS: Record<Quantity, number> = {
  cer: 0.2,
  eer: 0.35,
  rr: 1.75,
  or: 2.153846153846154,
  smd: 0.4563007671653466,
}

function bag(ids: Quantity[]): Values {
  const values: Values = {}
  for (const id of ids) values[id] = SENTINELS[id]
  return values
}

/** Every ordered (from, to) pair over the five quantities. */
const PAIRS: [Quantity, Quantity][] = QUANTITY_ORDER.flatMap((from) =>
  QUANTITY_ORDER.filter((to) => to !== from).map(
    (to) => [from, to] as [Quantity, Quantity],
  ),
)

describe('requiredInputs over every ordered pair', () => {
  it.each(PAIRS)('%s → %s is reachable', (from, to) => {
    expect(requiredInputs(from, to).unreachable).toBe(false)
  })

  it.each(PAIRS)(
    '%s → %s: any single member of the group makes a route resolve',
    (from, to) => {
      const requirement = requiredInputs(from, to)

      if (requirement.requiredAnyOf.length === 0) {
        expect(solve(bag([from]), to).resolved).toBe(true)
        return
      }

      for (const extra of requirement.requiredAnyOf) {
        const solution = solve(bag([from, extra]), to)
        expect(
          solution.resolved,
          `${from} + ${extra} → ${to}`,
        ).toBe(true)
        expect(
          solution.routes.some((route) => Number.isFinite(route.value)),
        ).toBe(true)
      }
    },
  )

  it.each(PAIRS)(
    '%s → %s: the from quantity alone is not enough when a group is demanded',
    (from, to) => {
      const requirement = requiredInputs(from, to)
      if (requirement.requiredAnyOf.length === 0) return
      expect(solve(bag([from]), to).resolved).toBe(false)
    },
  )

  it.each(PAIRS)(
    '%s → %s: never demands and offers the same quantity',
    (from, to) => {
      const { requiredAnyOf, optional } = requiredInputs(from, to)
      for (const id of requiredAnyOf) expect(optional).not.toContain(id)
      // A demanded group and an offered one are mutually exclusive: while
      // anything is still missing there is nothing "extra" to offer.
      if (requiredAnyOf.length > 0) expect(optional).toEqual([])
    },
  )

  it.each(PAIRS)(
    '%s → %s: never asks for the from or the to quantity',
    (from, to) => {
      const { requiredAnyOf, optional } = requiredInputs(from, to)
      for (const id of [...requiredAnyOf, ...optional]) {
        expect(id).not.toBe(from)
        expect(id).not.toBe(to)
      }
    },
  )

  it.each(PAIRS)('%s → %s: every optional input adds a route', (from, to) => {
    const requirement = requiredInputs(from, to)
    const baseline = solve(bag([from]), to).routes.filter((route) =>
      Number.isFinite(route.value),
    ).length
    for (const extra of requirement.optional) {
      const widened = solve(bag([from, extra]), to).routes.filter((route) =>
        Number.isFinite(route.value),
      ).length
      expect(widened, `${from} + ${extra} → ${to}`).toBeGreaterThan(baseline)
    }
  })
})

describe('the groups the owner specified', () => {
  /** Each listed candidate must appear in the derived group. */
  const EXPECTED: [Quantity, Quantity, Quantity[]][] = [
    ['or', 'rr', ['cer', 'eer']],
    ['rr', 'or', ['cer', 'eer']],
    ['cer', 'eer', ['rr', 'or']],
    ['eer', 'cer', ['rr', 'or']],
    ['rr', 'smd', ['cer', 'eer', 'or']],
    ['cer', 'smd', ['eer', 'rr', 'or']],
    ['eer', 'smd', ['cer', 'rr', 'or']],
    ['smd', 'eer', ['cer']],
    ['smd', 'rr', ['cer']],
    ['smd', 'cer', ['eer', 'rr']],
  ]

  it.each(EXPECTED)('%s → %s requires any one of %o', (from, to, expected) => {
    const { requiredAnyOf } = requiredInputs(from, to)
    for (const id of expected) expect(requiredAnyOf).toContain(id)
  })

  it('OR → SMD needs nothing, but offers the rates that unlock probit', () => {
    expect(requiredInputs('or', 'smd')).toEqual({
      from: 'or',
      to: 'smd',
      requiredAnyOf: [],
      optional: ['cer', 'eer', 'rr'],
      unreachable: false,
    })
  })

  it('SMD → OR needs nothing, but offers CER to unlock probit', () => {
    expect(requiredInputs('smd', 'or')).toEqual({
      from: 'smd',
      to: 'or',
      requiredAnyOf: [],
      optional: ['cer'],
      unreachable: false,
    })
  })

  /**
   * Binary → binary is exact algebra. An SMD would also reach the target,
   * approximately, and offering it alongside the two exact options would
   * invite an assumption the reader does not need.
   */
  it('never offers SMD as a way to complete an exact conversion', () => {
    for (const [from, to] of PAIRS) {
      if (from === 'smd' || to === 'smd') continue
      expect(requiredInputs(from, to).requiredAnyOf).not.toContain('smd')
    }
  })

  it('matches the recorded groups', () => {
    const summary = PAIRS.map(([from, to]) => {
      const requirement = requiredInputs(from, to)
      const demanded = requirement.requiredAnyOf.join('|') || '—'
      const offered = requirement.optional.join('|') || '—'
      return `${from} → ${to}: need any of ${demanded}; optional ${offered}`
    })
    expect(summary).toMatchInlineSnapshot(`
      [
        "cer → eer: need any of rr|or; optional —",
        "cer → rr: need any of eer|or; optional —",
        "cer → or: need any of eer|rr; optional —",
        "cer → smd: need any of eer|rr|or; optional —",
        "eer → cer: need any of rr|or; optional —",
        "eer → rr: need any of cer|or; optional —",
        "eer → or: need any of cer|rr; optional —",
        "eer → smd: need any of cer|rr|or; optional —",
        "rr → cer: need any of eer|or; optional —",
        "rr → eer: need any of cer|or; optional —",
        "rr → or: need any of cer|eer; optional —",
        "rr → smd: need any of cer|eer|or; optional —",
        "or → cer: need any of eer|rr; optional —",
        "or → eer: need any of cer|rr; optional —",
        "or → rr: need any of cer|eer; optional —",
        "or → smd: need any of —; optional cer|eer|rr",
        "smd → cer: need any of eer|rr; optional —",
        "smd → eer: need any of cer|rr; optional —",
        "smd → rr: need any of cer|eer; optional —",
        "smd → or: need any of —; optional cer",
      ]
    `)
  })
})
