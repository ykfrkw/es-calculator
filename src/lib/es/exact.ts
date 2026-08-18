import { fmtNumber } from './format'
import { QUANTITIES, validateQuantity } from './quantities'
import { expit, logit } from './stats/normal'
import type { Derivation, EsError, Quantity, Step, Values } from './types'

/** Why a rule refused. Tests assert on the code, not on the prose. */
export type ExactErrorCode =
  | 'missing'
  | 'domain'
  | 'indeterminate'
  | 'inconsistent'
  | 'boundary'
  | 'incompatible'

export interface ExactDerivation extends Derivation {
  code?: ExactErrorCode
}

export interface ExactRule {
  id: string
  requires: Quantity[]
  produces: Quantity
  /** Generic form shown above the substituted line. */
  formula: string
  apply(values: Values): ExactDerivation
}

/**
 * Recovering CER from OR and RR is a difference of two nearly equal numbers
 * as OR → 1. Inside this band the expression is float noise, so the guards
 * answer from the algebra instead of from the arithmetic.
 */
const UNIT_EPSILON = 1e-9

function failed(
  code: ExactErrorCode,
  error: string,
  substituted = '',
): ExactDerivation {
  return { value: NaN, substituted, error, code }
}

export const EXACT_RULES: ExactRule[] = [
  {
    id: 'rr_from_rates',
    requires: ['cer', 'eer'],
    produces: 'rr',
    formula: 'RR = EER / CER',
    apply: ({ cer, eer }) => {
      const value = eer! / cer!
      return {
        value,
        substituted: `RR = ${fmtNumber(eer)} / ${fmtNumber(cer)} = ${fmtNumber(value)}`,
      }
    },
  },
  {
    id: 'or_from_rates',
    requires: ['cer', 'eer'],
    produces: 'or',
    formula: 'OR = EER(1 − CER) / (CER(1 − EER))',
    apply: ({ cer, eer }) => {
      const value = (eer! * (1 - cer!)) / (cer! * (1 - eer!))
      return {
        value,
        substituted: `OR = ${fmtNumber(eer)} × ${fmtNumber(1 - cer!)} / (${fmtNumber(cer)} × ${fmtNumber(1 - eer!)}) = ${fmtNumber(value)}`,
      }
    },
  },
  {
    id: 'eer_from_cer_or',
    requires: ['cer', 'or'],
    produces: 'eer',
    // Algebraically EER = OR·CER / (1 − CER + OR·CER); going through the logit
    // keeps both tails accurate instead of cancelling near CER = 1.
    formula: 'EER = expit(logit(CER) + ln OR)',
    apply: ({ cer, or }) => {
      const logOdds = logit(cer!) + Math.log(or!)
      const value = expit(logOdds)
      if (!(value > 0 && value < 1)) {
        return failed(
          'domain',
          `OR = ${fmtNumber(or)} with CER = ${fmtNumber(cer)} implies an experimental event rate of ${fmtNumber(value)}, which is not a rate.`,
        )
      }
      return {
        value,
        substituted: `EER = expit(logit(${fmtNumber(cer)}) + ln ${fmtNumber(or)}) = expit(${fmtNumber(logOdds)}) = ${fmtNumber(value)}`,
      }
    },
  },
  {
    id: 'eer_from_cer_rr',
    requires: ['cer', 'rr'],
    produces: 'eer',
    formula: 'EER = RR × CER',
    apply: ({ cer, rr }) => {
      const value = rr! * cer!
      if (value >= 1) {
        const largest = 1 / cer!
        return failed(
          'domain',
          `RR × CER = ${fmtNumber(value)}, but an event rate cannot reach 1. With CER = ${fmtNumber(cer)} the risk ratio has to stay below ${fmtNumber(largest)}.`,
        )
      }
      return {
        value,
        substituted: `EER = ${fmtNumber(rr)} × ${fmtNumber(cer)} = ${fmtNumber(value)}`,
      }
    },
  },
  {
    id: 'cer_from_eer_rr',
    requires: ['eer', 'rr'],
    produces: 'cer',
    formula: 'CER = EER / RR',
    apply: ({ eer, rr }) => {
      const value = eer! / rr!
      if (value >= 1) {
        return failed(
          'domain',
          `EER / RR = ${fmtNumber(value)}, but an event rate cannot reach 1. With EER = ${fmtNumber(eer)} the risk ratio has to stay above ${fmtNumber(eer)}.`,
        )
      }
      return {
        value,
        substituted: `CER = ${fmtNumber(eer)} / ${fmtNumber(rr)} = ${fmtNumber(value)}`,
      }
    },
  },
  {
    id: 'cer_from_eer_or',
    requires: ['eer', 'or'],
    produces: 'cer',
    formula: 'CER = EER / ((1 − EER)·OR + EER)',
    apply: ({ eer, or }) => {
      const denominator = (1 - eer!) * or! + eer!
      const value = eer! / denominator
      if (!(value > 0 && value < 1)) {
        return failed(
          'domain',
          `OR = ${fmtNumber(or)} with EER = ${fmtNumber(eer)} implies a control event rate of ${fmtNumber(value)}, which is not a rate.`,
        )
      }
      return {
        value,
        substituted: `CER = ${fmtNumber(eer)} / ((1 − ${fmtNumber(eer)}) × ${fmtNumber(or)} + ${fmtNumber(eer)}) = ${fmtNumber(value)}`,
      }
    },
  },
  {
    id: 'cer_from_or_rr',
    requires: ['or', 'rr'],
    produces: 'cer',
    formula: 'CER = (OR − RR) / (RR·(OR − 1))',
    apply: ({ or, rr }) => {
      const orOffset = or! - 1
      const rrOffset = rr! - 1

      if (Math.abs(orOffset) < UNIT_EPSILON && Math.abs(rrOffset) < UNIT_EPSILON) {
        return failed(
          'indeterminate',
          'OR = 1 and RR = 1 both say the event is equally likely in the two arms. Every control event rate between 0 and 1 is consistent with that pair, so CER cannot be recovered — enter CER or EER directly.',
        )
      }
      if (Math.abs(orOffset) < UNIT_EPSILON) {
        return failed(
          'inconsistent',
          `OR = 1 means the two arms have identical odds, which forces RR = 1. RR = ${fmtNumber(rr)} contradicts that, so no control event rate fits both.`,
        )
      }
      if (Math.abs(rrOffset) < UNIT_EPSILON) {
        return failed(
          'inconsistent',
          `RR = 1 means the two arms have identical risks, which forces OR = 1. OR = ${fmtNumber(or)} contradicts that: the algebra formally returns CER = 1, which is a boundary rather than an answer.`,
        )
      }

      const value = (or! - rr!) / (rr! * orOffset)
      if (!(value > 0 && value < 1)) {
        return failed(
          'incompatible',
          `An odds ratio is always further from 1 than the corresponding risk ratio; OR = ${fmtNumber(or)} and RR = ${fmtNumber(rr)} are not compatible with any control event rate between 0 and 1.`,
        )
      }
      return {
        value,
        substituted: `CER = (${fmtNumber(or)} − ${fmtNumber(rr)}) / (${fmtNumber(rr)} × (${fmtNumber(or)} − 1)) = ${fmtNumber(value)}`,
      }
    },
  },
]

