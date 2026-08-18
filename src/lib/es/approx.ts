import { fmtNumber } from './format'
import { QUANTITIES } from './quantities'
import { normQuantile } from './stats/normQuantile'
import { phi } from './stats/normal'
import type { Derivation, Quantity, Values } from './types'

/**
 * Cox's divisor. A literal, not π/√3 rounded: Cox proposed 1.65 as its own
 * constant, and 1.65 vs 1.8138 changes a converted d in the third decimal.
 */
export const COX_FACTOR = 1.65

/**
 * Hasselblad–Hedges / Chinn divisor. Also a literal. 1.81 is *close to*
 * π/√3 = 1.8138, the SD of the standard logistic, but the published method
 * is stated with 1.81 and meta-analyses report values computed with 1.81.
 * Replacing it with π/√3 silently shifts every result by ~0.2%.
 */
export const HH_FACTOR = 1.81

export type ApproxMethodId = 'cox' | 'hh' | 'probit'

/** What a method hands back when asked to invert an SMD. */
export interface Seeding {
  /** Quantities the SMD implies, ready to feed back through completeExact. */
  seed: Values
  substituted: string
  error?: string
  warnings?: string[]
}

export interface ApproxMethod {
  id: ApproxMethodId
  label: string
  /** Quantities that must be available before the method can run. */
  needs: Quantity[]
  /** The latent-variable assumption, stated as a sentence for the reader. */
  assumption: string
  /** Why the method needs what it needs, shown when the route is blocked. */
  blockedNote: string
  citations: string[]
  toSmdFormula: string
  fromSmdFormula: string
  toSmd(values: Values): Derivation
  /** Which quantity the inverse produces — used to explain the working. */
  seeds: Quantity
  fromSmd(smd: number, values?: Values): Seeding
}

function missingInputs(values: Values, needs: Quantity[]): Quantity[] {
  return needs.filter((id) => values[id] === undefined)
}

function needsError(needs: Quantity[]): string {
  return `Needs ${needs.map((id) => QUANTITIES[id].short).join(' and ')}.`
}

/** Shared body of the two logistic conversions; only the divisor differs. */
function logisticToSmd(values: Values, factor: number): Derivation {
  const missing = missingInputs(values, ['or'])
  if (missing.length > 0) {
    return { value: NaN, substituted: '', error: needsError(missing) }
  }
  const logOdds = Math.log(values.or!)
  const value = logOdds / factor
  if (!Number.isFinite(value)) {
    return {
      value: NaN,
      substituted: '',
      error: `OR = ${fmtNumber(values.or)} has no finite logarithm.`,
    }
  }
  return {
    value,
    substituted: `d = ln ${fmtNumber(values.or)} / ${factor} = ${fmtNumber(logOdds)} / ${factor} = ${fmtNumber(value)}`,
  }
}

function logisticFromSmd(smd: number, factor: number): Seeding {
  if (!Number.isFinite(smd)) {
    return { seed: {}, substituted: '', error: 'd must be a finite number.' }
  }
  const or = Math.exp(factor * smd)
  // exp overflows to Infinity near d ≈ 430 and underflows to 0 near d ≈ −430;
  // both are useless as a seed, so refuse rather than propagate them.
  if (!Number.isFinite(or) || or <= 0) {
    return {
      seed: {},
      substituted: '',
      error: `d = ${fmtNumber(smd)} implies exp(${factor} × ${fmtNumber(smd)}), which is outside the representable range for an odds ratio.`,
    }
  }
  return {
    seed: { or },
    substituted: `OR = exp(${factor} × ${fmtNumber(smd)}) = ${fmtNumber(or)}`,
  }
}

