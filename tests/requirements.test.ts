import { describe, it, expect } from 'vitest'
import { SELECTION_ORDER, membersOf, type Selection } from '@/lib/es/selections'
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

/** Every ordered (from, to) pair the picker can express. */
const PAIRS: [Selection, Selection][] = SELECTION_ORDER.flatMap((from) =>
  SELECTION_ORDER.filter((to) => to !== from).map(
    (to) => [from, to] as [Selection, Selection],
  ),
)

/** True when every quantity the selection stands for actually resolved. */
function resolvesAll(supplied: Quantity[], to: Selection): boolean {
  return membersOf(to).every((target) => solve(bag(supplied), target).resolved)
}

describe('requiredInputs over every ordered pair', () => {
  it.each(PAIRS)('%s → %s is reachable', (from, to) => {
    expect(requiredInputs(membersOf(from), membersOf(to)).unreachable).toBe(
      false,
    )
  })

  it.each(PAIRS)(
    '%s → %s: any single member of the group makes a route resolve',
    (from, to) => {
      const requirement = requiredInputs(membersOf(from), membersOf(to))

      if (requirement.requiredAnyOf.length === 0) {
        expect(resolvesAll(membersOf(from), to)).toBe(true)
        return
      }

      for (const extra of requirement.requiredAnyOf) {
        expect(
          resolvesAll([...membersOf(from), extra], to),
          `${from} + ${extra} → ${to}`,
        ).toBe(true)
      }
    },
  )

  it.each(PAIRS)(
    '%s → %s: the from quantities alone are not enough when a group is demanded',
    (from, to) => {
      const requirement = requiredInputs(membersOf(from), membersOf(to))
      if (requirement.requiredAnyOf.length === 0) return
      expect(resolvesAll(membersOf(from), to)).toBe(false)
    },
  )

  /**
   * The from side is already on the form. The to side is not: reaching both
   * event rates from a ratio is exactly the case where one arm's rate is the
   * input to ask for.
   */
  it.each(PAIRS)(
    '%s → %s: never asks for a quantity already on the from side',
    (from, to) => {
      const { requiredAnyOf } = requiredInputs(membersOf(from), membersOf(to))
      for (const id of requiredAnyOf) {
        expect(membersOf(from)).not.toContain(id)
      }
    },
  )

  it.each(PAIRS)(
    '%s → %s: never asks for the whole target group, which would convert nothing',
    (from, to) => {
      const targets = membersOf(to)
      const { requiredAnyOf } = requiredInputs(membersOf(from), targets)
      for (const id of requiredAnyOf) {
        expect(targets.some((target) => target !== id)).toBe(true)
      }
    },
  )

  /**
   * Either arm's rate answers the same question, and CER is the one a paper
   * always reports. A form that demanded EER would look arbitrary.
   */
  it.each(PAIRS)('%s → %s: never demands EER', (from, to) => {
    expect(
      requiredInputs(membersOf(from), membersOf(to)).requiredAnyOf,
    ).not.toContain('eer')
  })
})

describe('the groups the owner specified', () => {
  /** Each listed candidate must appear in the derived group. */
  const EXPECTED: [Selection, Selection, Quantity[]][] = [
    ['rr', 'rates', ['cer']],
    ['rr', 'or', ['cer']],
    ['rr', 'smd', ['cer', 'or']],
    ['or', 'rates', ['cer']],
    ['or', 'rr', ['cer']],
    ['smd', 'rates', ['cer']],
    ['smd', 'rr', ['cer']],
  ]

  it.each(EXPECTED)('%s → %s requires any one of %o', (from, to, expected) => {
    const { requiredAnyOf } = requiredInputs(membersOf(from), membersOf(to))
    for (const id of expected) expect(requiredAnyOf).toContain(id)
  })

  /**
   * A ratio plus one arm's rate fixes the other arm. Asking for the other
   * ratio instead is the roundabout input this rule exists to remove.
   */
  it('asks a ratio for CER alone when the target is the event rates', () => {
    expect(requiredInputs(['or'], ['cer', 'eer']).requiredAnyOf).toEqual(['cer'])
    expect(requiredInputs(['rr'], ['cer', 'eer']).requiredAnyOf).toEqual(['cer'])
  })

  it('reaches EER from CER by the exact rule for each ratio', () => {
    const fromOr = solve(bag(['or', 'cer']), 'eer')
    expect(fromOr.resolved).toBe(true)
    expect(fromOr.routes[0].steps.map((step) => step.source)).toContain(
      'eer_from_cer_or',
    )

    const fromRr = solve(bag(['rr', 'cer']), 'eer')
    expect(fromRr.resolved).toBe(true)
    expect(fromRr.routes[0].steps.map((step) => step.source)).toContain(
      'eer_from_cer_rr',
    )
  })

  it('event rates in hand need nothing else', () => {
    for (const to of ['rr', 'or', 'smd'] as Selection[]) {
      expect(
        requiredInputs(membersOf('rates'), membersOf(to)).requiredAnyOf,
      ).toEqual([])
    }
  })

  it('OR ↔ SMD needs nothing extra in either direction', () => {
    expect(requiredInputs(['or'], ['smd'])).toEqual({
      from: ['or'],
      to: ['smd'],
      requiredAnyOf: [],
      unreachable: false,
    })
    expect(requiredInputs(['smd'], ['or'])).toEqual({
      from: ['smd'],
      to: ['or'],
      requiredAnyOf: [],
      unreachable: false,
    })
  })

  /**
   * Binary → binary is exact algebra. An SMD would also reach the target,
   * approximately, and offering it alongside the exact option would invite an
   * assumption the reader does not need.
   */
  it('never offers SMD as a way to complete an exact conversion', () => {
    for (const [from, to] of PAIRS) {
      if (from === 'smd' || to === 'smd') continue
      expect(
        requiredInputs(membersOf(from), membersOf(to)).requiredAnyOf,
      ).not.toContain('smd')
    }
  })

  it('matches the recorded groups', () => {
    const summary = PAIRS.map(([from, to]) => {
      const requirement = requiredInputs(membersOf(from), membersOf(to))
      const demanded = requirement.requiredAnyOf.join('|') || '—'
      return `${from} → ${to}: need any of ${demanded}`
    })
    expect(summary).toMatchInlineSnapshot(`
      [
        "rates → rr: need any of —",
        "rates → or: need any of —",
        "rates → smd: need any of —",
        "rr → rates: need any of cer",
        "rr → or: need any of cer",
        "rr → smd: need any of cer|or",
        "or → rates: need any of cer",
        "or → rr: need any of cer",
        "or → smd: need any of —",
        "smd → rates: need any of cer",
        "smd → rr: need any of cer",
        "smd → or: need any of —",
      ]
    `)
  })
})