const RULES_BY_ID = new Map(EXACT_RULES.map((rule) => [rule.id, rule]))

export function ruleById(id: string): ExactRule | undefined {
  return RULES_BY_ID.get(id)
}

export interface ExactResult {
  /** Supplied values plus everything derivable from them. */
  values: Values
  steps: Step[]
  errors: EsError[]
  warnings: string[]
}

/**
 * Apply the rules to a fixpoint.
 *
 * Every rule is attempted at most once, which both terminates the loop and
 * keeps a failed rule from re-reporting its error on each pass.
 */
export function completeExact(known: Values): ExactResult {
  const values: Values = {}
  const errors: EsError[] = []
  const warnings: string[] = []

  for (const [id, value] of Object.entries(known) as [Quantity, number][]) {
    if (value === undefined) continue
    const check = validateQuantity(id, value)
    warnings.push(...check.warnings)
    if (!check.ok) {
      errors.push({ quantity: id, message: check.error! })
      continue
    }
    values[id] = value
  }

  const steps: Step[] = []
  const attempted = new Set<string>()

  let progressed = true
  while (progressed) {
    progressed = false
    for (const rule of EXACT_RULES) {
      if (attempted.has(rule.id)) continue
      if (values[rule.produces] !== undefined) continue
      if (!rule.requires.every((id) => values[id] !== undefined)) continue

      attempted.add(rule.id)
      const outcome = rule.apply(values)

      if (outcome.error !== undefined || !Number.isFinite(outcome.value)) {
        errors.push({
          quantity: rule.produces,
          source: rule.id,
          message:
            outcome.error ??
            `${QUANTITIES[rule.produces].short} could not be computed from ${rule.requires.map((id) => QUANTITIES[id].short).join(' and ')}.`,
        })
        continue
      }

      // A rule can be algebraically fine and still land outside the domain;
      // the validator is the last gate before a bad value spreads.
      const check = validateQuantity(rule.produces, outcome.value)
      if (!check.ok) {
        errors.push({
          quantity: rule.produces,
          source: rule.id,
          message: check.error!,
        })
        continue
      }
      warnings.push(...check.warnings, ...(outcome.warnings ?? []))

      values[rule.produces] = outcome.value
      steps.push({
        source: rule.id,
        kind: 'exact',
        produces: rule.produces,
        formula: rule.formula,
        substituted: outcome.substituted,
        value: outcome.value,
      })
      progressed = true
    }
  }

  return { values, steps, errors, warnings }
}

/**
 * Which quantities are reachable from a set of ids, ignoring the numbers.
 *
 * Used to answer "what else would the reader have to type?" — a numeric
 * probe would answer "nothing helps" whenever the probe value happened to
 * contradict what was already entered.
 */
export function symbolicClosure(ids: Quantity[]): Set<Quantity> {
  const present = new Set<Quantity>(ids)
  let progressed = true
  while (progressed) {
    progressed = false
    for (const rule of EXACT_RULES) {
      if (present.has(rule.produces)) continue
      if (!rule.requires.every((id) => present.has(id))) continue
      present.add(rule.produces)
      progressed = true
    }
  }
  return present
}

/**
 * The steps that actually fed a target, in derivation order — the working a
 * reader should see, without the incidental derivations alongside it.
 */
export function traceSteps(steps: Step[], target: Quantity): Step[] {
  const byProduct = new Map(steps.map((step) => [step.produces, step]))
  const needed: Step[] = []
  const seen = new Set<Quantity>()

  const walk = (id: Quantity): void => {
    if (seen.has(id)) return
    seen.add(id)
    const step = byProduct.get(id)
    if (!step) return
    const rule = RULES_BY_ID.get(step.source)
    for (const requirement of rule?.requires ?? []) walk(requirement)
    needed.push(step)
  }

  walk(target)
  return steps.filter((step) => needed.includes(step))
}