export const APPROX_METHODS: ApproxMethod[] = [
  {
    id: 'cox',
    label: 'Cox',
    needs: ['or'],
    assumption:
      'Logistic latent variable: the dichotomous outcome is a cut on an underlying logistic distribution. The divisor 1.65 is the constant Cox proposed, not the exact SD of that distribution.',
    blockedNote:
      'the logistic conversion is a function of the odds ratio alone.',
    citations: ['Cox 1970', 'Sánchez-Meca 2003'],
    toSmdFormula: 'd = ln(OR) / 1.65',
    fromSmdFormula: 'OR = exp(1.65 × d)',
    seeds: 'or',
    toSmd: (values) => logisticToSmd(values, COX_FACTOR),
    fromSmd: (smd) => logisticFromSmd(smd, COX_FACTOR),
  },
  {
    id: 'hh',
    label: 'Hasselblad–Hedges (Chinn)',
    needs: ['or'],
    assumption:
      'Logistic latent variable: the dichotomous outcome is a cut on an underlying logistic distribution. 1.81 ≈ π/√3, the SD of the standard logistic.',
    blockedNote:
      'the logistic conversion is a function of the odds ratio alone.',
    citations: ['Hasselblad 1995', 'Chinn 2000', 'Sánchez-Meca 2003'],
    toSmdFormula: 'd = ln(OR) / 1.81',
    fromSmdFormula: 'OR = exp(1.81 × d)',
    seeds: 'or',
    toSmd: (values) => logisticToSmd(values, HH_FACTOR),
    fromSmd: (smd) => logisticFromSmd(smd, HH_FACTOR),
  },
  {
    id: 'probit',
    label: 'Probit',
    needs: ['cer', 'eer'],
    assumption:
      'Normal latent variable with equal variances in both arms: each event rate is the tail of the same normal distribution, cut at a different point.',
    blockedNote:
      'the probit index depends on the absolute event rates, not just the odds ratio.',
    citations: ['Sánchez-Meca 2003'],
    toSmdFormula: 'd = Φ⁻¹(EER) − Φ⁻¹(CER)',
    fromSmdFormula: 'EER = Φ(Φ⁻¹(CER) + d)',
    seeds: 'eer',
    toSmd: (values) => {
      const missing = missingInputs(values, ['cer', 'eer'])
      if (missing.length > 0) {
        return { value: NaN, substituted: '', error: needsError(missing) }
      }
      const zControl = normQuantile(values.cer!)
      const zExperimental = normQuantile(values.eer!)
      const value = zExperimental - zControl
      if (!Number.isFinite(value)) {
        return {
          value: NaN,
          substituted: '',
          error:
            'Event rates of exactly 0 or 1 have infinite probits, so no finite d exists.',
        }
      }
      return {
        value,
        substituted: `d = Φ⁻¹(${fmtNumber(values.eer)}) − Φ⁻¹(${fmtNumber(values.cer)}) = ${fmtNumber(zExperimental)} − (${fmtNumber(zControl)}) = ${fmtNumber(value)}`,
      }
    },
    fromSmd: (smd, values = {}) => {
      if (!Number.isFinite(smd)) {
        return { seed: {}, substituted: '', error: 'd must be a finite number.' }
      }
      if (values.cer === undefined) {
        return { seed: {}, substituted: '', error: needsError(['cer']) }
      }
      const zControl = normQuantile(values.cer)
      const eer = phi(zControl + smd)
      if (!(eer > 0 && eer < 1)) {
        return {
          seed: {},
          substituted: '',
          error: `CER = ${fmtNumber(values.cer)} shifted by d = ${fmtNumber(smd)} lands on an experimental event rate of ${fmtNumber(eer)}, which is not a rate.`,
        }
      }
      return {
        seed: { eer },
        substituted: `EER = Φ(Φ⁻¹(${fmtNumber(values.cer)}) + ${fmtNumber(smd)}) = Φ(${fmtNumber(zControl + smd)}) = ${fmtNumber(eer)}`,
      }
    },
  },
]

const METHODS_BY_ID = new Map<string, ApproxMethod>(
  APPROX_METHODS.map((method) => [method.id, method]),
)

export function methodById(id: string): ApproxMethod | undefined {
  return METHODS_BY_ID.get(id)
}
